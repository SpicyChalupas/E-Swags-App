// Admin page controller
// Handles account creation by admins

(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  function showMessage(message, type) {
    const messageEl = byId("create-message");
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
  }

  function clearForm() {
    const form = byId("create-account-form");
    if (form) form.reset();
  }

  async function handleCreateAccount(e) {
    e.preventDefault();

    // Check admin permissions
    if (!window.Auth) {
      showMessage("Auth system not initialized", "error");
      return;
    }

    if (!window.Auth.hasAnyRole("admin")) {
      showMessage("You do not have permission to create accounts", "error");
      return;
    }

    // Get form values
    const username = byId("username").value.trim();
    const displayName = byId("displayName").value.trim();
    const password = byId("password").value.trim();
    const role = byId("role").value.trim();
    const credits = Number(byId("credits").value) || 0;

    // Validate inputs
    if (!username || !displayName || !password) {
      showMessage("Please fill in all required fields", "error");
      return;
    }

    if (username.length < 3) {
      showMessage("Username must be at least 3 characters", "error");
      return;
    }

    if (password.length < 6) {
      showMessage("Password must be at least 6 characters", "error");
      return;
    }

    // Show loading state
    const submitBtn = byId("create-account-form").querySelector("[type='submit']");
    submitBtn.disabled = true;
    showMessage("Creating account...", "loading");

    try {
      // Call the createUser function from auth.js
      const result = await window.Auth.createUser(username, displayName, password, role, credits);

      if (result.ok) {
        showMessage(
          `✓ Account created successfully! | Username: ${username} | Role: ${role} | Credits: ${credits}`,
          "success"
        );
        clearForm();
      } else {
        showMessage(result.error || "Failed to create account", "error");
      }
    } catch (err) {
      showMessage(err.message || "Error creating account", "error");
      console.error("Account creation error:", err);
    } finally {
      submitBtn.disabled = false;
    }
  }

  // Initialize on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    // Check if user is admin
    if (!window.Auth || !window.Auth.hasAnyRole("admin")) {
      const container = byId("admin-container") || document.querySelector(".admin-container");
      if (container) {
        container.innerHTML = "<h1>Access Denied</h1><p>You do not have permission to access this page.</p>";
      }
      return;
    }

    // Attach form submission handler
    const form = byId("create-account-form");
    if (form) {
      form.addEventListener("submit", handleCreateAccount);
    }

    // Update nav
    if (window.Auth) {
      const user = window.Auth.getCurrentUser();
      if (user) {
        const navUser = byId("nav-user");
        if (navUser) {
          navUser.textContent = `${user.displayName} (${user.role}) | ${user.credits} credits`;
        }
      }
    }
  });
})();
