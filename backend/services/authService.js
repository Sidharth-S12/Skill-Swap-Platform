
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, database } from "../config/firebaseConfig.js";
import { isValidLanguage, validateFieldAndShow } from "../utils/validators.js";
import { showDashboard, hideDashboard, showAlert, setText } from "../utils/uiHelpers.js";

// We need to import these to populate UI on auth state change
// Ideally these should be injected or listener attached in script.js, 
// but to keep script.js small we might need a centralized way.
// For now, we will export the listener setup and let script.js pass the callbacks or we import them if possible.
// Circular dependencies are bad. script.js imports authService. authService shouldn't import script.js.
// We will emit events or accepts callbacks for UI updates.
// OR, we lazily import user/request services? 
// No, better to have a `router.js` or `app.js` that coordinates?
// The prompt asks for specific file structure.

// We will implement the functions and export them.
// The UI event listeners in script.js will call these.

export async function signupUser(event) {
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

    // Validate that the provided skills are in the allowed list (client-side)
    if (!isValidLanguage(offer) || !isValidLanguage(learn)) {
        console.warn('Invalid language provided', { offer, learn });
        if (message) {
            message.style.color = 'red';
            message.textContent = 'Please enter valid programming languages for both "Skill you offer" and "Skill you want to learn".';
        }
        // show per-field validation UI
        validateFieldAndShow(offerEl);
        validateFieldAndShow(learnEl);
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        // New users: set average rating visible as 1, but zero rated reviews initially.
        await set(ref(database, "users/" + uid), {
            name: name,
            email: email,
            offer: offer,
            learn: learn,
            // rating fields: avgRating shows 1 initially, totalRatings 0 (no reviews yet)
            avgRating: 0,
            totalRatings: 0,
            sessionsCompleted: 0
        });
        if (message) { message.style.color = "green"; message.textContent = "Signup successful! Redirecting..."; }
        console.log('signup success', uid);
        if (message) {
            message.style.color = "green";
            message.textContent = "Signup successful! Please sign in.";
        }

        await signOut(auth);

        setTimeout(() => {
            window.location.href = "signin.html";
        }, 800);

    } catch (error) {
        console.error('signup error', error);
        if (message) { message.style.color = "red"; message.textContent = error.message || 'Signup failed'; }
    }
}

export function loginUser(event) {
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
}

export function logout() {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
}

// ================= AUTH GUARD =================
let authGuardExecuted = false;

export function initAuthGuard() {
    // Protected pages that require authentication
    const protectedPages = ['profile.html', 'home.html', 'browse.html', 'view-requests.html', 'chat.html'];
    const isProtectedPage = protectedPages.some(p => window.location.pathname.includes(p));

    if (!isProtectedPage) return; // Public pages

    if (authGuardExecuted) return;
    authGuardExecuted = true;

    if (auth.currentUser) {
        console.log("Auth guard: currentUser already available", auth.currentUser.uid);
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe(); // One-time check
        if (!user) {
            console.log("Auth guard: User not authenticated, redirecting to index");
            window.location.href = "index.html";
        } else {
            console.log("Auth guard: User authenticated, allowing access", user.uid);
        }
    });
}

// ================= AUTH LISTENER =================
let authListenerRegistered = false;

// We allow passing callbacks to update UI from other modules to avoid circular imports
export function registerAuthListener(callbacks = {}) {
    if (authListenerRegistered) return;
    authListenerRegistered = true;

    onAuthStateChanged(auth, (user) => {
        console.log("Auth listener fired:", user ? user.uid : "logged out");

        if (!user) {
            const protectedPages = ['profile.html', 'home.html', 'browse.html', 'view-requests.html', 'chat.html'];
            if (protectedPages.some(p => window.location.pathname.includes(p))) {
                console.log("Auth listener: Session lost, redirecting to index");
                window.location.href = "index.html";
            }
            return;
        }

        // User is authenticated, trigger UI updates
        const uid = user.uid;
        const initial = (user.displayName && user.displayName[0]) ? user.displayName[0].toUpperCase() : (user.email ? user.email[0].toUpperCase() : 'U');

        // Update generic Avatar elements if they exist
        const profileAvatar = document.getElementById("profileAvatar");
        const sidebarAvatar = document.getElementById("sidebarAvatar");
        const sidebarAvatarSmall = document.getElementById("sidebarAvatarSmall");
        if (profileAvatar) profileAvatar.textContent = initial;
        if (sidebarAvatar) sidebarAvatar.textContent = initial;
        if (sidebarAvatarSmall) sidebarAvatarSmall.textContent = initial;

        // Call page specific callbacks
        if (window.location.pathname.includes("home.html")) {
            showDashboard();
            if (callbacks.onDashboard) callbacks.onDashboard(uid, user);
        }

        if (window.location.pathname.includes("profile.html")) {
            if (callbacks.onProfile) callbacks.onProfile(uid, user);
        }

        if (window.location.pathname.includes("browse.html")) {
            if (callbacks.onBrowse) callbacks.onBrowse(uid);
        }

        if (window.location.pathname.includes("view-requests.html")) {
            if (callbacks.onRequests) callbacks.onRequests(uid);
        }

        if (window.location.pathname.includes("chat.html")) {
            if (callbacks.onChat) callbacks.onChat(uid);
        }
    });
}
