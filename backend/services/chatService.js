
import { ref, get, push, set, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { database, auth } from "../config/firebaseConfig.js";
import { showAlert, linkify, escapeHtml, setText } from "../utils/uiHelpers.js";
import { isConnected } from "./userService.js";

// ================= CHAT SERVICE =================

export function appendMessageToList(msg, currentUid) {
    const list = document.getElementById("messagesList");
    if (!list || !msg) return;

    const item = document.createElement('div');
    item.className = `mb-2 ${msg.from === currentUid ? 'text-right' : 'text-left'}`;

    const bubble = document.createElement('div');
    bubble.className = `${msg.from === currentUid ? 'inline-block bg-primary text-white px-3 py-1 rounded-md' : 'inline-block bg-white/5 px-3 py-1 rounded-md'}`;
    bubble.innerHTML = linkify(msg.text || '');

    const meta = document.createElement('div');
    meta.className = 'text-xs text-gray-400 mt-1';
    const time = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : '';
    meta.textContent = time;

    item.appendChild(bubble);
    item.appendChild(meta);
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
}

export function listenToChat(sessionId, currentUid) {
    const list = document.getElementById("messagesList");
    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendMessageBtn");
    if (!list) return;

    const messagesRef = ref(database, `chats/${sessionId}/messages`);
    onChildAdded(messagesRef, (snap) => {
        const msg = snap.val();
        appendMessageToList(msg, currentUid);
    });

    if (sendBtn) {
        sendBtn.onclick = async () => {
            const text = input.value.trim();
            if (!text) return;
            try {
                const msgRef = push(ref(database, `chats/${sessionId}/messages`));
                await set(msgRef, {
                    from: currentUid,
                    text: text,
                    createdAt: Date.now()
                });
                input.value = '';
            } catch (e) {
                console.error("Failed to send message", e);
                await showAlert("Failed to send message");
            }
        };
    }
}

export async function populateChatHeader(sessionId, currentUid) {
    try {
        const titleEl = document.getElementById("chatTitle");
        if (!titleEl) return;

        const snap = await get(ref(database, `sessions/${sessionId}`));
        if (!snap.exists()) {
            titleEl.textContent = 'Chat';
            return;
        }
        const s = snap.val();

        // Determine other participant
        const otherUid = (s.teacher === currentUid) ? s.learner : s.teacher;

        // Prefer session-stored info
        const name = (otherUid === s.teacher ? (s.teacherName || '') : (s.learnerName || 'Participant')) || 'Participant';
        const email = (otherUid === s.teacher ? (s.teacherEmail || '') : (s.learnerEmail || '')) || '—';

        // If the session didn't store emails (older sessions), try to fetch user record
        let finalEmail = email;
        if ((!finalEmail || finalEmail === '') && otherUid) {
            const otherSnap = await get(ref(database, `users/${otherUid}`));
            if (otherSnap.exists()) {
                const otherData = otherSnap.val();
                const connected = await isConnected(currentUid, otherUid);
                if (connected) finalEmail = otherData.email || '—';
            }
        }

        titleEl.innerHTML = `
      <div class="font-semibold text-xl">Chat with ${escapeHtml(name)}</div>
      <div class="text-sm text-gray-400 mt-1">Contact: ${escapeHtml(finalEmail)}</div>
    `;
    } catch (e) {
        console.error('populateChatHeader error', e);
    }
}
