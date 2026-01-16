// 🔥 Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 🔴 PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyBUMI6CgEVrnfsTVBXZx3uZDsBh5oUY-1w",
  authDomain: "skill-swap-platform-53823.firebaseapp.com",
  projectId:"skill-swap-platform-53823",
  appId: "1:527524796826:web:8b7f50476ba72c8ebe0223"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

//
// -------- SIGNUP --------
//
window.signupUser = function (event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const message = document.getElementById("signupMessage");

  createUserWithEmailAndPassword(auth, email, password)
    .then(() => {
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

//
// -------- LOGIN --------
//
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
window.logout = function () {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
};
