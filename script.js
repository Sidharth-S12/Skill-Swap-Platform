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
  update
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

function createSessionCard(session, otherUser) {
  const container = document.createElement("div");
  container.className = "bg-white/3 border border-white/10 rounded-lg p-4 flex justify-between items-start";

  const left = document.createElement("div");
  left.innerHTML = `
    <div class="text-lg font-semibold">${session.skill}</div>
    <div class="text-sm text-gray-300">Teaching: ${session.teacherName || '—'}</div>
    <div class="text-sm text-gray-400">Contact: ${otherUser?.email || session.contact || '—'}</div>
  `;

  const right = document.createElement("div");
  right.className = "flex gap-2";
  const statusBtn = document.createElement("button");
  statusBtn.className = "px-3 py-1 rounded-md bg-black/80 text-white text-sm";
  statusBtn.textContent = (session.status || 'active');

  const msgBtn = document.createElement("button");
  msgBtn.className = "px-3 py-1 rounded-md border border-white/20 text-sm";
  msgBtn.textContent = "Message";
  msgBtn.onclick = () => {
    alert('Open message to ' + (otherUser?.email || 'user'));
  };

  right.appendChild(statusBtn);
  right.appendChild(msgBtn);

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
          if (!s.teacherName) {
            if (s.teacher && s.teacher !== uid) {
              const teacherSnap = await get(ref(database, "users/" + s.teacher));
              if (teacherSnap.exists()) s.teacherName = teacherSnap.val().name || 'Teacher';
            } else {
              s.teacherName = (s.teacher === uid) ? (userSnap.exists() ? userSnap.val().name : 'You') : 'Teacher';
            }
          }
          const card = createSessionCard(s, otherUser);
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

async function populateProfileFor(uid, firebaseUser) {
  try {
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

    // fetch user object
    const userSnap = await get(ref(database, "users/" + uid));
    let data = {};
    if (userSnap.exists()) data = userSnap.val();

    const displayName = data.name || (firebaseUser && firebaseUser.displayName) || (firebaseUser && firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User');
    if (profileNameEl) profileNameEl.textContent = displayName;
    if (profileBioEl) profileBioEl.textContent = data.bio || 'No bio available';
    if (profileEmailEl) profileEmailEl.textContent = `Email: ${data.email || (firebaseUser && firebaseUser.email) || '—'}`;

    // sessions completed placeholder (you can change to fetch real sessions)
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

    // wire edit button
    if (editBtn) {
      editBtn.onclick = () => {
        if (editForm) editForm.classList.remove('hidden');
        if (editName) editName.value = data.name || '';
        if (editOffer) editOffer.value = data.offer || '';
        if (editLearn) editLearn.value = data.learn || '';
        if (editMsg) editMsg.textContent = '';
        // scroll to form
        editForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
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

        // basic validation could be added
        try {
          await update(ref(database, "users/" + uid), {
            name: newName,
            offer: newOffer,
            learn: newLearn
          });
          if (editMsg) { editMsg.style.color = 'green'; editMsg.textContent = 'Profile updated.'; }

          // refresh UI
          await populateProfileFor(uid, firebaseUser);
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

    // If page was opened with ?edit=1, open the edit form automatically
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('edit') === '1') {
        if (editBtn) editBtn.click();
        else if (editForm) editForm.classList.remove('hidden');
      }
    } catch (e) {
      console.warn('Could not parse URL params for edit flag', e);
    }

  } catch (err) {
    console.error("Error populating profile:", err);
  }
}


// ================= DASHBOARD AUTH + DATA & PROFILE ROUTING =================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // not logged in
    hideDashboard();

    // If user is trying to access profile page or home, redirect to index
    if (window.location.pathname.includes("profile.html") || window.location.pathname.includes("home.html")) {
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
    populateProfileFor(uid, user);
  }
});
