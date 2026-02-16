// History.js
// Shows credit transactions for the current user

(function () {
  function byId(id) {
    return document.getElementById(id);
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

  function setStatus(msg, color) {
    const el = byId("history-status");
    if (!el) return;
    el.textContent = msg;
    if (color) el.style.color = color;
  }

  function renderRows(txns) {
    const body = byId("history-body");
    if (!body) return;

    if (!Array.isArray(txns) || txns.length === 0) {
      body.innerHTML = "<tr><td colspan='4'>No credit history yet.</td></tr>";
      return;
    }

    body.innerHTML = txns
      .map((t) => {
        const giver = t.givenBy || t.grantedBy || "";
        const desc = t.description || t.reason || "";
        const amount = fmtAmount(t.delta);
        const date = fmtDate(t.createdAt);
        return `
          <tr>
            <td style="white-space:nowrap;">${date}</td>
            <td>${giver}</td>
            <td style="text-align:right;">${amount}</td>
            <td>${desc}</td>
          </tr>`;
      })
      .join("");
  }

  async function loadHistory() {
    if (!window.Auth) {
      setStatus("Auth helper not found.", "red");
      renderRows([]);
      return;
    }

    try {
      await window.Auth.refreshUser();
    } catch {}

    const user = window.Auth.getCurrentUser();
    if (!user) {
      setStatus("You are not logged in.", "red");
      renderRows([]);
      return;
    }

    setStatus("", "");

    const txns = await window.Auth.getMyTransactions(200);
    const sorted = Array.isArray(txns)
      ? txns.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      : [];

    const creditOnly = sorted.filter(t => (t.type || "").startsWith("credit"));
    renderRows(creditOnly);
  }

  document.addEventListener("DOMContentLoaded", loadHistory);
})();
