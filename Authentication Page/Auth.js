// auth.js
// Front-end only "Midway" simulation. One login per day.
// Everyone logs in the same way; role is stored for later.

// Demo accounts
const DEMO_USERS = [
  { username: "employee", displayName: "Employee User", role: "employee", pin: "1111" },
  { username: "manager",  displayName: "Manager User",  role: "manager",  pin: "2222" },
];

const SESSION_KEY     = "eswag.session";
const POST_LOGIN_KEY  = "eswag.postLoginRedirect";
const ONE_DAY_MS      = 24 * 60 * 60 * 1000;

// adjust this to match login page path
const LOGIN_PATHS = [
  "/Authentication%20Page/Authentication.html",
  "/Authentication.html"
];

// ---------- basic session helpers ----------

function findUser(username) {
  return DEMO_USERS.find(
    u => u.username.toLowerCase() === username.toLowerCase()
  );
}

function saveSession(user) {
  const payload = {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    loginTime: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

function loadSessionRaw() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getCurrentUser() {
  const session = loadSessionRaw();
  if (!session) return null;

  const age = Date.now() - session.loginTime;
  if (age > ONE_DAY_MS) {
    // login expired after a day → force login again
    clearSession();
    return null;
  }
  return session;
}

function isLoggedIn() {
  return !!getCurrentUser();
}

function hasRole(role) {
  const u = getCurrentUser();
  return !!u && u.role === role;
}

async function loginWithPin(username, pin) {
  const user = findUser(username.trim());
  if (!user || user.pin !== pin.trim()) {
    throw new Error("Invalid username or security key PIN.");
  }
  saveSession(user);
}

function logout() {
  clearSession();
  window.location.href = "/index.html"; // after logout go to home → will be sent to login again
}

// ---------- global login gate ----------

function isLoginPage(pathname) {
  // normalize little differences like trailing slashes
  const clean = pathname.replace(/\/+$/, "");
  return LOGIN_PATHS.some(p => p.replace(/\/+$/, "") === clean);
}

function enforceGlobalLogin() {
  const path = window.location.pathname;

  // don't guard the login page itself
  if (isLoginPage(path)) return;

  // if not logged in, remember where they wanted to go and send to login
  if (!isLoggedIn()) {
    const target = path + window.location.search + window.location.hash;
    localStorage.setItem(POST_LOGIN_KEY, target || "/index.html");
    window.location.href = LOGIN_PATHS[0]; // first login path in the list
  }
}

// ---------- nav + login form UI ----------

function initNav() {
  const user      = getCurrentUser();
  const navUser   = document.getElementById("nav-user");
  const navLogin  = document.getElementById("nav-login");
  const navLogout = document.getElementById("nav-logout");

  if (!navUser || !navLogin || !navLogout) return;

  if (user) {
    navUser.textContent = `${user.displayName} (${user.role})`;
    navLogin.style.display = "none";
    navLogout.style.display = "inline";
    navLogout.onclick = (e) => {
      e.preventDefault();
      logout();
    };
  } else {
    navUser.textContent = "";
    navLogin.style.display = "inline";
    navLogout.style.display = "none";
  }
}

function initLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;

  const usernameInput = document.getElementById("username");
  const pinInput      = document.getElementById("pin");
  const errorBox      = document.getElementById("login-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    try {
      await loginWithPin(usernameInput.value, pinInput.value);

      const redirect = localStorage.getItem(POST_LOGIN_KEY) || "/index.html";
      localStorage.removeItem(POST_LOGIN_KEY);
      window.location.href = redirect;
    } catch (err) {
      errorBox.textContent = err.message;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initLoginForm();
  enforceGlobalLogin();   // <--- this is what forces login for the whole site
});

// Expose minimal API for later (role-based stuff)
window.Auth = {
  isLoggedIn,
  hasRole,
  getCurrentUser,
};
