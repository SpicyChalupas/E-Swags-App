// Raffle page script

const RAFFLE_VOTES_KEY = "luBucks.raffleVotes";
const RAFFLE_BALLOTS_KEY = "luBucks.raffleBallots";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[Raffle] Initializing...");

  const user = window.Auth?.getCurrentUser();
  if (user) {
    displayUserInfo(user);
  }

  setupVoteButtons();
  renderVoteCounts();
  renderMyVotes();
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

function loadVotes() {
  try {
    const raw = localStorage.getItem(RAFFLE_VOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveVotes(votes) {
  localStorage.setItem(RAFFLE_VOTES_KEY, JSON.stringify(votes));
}

function loadBallots() {
  try {
    const raw = localStorage.getItem(RAFFLE_BALLOTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBallots(ballots) {
  localStorage.setItem(RAFFLE_BALLOTS_KEY, JSON.stringify(ballots));
}

function setupVoteButtons() {
  const buttons = document.querySelectorAll(".vote-btn");

  const votes = loadVotes();

  buttons.forEach((btn) => {
    const item = btn.dataset.item;
    if (typeof votes[item] !== "number") {
      votes[item] = 0;
    }

    btn.addEventListener("click", () => handleVote(btn));
  });

  saveVotes(votes);
}

function renderVoteCounts() {
  const votes = loadVotes();
  const counters = document.querySelectorAll("[data-count-for]");

  counters.forEach((counter) => {
    const item = counter.dataset.countFor;
    const total = votes[item] || 0;
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

  const ballots = loadBallots();
  const userKey = user.username.toLowerCase();
  const myVotes = ballots[userKey] || {};

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

function handleVote(button) {
  const user = window.Auth?.getCurrentUser();

  if (!user) {
    alert("Please log in before voting.");
    return;
  }

  const group = button.dataset.group;
  const item = button.dataset.item;
  const userKey = user.username.toLowerCase();

  const votes = loadVotes();
  const ballots = loadBallots();

  if (!ballots[userKey]) {
    ballots[userKey] = {};
  }

  const currentVote = ballots[userKey][group];

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

  if (changingVote && votes[currentVote] > 0) {
    votes[currentVote] -= 1;
  }

  votes[item] = (votes[item] || 0) + 1;
  ballots[userKey][group] = item;

  saveVotes(votes);
  saveBallots(ballots);

  renderVoteCounts();
  renderMyVotes();

  alert("Your vote has been saved.");
}