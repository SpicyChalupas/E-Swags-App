// Profile page controller
// Shows account info for all users
// Shows admin tools (like Deposit link) for admins and managers only
// Also shows a short credit history

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

  function renderHistory(txns) {
    const box = byId("profile-history");
    if (!box) return;

    if (!window.Auth || typeof window.Auth.getMyTransactions !== "function") {
      box.textContent = "History is not enabled yet (getMyTransactions missing).";
      return;
    }

    if (!Array.isArray(txns) || txns.length === 0) {
      box.textContent = "No credit history yet.";
      return;
    }

    const html = txns.slice(0, 5).map((t) => {
      const giver = t.givenBy || t.grantedBy || "Unknown";
      const desc = t.description || t.reason || "No description provided";
      return `
        <div style="padding:8px 0; border-bottom:1px solid rgba(0,0,0,0.08);">
          <div style="font-size:12px; opacity:0.8;">${fmtDate(t.createdAt)}</div>
          <div><strong>${fmtAmount(t.delta)}</strong> credits</div>
          <div><strong>Given by:</strong> ${giver}</div>
          <div><strong>Why:</strong> ${desc}</div>
        </div>
      `;
    }).join("");

    box.innerHTML = html;
  }

  async function loadProfile() {
    if (!window.Auth) {
      console.warn("Auth helper not found. Make sure auth.js is loaded before Profile.js");
      return;
    }

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

    localStorage.setItem("eswag.lastProfileVisit", String(Date.now()));

    const adminTools = byId("admin-tools");
    const canSeeAdminTools = window.Auth.hasAnyRole("admin", "manager");
    if (adminTools) adminTools.style.display = canSeeAdminTools ? "block" : "none";

    updateNavUserText(user);

    // Load credit history
    const historyBox = byId("profile-history");
    if (historyBox) historyBox.textContent = "Loading...";

    if (typeof window.Auth.getMyTransactions === "function") {
      const txns = await window.Auth.getMyTransactions(200);
      const creditOnly = Array.isArray(txns)
        ? txns
            .slice()
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .filter(t => (t.type || "").startsWith("credit"))
        : [];
      renderHistory(creditOnly);
    } else {
      renderHistory([]);
    }

    if (window.location.hash === "#admin-tools" && adminTools) {
      adminTools.scrollIntoView({ behavior: "smooth" });
    }
  }

  document.addEventListener("DOMContentLoaded", loadProfile);
})();
