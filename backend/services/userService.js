import { ref, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { database, auth } from "../config/firebaseConfig.js";
import { setText, makeTag, el, escapeHtml, linkify } from "../utils/uiHelpers.js";
import { splitSkills } from "../utils/validators.js";


// ================= isConnected =================
export async function isConnected(uidA, uidB) {
    try {
        // 1) check sessions (accepted/active/completed)
        const sessionsSnap = await get(ref(database, "sessions"));
        if (sessionsSnap.exists()) {
            const sessions = sessionsSnap.val();
            const found = Object.values(sessions).some(s => {
                if (!s) return false;
                const okStatus = (s.status === 'active' || s.status === 'accepted' || s.status === 'completed');
                const between = (s.teacher === uidA && s.learner === uidB) || (s.teacher === uidB && s.learner === uidA);
                return okStatus && between;
            });
            if (found) return true;
        }

        // 2) fallback: check requests with status 'accepted'
        const requestsSnap = await get(ref(database, "requests"));
        if (requestsSnap.exists()) {
            const requests = requestsSnap.val();
            const foundReq = Object.values(requests).some(r => {
                if (!r) return false;
                const accepted = (r.status === 'accepted');
                const between = (r.from === uidA && r.to === uidB) || (r.from === uidB && r.to === uidA);
                return accepted && between;
            });
            if (foundReq) return true;
        }

        return false;
    } catch (e) {
        console.error("isConnected error", e);
        return false;
    }
}

// ================= PROFILE page =================
export async function populateProfileFor(profileUid, firebaseUser) {
    try {
        const viewer = auth.currentUser;
        if (!viewer) { window.location.href = "index.html"; return; }
        const viewerUid = viewer.uid;

        const profileNameEl = document.getElementById("profileName");
        const profileBioEl = document.getElementById("profileBio");
        const profileEmailEl = document.getElementById("profileEmail");
        const profileSessionsEl = document.getElementById("profileSessions");
        const skillsTeachEl = document.getElementById("skillsTeach");
        const skillsLearnEl = document.getElementById("skillsLearn");
        const editForm = document.getElementById("editForm");
        const editName = document.getElementById("editName");
        const editOffer = document.getElementById("editOffer");
        const editLearn = document.getElementById("editLearn");
        const editMsg = document.getElementById("editMsg");
        const editBtn = document.getElementById("editProfileBtn");
        const saveBtn = document.getElementById("saveProfileBtn");
        const cancelBtn = document.getElementById("cancelEditBtn");
        const avatarSmall = document.getElementById("sidebarAvatarSmall");

        const userSnap = await get(ref(database, "users/" + profileUid));
        let data = {};
        if (userSnap.exists()) data = userSnap.val();

        const displayName = data.name || (firebaseUser && firebaseUser.displayName) || (firebaseUser && firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User');
        if (profileNameEl) profileNameEl.textContent = displayName;
        if (profileBioEl) profileBioEl.textContent = data.bio || 'No bio available';

        // show contact if owner OR connected
        let showContact = false;
        if (viewerUid === profileUid) showContact = true;
        else showContact = await isConnected(viewerUid, profileUid);

        if (profileEmailEl) {
            profileEmailEl.textContent = `Email: ${showContact ? (data.email || '—') : '—'}`;
        }
        if (profileSessionsEl) profileSessionsEl.textContent = (data.sessionsCompleted || 0) + ' sessions completed';

        if (skillsTeachEl) skillsTeachEl.innerHTML = '';
        if (skillsLearnEl) skillsLearnEl.innerHTML = '';

        // We need splitSkills from validators or util?
        // It was in script.js. I should move it to validators or uiHelpers? 
        // It's in validators.js now.
        // These are already imported at top of file

        const teachList = splitSkills(data.offer);
        const learnList = splitSkills(data.learn);
        if (teachList.length === 0 && skillsTeachEl) {
            const msg = document.createElement('p'); msg.className = 'text-gray-400'; msg.textContent = 'No skills added.';
            skillsTeachEl.appendChild(msg);
        } else {
            teachList.forEach(s => skillsTeachEl.appendChild(makeTag(s)));
        }
        if (learnList.length === 0 && skillsLearnEl) {
            const msg = document.createElement('p'); msg.className = 'text-gray-400'; msg.textContent = 'No skills added.';
            skillsLearnEl.appendChild(msg);
        } else {
            learnList.forEach(s => skillsLearnEl.appendChild(makeTag(s)));
        }

        const initial = displayName && displayName[0] ? displayName[0].toUpperCase() : 'U';
        if (avatarSmall) avatarSmall.textContent = initial;

        if (viewerUid === profileUid) {
            if (editBtn) {
                editBtn.style.display = 'inline-block';
                editBtn.onclick = () => {
                    if (editForm) editForm.classList.remove('hidden');
                    if (editName) editName.value = data.name || '';
                    if (editOffer) editOffer.value = data.offer || '';
                    if (editLearn) editLearn.value = data.learn || '';
                    if (editMsg) editMsg.textContent = '';
                    editForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                };
            }
        } else {
            if (editBtn) editBtn.style.display = 'none';
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => { if (editForm) editForm.classList.add('hidden'); };
        }

        if (saveBtn) {
            saveBtn.onclick = async () => {
                const newName = (editName && editName.value.trim()) || displayName;
                const newOffer = editOffer && editOffer.value.trim();
                const newLearn = editLearn && editLearn.value.trim();
                try {
                    await update(ref(database, "users/" + profileUid), {
                        name: newName,
                        offer: newOffer,
                        learn: newLearn
                    });
                    if (editMsg) { editMsg.style.color = 'green'; editMsg.textContent = 'Profile updated.'; }
                    await populateProfileFor(profileUid, firebaseUser);
                    setTimeout(() => { if (editForm) editForm.classList.add('hidden'); }, 700);
                } catch (err) {
                    console.error("Failed to update profile", err);
                    if (editMsg) { editMsg.style.color = 'red'; editMsg.textContent = 'Failed to save. Try again.'; }
                }
            };
        }

        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('edit') === '1' && viewerUid === profileUid) {
                editBtn?.click();
            }
        } catch (e) { /* ignore */ }

    } catch (err) {
        console.error("Error populating profile:", err);
    }
}

