/**************************************************
 * KTQN - Làm bài thi (ĐỒNG BỘ MỌI THIẾT BỊ)
 * ✅ Quiz: đọc từ Google Sheet (Publish CSV) => đồng bộ
 * ✅ Attempts: đếm từ Apps Script ?action=listResults => xóa trên admin là thi lại được
 * ✅ Result: gửi Apps Script bằng no-cors => ghi vào tab RESULTS
 **************************************************/

// ====== STORAGE KEYS ======
const SESSION_KEY = "KTQN_SESSION_V1";
const RESULT_KEY = "KTQN_RESULTS_V1"; // chỉ lưu lịch sử local (không dùng khóa lượt thi)

// ====== QUIZZES CSV ======
const QUIZZES_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRll8YoIR4meYyIMQ4zscJfwj6hc4FBXKYBr6al7BGXGFR8bIHBKJvi2ATlTgBlT2nQUPNtbUb-DZcS/pub?gid=1035670183&single=true&output=csv";

const QUIZ_CACHE_KEY = "KTQN_QUIZZES_CACHE_V1";

// ====== API (Apps Script /exec) ======
// 🔥 DÁN ĐÚNG LINK /exec mới của chủ tướng (container-bound)
const API_URL =
  "https://script.google.com/macros/s/AKfycbxY7818jgoFttC7rl4HdhFy4RM84dPTIvAmLWo7kNr4Cw-62TAikiHaV-3iudhLpcwJ5Q/exec";

// ====== LABELS ======
const CAT_LABEL = {
  chiensi: "Chiến sĩ",
  qncn: "QNCN",
  syquan: "Sỹ quan",
  nhanthuc: "Nhận thức chính trị",
};

// ====== HELPERS ======
function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}

function requireLogin() {
  const s = loadSession();
  if (!s?.username) {
    window.location.href = `dangnhapktqn.html?return=${encodeURIComponent(
      "kienthucquannhan.html"
    )}`;
    return null;
  }
  return s;
}

function loadLocalResults() {
  try {
    const arr = JSON.parse(localStorage.getItem(RESULT_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveLocalResults(arr) {
  localStorage.setItem(RESULT_KEY, JSON.stringify(arr));
}

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function makeUUID() {
  try {
    return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
  } catch {
    return String(Date.now());
  }
}

function cacheSave(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr || [])); } catch {}
}
function cacheLoad(key) {
  try {
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error("INVALID_JSON: " + text.slice(0, 200)); }
}

// ====== CSV PARSER ======
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }

  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

function toObjects(csvText) {
  const rows = parseCSV(csvText);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h).trim());
  return rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = r[i] ?? ""));
    return o;
  });
}

function normalizeQuizRow(x) {
  const cat = String(x.cat || x.category || "").trim();

  let questions = [];
  try { questions = JSON.parse(x.questionsJson || "[]"); } catch { questions = []; }

  return {
    id: String(x.id || "").trim(),
    cat,
    week: safeNum(x.week, 0),
    title: String(x.title || "").trim(),
    maxAttempts: safeNum(x.maxAttempts ?? 3, 3),
    timeLimitMin: safeNum(x.timeLimitMin ?? 0, 0),
    questions: Array.isArray(questions) ? questions : [],
    createdAt: String(x.createdAt || ""),
    updatedAt: String(x.updatedAt || ""),
  };
}

