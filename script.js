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
  onChildAdded
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


// ================= AUTH: signup + login helpers =================
window.signupUser = async function (event) {
  event.preventDefault();
  console.log('signupUser called');

  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const nameEl = document.getElementById("name");
  const offerEl = document.getElementById("offer");
  const learnEl = document.getElementById("learn");
  const message = document.getElementById("signupMessage");

  if (!emailEl || !passEl) {
    console.error('Signup form elements not found.');
    if (message) { message.style.color = "red"; message.textContent = "Form elements missing."; }
    return;
  }

  const email = emailEl.value.trim();
  const password = passEl.value;
  const name = nameEl ? nameEl.value.trim() : '';
  const offer = offerEl ? offerEl.value.trim() : '';
  const learn = learnEl ? learnEl.value.trim() : '';

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    await set(ref(database, "users/" + uid), {
      name: name,
      email: email,
      offer: offer,
      learn: learn
    });
    if (message) { message.style.color = "green"; message.textContent = "Signup successful! Redirecting..."; }
    console.log('signup success', uid);
    setTimeout(() => window.location.href = "index.html", 800);
  } catch (error) {
    console.error('signup error', error);
    if (message) { message.style.color = "red"; message.textContent = error.message || 'Signup failed'; }
  }
};


window.loginUser = function (event) {
  event.preventDefault();
  console.log('loginUser called');

  const emailEl = document.getElementById("loginEmail");
  const passEl = document.getElementById("loginPassword");
  const message = document.getElementById("loginMessage");

  if (!emailEl || !passEl) {
    console.error('login form elements not found.');
    if (message) { message.style.color = "red"; message.textContent = "Form elements missing."; }
    return;
  }

  const email = emailEl.value.trim();
  const password = passEl.value;

  console.log('Attempting signInWithEmailAndPassword for', email);

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      console.log('signIn success', userCredential.user.uid);
      if (message) { message.style.color = "green"; message.textContent = "Login successful! Redirecting..."; }
      setTimeout(() => { window.location.href = "home.html"; }, 200);
    })
    .catch((error) => {
      console.error('signIn error', error);
      if (message) {
        message.style.color = "red";
        message.textContent = error.message || 'Login failed';
      } else {
        alert(error.message || 'Login failed');
      }
    });
};


// ================= LOGOUT =================
window.logout = function () {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
};


// ================= HELPERS =================
function el(html) {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstChild;
}

function splitSkills(skillString) {
  if (!skillString) return [];
  return skillString.split(',').map(s => s.trim()).filter(Boolean);
}

function makeTag(text) {
  const t = document.createElement('span');
  t.className = "bg-white/5 px-3 py-1 rounded-full text-sm text-gray-200 border border-white/10";
  t.textContent = text;
  return t;
}