// ================= BROWSE page =================
let browseCache = [];
export async function populateBrowsePage(currentUid) {
    try {
        const container = document.getElementById("mentorsContainer");
        const searchInput = document.getElementById("searchInput");
        const resultsCount = document.getElementById("resultsCount");

        if (!container) return;

        const user = auth.currentUser;
        if (!user) {
            console.error('User not authenticated');
            container.innerHTML = '<p class="text-red-400">Please log in to browse mentors.</p>';
            return;
        }

       const { createMentorCard, ensureRequestModal } = await import("./requestService.js");

        const usersSnap = await get(ref(database, "users"));
        let mentors = [];
        if (usersSnap.exists()) {
            const users = usersSnap.val();
            mentors = Object.entries(users).map(([uid, data]) => ({
                uid,
                name: data.name,
                email: data.email,
                offer: data.offer || '',
                learn: data.learn || '',
                avgRating: (data.avgRating !== undefined && data.avgRating !== null) ? data.avgRating : 1,
                totalRatings: data.totalRatings || 0,
                sessionsCompleted: data.sessionsCompleted || 0
            }));
        }

        mentors = mentors.filter(m => m.uid !== currentUid);
        browseCache = mentors;

        function render(list) {
            container.innerHTML = '';
            if (!list.length) {
                container.innerHTML = '<p class="text-gray-400">No mentors found for that skill.</p>';
                if (resultsCount) resultsCount.textContent = '0';
                return;
            }
            if (resultsCount) resultsCount.textContent = String(list.length);
            list.forEach(m => container.appendChild(createMentorCard(m, currentUid)));
        }

        render(mentors);

        if (searchInput) {
            searchInput.oninput = () => {
                const q = searchInput.value.trim().toLowerCase();
                if (!q) return render(browseCache);
                const tokens = q.split(/\s+/).filter(Boolean);
                const filtered = browseCache.filter(m => {
                    const offerStr = (m.offer || '').toLowerCase();
                    const learnStr = (m.learn || '').toLowerCase();
                    return tokens.every(t => offerStr.includes(t) || learnStr.includes(t));
                });
                render(filtered);
            };
        }

        // ensureRequestModal(); // handled in requestService or we call it here
        ensureRequestModal();

    } catch (err) {
        console.error("Error populating browse page:", err);
        const container = document.getElementById("mentorsContainer");
        if (container) container.innerHTML = '<p class="text-red-400">Failed to load mentors.</p>';
    }
}

