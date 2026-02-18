import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { database, auth } from "../config/firebaseConfig.js";
import { showAlert, escapeHtml } from "../utils/uiHelpers.js";

export function createSessionCard(session, otherUser, currentUid) {
    const container = document.createElement("div");
    container.className = "bg-white/3 border border-white/10 rounded-lg p-4 flex justify-between items-start";

    const isCurrentTeacher = (currentUid === session.teacher);
    const roleLabel = isCurrentTeacher ? 'Teaching:' : 'Learning:';

    const teacherName = session.teacherName || (session.teacher === otherUser?.uid ? otherUser.name : null);
    const learnerName = session.learnerName || (session.learner === otherUser?.uid ? otherUser.name : null);

    const roleName = isCurrentTeacher
        ? (learnerName || (otherUser && otherUser.uid === session.learner ? otherUser.name : 'Learner'))
        : (teacherName || (otherUser && otherUser.uid === session.teacher ? otherUser.name : 'Teacher'));

    const contact = isCurrentTeacher
        ? (session.learnerEmail || otherUser?.email || session.contact || '—')
        : (session.teacherEmail || otherUser?.email || session.contact || '—');

    const teacherRated = !!session.teacherRated;
    const learnerRated = !!session.learnerRated;

    const reviewerHasRated = (currentUid === session.teacher) ? teacherRated : learnerRated;
    const partnerHasRated = (currentUid === session.teacher) ? learnerRated : teacherRated;

    const left = document.createElement("div");
    left.innerHTML = `
    <div class="text-lg font-semibold">${escapeHtml(session.skill || '')}</div>
    <div class="text-sm text-gray-300">${escapeHtml(roleLabel)} ${escapeHtml(roleName || '')}</div>
    <div class="text-sm text-gray-400">Contact: ${escapeHtml(contact)}</div>
  `;

    const right = document.createElement("div");
    right.className = "flex gap-2 items-center";

    const statusBtn = document.createElement("button");
    statusBtn.className = "px-3 py-1 rounded-md bg-black/80 text-white text-sm";
    statusBtn.textContent = (session.status || 'active');
    right.appendChild(statusBtn);

    if (session.status === 'active' || session.status === 'accepted' || session.status === 'completed') {
        const chatBtn = document.createElement("button");
        chatBtn.className = "px-3 py-1 rounded-md border border-white/20 text-sm";
        chatBtn.textContent = "Chat";
        chatBtn.onclick = () => {
            const sid = session.id || session.sessionId;
            if (sid) window.location.href = `chat.html?sessionId=${sid}`;
            else showAlert('Session id missing.');
        };
        right.appendChild(chatBtn);
    }

    // ✅ FIXED: Check if already rated
    if (!reviewerHasRated) {
        const rateBtn = document.createElement("button");
        rateBtn.className = "px-3 py-1 rounded-md bg-primary text-white text-sm";
        rateBtn.textContent = "Rate partner";
        rateBtn.onclick = async () => {
            const sid = session.id || session.sessionId;
            if (!sid) { await showAlert('Session id missing.'); return; }

            // ✅ CHECK IF ALREADY RATED (prevent duplicates)
            const feedbackId = `${sid}_${currentUid}`;
            const fbRef = ref(database, `feedbacks/${feedbackId}`);
            const fbSnap = await get(fbRef);

            if (fbSnap.exists()) {
                await showAlert('You have already rated this session.', 'Already Rated');
                return;
            }

            const otherUid = (session.teacher === currentUid) ? session.learner : session.teacher;
            const otherName = (otherUid === session.teacher ? (session.teacherName || '') : (session.learnerName || 'Participant')) || 'Participant';

            const { openRatingModal } = await import("./ratingService.js");
            openRatingModal(sid, otherUid, otherName);
        };
        right.appendChild(rateBtn);
    } else {
        // ✅ SHOW RATED STATUS
        const doneBtn = document.createElement("button");
        doneBtn.className = "px-3 py-1 rounded-md border border-white/20 text-sm text-gray-300";
        doneBtn.textContent = "✓ Rated";
        doneBtn.disabled = true;
        right.appendChild(doneBtn);

        // ✅ IF PARTNER HASN'T RATED, SHOW WAITING STATUS
        if (!partnerHasRated) {
            const waitBadge = document.createElement("div");
            waitBadge.className = "text-xs text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded-md";
            waitBadge.textContent = "⏳ Waiting for partner to rate";
            right.appendChild(waitBadge);
        }
    }

    container.appendChild(left);
    container.appendChild(right);
    return container;
}