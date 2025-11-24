// Simple front-end "Midway" login gate for the whole site.

// === CONFIG ===
// IMPORTANT: use the path with the space, exactly like the folder name.
const LOGIN_PATH = "/Authentication%20Page/Authentication.html";

const SESSION_KEY    = "eswag.session";
const POST_LOGIN_KEY = "eswag.postLoginRedirect";
const ONE_DAY_MS     = 24 * 60 * 60 * 1000;

// Demo users: same login flow, different roles
const DEMO_USERS = [
  { username: "employee", displayName: "Employee User", role: "employee", pin: "1111" },
  { username: "manager",  displayName: "Manager User",  role: "manager",  pin: "2222" },
];

// === Session helpers ===

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
  // go to home; global gate will push them to login again
  window.location.href = "/index.html";
}

// === Global login gate ===

function isLoginPage(pathname) {
  // normalize both sides and decode spaces
  const cleanPath = decodeURIComponent(pathname.replace(/\/+$/, ""));
  const cleanLogin = decodeURIComponent(LOGIN_PATH.replace(/\/+$/, ""));
  return cleanPath === cleanLogin;
}

function enforceGlobalLogin() {
  const path = window.location.pathname;
  console.log("[auth] current path:", path);

  // Allow the login page itself
  if (isLoginPage(path)) {
    console.log("[auth] on login page, no redirect");
    return;
  }

  if (!isLoggedIn()) {
    console.log("[auth] not logged in, redirecting to login");
    const target = path + window.location.search + window.location.hash;
    localStorage.setItem(POST_LOGIN_KEY, target || "/index.html");
    window.location.href = LOGIN_PATH;
  } else {
    console.log("[auth] already logged in");
  }
}

// === Nav + login form ===

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
  if (!form) return; // not on login page

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
  console.log("[auth] DOMContentLoaded, initializing auth");
  initNav();
  initLoginForm();
  enforceGlobalLogin();
});

// Expose for later manager-only features
window.Auth = {
  isLoggedIn,
  hasRole,
  getCurrentUser,
};