async function fetchQuizzesFromCSV() {
  if (!QUIZZES_CSV_URL || QUIZZES_CSV_URL.includes("DAN_LINK_CSV")) {
    throw new Error("CHUA_DAN_LINK_CSV_QUIZZES");
  }
  const url = `${QUIZZES_CSV_URL}${QUIZZES_CSV_URL.includes("?") ? "&" : "?"}_=${Date.now()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("FETCH_CSV_FAILED");

  const csv = await res.text();
  const raw = toObjects(csv);
  const quizzes = raw.map(normalizeQuizRow).filter((q) => q.id);

  cacheSave(QUIZ_CACHE_KEY, quizzes);
  return quizzes;
}

// ====== ATTEMPTS (SERVER) ======
// Đếm lượt thi từ RESULTS (server) => admin xóa là thi lại được
// Match theo: username + cat + week + quizTitle
function countAttemptsServer(results, quiz, username) {
  const u = String(username || "");
  const cat = String(quiz.cat || "");
  const week = String(quiz.week ?? "");
  const title = String(quiz.title || "");

  return (results || []).filter((r) =>
    String(r.username || "") === u &&
    String(r.cat || "") === cat &&
    String(r.week ?? "") === week &&
    String(r.quizTitle || "") === title
  ).length;
}

async function fetchAllResultsFromServer() {
  // cần Apps Script có action=listResults
  const data = await fetchJson(`${API_URL}?action=listResults&t=${Date.now()}`);
  if (!data || data.ok !== true) throw new Error(data?.error || "LIST_RESULTS_FAILED");
  return Array.isArray(data.results) ? data.results : [];
}

// ====== SEND RESULT (no-cors) ======
function pushResultToSheetNonBlocking(record) {
  const payload = {
    action: "submitResult",

    submittedAt: record.submittedAt || "",
    cat: record.cat || "",
    week: record.week ?? "",
    quizTitle: record.quizTitle || "",

    attemptNo: record.attemptNo ?? "",
    maxAttempts: record.maxAttempts ?? "",
    autoSubmitted: record.autoSubmitted ? 1 : 0,

    timeLimitMin: record.timeLimitMin ?? "",
    durationSec: record.durationSec ?? 0,

    fullName: record.user?.fullName || "",
    rank: record.user?.rank || "",
    position: record.user?.position || "",
    unit: record.user?.unit || "",
    phone: record.user?.phone || "",
    username: record.user?.username || "",

    // thêm để tiện thống kê
    score: record.score ?? "",
    maxScore: record.maxScore ?? "",
    quizId: record.quizId || "",
  };

  try {
    fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

// ====== MAIN ======
document.addEventListener("DOMContentLoaded", async () => {
  const sess = requireLogin();
  if (!sess) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const statusEl = document.getElementById("status");
  const formEl = document.getElementById("form");

  const userBox = document.getElementById("userBox");
  if (userBox) userBox.textContent = `${sess.fullName || ""} • ${sess.unit || ""}`;

  // 1) tải quiz từ CSV (sync), fallback cache
  let quizzes = [];
  try {
    quizzes = await fetchQuizzesFromCSV();
  } catch (e) {
    quizzes = cacheLoad(QUIZ_CACHE_KEY);
    if (statusEl && String(e?.message || "").includes("CHUA_DAN_LINK_CSV_QUIZZES")) {
      statusEl.textContent = "❌ Chưa dán link CSV QUIZZES (Publish to web).";
    }
  }

  const quiz = quizzes.find((q) => String(q.id) === String(id));

  if (!quiz) {
    const quizTitleEl = document.getElementById("quizTitle");
    if (quizTitleEl) quizTitleEl.textContent = "❌ Không tìm thấy bài thi";
    if (statusEl)
      statusEl.textContent =
        "Bài thi không tồn tại hoặc chưa tải được danh sách (offline/chưa publish CSV).";
    return;
  }

  const maxAttempts = Number(quiz.maxAttempts ?? 3);
  const timeLimitMin = Number(quiz.timeLimitMin ?? 0);

  // 2) ĐẾM LƯỢT THI TỪ SERVER (QUAN TRỌNG)
  let resultsServer = [];
  try {
    resultsServer = await fetchAllResultsFromServer();
  } catch (e) {
    // nếu server lỗi, để an toàn: KHÔNG chặn cứng, nhưng cảnh báo
    if (statusEl) statusEl.textContent = "⚠️ Không tải được lượt thi từ server (listResults). Vui lòng thử lại.";
  }

  const used = countAttemptsServer(resultsServer, quiz, sess.username);
  if (used >= maxAttempts) {
    alert(`Bạn đã thi đủ ${maxAttempts} lần cho bài này.`);
    window.location.href = `ktqn-bai-thi.html?cat=${encodeURIComponent(quiz.cat)}`;
    return;
  }

  // UI title
  const backBtn = document.getElementById("backBtn");
  if (backBtn) backBtn.href = `ktqn-bai-thi.html?cat=${encodeURIComponent(quiz.cat)}`;

  const quizTitleEl = document.getElementById("quizTitle");
  if (quizTitleEl) quizTitleEl.textContent = quiz.title || "Bài thi";

  const quizMetaEl = document.getElementById("quizMeta");
  if (quizMetaEl) {
    quizMetaEl.textContent =
      `Mục: ${CAT_LABEL[quiz.cat] || quiz.cat} • Tuần ${quiz.week} • Thi lần ${used + 1}/${maxAttempts}` +
      (timeLimitMin > 0 ? ` • Thời gian: ${timeLimitMin} phút` : "");
  }

  const qs = Array.isArray(quiz.questions) ? quiz.questions : [];
  const qCountEl = document.getElementById("qCount");
  if (qCountEl) qCountEl.textContent = qs.length;

  // render questions
  formEl.innerHTML = qs
    .map((q, idx) => {
      const name = `q_${idx}`;
      const opts = Array.isArray(q.options) ? q.options : [];
      return `
      <div class="q">
        <div class="q-title">Câu ${idx + 1}: ${esc(q.text || "")}</div>
        <div class="opts">
          ${opts
            .map(
              (op, j) => `
            <label class="opt">
              <input type="radio" name="${name}" value="${j}" />
              <span>${esc(op)}</span>
            </label>
          `
            )
            .join("")}
        </div>
      </div>
    `;
    })
    .join("");

  // timer
  let timerId = null;
  let remainingSec = timeLimitMin > 0 ? timeLimitMin * 60 : 0;
  const startAt = Date.now();

  if (timeLimitMin > 0) {
    const head = document.querySelector(".panel-head");
    if (head) {
      const t = document.createElement("span");
      t.className = "pill";
      t.id = "timerPill";
      t.textContent = "⏳ ...";
      head.appendChild(t);
    }

    const tick = () => {
      const pill = document.getElementById("timerPill");
      const m = Math.floor(remainingSec / 60);
      const s = remainingSec % 60;
      if (pill) pill.textContent = `⏳ ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

      if (remainingSec <= 0) {
        clearInterval(timerId);
        timerId = null;
        if (statusEl) statusEl.textContent = "⏰ Hết giờ. Hệ thống đang tự động nộp bài...";
        submit(true);
        return;
      }
      remainingSec -= 1;
    };

    tick();
    timerId = setInterval(tick, 1000);
  }

  function calcScore() {
    let score = 0;
    let maxScore = 0;

    qs.forEach((q, idx) => {
      const pts = Number(q.points || 1);
      maxScore += pts;

      const correct = Number(q.correctIndex);
      const chosen = formEl.querySelector(`input[name="q_${idx}"]:checked`);
      if (chosen && Number(chosen.value) === correct) score += pts;
    });

    return { score, maxScore };
  }

  async function submit(autoSubmitted = false) {
    if (!autoSubmitted) {
      const unanswered = qs.findIndex(
        (_, idx) => !formEl.querySelector(`input[name="q_${idx}"]:checked`)
      );
      if (unanswered >= 0) {
        if (statusEl) statusEl.textContent = `⚠️ Chưa trả lời Câu ${unanswered + 1}.`;
        return;
      }
    }

    const btn = document.getElementById("submitBtn");
    if (btn) btn.disabled = true;

    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }

    // 🔥 kiểm tra lại lượt thi trên server ngay trước khi ghi (tránh mở 2 tab)
    let usedNow = used;
    try {
      const fresh = await fetchAllResultsFromServer();
      usedNow = countAttemptsServer(fresh, quiz, sess.username);
      if (usedNow >= maxAttempts) {
        alert(`Bạn đã thi đủ ${maxAttempts} lần cho bài này.`);
        window.location.href = `ktqn-bai-thi.html?cat=${encodeURIComponent(quiz.cat)}`;
        return;
      }
    } catch {
      // nếu server lỗi, cho nộp nhưng có thể bị vượt lượt (hiếm)
    }

    const { score, maxScore } = calcScore();
    const attemptNo = usedNow + 1;

    const durationSec = Math.round((Date.now() - startAt) / 1000);
    const rid = makeUUID();

    const record = {
      id: rid,
      submittedAt: new Date().toISOString(),

      quizId: quiz.id,
      cat: quiz.cat,
      week: quiz.week,
      quizTitle: quiz.title,

      attemptNo,
      maxAttempts,
      timeLimitMin,
      durationSec,
      autoSubmitted,

      user: {
        username: sess.username,
        fullName: sess.fullName,
        rank: sess.rank,
        position: sess.position,
        unit: sess.unit,
        phone: sess.phone,
      },

      score,
      maxScore,
    };

    // 1) local history (chỉ để xem nhanh/offline)
    const local = loadLocalResults();
    local.push(record);
    saveLocalResults(local);

    // 2) push to sheet (server)
    pushResultToSheetNonBlocking(record);

    // 3) go result page
    window.location.href = `ktqn-ketqua.html?rid=${encodeURIComponent(rid)}`;
  }

  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) submitBtn.addEventListener("click", () => submit(false));
});
