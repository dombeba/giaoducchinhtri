/**************************************************
 * KTQN - Làm bài thi
 * - Quiz lấy từ Apps Script => đồng bộ mọi thiết bị
 * - Kết quả: lưu local + gửi Apps Script RESULT_API_URL (giữ logic cũ)
 **************************************************/

// ====== STORAGE KEYS ======
const SESSION_KEY = "KTQN_SESSION_V1";
const RESULT_KEY = "KTQN_RESULTS_V1";

// ====== QUIZ API (SYNC) ======
const QUIZ_API_URL =
  "https://script.google.com/macros/s/AKfycbwSvIMUxw7NWwQ4dB-9cLIfAfyT9QRv21ukPHEaBO9ZweNzS4PbXRNhOmVdUePPvfvW/exec";
const QUIZ_CACHE_KEY = "KTQN_QUIZZES_CACHE_V1";

// ====== RESULT API (GIỮ NGUYÊN CỦA CHỦ TƯỚNG - nếu muốn đổi thì thay ở đây) ======
const RESULT_API_URL =
  "https://script.google.com/macros/s/AKfycbwSvIMUxw7NWwQ4dB-9cLIfAfyT9QRv21ukPHEaBO9ZweNzS4PbXRNhOmVdUePPvfvW/exec";

// ====== LABELS ======
const CAT_LABEL = {
  chiensi: "Chiến sĩ",
  qncn: "QNCN",
  syquan: "Sỹ quan",
  nhanthuc: "Nhận thức chính trị",
};

// ====== HELPERS ======
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

function saveResults(arr) {
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

function countAttempts(results, quizId, username) {
  return results.filter((r) => r.quizId === quizId && (r.user?.username || "") === username).length;
}

function makeUUID() {
  try {
    return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
  } catch {
    return String(Date.now());
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

/**
 * Gửi kết quả lên Apps Script (best-effort)
 * - Ưu tiên sendBeacon để không bị mất khi chuyển trang
 * - Fallback fetch keepalive
 */
function pushResultToSheetNonBlocking(record) {
  if (!RESULT_API_URL) return;

  const payload = {
    // user
    username: record.user?.username || "",
    fullName: record.user?.fullName || "",
    rank: record.user?.rank || "",
    position: record.user?.position || "",
    unit: record.user?.unit || "",
    phone: record.user?.phone || "",

    // quiz
    quizId: record.quizId || "",
    quizTitle: record.quizTitle || "",
    cat: record.cat || "",
    week: record.week ?? "",

    // result
    attemptNo: record.attemptNo ?? "",
    maxAttempts: record.maxAttempts ?? "",
    timeLimitMin: record.timeLimitMin ?? "",
    duration: record.durationSec ?? 0,
    autoSubmitted: record.autoSubmitted ? 1 : 0,
    score: record.score ?? 0,
    maxScore: record.maxScore ?? 0,
    submittedAt: record.submittedAt || "",
  };

  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(RESULT_API_URL, blob);
      if (ok) return;
    }
  } catch {}

  try {
    fetch(RESULT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
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

  // ✅ tải quiz từ API (sync), fallback cache
  let quizzes = [];
  try {
    quizzes = await fetchQuizzes();
  } catch (e) {
    quizzes = cacheLoad();
  }

  const quiz = quizzes.find((q) => String(q.id) === String(id));

  if (!quiz) {
    const quizTitleEl = document.getElementById("quizTitle");
    if (quizTitleEl) quizTitleEl.textContent = "❌ Không tìm thấy bài thi";
    if (statusEl) statusEl.textContent = "Bài thi không tồn tại hoặc đã bị xóa (hoặc bạn đang offline và chưa có cache).";
    return;
  }

  const maxAttempts = Number(quiz.maxAttempts ?? 3);
  const timeLimitMin = Number(quiz.timeLimitMin ?? 0);

  // ✅ chặn nếu đã hết lượt thi (lưu ý: lượt thi đang tính theo local máy hiện tại)
  const resultsNow = loadResults();
  const used = countAttempts(resultsNow, quiz.id, sess.username);
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

  // ✅ timer
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

  function submit(autoSubmitted = false) {
    if (!autoSubmitted) {
      const unanswered = qs.findIndex((q, idx) => !formEl.querySelector(`input[name="q_${idx}"]:checked`));
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

    const { score, maxScore } = calcScore();

    const results = loadResults();
    const attemptNo = countAttempts(results, quiz.id, sess.username) + 1;

    if (attemptNo > maxAttempts) {
      alert(`Bạn đã thi đủ ${maxAttempts} lần cho bài này.`);
      window.location.href = `ktqn-bai-thi.html?cat=${encodeURIComponent(quiz.cat)}`;
      return;
    }

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

    // 1) local
    results.push(record);
    saveResults(results);

    // 2) push to sheet best-effort
    pushResultToSheetNonBlocking(record);

    // 3) go result page
    window.location.href = `ktqn-ketqua.html?rid=${encodeURIComponent(rid)}`;
  }

  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) submitBtn.addEventListener("click", () => submit(false));
});
