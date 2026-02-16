// Frontend auth integration with backend JWT
// Manages user sessions, login logout, and shared auth helpers for the site

// === CONFIG ===

// Default to deployed App Runner URL, allow override via window.API_BASE
const API_BASE = window.API_BASE || "https://x2dfiunvsh.us-east-2.awsapprunner.com";

// Simple local mode for Live Server testing
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(window.location.hostname);

// Demo users for local mode
const LOCAL_USERS_KEY = "eswag.localUsers";
const LOCAL_DEMO_USERS = [
  { username: "admin", displayName: "Admin User", role: "admin", credits: 1000, password: "admin123" },
  { username: "employee", displayName: "Employee User", role: "employee", credits: 500, password: "employee123" },
];

// Local transaction history (so the History page works without a backend)
const TXNS_KEY = "eswag.transactions";
const MAX_TXNS = 2000;

const SESSION_KEY = "eswag.session";
const TOKEN_KEY = "eswag.token";
const POST_LOGIN_KEY = "eswag.postLoginRedirect";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// === Local storage helpers ===

function loadLocalUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function ensureLocalUsers() {
  const existing = loadLocalUsers();
  if (existing && Array.isArray(existing) && existing.length) return existing;
  saveLocalUsers(LOCAL_DEMO_USERS);
  return LOCAL_DEMO_USERS;
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(TXNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTransactions(txns) {
  const trimmed = Array.isArray(txns) ? txns.slice(-MAX_TXNS) : [];
  localStorage.setItem(TXNS_KEY, JSON.stringify(trimmed));
}

function makeTxnId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toIso(d) {
  try {
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function addTransaction(txn) {
  const txns = loadTransactions();
  txns.push(txn);
  saveTransactions(txns);
}

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
  if (IS_LOCAL) {
    const users = ensureLocalUsers();
    const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!user || user.password !== password.trim()) {
      throw new Error("Invalid username or password");
    }
    saveSession(user, "local-token");
    return user;
  }

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
  if (!data.ok || !data.token || !data.user) {
    throw new Error("Invalid response from server");
  }

  saveSession(data.user, data.token);
  return data.user;
}

// Refresh session user from backend
async function refreshUser() {
  if (IS_LOCAL) return getCurrentUser();

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

    const data = await res.json().catch(() => ({}));
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

// Credits for current user
async function getUserCredits() {
  if (IS_LOCAL) {
    const user = getCurrentUser();
    return user ? user.credits : null;
  }

  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/users/me/credits`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => ({}));
    return data.ok ? data.credits : null;
  } catch (err) {
    console.error("Get credits error:", err);
    return null;
  }
}

// Transaction history for current user
async function getMyTransactions(limit = 50) {
  const user = getCurrentUser();
  if (!user) return [];

  if (IS_LOCAL) {
    const txns = loadTransactions()
      .filter(t => t && t.username && t.username.toLowerCase() === user.username.toLowerCase())
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return txns.slice(0, Math.max(1, Number(limit) || 50));
  }

  const token = getToken();
  if (!token) return [];

  try {
    const res = await fetch(`${API_BASE}/users/me/transactions?limit=${encodeURIComponent(limit)}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    // If the endpoint is not available yet, do not break the UI
    if (!res.ok) return [];

    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.transactions) ? data.transactions : [];
  } catch (err) {
    console.error("Get transactions error:", err);
    return [];
  }
}

// Purchase item (deduct credits)
async function makePurchase(itemId, itemName, cost) {
  if (IS_LOCAL) {
    const user = getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    if ((Number(user.credits) || 0) < (Number(cost) || 0)) throw new Error("Insufficient credits");

    const nextCredits = (Number(user.credits) || 0) - Math.abs(Number(cost) || 0);
    const updated = { ...user, credits: nextCredits };
    saveSession(updated, "local-token");

    const users = ensureLocalUsers().map(u =>
      u.username.toLowerCase() === updated.username.toLowerCase() ? { ...u, credits: updated.credits } : u
    );
    saveLocalUsers(users);

    addTransaction({
      id: makeTxnId(),
      username: updated.username,
      delta: -Math.abs(Number(cost) || 0),
      balanceAfter: updated.credits,
      givenBy: "E-Swag Store",
      description: `Redeemed ${itemName}`,
      type: "purchase",
      createdAt: toIso(new Date()),
    });

    return { ok: true, creditsRemaining: updated.credits, itemId, itemName, cost };
  }

  const token = getToken();
  if (!token) throw new Error("Not authenticated");

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

  return await res.json();
}

// === Admin calls ===

// Admin user list
async function getAdminUsers() {
  if (IS_LOCAL) {
    return ensureLocalUsers().map(({ password, ...rest }) => rest);
  }

  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_BASE}/admin/users`, {
    headers: { "Authorization": `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to get users");
  }

  const data = await res.json().catch(() => ({}));
  return data.ok ? (data.users || []) : [];
}

