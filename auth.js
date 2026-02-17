// Frontend auth integration with backend JWT
// This script manages user sessions, handles login/logout, and provides auth helpers

// === CONFIG ===

// Use decoded path to work with both local and production
const LOGIN_PATH = "Authentication-Page/Authentication.html";

// Default to deployed App Runner URL; still allow overriding via `window.API_BASE`
const API_BASE = window.API_BASE || "https://x2dfiunvsh.us-east-2.awsapprunner.com"; // Override with window.API_BASE if needed

const IS_LOCAL = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const LOCAL_USERS_KEY = "eswag.localUsers";
const LOCAL_DEMO_USERS = [
  { username: "admin", displayName: "Admin User", role: "admin", credits: 1000, password: "admin123" },
  { username: "employee", displayName: "Employee User", role: "employee", credits: 500, password: "employee123" },
];

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

// === LOCAL transaction storage ===
// This is what powers Profile history + History page in local mode.
// In production you will only see history if your backend implements /users/me/transactions.
const TXNS_KEY = "eswag.transactions";
const MAX_TXNS = 2000;

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
  const safe = Array.isArray(txns) ? txns.slice(-MAX_TXNS) : [];
  localStorage.setItem(TXNS_KEY, JSON.stringify(safe));
}

function makeTxnId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return String(Date.now());
  }
}

function addTransaction(txn) {
  const txns = loadTransactions();
  txns.push(txn);
  saveTransactions(txns);
}

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
  if (IS_LOCAL) {
    const users = ensureLocalUsers();
    const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!user || user.password !== password.trim()) {
      throw new Error("Invalid username or password");
    }
    saveSession(user, "local-token");
    return user;
  }
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
  if (IS_LOCAL) {
    return getCurrentUser();
  }
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

    const data = await res.json();
    return data.ok ? data.credits : null;
  } catch (err) {
    console.error("Get credits error:", err);
    return null;
  }
}

// Get my transactions (history)
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

    // If not implemented yet, just return empty
    if (!res.ok) return [];

    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.transactions) ? data.transactions : [];
  } catch (err) {
    console.error("Get transactions error:", err);
    return [];
  }
}

// Make a purchase (deduct credits)
async function makePurchase(itemId, itemName, cost) {
  if (IS_LOCAL) {
    const user = getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    if (user.credits < cost) throw new Error("Insufficient credits");

    const updated = { ...user, credits: user.credits - cost };
    saveSession(updated, "local-token");

    const users = ensureLocalUsers().map(u =>
      u.username.toLowerCase() === updated.username.toLowerCase() ? { ...u, credits: updated.credits } : u
    );
    saveLocalUsers(users);

    // Log purchase
    addTransaction({
      id: makeTxnId(),
      username: updated.username,
      delta: -Math.abs(Number(cost) || 0),
      balanceAfter: updated.credits,
      givenBy: "E Swag Store",
      description: `Redeemed ${itemName}`,
      type: "purchase",
      createdAt: nowIso(),
    });

    return { ok: true, remainingCredits: updated.credits, itemId, itemName };
  }

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
  if (IS_LOCAL) {
    return ensureLocalUsers().map(({ password, ...rest }) => rest);
  }
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
// Backward compatible:
//  - assignCredits(user, credits, "add")
//  - assignCredits(user, credits, "remove")
//  - assignCredits(user, credits, "add", { givenBy, description })
async function assignCredits(username, credits, operation = "add", meta = null) {
  // If someone accidentally passes meta as the 3rd argument:
  if (typeof operation === "object" && operation !== null) {
    meta = operation;
    operation = "add";
  }

  const op = String(operation || "add").toLowerCase();
  const safeMeta = meta && typeof meta === "object" ? meta : {};
  const current = getCurrentUser();

  if (IS_LOCAL) {
    const users = ensureLocalUsers();
    const updated = users.map(u => {
      if (u.username.toLowerCase() !== String(username).toLowerCase()) return u;

      const oldCredits = Number(u.credits) || 0;
      const amount = Number(credits) || 0;

      // Your UI uses "remove" to mean Set
      const isSet = (op === "remove" || op === "set");
      const nextCredits = isSet ? amount : (oldCredits + amount);
      const delta = nextCredits - oldCredits;

      // Log credit transaction with who + why
      addTransaction({
        id: makeTxnId(),
        username: u.username,
        delta,
        balanceAfter: nextCredits,
        givenBy: safeMeta.givenBy || current?.username || "admin",
        description: safeMeta.description || "",
        type: isSet ? "credit_set" : "credit_add",
        createdAt: nowIso(),
      });

      return { ...u, credits: nextCredits };
    });

    saveLocalUsers(updated);

    const me = getCurrentUser();
    if (me && me.username.toLowerCase() === String(username).toLowerCase()) {
      const found = updated.find(u => u.username.toLowerCase() === String(username).toLowerCase());
      if (found) saveSession({ ...me, credits: found.credits }, "local-token");
    }

    return { ok: true };
  }

  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  try {
    const payload = { credits, operation: op };
    if (safeMeta.givenBy || safeMeta.description) payload.meta = safeMeta;

    const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(username)}/credits`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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

// Create new user account (admin only)
async function createUser(username, displayName, password, role = "employee", credits = 0) {
  if (IS_LOCAL) {
    const users = ensureLocalUsers();
    const exists = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (exists) throw new Error("User already exists");

    const newUser = {
      username,
      displayName,
      role,
      credits,
      password,
    };
    users.push(newUser);
    saveLocalUsers(users);
    return { ok: true, user: { username, displayName, role, credits } };
  }
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, displayName, password, role, credits }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to create user");
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Create user error:", err);
    throw err;
  }
}

// === Global login gate ===

function isLoginPage(pathname) {
  // Check if the pathname ends with Authentication.html (works locally and in production)
  return pathname.includes("Authentication.html") || pathname.includes("Authentication-Page");
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

    const baseUrl = window.location.origin;
    const pathBefore = window.location.pathname.includes("/E-Swags-App/") ? "/E-Swags-App/" : "/";
    window.location.href = baseUrl + pathBefore + "Authentication-Page/Authentication.html";
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
  getMyTransactions, // new
  makePurchase,
  getAdminUsers,
  assignCredits,     // Updated
  createUser,        
};
