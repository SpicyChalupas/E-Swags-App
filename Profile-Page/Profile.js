// Profile.js
// Shows account info, admin tools links, and a quick preview of who granted credits and why

(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function updateNavUserText(user) {
    const navUser = byId("nav-user");
    if (!navUser || !user) return;
    navUser.textContent = `${user.displayName} (${user.role}) | ${user.credits} credits`;
  }

  function fmtAmount(delta) {
    const n = Number(delta) || 0;
    const sign = n >= 0 ? "+" : "";
    return `${sign}${n}`;
  }

  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso || "");
      return d.toLocaleString();
    } catch {
      return String(iso || "");
    }
  }

  function ensureAdminLinks(adminTools) {
    if (!adminTools) return;

    const canSeeAdminTools = window.Auth && window.Auth.hasAnyRole && window.Auth.hasAnyRole("admin", "manager");
    adminTools.style.display = canSeeAdminTools ? "block" : "none";
    if (!canSeeAdminTools) return;

    // Deposit link 
    if (adminTools.querySelector(".admin-deposit-link") === null) {
      const depositLink = document.createElement("div");
      depositLink.className = "tool-box";
      depositLink.innerHTML = `
        <a class="tool-link admin-deposit-link" href="../Deposit-Page/Deposit.html">Open deposit dashboard</a>
        <p class="tool-desc">View token totals and adjust credits.</p>
      `;
      adminTools.appendChild(depositLink);
    }

    // Create Account link 
    if (adminTools.querySelector(".admin-create-link") === null) {
      const createLink = document.createElement("div");
      createLink.className = "tool-box";
      createLink.innerHTML = `
        <a class="tool-link admin-create-link" href="Admin.html">Create New Account</a>
        <p class="tool-desc">Add new employee or admin accounts to the system.</p>
      `;
      adminTools.appendChild(createLink);
    }
  }

  function renderHistory(txns) {
    const box = byId("profile-history");
    if (!box) return;

    if (!Array.isArray(txns) || txns.length === 0) {
      box.textContent = "No credit awards yet.";
      return;
    }

    const rows = txns.slice(0, 5).map((t) => {
      const giver = t.givenBy || t.grantedBy || "";
      const desc = t.description || t.reason || "";
      return `
        <div style="padding:8px 0; border-bottom:1px solid rgba(0,0,0,0.08);">
          <div style="font-size:12px; opacity:0.8;">${fmtDate(t.createdAt)}</div>
          <div><strong>${fmtAmount(t.delta)}</strong> credits</div>
          <div style="opacity:0.9;"><strong>Given by:</strong> ${giver || "Unknown"}</div>
          <div style="opacity:0.9;"><strong>Why:</strong> ${desc || "No description provided"}</div>
        </div>
      `;
    }).join("");

    box.innerHTML = rows;
  }

  async function loadProfile() {
    if (!window.Auth) {
      console.warn("Auth helper not found. Make sure auth.js is loaded before Profile.js");
      return;
    }

    // Refresh so credits stay current
    let user = null;
    try {
      user = await window.Auth.refreshUser();
    } catch {
      user = null;
    }

    user = user || window.Auth.getCurrentUser();
    if (!user) return;

    setText("profile-title", user.displayName || "Profile");
    setText("profile-displayName", user.displayName || "");
    setText("profile-username", user.username || "");
    setText("profile-role", user.role || "");
    setText("profile-credits", String(user.credits ?? ""));

    updateNavUserText(user);

    // Admin tools links
    const adminTools = byId("admin-tools");
    ensureAdminLinks(adminTools);

    // Credit history preview
    const historyBox = byId("profile-history");
    if (historyBox) historyBox.textContent = "Loading...";

    if (typeof window.Auth.getMyTransactions === "function") {
      const txns = await window.Auth.getMyTransactions(50);

      const creditOnly = Array.isArray(txns)
        ? txns
            .slice()
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .filter(t => (t.type || "").startsWith("credit"))
        : [];

      renderHistory(creditOnly);
    } else {
      if (historyBox) historyBox.textContent = "History is not enabled yet.";
    }

    if (window.location.hash === "#admin-tools" && adminTools) {
      adminTools.scrollIntoView({ behavior: "smooth" });
    }
  }

  document.addEventListener("DOMContentLoaded", loadProfile);
})();
