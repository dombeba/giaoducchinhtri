/***************** CONFIG *****************/
const SESSION_KEY = "KTQN_SESSION_V1";

// ✅ Link /exec mới (giống admin)
const API_URL =
  "https://script.google.com/macros/s/AKfycbxY7818jgoFttC7rl4HdhFy4RM84dPTIvAmLWo7kNr4Cw-62TAikiHaV-3iudhLpcwJ5Q/exec";

/***************** HELPERS *****************/
const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}

function requireLogin() {
  const s = loadSession();
  if (!s?.username) {
    window.location.href = `dangnhapktqn.html?return=${encodeURIComponent(location.pathname + location.search)}`;
    return null;
  }
  return s;
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${dd}/${mm}/${yy} ${hh}:${mi}:${ss}`;
  } catch {
    return "";
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error("INVALID_JSON: " + text.slice(0, 200)); }
}

function norm(v) { return String(v ?? "").trim(); }
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

/***************** LOAD + FILTER *****************/
async function loadMyResults(username) {
  const data = await fetchJson(`${API_URL}?action=listResults&t=${Date.now()}`);
  if (!data || data.ok !== true) throw new Error(data?.error || "LIST_RESULTS_FAILED");

  const all = Array.isArray(data.results) ? data.results : [];

  // chỉ lấy của user đang đăng nhập
  const mine = all.filter(r => String(r.username || "") === String(username));

  // sắp xếp mới nhất lên đầu
  mine.sort((a, b) => norm(b.submittedAt).localeCompare(norm(a.submittedAt)));

  return mine;
}

/***************** RENDER *****************/
function renderMyResults(sess, items) {
  const tbody = $("tbody");
  const status = $("status");

  if (status) {
    status.textContent = `Tài khoản: ${sess.username} • ${items.length} kết quả`;
  }

  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="padding:14px;color:#666">Chưa có kết quả.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(r => {
    const scoreText =
      norm(r.score) || norm(r.maxScore)
        ? `<b>${esc(r.score)} / ${esc(r.maxScore)}</b>`
        : `<span style="color:#666">—</span>`;

    return `
      <tr>
        <td>${esc(fmtDate(r.submittedAt))}</td>
        <td>${esc(r.cat)}</td>
        <td>${esc(r.week)}</td>
        <td>${esc(r.quizTitle)}</td>
        <td>${esc(r.attemptNo)}</td>
        <td>${esc(r.fullName)}</td>
        <td>${esc(r.rank)}</td>
        <td>${esc(r.unit)}</td>
        <td>${esc(r.phone)}</td>
        <td>${scoreText}</td>
      </tr>
    `;
  }).join("");
}

/***************** INIT *****************/
document.addEventListener("DOMContentLoaded", async () => {
  const sess = requireLogin();
  if (!sess) return;

  // Nếu trang có chỗ hiển thị tên
  if ($("me")) $("me").textContent = `${sess.fullName || ""} (${sess.username})`;

  // Thông báo tải
  if ($("status")) $("status").textContent = "⏳ Đang tải kết quả từ server...";

  try {
    const mine = await loadMyResults(sess.username);
    renderMyResults(sess, mine);
    if ($("status")) $("status").textContent = `✅ Đã đồng bộ • ${mine.length} kết quả`;
  } catch (err) {
    console.error(err);
    if ($("status")) $("status").textContent = "❌ Không tải được kết quả từ server.";
    const tbody = $("tbody");
    if (tbody) {
      tbody.innerHTML = `
        <tr><td colspan="10" style="padding:14px;color:#b00020">
          Không tải được dữ liệu.<br/>
          Thử mở: <b>${esc(API_URL)}?action=listResults</b>
        </td></tr>`;
    }
  }
});
