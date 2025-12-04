// Merch page script - handles purchases and credit management

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Merch] Initializing...");

  // Get current user and display credits
  const user = window.Auth?.getCurrentUser();
  if (user) {
    displayUserInfo(user);
  }

  // Attach purchase handlers to all buy buttons
  const buyButtons = document.querySelectorAll(".buy-btn");
  buyButtons.forEach((btn, index) => {
    btn.addEventListener("click", (e) => handlePurchase(e, index));
  });

  // Set up admin panel if user is admin
  if (window.Auth?.hasRole("admin")) {
    setupAdminPanel();
  }
});

// Display user info in a dedicated section
function displayUserInfo(user) {
  let infoSection = document.getElementById("user-info-section");
  if (!infoSection) {
    infoSection = document.createElement("div");
    infoSection.id = "user-info-section";
    infoSection.className = "user-info-banner";
    document.body.insertBefore(infoSection, document.querySelector("h2"));
  }

  infoSection.innerHTML = `
    <div style="background: #f0f0f0; padding: 15px; margin: 10px 0; border-radius: 5px;">
      <p><strong>${user.displayName}</strong> (${user.role})</p>
      <p>Available Credits: <strong id="credits-display">${user.credits}</strong></p>
      <button id="refresh-credits-btn" style="margin-top: 5px; padding: 5px 10px;">Refresh Credits</button>
    </div>
  `;

  document.getElementById("refresh-credits-btn").addEventListener("click", refreshUserCredits);
}

// Refresh user credits from backend
async function refreshUserCredits() {
  try {
    const credits = await window.Auth.getUserCredits();
    if (credits !== null) {
      document.getElementById("credits-display").textContent = credits;
      const user = window.Auth.getCurrentUser();
      user.credits = credits;
      console.log("[Merch] Credits refreshed:", credits);
    }
  } catch (err) {
    console.error("[Merch] Failed to refresh credits:", err);
  }
}

// Handle purchase button click
async function handlePurchase(e, buttonIndex) {
  e.preventDefault();

  const user = window.Auth?.getCurrentUser();
  if (!user) {
    alert("Please log in to make a purchase.");
    return;
  }

  // Get item info from the button's parent cell
  const cell = e.target.closest("td");
  const priceLabel = cell?.querySelector(".price-label")?.textContent || "Unknown";
  const costMatch = priceLabel.match(/(\d+)\s+swagbucks/);
  const cost = costMatch ? parseInt(costMatch[1]) : 0;

  if (cost <= 0) {
    alert("Invalid item price.");
    return;
  }

  // Check if user has enough credits
  if (user.credits < cost) {
    alert(`Insufficient credits! You have ${user.credits} credits but this item costs ${cost}.`);
    return;
  }

  // Confirm purchase
  const confirmed = window.confirm(
    `Purchase this item for ${cost} credits?\n\nYou will have ${user.credits - cost} credits remaining.`
  );
  if (!confirmed) return;

  // Make the purchase via backend
  try {
    const itemName = cell?.querySelector("img")?.alt || `Item ${buttonIndex + 1}`;
    const result = await window.Auth.makePurchase(`item-${buttonIndex}`, itemName, cost);

    alert(
      `Purchase successful!\n\nItem: ${result.itemName}\nCost: ${result.cost} credits\nRemaining: ${result.creditsRemaining} credits`
    );

    // Update local credits display
    const user = window.Auth.getCurrentUser();
    user.credits = result.creditsRemaining;
    displayUserInfo(user);
  } catch (err) {
    alert(`Purchase failed: ${err.message}`);
  }
}

// Setup admin panel for credit management
function setupAdminPanel() {
  let adminPanel = document.getElementById("admin-panel");
  if (!adminPanel) {
    adminPanel = document.createElement("div");
    adminPanel.id = "admin-panel";
    adminPanel.className = "admin-panel";
    document.querySelector("h2").insertAdjacentElement("afterend", adminPanel);
  }

  adminPanel.innerHTML = `
    <div style="background: #fff3cd; padding: 15px; margin: 10px 0; border-radius: 5px; border: 2px solid #ffc107;">
      <h3 style="margin-top: 0;">Admin Panel - Manage User Credits</h3>
      <div style="margin: 10px 0;">
        <button id="list-users-btn" style="padding: 8px 15px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">
          List All Users
        </button>
      </div>
      <div id="admin-users-list" style="margin-top: 15px;"></div>
      <div id="credit-assignment-form" style="display: none; margin-top: 15px; padding: 10px; background: white; border: 1px solid #ccc; border-radius: 3px;">
        <h4>Assign Credits</h4>
        <label>
          Username: <input type="text" id="target-username" required placeholder="username">
        </label>
        <label>
          Credits: <input type="number" id="credit-amount" required placeholder="100" min="0">
        </label>
        <label>
          <input type="radio" name="operation" value="add" checked> Add Credits
          <input type="radio" name="operation" value="set"> Set Credits
        </label>
        <button id="assign-btn" style="padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">
          Assign
        </button>
        <button id="cancel-assign-btn" style="padding: 5px 10px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">
          Cancel
        </button>
      </div>
    </div>
  `;

  document.getElementById("list-users-btn").addEventListener("click", listAdminUsers);
  document.getElementById("assign-btn").addEventListener("click", submitCreditAssignment);
  document.getElementById("cancel-assign-btn").addEventListener("click", cancelAssignment);
}

// List all users (admin)
async function listAdminUsers() {
  const listDiv = document.getElementById("admin-users-list");
  listDiv.innerHTML = "<p>Loading users...</p>";

  try {
    const users = await window.Auth.getAdminUsers();
    let html = "<table border='1' cellpadding='10' style='width:100%; margin-top:10px;'>";
    html += "<thead><tr><th>Username</th><th>Display Name</th><th>Role</th><th>Credits</th><th>Action</th></tr></thead>";
    html += "<tbody>";

    users.forEach((user) => {
      html += `<tr>
        <td>${user.username}</td>
        <td>${user.displayName}</td>
        <td>${user.role}</td>
        <td>${user.credits}</td>
        <td><button onclick="showCreditForm('${user.username}')" style="padding:5px 10px; background:#007bff; color:white; border:none; border-radius:3px; cursor:pointer;">
          Manage
        </button></td>
      </tr>`;
    });

    html += "</tbody></table>";
    listDiv.innerHTML = html;
  } catch (err) {
    listDiv.innerHTML = `<p style="color:red;">Error loading users: ${err.message}</p>`;
  }
}

// Show credit assignment form
function showCreditForm(username) {
  document.getElementById("target-username").value = username;
  document.getElementById("credit-assignment-form").style.display = "block";
  document.getElementById("credit-amount").focus();
}

// Cancel credit assignment
function cancelAssignment() {
  document.getElementById("credit-assignment-form").style.display = "none";
  document.getElementById("admin-users-list").innerHTML = "";
  document.getElementById("list-users-btn").click();
}

// Submit credit assignment
async function submitCreditAssignment() {
  const username = document.getElementById("target-username").value.trim();
  const credits = parseInt(document.getElementById("credit-amount").value);
  const operation = document.querySelector('input[name="operation"]:checked').value;

  if (!username || !Number.isFinite(credits) || credits < 0) {
    alert("Please fill in all fields correctly.");
    return;
  }

  try {
    const result = await window.Auth.assignCredits(username, credits, operation);
    alert(
      `Credits ${operation === "add" ? "added" : "set"} successfully!\n${username} now has ${result.user.credits} credits.`
    );
    cancelAssignment();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}
