import { auth, database } from "../config/firebaseConfig.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { setText } from "../utils/uiHelpers.js";

let browseCache = [];

// ================= BROWSE page (WITHOUT JS ML RANKING) =================
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
                avgRating: (data.avgRating !== undefined && data.avgRating !== null) ? data.avgRating : 0,
                totalRatings: data.totalRatings || 0,
                sessionsCompleted: data.sessionsCompleted || 0
            }));
        }

        mentors = mentors.filter(m => m.uid !== currentUid);
        
        // Sort by average rating (simple sorting - NO ML)
        // ML-based ranking using sentiment analysis + Random Forest
        // @ts-ignore
        const { rankMentorsByML } = await import("./mlRankingService.js");
        mentors = await rankMentorsByML(mentors);
        
        browseCache = mentors;

        async function render(list) {
            container.innerHTML = '';
            if (!list.length) {
                container.innerHTML = '<p class="text-gray-400">No mentors found for that skill.</p>';
                if (resultsCount) resultsCount.textContent = '0';
                return;
            }
            if (resultsCount) resultsCount.textContent = String(list.length);
            for (const m of list) {
                const card = await createMentorCard(m, currentUid);
                container.appendChild(card);
            }
        }

        await render(mentors);

        if (searchInput) {
            searchInput.oninput = async () => {
                const q = searchInput.value.trim().toLowerCase();
                if (!q) { await render(browseCache); return; }
                const tokens = q.split(/\s+/).filter(Boolean);
                const filtered = browseCache.filter(m => {
                    const offerStr = (m.offer || '').toLowerCase();
                    // Only search in what they TEACH, not what they want to learn
                    return tokens.every(t => offerStr.includes(t));
                });
                await render(filtered);
            };
        }

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

        const { createSessionCard } = await import("./sessionService.js");

        if (sessionsSnap.exists()) {
            const sessions = sessionsSnap.val();
            const sessionList = Object.entries(sessions).map(([id, s]) => ({ id, ...s }));
            const matching = sessionList.filter(s => (s.teacher === uid || s.learner === uid) && (s.status === 'active' || s.status === 'accepted'));
            activeCount = matching.length;
            if (matching.length === 0 && container) {
                container.innerHTML = '<p class="text-gray-400">No active sessions yet.</p>';
            } else {
                for (const s of matching) {
                    s.id = s.id || s.sessionId || s.id;

                    const otherUid = (s.teacher === uid) ? s.learner : s.teacher;

                    const otherName = (s.teacher === uid) ? (s.learnerName || 'Unknown') : (s.teacherName || 'Unknown');
                    const otherEmail = (s.teacher === uid) ? (s.learnerEmail || '') : (s.teacherEmail || '');

                    const otherUser = { uid: otherUid, name: otherName, email: otherEmail };
                    const card = createSessionCard(s, otherUser, uid);
                    container.appendChild(card);
                }
            }
        } else {
            if (container) container.innerHTML = '<p class="text-gray-400">No active sessions yet.</p>';
        }

        setText("activeSessionsCount", activeCount);

        // YOUR rating — recalculate live from feedbacks (source of truth)
        const allFeedbacksSnap = await get(ref(database, "feedbacks"));
        let yourRating = 0;
        let totalRatingsCount = 0;

        if (allFeedbacksSnap.exists()) {
            const allFeedbacks = allFeedbacksSnap.val();
            // Find all feedbacks where this user was rated (by someone else)
            const myFeedbacks = Object.values(allFeedbacks).filter(f =>
                f && f.ratedUserId === uid && f.raterId && f.raterId !== uid
            );
            console.log(`[Dashboard] Found ${myFeedbacks.length} valid feedbacks for uid=${uid}`);
            if (myFeedbacks.length > 0) {
                const sum = myFeedbacks.reduce((acc, f) => acc + (Number(f.rating) || 0), 0);
                yourRating = sum / myFeedbacks.length;
                totalRatingsCount = myFeedbacks.length;
            }
        }

        const yourRatingEl = document.getElementById("rating");
        if (yourRatingEl) {
            if (totalRatingsCount > 0) {
                yourRatingEl.textContent = `${yourRating.toFixed(1)}/5 (${totalRatingsCount})`;
            } else {
                yourRatingEl.textContent = "N/A";
            }
        }

    } catch (err) {
        console.error("Error populating dashboard:", err);
    }
}

