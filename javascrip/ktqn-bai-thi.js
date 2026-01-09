/**************************************************
 * KTQN - DANH SÁCH BÀI THI (SERVER-FIRST)
 * - Quizzes: API ?action=listQuizzes
 * - Attempts: API ?action=listResults
 * => Admin xóa kết quả trong RESULTS => thi lại được ngay
 **************************************************/

/*************** CONFIG ***************/
const SESSION_KEY = "KTQN_SESSION_V1";

// ✅ DÁN ĐÚNG LINK /exec mới của chủ tướng
const API_URL =
  "https://script.google.com/macros/s/AKfycbxY7818jgoFttC7rl4HdhFy4RM84dPTIvAmLWo7kNr4Cw-62TAikiHaV-3iudhLpcwJ5Q/exec";

const CAT_INFO = {
  chiensi: { title: "Bài thi cho chiến sĩ", sub: "Danh sách bài thi theo tuần" },
  qncn: { title: "Bài thi cho QNCN", sub: "Danh sách bài thi theo tuần" },
  syquan: { title: "Bài thi cho sỹ quan", sub: "Danh sách bài thi theo tuần" },
  nhanthuc: { title: "Bài thi nhận thức chính trị", sub: "Danh sách bài thi theo tuần" },
};

/*************** HELPERS ***************/
const $ = (id) => document.getElementById(id);

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}
function requireLogin() {
  const s = loadSession();
  if (!s?.username) {
    window.location.href =
      `dangnhapktqn.html?return=${encodeURIComponent(location.pathname + location.search)}`;
    return null;
  }
  return s;
}
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function norm(v) { return String(v ?? "").trim(); }
function toNum(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yy} ${hh}:${mi}`;
  } catch {
    return "";
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error("INVALID_JSON"); }
}

/*************** SERVER ***************/
async function loadQuizzes() {
  const d = await fetchJson(`${API_URL}?action=listQuizzes&t=${Date.now()}`);
  if (!d || d.ok !== true) throw new Error(d?.error || "LIST_QUIZZES_FAILED");
  return Array.isArray(d.quizzes) ? d.quizzes : [];
}

async function loadResults() {
  const d = await fetchJson(`${API_URL}?action=listResults&t=${Date.now()}`);
  if (!d || d.ok !== true) throw new Error(d?.error || "LIST_RESULTS_FAILED");
  return Array.isArray(d.results) ? d.results : [];
}

// Đếm lượt thi theo server (username + cat + week + quizTitle)
function usedAttempts(results, quiz, username) {
  const u = String(username || "");
  const cat = String(quiz.cat || "");
  const week = String(quiz.week ?? "");
  const title = String(quiz.title || "");
  return (results || []).filter(r =>
    String(r.username || "") === u &&
    String(r.cat || "") === cat &&
    String(r.week ?? "") === week &&
    String(r.quizTitle || "") === title
  ).length;
}

/*************** RENDER ***************/
function renderList(cat, sess, quizzes, results) {
  const listEl = $("list");
  const countEl = $("count");
  if (!listEl) return;

  const items = (quizzes || [])
    .filter(q => String(q.cat || "") === String(cat))
    .sort((a, b) => toNum(b.week, 0) - toNum(a.week, 0));

  if (countEl) countEl.textContent = items.length;

  if (!items.length) {
    listEl.innerHTML = `<div class="item" style="color:#666">Chưa có bài thi.</div>`;
    return;
  }

  listEl.innerHTML = items.map(q => {
    const maxAttempts = toNum(q.maxAttempts, 3);
    const used = usedAttempts(results, q, sess.username);
    const left = Math.max(0, maxAttempts - used);
    const disabled = left <= 0;
    const qCount = Array.isArray(q.questions) ? q.questions.length : 0;
    const timeText = toNum(q.timeLimitMin, 0) > 0 ? `${q.timeLimitMin} phút` : "không giới hạn";

    return `
      <div class="item">
        <div>
          <h3>${esc(q.title || "Bài thi")}</h3>
          <div class="meta">
            <span>📅 Tuần ${esc(q.week)}</span>
            <span>•</span>
            <span>🧩 ${esc(qCount)} câu</span>
            <span>•</span>
            <span>🎯 Lượt thi: <b>${esc(used)}/${esc(maxAttempts)}</b></span>
            <span>•</span>
            <span>⏳ ${esc(timeText)}</span>
            <span>•</span>
            <span>🕒 Cập nhật: ${esc(fmtDate(q.updatedAt || q.createdAt))}</span>
          </div>

          ${
            disabled
              ? `<div style="margin-top:10px;color:#c62522;font-weight:900;">Đã hết lượt thi</div>`
              : `<a class="open" href="ktqn-lam-bai.html?id=${encodeURIComponent(q.id)}">Bắt đầu làm bài (còn ${left} lượt)</a>`
          }
        </div>
      </div>
    `;
  }).join("");
}

/*************** INIT ***************/
document.addEventListener("DOMContentLoaded", async () => {
  const sess = requireLogin();
  if (!sess) return;

  const params = new URLSearchParams(location.search);
  const cat = params.get("cat") || "chiensi";
  const info = CAT_INFO[cat] || CAT_INFO.chiensi;

  if ($("catTitle")) $("catTitle").textContent = info.title;
  if ($("catSub")) $("catSub").textContent = info.sub;
  if ($("userBox")) $("userBox").textContent = `${sess.fullName || ""} • ${sess.unit || ""}`;

  const listEl = $("list");
  if (listEl) listEl.innerHTML = `<div class="item" style="color:#666">⏳ Đang tải bài thi...</div>`;

  try {
    const [quizzes, results] = await Promise.all([loadQuizzes(), loadResults()]);
    renderList(cat, sess, quizzes, results);
  } catch (err) {
    console.error(err);
    if (listEl) {
      listEl.innerHTML = `
        <div class="item" style="color:#b00020">
          ❌ Không tải được danh sách bài thi từ server.<br/>
          Hãy thử mở: <b>${esc(API_URL)}?action=listQuizzes</b><br/>
          Và: <b>${esc(API_URL)}?action=listResults</b>
        </div>`;
    }
  }
});
