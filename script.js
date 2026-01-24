// ================= FIREBASE IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  get,
  update,
  push,
  onChildAdded,
  onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";


// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyBUMI6CgEVrnfsTVBXZx3uZDsBh5oUY-1w",
  authDomain: "skill-swap-platform-53823.firebaseapp.com",
  projectId: "skill-swap-platform-53823",
  appId: "1:527524796826:web:8b7f50476ba72c8ebe0223",
  databaseURL: "https://skill-swap-platform-53823-default-rtdb.firebaseio.com"
};


// ================= INITIALIZE FIREBASE =================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);


// ================= SIGNUP =================
window.signupUser = function (event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const name = document.getElementById("name").value.trim();
  const offer = document.getElementById("offer").value.trim();
  const learn = document.getElementById("learn").value.trim();
  const message = document.getElementById("signupMessage");

  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const uid = userCredential.user.uid;

      // 🔥 SAVE USER DATA TO REALTIME DATABASE
      set(ref(database, "users/" + uid), {
        name: name,
        email: email,
        offer: offer,
        learn: learn
      });

      message.style.color = "green";
      message.textContent = "Signup successful! Redirecting...";

      setTimeout(() => {
        window.location.href = "index.html";
      }, 1500);
    })
    .catch((error) => {
      message.style.color = "red";
      message.textContent = error.message;
    });
};


// ================= LOGIN =================
window.loginUser = function (event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const message = document.getElementById("loginMessage");

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      message.style.color = "green";
      message.textContent = "Login successful!";
      window.location.href = "home.html";
    })
    .catch((error) => {
      message.style.color = "red";
      message.textContent = error.message;
    });
};


// ================= LOGOUT =================
window.logout = function () {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
};


// ================= DASHBOARD HELPERS =================
function showDashboard() {
  const dashboard = document.getElementById("dashboard");
  const publicHero = document.getElementById("publicHero");
  if (dashboard) dashboard.classList.remove("hidden");
  if (publicHero) publicHero.classList.add("hidden");
}