// ================= PROFILE page =================
export async function populateProfileFor(uid, user) {
    try {
        const userSnap = await get(ref(database, "users/" + uid));
        if (!userSnap.exists()) {
            console.warn("User data not found in DB for", uid);
            return;
        }

        const data = userSnap.val();
        const nameEl = document.getElementById("profileName");
        const emailEl = document.getElementById("profileEmail");
        const skillsEl = document.getElementById("profileSkills");
        const wantsEl = document.getElementById("profileWants");
        const bioEl = document.getElementById("profileBio");
        const ratingEl = document.getElementById("profileRating");

        if (nameEl) nameEl.textContent = data.name || 'No Name';
        if (emailEl) emailEl.textContent = data.email || 'No Email';
        const skillsTeach = document.getElementById('skillsTeach');
        const skillsLearn = document.getElementById('skillsLearn');
        if (skillsTeach) skillsTeach.textContent = data.offer || 'None';
        if (skillsLearn) skillsLearn.textContent = data.learn || 'None';
        if (bioEl) bioEl.textContent = data.bio || 'No bio yet.';

        const avgRating = (data.avgRating !== undefined && data.avgRating !== null) ? data.avgRating : 0;
        const totalRatings = data.totalRatings || 0;

        if (ratingEl) {
            if (totalRatings > 0) {
                ratingEl.textContent = `${avgRating.toFixed(1)}/5 (${totalRatings} reviews)`;
            } else {
                ratingEl.textContent = "No ratings yet";
            }
        }

        // ===== WIRE UP EDIT PROFILE BUTTONS =====
        const editBtn    = document.getElementById('editProfileBtn');
        const editForm   = document.getElementById('editForm');
        const saveBtn    = document.getElementById('saveProfileBtn');
        const cancelBtn  = document.getElementById('cancelEditBtn');
        const editMsg    = document.getElementById('editMsg');
        const editName   = document.getElementById('editName');
        const editOffer  = document.getElementById('editOffer');
        const editLearn  = document.getElementById('editLearn');

        if (editBtn && editForm) {
            editBtn.addEventListener('click', () => {
                // Pre-fill form with current values
                if (editName)  editName.value  = data.name  || '';
                if (editOffer) editOffer.value = data.offer || '';
                if (editLearn) editLearn.value = data.learn || '';
                if (editMsg)   editMsg.textContent = '';
                editForm.classList.remove('hidden');
                editBtn.classList.add('hidden');
            });
        }

        if (cancelBtn && editForm) {
            cancelBtn.addEventListener('click', () => {
                editForm.classList.add('hidden');
                if (editBtn) editBtn.classList.remove('hidden');
                if (editMsg) editMsg.textContent = '';
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const newName  = editName  ? editName.value.trim()  : data.name;
                const newOffer = editOffer ? editOffer.value.trim()  : data.offer;
                const newLearn = editLearn ? editLearn.value.trim()  : data.learn;

                if (!newName) {
                    if (editMsg) { editMsg.style.color = 'red'; editMsg.textContent = 'Name cannot be empty.'; }
                    return;
                }

                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';

                const success = await updateProfile(uid, { name: newName, offer: newOffer, learn: newLearn });

                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';

                if (success) {
                    // Update visible profile info
                    if (nameEl)      nameEl.textContent      = newName;
                    if (skillsTeach) skillsTeach.textContent = newOffer || 'None';
                    if (skillsLearn) skillsLearn.textContent = newLearn || 'None';

                    if (editMsg) { editMsg.style.color = 'green'; editMsg.textContent = '✅ Profile updated!'; }

                    setTimeout(() => {
                        if (editForm) editForm.classList.add('hidden');
                        if (editBtn)  editBtn.classList.remove('hidden');
                        if (editMsg)  editMsg.textContent = '';
                    }, 1500);
                } else {
                    if (editMsg) { editMsg.style.color = 'red'; editMsg.textContent = 'Failed to save. Try again.'; }
                }
            });
        }

    } catch (err) {
        console.error("Error populating profile:", err);
    }
}

// ================= UPDATE PROFILE =================
export async function updateProfile(uid, updates) {
    try {
        await update(ref(database, "users/" + uid), updates);
        return true;
    } catch (err) {
        console.error("Update profile error:", err);
        return false;
    }
}

// ================= IS CONNECTED =================
export async function isConnected(uid1, uid2) {
    try {
        const sessionsSnap = await get(ref(database, "sessions"));
        if (!sessionsSnap.exists()) return false;
        const sessions = sessionsSnap.val();
        return Object.values(sessions).some(s =>
            s && (
                (s.teacher === uid1 && s.learner === uid2) ||
                (s.teacher === uid2 && s.learner === uid1)
            )
        );
    } catch (err) {
        console.error("isConnected error:", err);
        return false;
    }
}