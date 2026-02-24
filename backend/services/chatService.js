import { ref, get, push, set, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { database, auth } from "../config/firebaseConfig.js";
import { showAlert, linkify, escapeHtml, setText } from "../utils/uiHelpers.js";
import { isConnected } from "./userService.js";

// ================= CHAT SERVICE =================

export function appendMessageToList(msg, currentUid) {
    const list = document.getElementById("messagesList");
    if (!list || !msg) return;

    // Remove empty state if present
    const emptyState = list.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const isSent = msg.from === currentUid;
    const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = isSent ? 'flex-end' : 'flex-start';

    const bubble = document.createElement('div');
    bubble.className = isSent ? 'msg-sent' : 'msg-received';
    bubble.innerHTML = linkify(msg.text || '');

    const meta = document.createElement('div');
    meta.className = 'msg-time';
    meta.style.paddingLeft = isSent ? '0' : '4px';
    meta.style.paddingRight = isSent ? '4px' : '0';
    meta.textContent = time;

    wrapper.appendChild(bubble);
    wrapper.appendChild(meta);
    list.appendChild(wrapper);
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

        const initial = name ? name[0].toUpperCase() : '?';
        titleEl.innerHTML = `
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#006064] to-[#FF7F50] flex items-center justify-center font-bold text-white text-sm flex-shrink-0">${initial}</div>
            <div>
              <div class="font-semibold text-white text-base">Chat with ${escapeHtml(name)}</div>
              <div class="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                <span class="online-dot"></span>
                <span>Contact: ${escapeHtml(finalEmail)}</span>
              </div>
            </div>
          </div>
        `;
    } catch (e) {
        console.error('populateChatHeader error', e);
    }
}