function hideDashboard() {
  const dashboard = document.getElementById("dashboard");
  const publicHero = document.getElementById("publicHero");
  if (dashboard) dashboard.classList.add("hidden");
  if (publicHero) publicHero.classList.remove("hidden");
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function createSessionCard(session, otherUser, currentUid) {
  const container = document.createElement("div");
  container.className = "bg-white/3 border border-white/10 rounded-lg p-4 flex justify-between items-start";

  const left = document.createElement("div");
  left.innerHTML = `
    <div class="text-lg font-semibold">${session.skill}</div>
    <div class="text-sm text-gray-300">Teacher: ${session.teacherName || '—'}</div>
    <div class="text-sm text-gray-400">Contact: ${otherUser?.email || session.contact || '—'}</div>
  `;

  const right = document.createElement("div");
  right.className = "flex gap-2";

  const statusBtn = document.createElement("button");
  statusBtn.className = "px-3 py-1 rounded-md bg-black/80 text-white text-sm";
  statusBtn.textContent = (session.status || 'active');

  right.appendChild(statusBtn);

  // chat button for active sessions
  if (session.status === 'active' || session.status === 'accepted') {
    const chatBtn = document.createElement("button");
    chatBtn.className = "px-3 py-1 rounded-md border border-white/20 text-sm";
    chatBtn.textContent = "Chat";
    chatBtn.onclick = () => {
      // open chat page for session
      const sid = session.id || session.sessionId;
      if (sid) window.location.href = `chat.html?sessionId=${sid}`;
      else alert('Session id missing.');
    };
    right.appendChild(chatBtn);
  }

  container.appendChild(left);
  container.appendChild(right);

  return container;
}


// ================= DASHBOARD DATA FETCH =================
async function populateDashboardFor(uid, currentUserEmail, firebaseUser) {
  try {
    // get user profile
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
    const initial = (displayName && displayName[0]) ? displayName[0].toUpperCase() : 'U';
    const profileAvatar = document.getElementById("profileAvatar");
    const sidebarAvatar = document.getElementById("sidebarAvatar");
    if (profileAvatar) profileAvatar.textContent = initial;
    if (sidebarAvatar) sidebarAvatar.textContent = initial;

    // requests: count sent and received
    const requestsSnap = await get(ref(database, "requests"));
    let sentCount = 0;
    let receivedCount = 0;
    if (requestsSnap.exists()) {
      const requests = requestsSnap.val();
      Object.values(requests).forEach((r) => {
        if (!r) return;
        if (r.from === uid) sentCount++;
        if (r.to === uid) receivedCount++;
      });
    }
    setText("sentRequestsCount", sentCount);
    setText("receivedRequestsCount", receivedCount);

    // sessions: active sessions involving this user
    const sessionsSnap = await get(ref(database, "sessions"));
    let activeCount = 0;
    const container = document.getElementById("activeSessionsContainer");
    if (container) container.innerHTML = ''; // clear
    if (sessionsSnap.exists()) {
      const sessions = sessionsSnap.val();
      const sessionList = Object.entries(sessions).map(([id, s]) => ({ id, ...s }));
      const matching = sessionList.filter(s => s.teacher === uid || s.learner === uid);
      activeCount = matching.length;
      if (matching.length === 0 && container) {
        container.innerHTML = '<p class="text-gray-400">No active sessions yet.</p>';
      } else {
        for (const s of matching) {
          const otherUid = (s.teacher === uid) ? s.learner : s.teacher;
          let otherUser = null;
          if (otherUid) {
            const otherSnap = await get(ref(database, "users/" + otherUid));
            if (otherSnap.exists()) otherUser = otherSnap.val();
          }
          // teacherName
          if (!s.teacherName) {
            if (s.teacher && s.teacher !== uid) {
              const teacherSnap = await get(ref(database, "users/" + s.teacher));
              if (teacherSnap.exists()) s.teacherName = teacherSnap.val().name || 'Teacher';
            } else {
              s.teacherName = (s.teacher === uid) ? (userSnap.exists() ? userSnap.val().name : 'You') : 'Teacher';
            }
          }
          // include id
          s.id = s.id || s.sessionId || s.id;
          const card = createSessionCard(s, otherUser, uid);
          if (container) container.appendChild(card);
        }
      }
    } else {
      if (container) container.innerHTML = '<p class="text-gray-400">No active sessions yet.</p>';
    }
    setText("activeSessionsCount", activeCount);

    // rating - placeholder
    const ratingSnap = await get(ref(database, "ratings/" + uid));
    if (ratingSnap.exists()) {
      setText("rating", ratingSnap.val().average || 'N/A');
    } else {
      setText("rating", 'N/A');
    }

  } catch (err) {
    console.error("Error populating dashboard:", err);
  }
}


// ================= PROFILE PAGE FUNCTIONS =================
function makeTag(text) {
  const t = document.createElement('span');
  t.className = "bg-white/5 px-3 py-1 rounded-full text-sm text-gray-200 border border-white/10";
  t.textContent = text;
  return t;
}

function splitSkills(skillString) {
  if (!skillString) return [];
  return skillString.split(',').map(s => s.trim()).filter(Boolean);
}

// returns true if there is an active/accepted session between a and b
async function isConnected(uidA, uidB) {
  try {
    const sessionsSnap = await get(ref(database, "sessions"));
    if (!sessionsSnap.exists()) return false;
    const sessions = sessionsSnap.val();
    return Object.values(sessions).some(s => {
      if (!s) return false;
      const okStatus = (s.status === 'active' || s.status === 'accepted');
      const between = (s.teacher === uidA && s.learner === uidB) || (s.teacher === uidB && s.learner === uidA);
      return okStatus && between;
    });
  } catch (e) {
    console.error("isConnected error", e);
    return false;
  }
}

async function populateProfileFor(profileUid, firebaseUser) {
  try {
    // determine viewer (current logged in)
    const viewer = auth.currentUser;
    if (!viewer) {
      // redirect to index
      window.location.href = "index.html";
      return;
    }
    const viewerUid = viewer.uid;

    // elements
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

    // fetch profile user object
    const userSnap = await get(ref(database, "users/" + profileUid));
    let data = {};
    if (userSnap.exists()) data = userSnap.val();

    const displayName = data.name || (firebaseUser && firebaseUser.displayName) || (firebaseUser && firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User');
    if (profileNameEl) profileNameEl.textContent = displayName;
    if (profileBioEl) profileBioEl.textContent = data.bio || 'No bio available';

    // show email ONLY if viewer is owner OR connected (accepted session)
    let showContact = false;
    if (viewerUid === profileUid) showContact = true;
    else {
      showContact = await isConnected(viewerUid, profileUid);
    }
    if (profileEmailEl) {
      profileEmailEl.textContent = `Email: ${showContact ? (data.email || '—') : '—'}`;
    }

    // sessions completed placeholder
    if (profileSessionsEl) profileSessionsEl.textContent = (data.sessionsCompleted || 0) + ' sessions completed';

    // skills
    if (skillsTeachEl) skillsTeachEl.innerHTML = '';
    if (skillsLearnEl) skillsLearnEl.innerHTML = '';
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

    // set avatar initial
    const initial = displayName && displayName[0] ? displayName[0].toUpperCase() : 'U';
    if (avatarSmall) avatarSmall.textContent = initial;

    // If viewer is the owner, wire the edit button to show the form
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
      cancelBtn.onclick = () => {
        if (editForm) editForm.classList.add('hidden');
      };
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

          // refresh UI
          await populateProfileFor(profileUid, firebaseUser);
          // hide form after short delay
          setTimeout(() => {
            if (editForm) editForm.classList.add('hidden');
          }, 700);
        } catch (err) {
          console.error("Failed to update profile", err);
          if (editMsg) { editMsg.style.color = 'red'; editMsg.textContent = 'Failed to save. Try again.'; }
        }
      };
    }

  } catch (err) {
    console.error("Error populating profile:", err);
  }
}


