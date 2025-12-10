// Deposit.js
// Admin only dashboard for viewing balances and depositing tokens

document.addEventListener("DOMContentLoaded", () => {
  console.log("[Deposit] Initializing");

  const user = window.Auth?.getCurrentUser();

  if (!user || !window.Auth.hasRole("admin")) {
    document.getElementById("admin-warning").style.display = "block";
    // Optionally send them back home after a short delay
    setTimeout(() => {
      window.location.href = "/index.html";
    }, 2000);
    return;
  }

  // If we reached here, user is admin
  document.getElementById("summary-section").style.display = "block";
  document.getElementById("users-section").style.display = "block";
  document.getElementById("deposit-all-section").style.display = "block";

  loadUsersAndSummary();

  const form = document.getElementById("deposit-all-form");
  form.addEventListener("submit", onDepositAll);
});

// Load all users and compute totals
async function loadUsersAndSummary() {
  const tbody = document.getElementById("users-body");
  tbody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

  try {
    const users = await window.Auth.getAdminUsers();

    if (!Array.isArray(users) || users.length === 0) {
      tbody.innerHTML = "<tr><td colspan='4'>No users found.</td></tr>";
      document.getElementById("total-users").textContent = "0";
      document.getElementById("total-tokens").textContent = "0";
      return;
    }

    let totalTokens = 0;
    tbody.innerHTML = "";
    users.forEach((u) => {
      totalTokens += u.credits || 0;

      const tr = document.createElement("tr");

      const tdUser = document.createElement("td");
      tdUser.textContent = u.username;

      const tdName = document.createElement("td");
      tdName.textContent = u.displayName || "";

      const tdRole = document.createElement("td");
      tdRole.textContent = u.role || "";

      const tdCredits = document.createElement("td");
      tdCredits.textContent = u.credits ?? 0;

      tr.appendChild(tdUser);
      tr.appendChild(tdName);
      tr.appendChild(tdRole);
      tr.appendChild(tdCredits);

      tbody.appendChild(tr);
    });

    document.getElementById("total-users").textContent = users.length;
    document.getElementById("total-tokens").textContent = totalTokens;
  } catch (err) {
    console.error("[Deposit] Error loading users:", err);
    tbody.innerHTML = `<tr><td colspan='4' style='color:red;'>Error loading users: ${err.message}</td></tr>`;
  }
}

// Handle "deposit to all" submit
async function onDepositAll(e) {
  e.preventDefault();

  const amountInput = document.getElementById("deposit-amount");
  const statusEl = document.getElementById("deposit-status");

  const amount = parseInt(amountInput.value, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    statusEl.textContent = "Enter a positive number.";
    statusEl.style.color = "red";
    return;
  }

  statusEl.textContent = "Depositing credits to all users...";
  statusEl.style.color = "black";

  try {
    const users = await window.Auth.getAdminUsers();
    if (!Array.isArray(users) || users.length === 0) {
      statusEl.textContent = "No users to deposit to.";
      statusEl.style.color = "red";
      return;
    }

    for (const u of users) {
      await window.Auth.assignCredits(u.username, amount, "add");
    }

    statusEl.textContent = `Successfully deposited ${amount} credits to ${users.length} users.`;
    statusEl.style.color = "green";

    // Reload table and totals
    await loadUsersAndSummary();
  } catch (err) {
    console.error("[Deposit] Deposit to all failed:", err);
    statusEl.textContent = `Error: ${err.message}`;
    statusEl.style.color = "red";
  }
}
