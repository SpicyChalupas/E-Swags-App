// Raffle page script

const API_BASE = window.API_BASE || "https://x2dfiunvsh.us-east-2.awsapprunner.com";

let voteTotals = {
  "weekly-1": 0,
  "weekly-2": 0,
  "weekly-3": 0,
  "monthly-1": 0,
  "monthly-2": 0,
  "monthly-3": 0,
};

let myVotes = {
  weekly: null,
  monthly: null,
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("[Raffle] Initializing...");

  const user = window.Auth?.getCurrentUser();
  if (user) {
    displayUserInfo(user);
  }

  setupVoteButtons();
  loadVotesFromServer();
});

function displayUserInfo(user) {
  let infoSection = document.getElementById("user-info-section");

  if (!infoSection) {
    infoSection = document.createElement("div");
    infoSection.id = "user-info-section";
    infoSection.className = "user-info-banner";

    const heading = document.querySelector("h2");
    if (heading) {
      heading.insertAdjacentElement("afterend", infoSection);
    }
  }

  infoSection.innerHTML = `
    <div class="user-info-box">
      <p><strong>${user.displayName}</strong> (${user.role})</p>
      <p>Cast your votes for the next giveaway prizes.</p>
    </div>
  `;
}

async function loadVotesFromServer() {
  const token = window.Auth?.getToken?.();

  try {
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/raffle/votes`, {
      headers,
    });

    if (!res.ok) {
      throw new Error("Unable to load raffle votes");
    }

    const data = await res.json();
    if (data?.ok) {
      voteTotals = {
        ...voteTotals,
        ...(data.totals || {}),
      };
      myVotes = {
        weekly: data?.myVotes?.weekly || null,
        monthly: data?.myVotes?.monthly || null,
      };
    }
  } catch (err) {
    console.error("[Raffle] Failed to load votes:", err);
  }

  renderVoteCounts();
  renderMyVotes();
}

function setupVoteButtons() {
  const buttons = document.querySelectorAll(".vote-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => handleVote(btn));
  });
}

function renderVoteCounts() {
  const counters = document.querySelectorAll("[data-count-for]");

  counters.forEach((counter) => {
    const item = counter.dataset.countFor;
    const total = voteTotals[item] || 0;
    counter.textContent = `${total} vote${total === 1 ? "" : "s"}`;
  });
}

function renderMyVotes() {
  const user = window.Auth?.getCurrentUser();
  const buttons = document.querySelectorAll(".vote-btn");

  buttons.forEach((btn) => {
    btn.classList.remove("selected-vote");
    btn.textContent = "Vote";
  });

  if (!user) return;

  buttons.forEach((btn) => {
    const group = btn.dataset.group;
    const item = btn.dataset.item;

    if (myVotes[group] === item) {
      btn.classList.add("selected-vote");
      btn.textContent = "Selected";
    } else if (myVotes[group]) {
      btn.textContent = "Change Vote";
    }
  });
}

async function handleVote(button) {
  const user = window.Auth?.getCurrentUser();
  const token = window.Auth?.getToken?.();

  console.log("[Raffle] handleVote: user=", user?.username, "token present=", !!token, "token value=", token?.slice(0,20));

  if (!user || !token) {
    console.warn("[Raffle] Not logged in or no token — user:", user, "token:", token);
    alert("Please log in before voting.");
    return;
  }

  const group = button.dataset.group;
  const item = button.dataset.item;
  const currentVote = myVotes[group];

  if (currentVote === item) {
    alert("You already selected this option.");
    return;
  }

  const changingVote = !!currentVote;

  const confirmed = window.confirm(
    changingVote
      ? "You already voted in this section. Do you want to change your vote?"
      : "Submit your vote for this giveaway prize?"
  );

  if (!confirmed) return;

  try {
    console.log("[Raffle] POSTing vote:", { group, item }, "to", API_BASE);
    const res = await fetch(`${API_BASE}/raffle/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ group, item }),
    });

    const data = await res.json().catch(() => ({}));
    console.log("[Raffle] vote response:", res.status, data);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "Unable to save vote");
    }

    voteTotals = {
      ...voteTotals,
      ...(data.totals || {}),
    };
    myVotes = {
      weekly: data?.myVotes?.weekly || null,
      monthly: data?.myVotes?.monthly || null,
    };

    renderVoteCounts();
    renderMyVotes();

    alert("Your vote has been saved.");
  } catch (err) {
    console.error("[Raffle] Failed to save vote:", err);
    alert(err.message || "Unable to save vote.");
  }
}