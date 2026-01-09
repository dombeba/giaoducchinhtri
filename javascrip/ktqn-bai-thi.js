const SESSION_KEY = "KTQN_SESSION_V1";
const RESULT_KEY = "KTQN_RESULTS_V1";

// ✅ đồng bộ quiz từ Apps Script
const QUIZ_API_URL =
  "https://script.google.com/macros/s/AKfycbxY7818jgoFttC7rl4HdhFy4RM84dPTIvAmLWo7kNr4Cw-62TAikiHaV-3iudhLpcwJ5Q/exec";

// cache local phòng khi api lỗi
const QUIZ_CACHE_KEY = "KTQN_QUIZZES_CACHE_V1";

const CAT_MAP = {
  chiensi: { name: "Bài thi cho chiến sĩ", sub: "Danh sách bài thi theo tuần" },
  qncn: { name: "Bài thi cho QNCN", sub: "Danh sách bài thi theo tuần" },
  syquan: { name: "Bài thi cho sỹ quan", sub: "Danh sách bài thi theo tuần" },
  nhanthuc: { name: "Bài thi nhận thức chính trị", sub: "Danh sách bài thi theo tuần" },
};

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}
function requireLogin() {
  const s = loadSession();
  if (!s?.username) {
    window.location.href = `dangnhapktqn.html?return=${encodeURIComponent("kienthucquannhan.html")}`;
    return null;
  }
  return s;
}

function loadResults() {
  try {
    const arr = JSON.parse(localStorage.getItem(RESULT_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function cacheLoad() {
  try {
    const arr = JSON.parse(localStorage.getItem(QUIZ_CACHE_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function cacheSave(arr) {
  try {
    localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(arr || []));
  } catch {}
}

async function fetchQuizzes() {
  const url = `${QUIZ_API_URL}?action=listQuizzes&_=${Date.now()}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "API_ERROR");
  const quizzes = Array.isArray(data.quizzes) ? data.quizzes : [];
  cacheSave(quizzes);
  return quizzes;
}

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(
      d.getHours()
    ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}
function usedAttempts(results, quizId, username) {
  return results.filter((r) => r.quizId === quizId && (r.user?.username || "") === username).length;
}

document.addEventListener("DOMContentLoaded", async () => {
  const sess = requireLogin();
  if (!sess) return;

  const params = new URLSearchParams(window.location.search);
  const cat = params.get("cat") || "chiensi";
  const info = CAT_MAP[cat] || CAT_MAP.chiensi;

  document.getElementById("catTitle").textContent = info.name;
  document.getElementById("catSub").textContent = info.sub;
  document.getElementById("userBox").textContent = `${sess.fullName || ""} • ${sess.unit || ""}`;

  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");

  // load quizzes from API (sync), fallback cache
  let quizzesAll = [];
  try {
    quizzesAll = await fetchQuizzes();
  } catch (e) {
    quizzesAll = cacheLoad();
  }

  const results = loadResults();
  const all = quizzesAll.filter((q) => q.cat === cat).sort((a, b) => (b.week || 0) - (a.week || 0));

  if (countEl) countEl.textContent = all.length;

  if (!all.length) {
    listEl.innerHTML = `<div class="item" style="color:#666">Chưa có bài thi. Admin cần tạo bài trước.</div>`;
    return;
  }

  listEl.innerHTML = all
    .map((q) => {
      const maxAttempts = Number(q.maxAttempts ?? 3);
      const used = usedAttempts(results, q.id, sess.username);
      const left = Math.max(0, maxAttempts - used);
      const disabled = left <= 0;

      return `
      <div class="item">
        <div>
          <h3>${esc(q.title || "Bài thi")}</h3>
          <div class="meta">
            <span>📅 Tuần ${esc(q.week)}</span>
            <span>•</span>
            <span>📝 ${esc((q.questions || []).length)} câu</span>
            <span>•</span>
            <span>🎯 Lượt thi: <b>${esc(used)}/${esc(maxAttempts)}</b></span>
            <span>•</span>
            <span>⏳ ${Number(q.timeLimitMin ?? 0) > 0 ? `${esc(q.timeLimitMin)} phút` : "không giới hạn"}</span>
            <span>•</span>
            <span>🕒 ${q.updatedAt ? `Cập nhật: ${esc(fmtTime(q.updatedAt))}` : `Tạo: ${esc(fmtTime(q.createdAt))}`}</span>
          </div>

          ${
            disabled
              ? `<div style="margin-top:10px; color:#c62522; font-weight:900;">Đã hết lượt thi</div>`
              : `<a class="open" href="ktqn-lam-bai.html?id=${encodeURIComponent(q.id)}">Bắt đầu làm bài (còn ${left} lượt)</a>`
          }
        </div>
      </div>
    `;
    })
    .join("");
});