// ================= DASHBOARD page =================
export async function populateDashboardFor(uid, currentUserEmail, firebaseUser) {
    try {
        const userSnap = await get(ref(database, "users/" + uid));
        let displayName = null;
        if (userSnap.exists()) {
            const data = userSnap.val();
            displayName = data.name || null;
        }
        if (!displayName) {
            displayName = (firebaseUser && firebaseUser.displayName) || (currentUserEmail ? currentUserEmail.split('@')[0] : null) || "User";
        }
        setText("welcomeHeading", displayName);

        // Request counts
        const requestsSnap = await get(ref(database, "requests"));
        let sentCount = 0;
        let receivedCount = 0;
        if (requestsSnap.exists()) {
            const requests = requestsSnap.val();
            Object.values(requests).forEach((r) => {
                if (!r) return;
                if (r.from === uid && r.status === 'pending') sentCount++;
                if (r.to === uid && r.status === 'pending') receivedCount++;
            });
        }
        setText("sentRequestsCount", sentCount);
        setText("receivedRequestsCount", receivedCount);

        // Active Sessions
        const sessionsSnap = await get(ref(database, "sessions"));
        let activeCount = 0;
        const container = document.getElementById("activeSessionsContainer");
        if (container) container.innerHTML = '';

        // Import createSessionCard dynamically to avoid cycle if possible, or use module system
        const { createSessionCard } = await import("./sessionService.js");

        if (sessionsSnap.exists()) {
            const sessions = sessionsSnap.val();
            const sessionList = Object.entries(sessions).map(([id, s]) => ({ id, ...s }));
            // Only consider sessions that are still active/accepted for the "active sessions" area.
            const matching = sessionList.filter(s => (s.teacher === uid || s.learner === uid) && (s.status === 'active' || s.status === 'accepted'));
            activeCount = matching.length;
            if (matching.length === 0 && container) {
                container.innerHTML = '<p class="text-gray-400">No active sessions yet.</p>';
            } else {
                for (const s of matching) {
                    s.id = s.id || s.sessionId || s.id;

                    const otherUid = (s.teacher === uid) ? s.learner : s.teacher;

                    // Resolve flags
                    try {
                        const fbTeacherSnap = await get(ref(database, `feedbacks/${s.id}_${s.teacher}`));
                        const fbLearnerSnap = await get(ref(database, `feedbacks/${s.id}_${s.learner}`));
                        s.teacherRated = s.teacherRated || (fbTeacherSnap.exists());
                        s.learnerRated = s.learnerRated || (fbLearnerSnap.exists());

                        // ✅ CLEANUP: If both rated but status is still active/accepted, fix it now
                        if (s.teacherRated && s.learnerRated && (s.status === 'active' || s.status === 'accepted')) {
                            console.log(`Fixing session ${s.id} - both users rated but status was ${s.status}`);
                            await update(ref(database, `sessions/${s.id}`), {
                                status: 'completed',
                                completedAt: Date.now(),
                                teacherRated: true,
                                learnerRated: true
                            });
                            // Skip showing this session since it should be completed
                            continue;
                        }
                    } catch (e) {
                        console.warn('Failed to resolve feedback flags for session', s.id, e);
                    }

                    let otherUser = null;
                    if (otherUid) {
                        const otherSnap = await get(ref(database, "users/" + otherUid));
                        if (otherSnap.exists()) {
                            otherUser = { uid: otherUid, ...otherSnap.val() };
                        }
                    }

                    // resolve info
                    try {
                        if (!s.teacherName && s.teacher) {
                            const ts = await get(ref(database, "users/" + s.teacher));
                            if (ts.exists()) s.teacherName = ts.val().name || s.teacherName;
                            if (ts.exists() && !s.teacherEmail) s.teacherEmail = ts.val().email || s.teacherEmail;
                        }
                        if (!s.learnerName && s.learner) {
                            const ls = await get(ref(database, "users/" + s.learner));
                            if (ls.exists()) s.learnerName = ls.val().name || s.learnerName;
                            if (ls.exists() && !s.learnerEmail) s.learnerEmail = ls.val().email || s.learnerEmail;
                        }
                    } catch (e) {
                        console.warn('Failed to resolve participant info for session', s.id, e);
                    }

                    const card = createSessionCard(s, otherUser, uid);
                    if (container) container.appendChild(card);
                }
            }
        } else {
            if (container) container.innerHTML = '<p class="text-gray-400">No active sessions yet.</p>';
        }
        setText("activeSessionsCount", activeCount);

        const userRatingSnap = await get(ref(database, "users/" + uid));
        if (userRatingSnap.exists()) {
            const userData = userRatingSnap.val();
            const avgRating = userData.avgRating || 0;
            const totalRatings = userData.totalRatings || 0;
            // ✅ SHOW RATING WITH COUNT
            setText("rating", totalRatings > 0 ? `${avgRating.toFixed(1)}/5 (${totalRatings})` : 'N/A');
        } else {
            setText("rating", 'N/A');
        }

    } catch (err) {
        console.error("Error populating dashboard:", err);
    }
}

// ================= RANKING =================
export async function getRankedTeachers() {
    const snap = await get(ref(database, "users"));
    if (!snap.exists()) return;

    const users = snap.val();
    const ranked = [];

    Object.keys(users).forEach(uid => {
        if (users[uid].avgRating) {
            ranked.push({
                uid,
                name: users[uid].name || 'User',
                rating: users[uid].avgRating
            });
        }
    });

    ranked.sort((a, b) => b.rating - a.rating);
    console.table(ranked);
}