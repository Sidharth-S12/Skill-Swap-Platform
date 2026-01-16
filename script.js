
/* ---------- SIGNUP ---------- */
function signupUser(event) {
  event.preventDefault();

  const fullName = document.getElementById('fullname').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const skillOffer = document.getElementById('skilloffer').value.trim();
  const skillLearn = document.getElementById('skilllearn').value.trim();

  const message = document.getElementById('signupMessage');

  if (localStorage.getItem(email)) {
    message.textContent = "User already exists! Please login.";
    message.style.color = "red";
    return;
  }

  const user = { fullName, email, password, skillOffer, skillLearn };
  localStorage.setItem(email, JSON.stringify(user));

  message.textContent = "Signup successful! Redirecting to login...";
  message.style.color = "green";

  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1500);
}

/* ---------- LOGIN ---------- */
function loginUser(event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const message = document.getElementById("message");

  const storedUser = JSON.parse(localStorage.getItem(email));

  if (!storedUser) {
    message.textContent = "No user found. Please sign up first.";
    message.style.color = "red";
    return;
  }

  if (storedUser.password === password) {
    message.textContent = "Login successful!";
    message.style.color = "limegreen";
  } else {
    message.textContent = "Invalid email or password.";
    message.style.color = "red";
  }
}
