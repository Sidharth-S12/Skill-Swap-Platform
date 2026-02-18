import { ref, get, update, push, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { database, auth } from "../config/firebaseConfig.js";
import { setText, makeTag, el, escapeHtml, showAlert, showConfirm } from "../utils/uiHelpers.js";
import { splitSkills } from "../utils/validators.js";

// ================= REQUEST MODAL =================
let requestModalExists = false;
let currentModalMentor = null;
let requestModalState = { isSubmitting: false };

export function ensureRequestModal() {
    if (requestModalExists) return;
    requestModalExists = true;

    const modalHtml = `
    <div id="requestOverlay" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 hidden">
      <div class="bg-[#020617] text-gray-200 rounded-lg w-full max-w-lg p-6 border border-white/10 relative">
        <button id="requestCloseBtn" class="absolute right-4 top-4 text-gray-400">✕</button>
        <h3 class="text-lg font-semibold mb-4" id="requestModalTitle">Send Learning Request</h3>

        <label class="text-sm text-gray-400">Skill to Learn *</label>
        <input id="requestSkillInput" class="w-full px-3 py-2 rounded-md border border-white/10 mt-1 mb-3 bg-[#020617] text-gray-200" placeholder="e.g. Python Programming" />

        <label class="text-sm text-gray-400">Message *</label>
        <textarea id="requestMessageInput" rows="5" class="w-full px-3 py-2 rounded-md border border-white/10 mt-1 mb-4 bg-[#020617] text-gray-200" placeholder="Tell them why you want to learn this skill..."></textarea>

        <div class="flex justify-end gap-3">
          <button id="requestCancelBtn" class="px-4 py-2 rounded-md border border-white/10">Cancel</button>
          <button id="requestSendBtn" class="px-4 py-2 rounded-md bg-black text-white">Send Request</button>
        </div>
      </div>
    </div>
  `;
    document.body.insertBefore(el(modalHtml), document.body.firstChild);

    document.getElementById('requestCloseBtn').addEventListener('click', closeRequestModal, false);
    document.getElementById('requestCancelBtn').addEventListener('click', closeRequestModal, false);

    const sendBtn = document.getElementById('requestSendBtn');
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    newSendBtn.addEventListener('click', handleRequestSendClick, false);
}

export function openRequestModal(mentor) {
    ensureRequestModal();
    currentModalMentor = mentor;
    requestModalState.isSubmitting = false;

    const overlay = document.getElementById('requestOverlay');
    const title = document.getElementById('requestModalTitle');
    const skillInput = document.getElementById('requestSkillInput');
    const msgInput = document.getElementById('requestMessageInput');

    title.textContent = `Send Learning Request to ${mentor.name || mentor.email || 'mentor'}`;
    skillInput.value = '';
    msgInput.value = '';

    const offers = splitSkills(mentor.offer);
    if (offers.length === 1) {
        skillInput.value = offers[0];
    }

    if (!skillInput.value) {
        skillInput.placeholder = offers.length ? offers.join(', ') : 'e.g. Python Programming';
    }

    overlay.classList.remove('hidden');
}

export function closeRequestModal() {
    const overlay = document.getElementById('requestOverlay');
    if (!overlay) return;
    overlay.classList.add('hidden');

    const skillInput = document.getElementById('requestSkillInput');
    const msgInput = document.getElementById('requestMessageInput');
    if (skillInput) skillInput.value = '';
    if (msgInput) msgInput.value = '';

    currentModalMentor = null;
    requestModalState.isSubmitting = false;
}

export async function handleRequestSendClick(event) {
    event.preventDefault();
    if (requestModalState.isSubmitting) return;

    requestModalState.isSubmitting = true;

    try {
        const skillInput = document.getElementById('requestSkillInput');
        const msgInput = document.getElementById('requestMessageInput');

        const skill = skillInput.value.trim();
        const note = msgInput.value.trim();

        if (!skill) {
            await showAlert('Please enter the skill you want to learn.', 'Missing skill');
            requestModalState.isSubmitting = false;
            return;
        }

        if (!note) {
            const ok = await showConfirm('Send without a message?', 'No message provided', 'Send', 'Cancel');
            if (!ok) {
                requestModalState.isSubmitting = false;
                return;
            }
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
            await showAlert('Not authenticated.');
            closeRequestModal();
            requestModalState.isSubmitting = false;
            return;
        }

        if (!currentModalMentor) {
            await showAlert('Mentor information missing.');
            requestModalState.isSubmitting = false;
            return;
        }

        const reqRef = push(ref(database, "requests"));
        await set(reqRef, {
            from: currentUser.uid,
            to: currentModalMentor.uid,
            skill: skill,
            note: note,
            status: "pending",
            createdAt: Date.now()
        });

        closeRequestModal();
        await showAlert('Request sent successfully!', 'Success');

        try {
            const { populateRequestsPage } = await import('./requestService.js');
            const { populateDashboardFor, populateBrowsePage } = await import('./userService.js');
            if (window.location.pathname.includes('view-requests.html')) {
                await populateRequestsPage(currentUser.uid);
            }
            if (window.location.pathname.includes('home.html')) {
                await populateDashboardFor(currentUser.uid, currentUser.email, currentUser);
            }
            if (window.location.pathname.includes('browse.html')) {
                await populateBrowsePage(currentUser.uid);
            }
        } catch (refreshErr) {
            console.warn('Backend refresh warning:', refreshErr);
        }

    } catch (err) {
        console.error('Error in handleRequestSendClick:', err);
        await showAlert('Failed to send request. Please try again.', 'Error');
    } finally {
        requestModalState.isSubmitting = false;
    }
}

// ================= REQUESTS PAGE =================

export async function populateRequestsPage(currentUid) {
    try {
        const receivedContainer = document.getElementById("receivedRequests");
        const sentContainer = document.getElementById("sentRequests");

        if (receivedContainer) receivedContainer.innerHTML = '<p class="text-gray-400">Loading…</p>';
        if (sentContainer) sentContainer.innerHTML = '<p class="text-gray-400">Loading…</p>';

        const requestsSnap = await get(ref(database, "requests"));
        let requests = [];
        if (requestsSnap.exists()) requests = Object.entries(requestsSnap.val()).map(([id, r]) => ({ id, ...r }));

        const received = requests.filter(r => r.to === currentUid && r.status !== 'canceled');
        const sent = requests.filter(r => r.from === currentUid && r.status !== 'canceled');

        if (receivedContainer) {
            receivedContainer.innerHTML = '';
            if (received.length === 0) receivedContainer.innerHTML = '<p class="text-gray-400">No requests received.</p>';
            for (const r of received) {
                const fromSnap = await get(ref(database, "users/" + r.from));
                const fromUser = fromSnap.exists() ? fromSnap.val() : { name: 'Unknown', email: '—' };

                const card = document.createElement('div');
                card.className = 'bg-white/5 border border-white/10 rounded-md p-4 mb-3';
                card.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <div class="font-semibold">${escapeHtml(fromUser.name || fromUser.email || 'User')}</div>
              <div class="text-sm text-gray-400">Skill: ${escapeHtml(r.skill || '—')}</div>
              <div class="text-sm text-gray-400 mt-2">Note: ${r.note ? escapeHtml(r.note) : '—'}</div>
              <div class="text-sm text-gray-400 mt-2">Status: ${escapeHtml(r.status)}</div>
            </div>
            <div class="flex flex-col gap-2">
              ${r.status === 'pending' ? `<button class="acceptBtn px-3 py-1 bg-primary text-white rounded-md" data-id="${r.id}">Accept</button>` : ''}
              ${r.status === 'pending' ? `<button class="rejectBtn px-3 py-1 border border-white/20 rounded-md" data-id="${r.id}">Reject</button>` : ''}
              ${r.status === 'accepted' && r.sessionId ? `<a class="chatBtn px-3 py-1 bg-primary text-white rounded-md" href="chat.html?sessionId=${r.sessionId}">Chat</a>` : ''}
            </div>
          </div>
        `;
                receivedContainer.appendChild(card);
            }
        }

        if (sentContainer) {
            sentContainer.innerHTML = '';
            if (sent.length === 0) sentContainer.innerHTML = '<p class="text-gray-400">No requests sent.</p>';
            for (const r of sent) {
                const toSnap = await get(ref(database, "users/" + r.to));
                const toUser = toSnap.exists() ? toSnap.val() : { name: 'Unknown' };

                const card = document.createElement('div');
                card.className = 'bg-white/5 border border-white/10 rounded-md p-4 mb-3 relative';
                card.innerHTML = `
          <div>
            <div class="font-semibold">${escapeHtml(toUser.name || 'User')}</div>
            <div class="text-sm text-gray-400">Skill: ${escapeHtml(r.skill || '—')}</div>
            <div class="text-sm text-gray-400 mt-2">Note: ${r.note ? escapeHtml(r.note) : '—'}</div>
            <div class="text-sm text-gray-400 mt-2">Status: ${escapeHtml(r.status)}</div>
          </div>
          ${r.status === 'accepted' && r.sessionId ? `<a class="chatBtn absolute right-4 bottom-4 px-3 py-1 bg-primary text-white rounded-md" href="chat.html?sessionId=${r.sessionId}">Chat</a>` : ''}
        `;
                if (r.status === 'pending') {
                    const cancelBtnHtml = `<button class="cancelBtn absolute right-4 top-4 px-3 py-1 rounded-md border" data-id="${r.id}">Cancel</button>`;
                    card.insertAdjacentHTML('beforeend', cancelBtnHtml);
                }
                sentContainer.appendChild(card);

                if (r.status === 'pending') {
                    const cancelBtn = card.querySelector('.cancelBtn');
                    if (cancelBtn) {
                        cancelBtn.onclick = async () => {
                            const ok = await showConfirm('Do you really want to cancel this request?', 'Cancel request', 'Yes, cancel', 'Keep');
                            if (!ok) return;
                            try {
                                await update(ref(database, 'requests/' + r.id), { status: 'canceled', canceledAt: Date.now() });
                                await showAlert('Request canceled.', 'Canceled');
                                await populateRequestsPage(currentUid);
                                const { populateDashboardFor, populateBrowsePage } = await import('./userService.js');
                                await populateDashboardFor(currentUid, auth.currentUser?.email, auth.currentUser);
                                if (window.location.pathname.includes('browse.html')) {
                                    await populateBrowsePage(currentUid);
                                }
                            } catch (err) {
                                console.error('Cancel failed', err);
                                await showAlert('Failed to cancel request.');
                            }
                        };
                    }
                }
            }
        }

        document.querySelectorAll('.acceptBtn').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                if (!id) return;
                const requestSnap = await get(ref(database, "requests/" + id));
                if (!requestSnap.exists()) { await showAlert('Request not found'); return; }
                const r = requestSnap.val();

                const ok = await showConfirm('Accept this request and start a session?', 'Accept request', 'Accept', 'Cancel');
                if (!ok) return;

                try {
                    const teacherUid = r.to;
                    const learnerUid = r.from;

                    const [teacherSnap, learnerSnap] = await Promise.all([
                        get(ref(database, `users/${teacherUid}`)),
                        get(ref(database, `users/${learnerUid}`))
                    ]);

                    const teacherData = teacherSnap.exists() ? teacherSnap.val() : {};
                    const learnerData = learnerSnap.exists() ? learnerSnap.val() : {};

                    // create session
                    const sessRef = push(ref(database, "sessions"));
                    const sessionObj = {
                        teacher: teacherUid,
                        learner: learnerUid,
                        skill: r.skill || '',
                        status: 'active',
                        createdAt: Date.now(),
                        teacherName: teacherData.name || '',
                        teacherEmail: teacherData.email || '',
                        learnerName: learnerData.name || '',
                        learnerEmail: learnerData.email || '',
                        teacherRated: false,
                        learnerRated: false
                    };
                    await set(sessRef, sessionObj);

                    await update(ref(database, "requests/" + id), {
                        status: 'accepted',
                        acceptedAt: Date.now(),
                        sessionId: sessRef.key
                    });

                    await showAlert('Request accepted. Session created.', 'Accepted');

                    await populateRequestsPage(auth.currentUser.uid);
                    const { populateDashboardFor: refreshDash } = await import('./userService.js');
                    await refreshDash(auth.currentUser.uid, auth.currentUser.email, auth.currentUser);
                } catch (err) {
                    console.error('Accept failed', err);
                    await showAlert('Failed to accept request. Try again.');
                }
            };
        });

        document.querySelectorAll('.rejectBtn').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                if (!id) return;
                const ok = await showConfirm('Reject this request?', 'Reject request', 'Reject', 'Cancel');
                if (!ok) return;
                try {
                    await update(ref(database, "requests/" + id), { status: 'rejected', respondedAt: Date.now() });
                    await showAlert('Request rejected.', 'Rejected');
                    await populateRequestsPage(auth.currentUser.uid);
                    const { populateDashboardFor: refreshDash2 } = await import('./userService.js');
                    await refreshDash2(auth.currentUser.uid, auth.currentUser.email, auth.currentUser);
                } catch (err) {
                    console.error('Reject failed', err);
                    await showAlert('Failed to reject request. Try again.');
                }
            };
        });

    } catch (err) {
        console.error("Error populating requests page:", err);
    }
}

// ================= MENTOR CARD =================
export function createMentorCard(mentor, currentUid) {
    const card = document.createElement('div');
    card.className = "bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start";

    const left = document.createElement('div');
    left.className = "flex-1";

    const name = document.createElement('div');
    name.className = "font-semibold text-lg";
    name.textContent = mentor.name || 'Unnamed';

    const email = document.createElement('div');
    email.className = "text-gray-400 text-sm mt-1";
    email.textContent = 'Email: —';

    const meta = document.createElement('div');
    meta.className = "text-sm text-gray-400 mt-2";
    const avgRating = (mentor.avgRating !== undefined && mentor.avgRating !== null) ? mentor.avgRating : 0;
    const totalRatings = mentor.totalRatings || 0;
    meta.textContent = `Rating: ${avgRating > 0 ? avgRating.toFixed(1) : 'N/A'} · Sessions: ${totalRatings}`;

    const teachDiv = document.createElement('div');
    teachDiv.className = "flex flex-wrap gap-2 mt-3";
    const offerList = splitSkills(mentor.offer);
    if (offerList.length === 0) {
        const p = document.createElement('div'); 
        p.className = 'text-gray-400 text-sm'; 
        p.textContent = 'No skills offered';
        teachDiv.appendChild(p);
    } else {
        offerList.forEach(s => {
            teachDiv.appendChild(makeTag(s));
        });
    }

    const learnDiv = document.createElement('div');
    learnDiv.className = "mt-3 text-sm text-gray-400";
    const learnList = splitSkills(mentor.learn);
    learnDiv.textContent = 'Wants to learn: ' + (learnList.length ? learnList.join(', ') : '—');

    left.appendChild(name);
    left.appendChild(email);
    left.appendChild(meta);
    left.appendChild(teachDiv);
    left.appendChild(learnDiv);

    const right = document.createElement('div');
    right.className = "mt-4 md:mt-0 md:ml-6 flex flex-col gap-2";

    const viewBtn = document.createElement('a');
    viewBtn.className = "px-4 py-2 border border-white/20 rounded-md text-sm text-center hover:bg-white/5";
    viewBtn.textContent = 'View Profile';
    viewBtn.href = `profile.html?uid=${mentor.uid}`;
    right.appendChild(viewBtn);

    const requestBtn = document.createElement('button');
    requestBtn.className = "px-4 py-2 bg-primary rounded-md text-white hover:bg-primary/80";
    requestBtn.textContent = 'Request';
    requestBtn.onclick = () => openRequestModal(mentor);
    right.appendChild(requestBtn);

    card.appendChild(left);
    card.appendChild(right);
    return card;
}