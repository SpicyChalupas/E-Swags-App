// Frontend auth integration with backend JWT
// This script manages user sessions, handles login/logout, and provides auth helpers

// === CONFIG ===

const LOGIN_PATH = "/Authentication%20Page/Authentication.html";  

// Default to deployed App Runner URL; still allow overriding via `window.API_BASE`
const API_BASE = window.API_BASE || "https://x2dfiunvsh.us-east-2.awsapprunner.com"; // Override with window.API_BASE if needed


const SESSION_KEY = "eswag.session";
const TOKEN_KEY = "eswag.token";
const POST_LOGIN_KEY = "eswag.postLoginRedirect";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// === Session helpers ===

function saveSession(user, token) {
  const payload = {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    credits: user.credits,
    loginTime: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  localStorage.setItem(TOKEN_KEY, token);
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

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
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
  return !!getCurrentUser() && !!getToken();
}

function hasRole(role) {
  const u = getCurrentUser();
  return !!u && u.role === role;
}

function hasAnyRole(...roles) {
  const u = getCurrentUser();
  return !!u && roles.includes(u.role);
}

// === API Calls ===

async function loginWithBackend(username, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Login failed");
    }

    const data = await res.json();
    if (!data.ok || !data.token) {
      throw new Error("Invalid response from server");
    }

    saveSession(data.user, data.token);
    return data.user;
  } catch (err) {
    console.error("Backend login error:", err);
    throw err;
  }
}

// Get current user from backend (refresh session)
async function refreshUser() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    if (!res.ok) {
      clearSession();
      return null;
    }

    const data = await res.json();
    if (data.ok && data.user) {
      saveSession(data.user, token);
      return data.user;
    }
    return null;
  } catch (err) {
    console.error("Refresh error:", err);
    return null;
  }
}

// Get user credits from backend
async function getUserCredits() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/users/me/credits`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.ok ? data.credits : null;
  } catch (err) {
    console.error("Get credits error:", err);
    return null;
  }
}

// Make a purchase (deduct credits)
async function makePurchase(itemId, itemName, cost) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  try {
    const res = await fetch(`${API_BASE}/purchase`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ itemId, itemName, cost }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Purchase failed");
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Purchase error:", err);
    throw err;
  }
}

// === Admin API Calls ===

// Get all users (admin only)
async function getAdminUsers() {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to get users");
    }

    const data = await res.json();
    return data.ok ? data.users : [];
  } catch (err) {
    console.error("Get users error:", err);
    throw err;
  }
}

// Assign credits to user (admin only)
async function assignCredits(username, credits, operation = "add") {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  try {
    const res = await fetch(`${API_BASE}/admin/users/${username}/credits`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ credits, operation }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to assign credits");
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Assign credits error:", err);
    throw err;
  }
}

// === Global login gate ===

function isLoginPage(pathname) {
  const cleanPath = decodeURIComponent(pathname.replace(/\/+$/, ""));
  const cleanLogin = decodeURIComponent(LOGIN_PATH.replace(/\/+$/, ""));
  return cleanPath === cleanLogin;
}

function enforceGlobalLogin() {
  const path = window.location.pathname;
  console.log("[auth] current path:", path);

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
  const user = getCurrentUser();
  const navUser = document.getElementById("nav-user");
  const navLogin = document.getElementById("nav-login");
  const navLogout = document.getElementById("nav-logout");

  if (!navUser || !navLogin || !navLogout) return;

  if (user) {
    navUser.textContent = `${user.displayName} (${user.role}) | ${user.credits} credits`;
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
  const passwordInput = document.getElementById("password");
  const errorBox = document.getElementById("login-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    try {
      await loginWithBackend(usernameInput.value, passwordInput.value);

      const redirect = localStorage.getItem(POST_LOGIN_KEY) || "/index.html";
      localStorage.removeItem(POST_LOGIN_KEY);
      window.location.href = redirect;
    } catch (err) {
      errorBox.textContent = err.message || "Login failed";
      passwordInput.value = "";
    }
  });
}

function logout() {
  clearSession();
  window.location.href = "/index.html";
}

// === Init on DOM ready ===

document.addEventListener("DOMContentLoaded", () => {
  console.log("[auth] DOMContentLoaded, initializing auth");
  initNav();
  initLoginForm();
  enforceGlobalLogin();
});

// === Expose for other scripts ===

window.Auth = {
  isLoggedIn,
  hasRole,
  hasAnyRole,
  getCurrentUser,
  getToken,
  logout,
  loginWithBackend,
  refreshUser,
  getUserCredits,
  makePurchase,
  getAdminUsers,
  assignCredits,
};