// ================= BROWSE PAGE FUNCTIONS =================
function createMentorCard(mentor, currentUid) {
  const card = document.createElement('div');
  card.className = "bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start";

  const left = document.createElement('div');
  left.className = "flex-1";

  const name = document.createElement('div');
  name.className = "font-semibold text-lg";
  name.textContent = mentor.name || 'Unnamed';

  const email = document.createElement('div');
  email.className = "text-gray-400 text-sm mt-1";
  // Do not show email to others unless connected — we will show 'Email: —' in the card (view profile reveals if connected)
  email.textContent = 'Email: —';

  const teachDiv = document.createElement('div');
  teachDiv.className = "flex flex-wrap gap-2 mt-3";

  const offerList = splitSkills(mentor.offer);
  if (offerList.length === 0) {
    const p = document.createElement('div'); p.className = 'text-gray-400 text-sm'; p.textContent = 'No skills offered';
    teachDiv.appendChild(p);
  } else {
    offerList.forEach(s => {
      const tag = document.createElement('span');
      tag.className = "bg-white/5 px-3 py-1 rounded-full text-sm text-gray-200 border border-white/10";
      tag.textContent = s;
      teachDiv.appendChild(tag);
    });
  }

  const learnDiv = document.createElement('div');
  learnDiv.className = "mt-3 text-sm text-gray-400";
  const learnList = splitSkills(mentor.learn);
  learnDiv.textContent = 'Wants to learn: ' + (learnList.length ? learnList.join(', ') : '—');

  left.appendChild(name);
  left.appendChild(email);
  left.appendChild(teachDiv);
  left.appendChild(learnDiv);

  const right = document.createElement('div');
  right.className = "mt-4 md:mt-0 md:ml-6 flex flex-col gap-2";

  // view profile
  const viewBtn = document.createElement('a');
  viewBtn.className = "px-4 py-2 border border-white/20 rounded-md text-sm text-center";
  viewBtn.textContent = 'View Profile';
  viewBtn.href = `profile.html?uid=${mentor.uid}`;
  right.appendChild(viewBtn);

  // request button
  const requestBtn = document.createElement('button');
  requestBtn.className = "px-4 py-2 bg-primary rounded-md text-white";
  requestBtn.textContent = 'Request';
  requestBtn.onclick = async () => {
    if (mentor.uid === currentUid) {
      alert("You cannot send a request to yourself.");
      return;
    }

    // choose skill if multiple
    let skill = '';
    if (offerList.length === 1) {
      skill = offerList[0];
    } else if (offerList.length > 1) {
      skill = prompt("Which skill do you want to request?\nOptions: " + offerList.join(', '));
      if (!skill) return;
      skill = skill.trim();
      // allow sending for skills not listed (ask for confirmation)
      if (!offerList.map(o => o.toLowerCase()).includes(skill.toLowerCase())) {
        if (!confirm("The skill you entered isn't listed. Send request anyway?")) return;
      }
    } else {
      // no offers — still allow specifying skill
      skill = prompt("This user hasn't listed skills. Enter the skill you want to request:");
      if (!skill) return;
      skill = skill.trim();
    }

    // ask for reason / bio why learning
    const note = prompt("Why are you studying this? Add a short note (optional):") || '';

    try {
      // push a request into /requests
      const reqRef = push(ref(database, "requests"));
      await set(reqRef, {
        from: currentUid,
        to: mentor.uid,
        skill: skill,
        note: note,
        status: "pending",
        createdAt: Date.now()
      });
      alert("Request sent to " + (mentor.name || mentor.email));
    } catch (err) {
      console.error("Failed to send request:", err);
      alert("Failed to send request. Try again.");
    }
  };

  right.appendChild(requestBtn);

  card.appendChild(left);
  card.appendChild(right);

  return card;
}