// Assign credits to a user (admin only)
// operation: "add" or "set" (also accepts "remove" for older UIs)
// meta can include: givenBy, grantedBy, description
async function assignCredits(username, credits, operation = "add", meta = {}) {
  const op = (operation || "").toLowerCase();

  if (IS_LOCAL) {
    const users = ensureLocalUsers();

    let updatedUser = null;
    const updated = users.map(u => {
      if (u.username.toLowerCase() !== String(username).toLowerCase()) return u;

      const oldCredits = Number(u.credits) || 0;
      const amount = Number(credits) || 0;

      const isSetOp = op === "set" || op === "remove";
      const nextCredits = isSetOp ? amount : (oldCredits + amount);
      const delta = nextCredits - oldCredits;

      updatedUser = { ...u, credits: nextCredits };

      addTransaction({
        id: makeTxnId(),
        username: u.username,
        delta,
        balanceAfter: nextCredits,
        givenBy: meta.givenBy || meta.grantedBy || getCurrentUser()?.username || "admin",
        description: meta.description || "",
        type: isSetOp ? "credit_set" : "credit_add",
        createdAt: toIso(new Date()),
      });

      return updatedUser;
    });

    saveLocalUsers(updated);

    const current = getCurrentUser();
    if (current && current.username.toLowerCase() === String(username).toLowerCase()) {
      saveSession({ ...current, credits: updatedUser ? updatedUser.credits : current.credits }, "local-token");
    }

    return { ok: true, user: updatedUser };
  }

  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(username)}/credits`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credits, operation: op, meta }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to assign credits");
  }

  return await res.json();
}

// === Global login gate ===

function isLoginPage(pathname) {
  return pathname.includes("Authentication.html") || pathname.includes("Authentication-Page");
}

function enforceGlobalLogin() {
  const path = window.location.pathname;

  if (isLoginPage(path)) return;

  if (!isLoggedIn()) {
    const target = path + window.location.search + window.location.hash;
    localStorage.setItem(POST_LOGIN_KEY, target || "/index.html");

    const baseUrl = window.location.origin;
    const pathBefore = window.location.pathname.includes("/E-Swags-App/") ? "/E-Swags-App/" : "/";
    window.location.href = baseUrl + pathBefore + "Authentication-Page/Authentication.html";
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
  if (!form) return;

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorBox = document.getElementById("login-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorBox) errorBox.textContent = "";

    try {
      await loginWithBackend(usernameInput.value, passwordInput.value);

      const redirect = localStorage.getItem(POST_LOGIN_KEY) || "/index.html";
      localStorage.removeItem(POST_LOGIN_KEY);
      window.location.href = redirect;
    } catch (err) {
      if (errorBox) errorBox.textContent = err.message || "Login failed";
      if (passwordInput) passwordInput.value = "";
    }
  });
}

function logout() {
  clearSession();
  window.location.href = "/index.html";
}

// === Init ===

document.addEventListener("DOMContentLoaded", () => {
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
  getMyTransactions,
  makePurchase,
  getAdminUsers,
  assignCredits,
};