function escapeHtml(unsafe) {
  return (unsafe || '').toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function linkify(text) {
  const escaped = escapeHtml(text);
  const urlRegex = /((https?:\/\/|www\.)[^\s]+)/g;
  return escaped.replace(urlRegex, function(url) {
    let href = url;
    if (!href.startsWith('http')) href = 'http://' + href;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-primary underline">${href}</a>`;
  });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

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


// ================= GLOBAL CENTERED MODAL (confirm/alert) =================
let globalModalExists = false;
function ensureGlobalModal() {
  if (globalModalExists) return;
  globalModalExists = true;

  const html = `
  <div id="globalModalOverlay" class="fixed inset-0 bg-black/60 z-50 hidden flex items-center justify-center">
    <div id="globalModalCard" class="bg-[#020617] text-gray-200 rounded-xl w-full max-w-md p-6 border border-white/10 shadow-xl">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h3 id="globalModalTitle" class="text-lg font-semibold"></h3>
          <p id="globalModalMessage" class="text-sm text-gray-400 mt-2"></p>
        </div>
      </div>
      <div class="mt-6 flex justify-end gap-3" id="globalModalButtons"></div>
    </div>
  </div>
  `;
  document.body.insertBefore(el(html), document.body.firstChild);
}

function showAlert(message, title = '') {
  ensureGlobalModal();
  return new Promise((resolve) => {
    const overlay = document.getElementById('globalModalOverlay');
    const titleEl = document.getElementById('globalModalTitle');
    const msgEl = document.getElementById('globalModalMessage');
    const btns = document.getElementById('globalModalButtons');

    titleEl.textContent = title || '';
    msgEl.textContent = message || '';
    btns.innerHTML = `<button id="globalModalOk" class="px-4 py-2 bg-primary rounded-md text-white">OK</button>`;

    overlay.classList.remove('hidden');

    const ok = document.getElementById('globalModalOk');
    function done() {
      overlay.classList.add('hidden');
      ok.removeEventListener('click', done);
      resolve();
    }
    ok.addEventListener('click', done);
  });
}

function showConfirm(message, title = '', okText = 'Yes', cancelText = 'Cancel') {
  ensureGlobalModal();
  return new Promise((resolve) => {
    const overlay = document.getElementById('globalModalOverlay');
    const titleEl = document.getElementById('globalModalTitle');
    const msgEl = document.getElementById('globalModalMessage');
    const btns = document.getElementById('globalModalButtons');

    titleEl.textContent = title || '';
    msgEl.textContent = message || '';
    btns.innerHTML = `
      <button id="globalModalCancel" class="px-4 py-2 rounded-md border">${cancelText}</button>
      <button id="globalModalOk" class="px-4 py-2 bg-primary rounded-md text-white">${okText}</button>
    `;

    overlay.classList.remove('hidden');

    const ok = document.getElementById('globalModalOk');
    const cancel = document.getElementById('globalModalCancel');

    function cleanup() {
      overlay.classList.add('hidden');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
    }
    function onOk() { cleanup(); resolve(true); }
    function onCancel() { cleanup(); resolve(false); }

    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
  });
}


// ================= REQUEST MODAL (single instance) =================
let requestModalExists = false;
function ensureRequestModal() {
  if (requestModalExists) return;
  requestModalExists = true;

  const modalHtml = `
    <div id="requestOverlay" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 hidden">
      <div class="bg-[#020617] text-gray-200 rounded-lg w-full max-w-lg p-6 border border-white/10">
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

  document.getElementById('requestCloseBtn').onclick = closeRequestModal;
  document.getElementById('requestCancelBtn').onclick = closeRequestModal;
}

let currentModalMentor = null;

async function openRequestModal(mentor) {
  ensureRequestModal();
  currentModalMentor = mentor;
  const overlay = document.getElementById('requestOverlay');
  const title = document.getElementById('requestModalTitle');
  const skillInput = document.getElementById('requestSkillInput');
  const msgInput = document.getElementById('requestMessageInput');

  title.textContent = `Send Learning Request to ${mentor.name || mentor.email || 'mentor'}`;

  const offers = splitSkills(mentor.offer);
  if (offers.length === 1) skillInput.value = offers[0];
  else skillInput.value = '';

  if (!skillInput.value) skillInput.placeholder = offers.length ? offers.join(', ') : 'e.g. Python Programming';
  msgInput.value = '';

  overlay.classList.remove('hidden');

  const sendBtn = document.getElementById('requestSendBtn');
  sendBtn.onclick = async () => {
    const skill = skillInput.value.trim();
    const note = msgInput.value.trim();

    if (!skill) {
      await showAlert('Please enter the skill you want to learn.', 'Missing skill');
      return;
    }
    if (!note) {
      const ok = await showConfirm('Send without a message?', 'No message provided', 'Send', 'Cancel');
      if (!ok) return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) { await showAlert('Not authenticated.'); closeRequestModal(); return; }
      const reqRef = push(ref(database, "requests"));
      await set(reqRef, {
        from: currentUser.uid,
        to: mentor.uid,
        skill: skill,
        note: note,
        status: "pending",
        createdAt: Date.now()
      });
      await showAlert('Request sent.', 'Success');
      closeRequestModal();
      if (window.location.pathname.includes('view-requests.html')) {
        await populateRequestsPage(currentUser.uid);
      }
      if (window.location.pathname.includes('home.html')) {
        await populateDashboardFor(currentUser.uid, currentUser.email, currentUser);
      }
    } catch (err) {
      console.error('Failed to send request', err);
      await showAlert('Failed to send request.');
    }
  };
}

function closeRequestModal() {
  const overlay = document.getElementById('requestOverlay');
  if (overlay) overlay.classList.add('hidden');
  currentModalMentor = null;
}


// ================= BROWSE: mentor card + populate =================
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

  const viewBtn = document.createElement('a');
  viewBtn.className = "px-4 py-2 border border-white/20 rounded-md text-sm text-center";
  viewBtn.textContent = 'View Profile';
  viewBtn.href = `profile.html?uid=${mentor.uid}`;
  right.appendChild(viewBtn);

  const requestBtn = document.createElement('button');
  requestBtn.className = "px-4 py-2 bg-primary rounded-md text-white";
  requestBtn.textContent = 'Request';
  requestBtn.onclick = () => openRequestModal(mentor);
  right.appendChild(requestBtn);

  card.appendChild(left);
  card.appendChild(right);
  return card;
}

let browseCache = [];
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

    ensureRequestModal();

  } catch (err) {
    console.error("Error populating browse page:", err);
    const container = document.getElementById("mentorsContainer");
    if (container) container.innerHTML = '<p class="text-red-400">Failed to load mentors.</p>';
  }
}


// ================= isConnected: sessions OR accepted requests =================
async function isConnected(uidA, uidB) {
  try {
    // 1) check sessions (accepted/active)
    const sessionsSnap = await get(ref(database, "sessions"));
    if (sessionsSnap.exists()) {
      const sessions = sessionsSnap.val();
      const found = Object.values(sessions).some(s => {
        if (!s) return false;
        const okStatus = (s.status === 'active' || s.status === 'accepted');
        const between = (s.teacher === uidA && s.learner === uidB) || (s.teacher === uidB && s.learner === uidA);
        return okStatus && between;
      });
      if (found) return true;
    }

    // 2) fallback: check requests with status 'accepted' between them (some flows might set accepted before session created)
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


// ================= DASHBOARD: sessions & stats (fixed name + contact after accept) =================
function createSessionCard(session, otherUser, currentUid) {
  const container = document.createElement("div");
  container.className = "bg-white/3 border border-white/10 rounded-lg p-4 flex justify-between items-start";

  const isCurrentTeacher = (currentUid === session.teacher);
  const roleLabel = isCurrentTeacher ? 'Learning:' : 'Teaching:';

  // prefer session-stored names/emails (set at acceptance time)
  const teacherName = session.teacherName || (session.teacher === otherUser?.uid ? otherUser.name : null);
  const learnerName = session.learnerName || (session.learner === otherUser?.uid ? otherUser.name : null);

  const roleName = isCurrentTeacher
    ? (learnerName || (otherUser && otherUser.uid === session.learner ? otherUser.name : 'Learner'))
    : (teacherName || (otherUser && otherUser.uid === session.teacher ? otherUser.name : 'Teacher'));

  // use session-stored emails first (teacherEmail/learnerEmail) then otherUser.email
  const contact = isCurrentTeacher
    ? (session.learnerEmail || otherUser?.email || session.contact || '—')
    : (session.teacherEmail || otherUser?.email || session.contact || '—');

  const left = document.createElement("div");
  left.innerHTML = `
    <div class="text-lg font-semibold">${escapeHtml(session.skill || '')}</div>
    <div class="text-sm text-gray-300">${escapeHtml(roleLabel)} ${escapeHtml(roleName || '')}</div>
    <div class="text-sm text-gray-400">Contact: ${escapeHtml(contact)}</div>
  `;

  const right = document.createElement("div");
  right.className = "flex gap-2";

  const statusBtn = document.createElement("button");
  statusBtn.className = "px-3 py-1 rounded-md bg-black/80 text-white text-sm";
  statusBtn.textContent = (session.status || 'active');
  right.appendChild(statusBtn);

  if (session.status === 'active' || session.status === 'accepted') {
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

  container.appendChild(left);
  container.appendChild(right);
  return container;
}

async function populateDashboardFor(uid, currentUserEmail, firebaseUser) {
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
    const initial = (displayName && displayName[0]) ? displayName[0].toUpperCase() : 'U';
    const profileAvatar = document.getElementById("profileAvatar");
    const sidebarAvatar = document.getElementById("sidebarAvatar");
    if (profileAvatar) profileAvatar.textContent = initial;
    if (sidebarAvatar) sidebarAvatar.textContent = initial;

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

    const sessionsSnap = await get(ref(database, "sessions"));
    let activeCount = 0;
    const container = document.getElementById("activeSessionsContainer");
    if (container) container.innerHTML = '';
    if (sessionsSnap.exists()) {
      const sessions = sessionsSnap.val();
      const sessionList = Object.entries(sessions).map(([id, s]) => ({ id, ...s }));
      const matching = sessionList.filter(s => s.teacher === uid || s.learner === uid);
      activeCount = matching.length;
      if (matching.length === 0 && container) {
        container.innerHTML = '<p class="text-gray-400">No active sessions yet.</p>';
      } else {
        for (const s of matching) {
          s.id = s.id || s.sessionId || s.id;

          const otherUid = (s.teacher === uid) ? s.learner : s.teacher;

          let otherUser = null;
          if (otherUid) {
            const otherSnap = await get(ref(database, "users/" + otherUid));
            if (otherSnap.exists()) {
              otherUser = { uid: otherUid, ...otherSnap.val() };
            }
          }

          // resolve teacher/learner names/emails if not stored
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


// ================= PROFILE page =================
async function populateProfileFor(profileUid, firebaseUser) {
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


// ================= REQUESTS page (populate, accept, reject, cancel) =================
async function populateRequestsPage(currentUid) {
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
          // fetch both user profiles to store both names + emails in session
          const teacherUid = r.to;
          const learnerUid = r.from;

          const [teacherSnap, learnerSnap] = await Promise.all([
            get(ref(database, `users/${teacherUid}`)),
            get(ref(database, `users/${learnerUid}`))
          ]);

          const teacherData = teacherSnap.exists() ? teacherSnap.val() : {};
          const learnerData = learnerSnap.exists() ? learnerSnap.val() : {};

          // create session with embedded contact info
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
            learnerEmail: learnerData.email || ''
          };
          await set(sessRef, sessionObj);

          // update request to accepted + attach sessionId
          await update(ref(database, "requests/" + id), {
            status: 'accepted',
            acceptedAt: Date.now(),
            sessionId: sessRef.key
          });

          await showAlert('Request accepted. Session created.', 'Accepted');

          // refresh UI: requests, dashboard, browse
          await populateRequestsPage(auth.currentUser.uid);
          await populateDashboardFor(auth.currentUser.uid, auth.currentUser.email, auth.currentUser);
          // If learner is viewing browse or profile, they will see contact once they reload those views
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
          await populateDashboardFor(auth.currentUser.uid, auth.currentUser.email, auth.currentUser);
        } catch (err) {
          console.error('Reject failed', err);
          await showAlert('Failed to reject request. Try again.');
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


// ================= CHAT helpers & header population =================
function appendMessageToList(msg, currentUid) {
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

function listenToChat(sessionId, currentUid) {
  const list = document.getElementById("messagesList");
  const input = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendMessageBtn");
  if (!list) return;
  list.innerHTML = '<p class="text-gray-400">Loading messages…</p>';

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

// Populate chat header with participant name, skill and contact (email)
async function populateChatHeader(sessionId, currentUid) {
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
    const skill = s.skill || '';

    // If the session didn't store emails (older sessions), try to fetch user record, but show only if connected
    let finalEmail = email;
    if ((!finalEmail || finalEmail === '') && otherUid) {
      const otherSnap = await get(ref(database, `users/${otherUid}`));
      if (otherSnap.exists()) {
        const otherData = otherSnap.val();
        // show only if connected
        const connected = await isConnected(currentUid, otherUid);
        if (connected) finalEmail = otherData.email || '—';
      }
    }

    titleEl.innerHTML = `
      <div class="font-semibold text-xl">Chat with ${escapeHtml(name)}</div>
      <div class="text-sm text-gray-400 mt-1">Learning: ${escapeHtml(skill)}<br>Contact: ${escapeHtml(finalEmail)}</div>
    `;
  } catch (e) {
    console.error('populateChatHeader error', e);
  }
}


// ================= AUTH ROUTING & PAGE HOOKS =================
onAuthStateChanged(auth, (user) => {
  console.log("onAuthStateChanged user:", user);

  if (!user) {
    const protectedPages = ['profile.html','home.html','browse.html','view-requests.html','chat.html'];
    if (protectedPages.some(p => window.location.pathname.includes(p))) {
      window.location.href = "index.html";
    }
    return;
  }

  const uid = user.uid;
  const initial = (user.displayName && user.displayName[0]) ? user.displayName[0].toUpperCase() : (user.email ? user.email[0].toUpperCase() : 'U');
  const profileAvatar = document.getElementById("profileAvatar");
  const sidebarAvatar = document.getElementById("sidebarAvatar");
  const sidebarAvatarSmall = document.getElementById("sidebarAvatarSmall");
  if (profileAvatar) profileAvatar.textContent = initial;
  if (sidebarAvatar) sidebarAvatar.textContent = initial;
  if (sidebarAvatarSmall) sidebarAvatarSmall.textContent = initial;

  if (window.location.pathname.includes("home.html")) {
    showDashboard();
    populateDashboardFor(uid, user.email, user);
  }

  if (window.location.pathname.includes("profile.html")) {
    const params = new URLSearchParams(window.location.search);
    const profileUid = params.get('uid') || uid;
    populateProfileFor(profileUid, user);
  }

  if (window.location.pathname.includes("browse.html")) {
    populateBrowsePage(uid);
  }

  if (window.location.pathname.includes("view-requests.html")) {
    populateRequestsPage(uid);
  }

  if (window.location.pathname.includes("chat.html")) {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId');
    if (!sessionId) { showAlert('No session specified.'); return; }
    get(ref(database, `sessions/${sessionId}`)).then(async snap => {
      if (!snap.exists()) { showAlert('Session not found'); return; }
      const s = snap.val();
      if (s.teacher !== uid && s.learner !== uid) { showAlert('You are not a participant in this session'); return; }
      await populateChatHeader(sessionId, uid);
      listenToChat(sessionId, uid);
    }).catch(err => {
      console.error('Session load error', err);
      showAlert('Could not open chat');
    });
  }
});