let browseCache = []; // cached mentors fetched from DB

async function populateBrowsePage(currentUid) {
  try {
    const container = document.getElementById("mentorsContainer");
    const searchInput = document.getElementById("searchInput");
    const resultsCount = document.getElementById("resultsCount");

    if (!container) return;

    container.innerHTML = '<p class="text-gray-400">Loading mentors…</p>';

    const usersSnap = await get(ref(database, "users"));
    let mentors = [];
    if (usersSnap.exists()) {
      const users = usersSnap.val();
      mentors = Object.entries(users).map(([uid, data]) => ({
        uid,
        name: data.name,
        email: data.email,
        offer: data.offer || '',
        learn: data.learn || ''
      }));
    }

    // remove current user from mentor list
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

    // initial render all
    render(mentors);

    // search handler
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

  } catch (err) {
    console.error("Error populating browse page:", err);
    const container = document.getElementById("mentorsContainer");
    if (container) container.innerHTML = '<p class="text-red-400">Failed to load mentors.</p>';
  }
}


// ================= VIEW REQUESTS PAGE =================
async function populateRequestsPage(currentUid) {
  try {
    const receivedContainer = document.getElementById("receivedRequests");
    const sentContainer = document.getElementById("sentRequests");

    if (receivedContainer) receivedContainer.innerHTML = '<p class="text-gray-400">Loading…</p>';
    if (sentContainer) sentContainer.innerHTML = '<p class="text-gray-400">Loading…</p>';

    const requestsSnap = await get(ref(database, "requests"));
    let requests = [];
    if (requestsSnap.exists()) requests = Object.entries(requestsSnap.val()).map(([id, r]) => ({ id, ...r }));

    const received = requests.filter(r => r.to === currentUid);
    const sent = requests.filter(r => r.from === currentUid);

    if (receivedContainer) {
      receivedContainer.innerHTML = '';
      if (received.length === 0) receivedContainer.innerHTML = '<p class="text-gray-400">No requests received.</p>';
      for (const r of received) {
        const card = document.createElement('div');
        card.className = 'bg-white/5 border border-white/10 rounded-md p-4 mb-3';
        // fetch sender profile
        const fromSnap = await get(ref(database, "users/" + r.from));
        const fromUser = fromSnap.exists() ? fromSnap.val() : { name: 'Unknown', email: '—' };

        card.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <div class="font-semibold">${fromUser.name || fromUser.email || 'User'}</div>
              <div class="text-sm text-gray-400">Skill: ${r.skill || '—'}</div>
              <div class="text-sm text-gray-400 mt-2">Note: ${r.note ? r.note : '—'}</div>
              <div class="text-sm text-gray-400 mt-2">Status: ${r.status}</div>
            </div>
            <div class="flex flex-col gap-2">
              <button class="acceptBtn px-3 py-1 bg-primary text-white rounded-md" data-id="${r.id}">Accept</button>
              <button class="rejectBtn px-3 py-1 border border-white/20 rounded-md" data-id="${r.id}">Reject</button>
            </div>
          </div>
        `;
        // append
        receivedContainer.appendChild(card);
      }
    }

    if (sentContainer) {
      sentContainer.innerHTML = '';
      if (sent.length === 0) sentContainer.innerHTML = '<p class="text-gray-400">No requests sent.</p>';
      for (const r of sent) {
        const card = document.createElement('div');
        card.className = 'bg-white/5 border border-white/10 rounded-md p-4 mb-3';
        const toSnap = await get(ref(database, "users/" + r.to));
        const toUser = toSnap.exists() ? toSnap.val() : { name: 'Unknown' };
        card.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <div class="font-semibold">${toUser.name || 'User'}</div>
              <div class="text-sm text-gray-400">Skill: ${r.skill || '—'}</div>
              <div class="text-sm text-gray-400 mt-2">Note: ${r.note ? r.note : '—'}</div>
              <div class="text-sm text-gray-400 mt-2">Status: ${r.status}</div>
            </div>
            <div class="flex flex-col gap-2">
              ${r.status === 'accepted' && r.sessionId ? `<a class="px-3 py-1 bg-primary text-white rounded-md" href="chat.html?sessionId=${r.sessionId}">Chat</a>` : ''}
            </div>
          </div>
        `;
        sentContainer.appendChild(card);
      }
    }

    // attach accept/reject button handlers (delegated)
    document.querySelectorAll('.acceptBtn').forEach(btn => {
      btn.onclick = async (e) => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        const requestSnap = await get(ref(database, "requests/" + id));
        if (!requestSnap.exists()) { alert('Request not found'); return; }
        const r = requestSnap.val();

        // Accept: create session with teacher and learner
        // We'll treat recipient (r.to) as teacher and sender (r.from) as learner
        try {
          // create session
          const sessRef = push(ref(database, "sessions"));
          const sessionObj = {
            teacher: r.to,
            learner: r.from,
            skill: r.skill || '',
            status: 'active',
            createdAt: Date.now()
          };
          await set(sessRef, sessionObj);

          // update request
          await update(ref(database, "requests/" + id), {
            status: 'accepted',
            acceptedAt: Date.now(),
            sessionId: sessRef.key
          });

          alert('Request accepted. Session created.');

          // refresh view
          await populateRequestsPage(auth.currentUser.uid);

        } catch (err) {
          console.error('Accept failed', err);
          alert('Failed to accept request. Try again.');
        }
      };
    });

    document.querySelectorAll('.rejectBtn').forEach(btn => {
      btn.onclick = async (e) => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        if (!confirm('Reject this request?')) return;
        try {
          await update(ref(database, "requests/" + id), { status: 'rejected', respondedAt: Date.now() });
          alert('Request rejected.');
          await populateRequestsPage(auth.currentUser.uid);
        } catch (err) {
          console.error('Reject failed', err);
          alert('Failed to reject request. Try again.');
        }
      };
    });

  } catch (err) {
    console.error("Error populating requests page:", err);
    const rc = document.getElementById("receivedRequests");
    const sc = document.getElementById("sentRequests");
    if (rc) rc.innerHTML = '<p class="text-red-400">Failed to load.</p>';
    if (sc) sc.innerHTML = '<p class="text-red-400">Failed to load.</p>';
  }
}


