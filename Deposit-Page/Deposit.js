// Deposit.js
// Admin dashboard for viewing balances and adjusting credits

let adminUsers = [];

document.addEventListener("DOMContentLoaded", () => {
  const user = window.Auth?.getCurrentUser();

  // Block non admins
  if (!user || !window.Auth.hasRole("admin")) {
    const warn = document.getElementById("admin-warning");
    if (warn) {
      warn.style.display = "block";
      warn.textContent = "You must be an admin to view this page. Redirecting to Home...";
    }
    setTimeout(() => {
      window.location.href = "../index.html";
    }, 1500);
    return;
  }

  // Prefill "given by"
  const givenByDefault = user.displayName ? `${user.displayName} (${user.username})` : user.username;
  const singleGivenBy = document.getElementById("single-givenby");
  const allGivenBy = document.getElementById("all-givenby");
  if (singleGivenBy) singleGivenBy.value = givenByDefault;
  if (allGivenBy) allGivenBy.value = givenByDefault;

  showAdminSections();
  loadUsersAndSummary();

  const singleForm = document.getElementById("single-adjust-form");
  if (singleForm) singleForm.addEventListener("submit", onSingleAdjust);

  const allForm = document.getElementById("all-adjust-form");
  if (allForm) allForm.addEventListener("submit", onAllAdjust);
});

function showAdminSections() {
  ["summary-section", "users-section", "adjust-user-section", "adjust-all-section"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
  });
}

async function loadUsersAndSummary() {
  const tbody = document.getElementById("users-body");
  if (tbody) tbody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

  try {
    const users = await window.Auth.getAdminUsers();
    adminUsers = Array.isArray(users) ? users : [];

    if (!adminUsers.length) {
      if (tbody) tbody.innerHTML = "<tr><td colspan='4'>No users found.</td></tr>";
      setSummary(0, 0);
      populateSingleUserSelect(adminUsers);
      return;
    }

    let totalTokens = 0;
    if (tbody) {
      tbody.innerHTML = "";
      adminUsers.forEach((u) => {
        totalTokens += Number(u.credits) || 0;

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
    }

    setSummary(adminUsers.length, totalTokens);
    populateSingleUserSelect(adminUsers);
  } catch (err) {
    console.error("[Deposit] Error loading users:", err);
    if (tbody) tbody.innerHTML = "<tr><td colspan='4' style='color:red;'>Error loading users.</td></tr>";
  }
}

function setSummary(totalUsers, totalTokens) {
  const usersEl = document.getElementById("total-users");
  const tokensEl = document.getElementById("total-tokens");
  if (usersEl) usersEl.textContent = totalUsers;
  if (tokensEl) tokensEl.textContent = totalTokens;
}

function populateSingleUserSelect(users) {
  const select = document.getElementById("single-user-select");
  if (!select) return;

  select.innerHTML = "";
  users.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = `${u.username} (${u.displayName || ""})`;
    select.appendChild(opt);
  });
}

function readMeta(prefix) {
  const current = window.Auth?.getCurrentUser?.();
  const grantedBy = current?.username || "";

  const givenByInput = document.getElementById(`${prefix}-givenby`)?.value?.trim();
  const reason = document.getElementById(`${prefix}-reason`)?.value?.trim();

  const fallbackGivenBy = current?.displayName
    ? `${current.displayName} (${current.username})`
    : (current?.username || "");

  return {
    grantedBy,
    givenBy: givenByInput || fallbackGivenBy,
    description: reason || "",
  };
}

// Single user adjust
async function onSingleAdjust(e) {
  e.preventDefault();

  const username = document.getElementById("single-user-select")?.value;
  const amountInput = document.getElementById("single-amount");
  const statusEl = document.getElementById("single-status");
  const opEl = document.querySelector('input[name="single-op"]:checked');

  if (!username || !amountInput || !opEl) return;

  const op = opEl.value; // add or set
  const amount = parseInt(amountInput.value, 10);

  const badAmount = !Number.isFinite(amount) || amount < 0 || (op === "add" && amount <= 0);
  if (badAmount) {
    if (statusEl) {
      statusEl.textContent = op === "set" ? "Enter 0 or a positive amount." : "Enter a positive amount.";
      statusEl.style.color = "red";
    }
    return;
  }

  if (statusEl) {
    statusEl.textContent = "Applying change...";
    statusEl.style.color = "black";
  }

  const meta = readMeta("single");

  try {
    await window.Auth.assignCredits(username, amount, op, meta);

    if (statusEl) {
      statusEl.textContent = op === "add"
        ? `Added ${amount} credits for ${username}.`
        : `Set ${username}'s credits to ${amount}.`;
      statusEl.style.color = "green";
    }

    await loadUsersAndSummary();
  } catch (err) {
    console.error("[Deposit] Single adjust failed:", err);
    if (statusEl) {
      statusEl.textContent = `Error: ${err.message || "Failed to adjust credits."}`;
      statusEl.style.color = "red";
    }
  }
}

// All users adjust
async function onAllAdjust(e) {
  e.preventDefault();

  const amountInput = document.getElementById("all-amount");
  const statusEl = document.getElementById("all-status");
  const opEl = document.querySelector('input[name="all-op"]:checked');

  if (!amountInput || !opEl) return;

  const op = opEl.value; // add or set
  const amount = parseInt(amountInput.value, 10);

  const badAmount = !Number.isFinite(amount) || amount < 0 || (op === "add" && amount <= 0);
  if (badAmount) {
    if (statusEl) {
      statusEl.textContent = op === "set" ? "Enter 0 or a positive amount." : "Enter a positive amount.";
      statusEl.style.color = "red";
    }
    return;
  }

  if (statusEl) {
    statusEl.textContent = op === "add" ? "Applying credits for all users..." : "Setting credits for all users...";
    statusEl.style.color = "black";
  }

  const meta = readMeta("all");

  try {
    if (!adminUsers.length) adminUsers = await window.Auth.getAdminUsers();

    for (const u of adminUsers) {
      await window.Auth.assignCredits(u.username, amount, op, meta);
    }

    if (statusEl) {
      statusEl.textContent = op === "add"
        ? `Added ${amount} credits for ${adminUsers.length} users.`
        : `Set credits to ${amount} for ${adminUsers.length} users.`;
      statusEl.style.color = "green";
    }

    await loadUsersAndSummary();
  } catch (err) {
    console.error("[Deposit] All adjust failed:", err);
    if (statusEl) {
      statusEl.textContent = `Error: ${err.message || "Failed to adjust credits for all users."}`;
      statusEl.style.color = "red";
    }
  }
}
