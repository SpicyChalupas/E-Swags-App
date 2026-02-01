// Profile page controller
// Shows account info for all users
// Shows admin tools (like Deposit link) for admins and managers only

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

  async function loadProfile() {
    if (!window.Auth) {
      console.warn("Auth helper not found. Make sure auth.js is loaded before Profile.js");
      return;
    }

    // Refresh from backend so credits and role stay current
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

    // Track that the user visited their account info
    localStorage.setItem("eswag.lastProfileVisit", String(Date.now()));

    // Show admin tools only to admins and managers
    const adminTools = byId("admin-tools");
    const canSeeAdminTools = window.Auth.hasAnyRole("admin", "manager");
    if (adminTools) adminTools.style.display = canSeeAdminTools ? "block" : "none";

    updateNavUserText(user);

    if (window.location.hash === "#admin-tools" && adminTools) {
      adminTools.scrollIntoView({ behavior: "smooth" });
    }
  }

  document.addEventListener("DOMContentLoaded", loadProfile);
})();