// ================= CHAT PAGE FUNCTIONS =================
// escape HTML to avoid XSS
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// simple linkify - detects urls and wraps in anchor tags (safe-ish because we escape before)
function linkify(text) {
  const escaped = escapeHtml(text);
  const urlRegex = /((https?:\/\/|www\.)[^\s]+)/g;
  return escaped.replace(urlRegex, function(url) {
    let href = url;
    if (!href.startsWith('http')) href = 'http://' + href;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-primary underline">${href}</a>`;
  });
}

function listenToChat(sessionId, currentUid) {
  const list = document.getElementById("messagesList");
  const input = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendMessageBtn");

  if (!list) return;

  list.innerHTML = '<p class="text-gray-400">Loading messages…</p>';

  const messagesRef = ref(database, `chats/${sessionId}/messages`);
  // initial load and listen for new messages
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
        alert("Failed to send message");
      }
    };
  }
}

function appendMessageToList(msg, currentUid) {
  const list = document.getElementById("messagesList");
  if (!list) return;
  if (!msg) return;

  // create item
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

  // scroll to bottom
  list.scrollTop = list.scrollHeight;
}


// ================= DASHBOARD AUTH + DATA & ROUTING =================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // not logged in
    hideDashboard();

    // If user is trying to access profile, home, browse, requests, chat pages, redirect to index
    if (window.location.pathname.includes("profile.html") ||
        window.location.pathname.includes("home.html") ||
        window.location.pathname.includes("browse.html") ||
        window.location.pathname.includes("view-requests.html") ||
        window.location.pathname.includes("chat.html")) {
      window.location.href = "index.html";
    }
    return;
  }

  // Logged in
  const uid = user.uid;

  // Update avatar initials quickly (if present in any page)
  const initial = (user.displayName && user.displayName[0]) ? user.displayName[0].toUpperCase() : (user.email ? user.email[0].toUpperCase() : 'U');
  const profileAvatar = document.getElementById("profileAvatar");
  const sidebarAvatar = document.getElementById("sidebarAvatar");
  const sidebarAvatarSmall = document.getElementById("sidebarAvatarSmall");
  if (profileAvatar) profileAvatar.textContent = initial;
  if (sidebarAvatar) sidebarAvatar.textContent = initial;
  if (sidebarAvatarSmall) sidebarAvatarSmall.textContent = initial;

  // If user on home.html -> populate dashboard
  if (window.location.pathname.includes("home.html")) {
    showDashboard();
    populateDashboardFor(uid, user.email, user);
  }

  // If user on profile.html -> populate profile page
  if (window.location.pathname.includes("profile.html")) {
    // support viewing other user's profile by ?uid=...
    const params = new URLSearchParams(window.location.search);
    const profileUid = params.get('uid') || uid; // if no uid param, show self
    populateProfileFor(profileUid, user);
  }

  // If user on browse.html -> populate browse page
  if (window.location.pathname.includes("browse.html")) {
    populateBrowsePage(uid);
  }

  // If user on view-requests.html -> populate requests
  if (window.location.pathname.includes("view-requests.html")) {
    populateRequestsPage(uid);
  }

  // If user on chat.html -> listen to chat
  if (window.location.pathname.includes("chat.html")) {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId');
    if (!sessionId) {
      alert('No session specified.');
      return;
    }

    // Basic check: ensure current user is part of session
    get(ref(database, `sessions/${sessionId}`)).then(snap => {
      if (!snap.exists()) { alert('Session not found'); return; }
      const s = snap.val();
      if (s.teacher !== uid && s.learner !== uid) { alert('You are not a participant in this session'); return; }
      // show simple chat UI
      listenToChat(sessionId, uid);
    }).catch(err => {
      console.error('Session load error', err);
      alert('Could not open chat');
    });
  }
});