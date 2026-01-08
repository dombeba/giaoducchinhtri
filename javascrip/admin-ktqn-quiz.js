// =============================
// ADMIN - KTQN QUIZ (SYNC PC ↔ PHONE)
// ✅ READ: Google Sheet CSV (không CORS)
// ✅ WRITE/DELETE: Apps Script no-cors (né CORS)
// File: javascrip/admin-ktqn-quiz.js
// =============================

// ===== BẢO VỆ ADMIN (CÁCH 1) =====
const ADMIN_PASSWORD = "123321";
const input = prompt("🔐 Nhập mật khẩu quản trị:");
if (input !== ADMIN_PASSWORD) {
  alert("❌ Sai mật khẩu. Không có quyền truy cập.");
  window.location.href = "index.html";
}

// ====== CONFIG ======

// ✅ 1) LINK CSV QUIZZES (Publish to web -> CSV)
// DÁN LINK CSV Ở ĐÂY (phải có output=csv)
const QUIZ_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRll8YoIR4meYyIMQ4zscJfwj6hc4FBXKYBr6al7BGXGFR8bIHBKJvi2ATlTgBlT2nQUPNtbUb-DZcS/pub?gid=1035670183&single=true&output=csv";

// ✅ 2) LINK APPS SCRIPT (ghi/xóa)
// (CORS chặn đọc response, nhưng gửi no-cors vẫn đi)
const QUIZ_API_URL =
  "https://script.google.com/macros/s/AKfycbwYk8NZK4q88kWHlvSG9Ehb8zHf-04CaYnYprSMV_dj73LS2banBP7ceEqEx6cn2fWbDA/exec";

// Cache local (phòng khi CSV lỗi)
const QUIZ_CACHE_KEY = "KTQN_QUIZZES_CACHE_V1";

// ====== DOM ======
const $ = (id) => document.getElementById(id);

// ====== UI ======
function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}
function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ====== CACHE ======
function cacheSave(arr) {
  try { localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(arr || [])); } catch {}
}
function cacheLoad() {
  try {
    const arr = JSON.parse(localStorage.getItem(QUIZ_CACHE_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

// ====== CSV PARSER (giống kiểu chủ tướng đang dùng) ======
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }

    if (!inQuotes && ch === ",") { row.push(cur); cur = ""; continue; }
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

  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ""));
}

function toObjects(csvText) {
  const rows = parseCSV(csvText);
  if (!rows.length) return [];
  const headers = rows[0].map(h => String(h).trim());
  return rows.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => (o[h] = r[i] ?? ""));
    return o;
  });
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeQuizObj(x) {
  // chuẩn header khuyến nghị:
  // id,cat,week,title,maxAttempts,timeLimitMin,questionsJson,createdAt,updatedAt
  // nếu chủ tướng lỡ đặt category thay cat -> vẫn đọc
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
    questions,
    createdAt: String(x.createdAt || ""),
    updatedAt: String(x.updatedAt || "")
  };
}

// ====== READ QUIZZES (CSV) ======
async function fetchQuizzesFromCSV() {
  if (!QUIZ_CSV_URL || QUIZ_CSV_URL.includes("DAN_LINK_CSV")) {
    throw new Error("CHUA_DAN_LINK_CSV_QUIZZES");
  }

  const url = `${QUIZ_CSV_URL}${QUIZ_CSV_URL.includes("?") ? "&" : "?"}_=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("FETCH_CSV_FAILED");
  const csv = await res.text();

  const raw = toObjects(csv);
  const quizzes = raw.map(normalizeQuizObj).filter(q => q.id);

  cacheSave(quizzes);
  return quizzes;
}

// ====== WRITE/DELETE (no-cors) ======
async function postNoCors(payload) {
  // ⚠️ no-cors: không đọc được response, nhưng request sẽ đi
  await fetch(QUIZ_API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  // chờ Apps Script ghi sheet
  await sleep(900);
}

// ====== QUESTIONS UI ======
function makeQCard(q = {}) {
  const wrap = document.createElement("div");
  wrap.className = "qcard";
  wrap.innerHTML = `
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <div style="font-weight:900;">Câu hỏi</div>
      <button class="btn danger del" type="button">Xóa câu</button>
    </div>

    <div class="qrow">
      <label class="full">
        Nội dung câu <span class="req">*</span>
        <input class="qText" type="text" placeholder="Nhập câu hỏi..." value="${esc(q.text || "")}"/>
      </label>

      <label>Đáp án A <span class="req">*</span>
        <input class="opt" data-i="0" type="text" value="${esc(q.options?.[0] || "")}"/>
      </label>
      <label>Đáp án B <span class="req">*</span>
        <input class="opt" data-i="1" type="text" value="${esc(q.options?.[1] || "")}"/>
      </label>
      <label>Đáp án C <span class="req">*</span>
        <input class="opt" data-i="2" type="text" value="${esc(q.options?.[2] || "")}"/>
      </label>
      <label>Đáp án D <span class="req">*</span>
        <input class="opt" data-i="3" type="text" value="${esc(q.options?.[3] || "")}"/>
      </label>

      <label>Đáp án đúng <span class="req">*</span>
        <select class="correct">
          <option value="0">A</option><option value="1">B</option>
          <option value="2">C</option><option value="3">D</option>
        </select>
      </label>

      <label>Điểm (mặc định 1)
        <input class="points" type="number" min="1" max="10" value="${esc(q.points || "1")}"/>
      </label>
    </div>
  `;
  wrap.querySelector(".correct").value = String(q.correctIndex ?? 0);
  wrap.querySelector(".del").addEventListener("click", () => wrap.remove());
  return wrap;
}

function readQuestions() {
  const qWrap = $("qWrap");
  const cards = Array.from(qWrap.querySelectorAll(".qcard"));
  const questions = [];

  for (const card of cards) {
    const text = card.querySelector(".qText")?.value?.trim();
    const opts = Array.from(card.querySelectorAll(".opt")).map(i => i.value.trim());
    const correctIndex = Number(card.querySelector(".correct")?.value ?? 0);
    const points = Number(card.querySelector(".points")?.value ?? 1);

    if (!text) throw new Error("Có câu hỏi chưa có nội dung.");
    if (opts.some(x => !x)) throw new Error("Có câu hỏi chưa đủ 4 đáp án.");
    if (!(correctIndex >= 0 && correctIndex <= 3)) throw new Error("Có câu hỏi chưa chọn đáp án đúng.");

    questions.push({ text, options: opts, correctIndex, points: points > 0 ? points : 1 });
  }
  if (!questions.length) throw new Error("Chưa có câu hỏi nào.");
  return questions;
}

// ====== RENDER LIST ======
let QUIZZES_MEM = [];

async function refreshList() {
  const list = $("list");
  if (!list) return;

  setStatus("Đang tải danh sách bài thi...");
  try {
    QUIZZES_MEM = await fetchQuizzesFromCSV();
    setStatus(`✅ Đã tải ${QUIZZES_MEM.length} bài (CSV)`);
  } catch (e) {
    QUIZZES_MEM = cacheLoad();
    if (String(e?.message).includes("CHUA_DAN_LINK_CSV")) {
      setStatus("❌ Chưa dán link CSV QUIZZES (Publish to web).");
    } else {
      setStatus("⚠️ Không đọc được CSV. Đang dùng cache trên máy.");
    }
  }

  const quizzesSorted = [...QUIZZES_MEM].sort((a, b) =>
    String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))
  );

  if (!quizzesSorted.length) {
    list.innerHTML = `<div style="color:#666">Chưa có bài thi nào.</div>`;
    return;
  }

  list.innerHTML = quizzesSorted.map(q => `
    <div class="item">
      <div>
        <h3>${esc(q.title || "Bài thi")}</h3>
        <div class="meta">
          Mục: <b>${esc(q.cat)}</b> • Tuần: <b>${esc(q.week)}</b> • ${esc((q.questions||[]).length)} câu
          <br/>
          Lượt thi: <b>${esc(q.maxAttempts)}</b> • Thời gian: <b>${esc(q.timeLimitMin)} phút</b>
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" data-edit="${esc(q.id)}" type="button">Sửa</button>
        <button class="btn danger" data-del="${esc(q.id)}" type="button">Xóa</button>
      </div>
    </div>
  `).join("");

  // delete
  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!id) return;
      if (!confirm("Xóa bài thi này?")) return;

      try {
        setStatus("Đang gửi lệnh xóa (no-cors)...");
        await postNoCors({ action:"deleteQuiz", adminPassword: ADMIN_PASSWORD, id });
        setStatus("✅ Đã gửi lệnh xóa. Đang tải lại CSV...");
        await refreshList();
      } catch {
        setStatus("❌ Không gửi được lệnh xóa. Kiểm tra mạng.");
      }
    });
  });

  // edit
  list.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      const q = QUIZZES_MEM.find(x => String(x.id) === String(id));
      if (!q) return;

      $("cat").value = q.cat || "chiensi";
      $("week").value = q.week || "";
      $("title").value = q.title || "";
      $("maxAttempts").value = String(q.maxAttempts ?? 3);
      $("timeLimitMin").value = String(q.timeLimitMin ?? 0);

      $("save").dataset.editId = q.id;

      $("qWrap").innerHTML = "";
      (q.questions || []).forEach(qq => $("qWrap").appendChild(makeQCard(qq)));

      setStatus("Đang sửa bài: " + (q.title || ""));
      window.scrollTo({ top: 0, behavior:"smooth" });
    });
  });
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", async () => {
  // đảm bảo HTML có 2 ô cấu hình
  const grid = document.querySelector(".grid");
  if (grid && !$("maxAttempts")) {
    grid.insertAdjacentHTML("beforeend", `
      <label>
        Số lần thi tối đa (mặc định 3)
        <input id="maxAttempts" type="number" min="1" max="20" value="3" />
      </label>
      <label>
        Thời gian làm bài (phút) (0 = không giới hạn)
        <input id="timeLimitMin" type="number" min="0" max="600" value="0" />
      </label>
    `);
  }

  // init 1 câu hỏi
  if (!$("qWrap")?.children?.length) {
    $("qWrap").appendChild(makeQCard({ text:"", options:["","","",""], correctIndex:0, points:1 }));
  }

  $("addQ")?.addEventListener("click", () => {
    $("qWrap").appendChild(makeQCard({ text:"", options:["","","",""], correctIndex:0, points:1 }));
  });

  $("save")?.addEventListener("click", async () => {
    try {
      const cat = ($("cat")?.value || "").trim();
      const week = safeNum(($("week")?.value || "").trim(), 0);
      const title = ($("title")?.value || "").trim();
      const maxAttempts = safeNum(($("maxAttempts")?.value || "3").trim(), 3);
      const timeLimitMin = safeNum(($("timeLimitMin")?.value || "0").trim(), 0);

      if (!cat) return setStatus("Cần chọn mục.");
      if (!week || week < 1) return setStatus("Cần nhập tuần (>=1).");
      if (!title) return setStatus("Cần nhập tiêu đề.");
      if (!maxAttempts || maxAttempts < 1) return setStatus("Số lần thi tối đa phải >= 1.");
      if (timeLimitMin < 0) return setStatus("Thời gian làm bài không hợp lệ.");

      const questions = readQuestions();
      const editId = $("save").dataset.editId || "";

      const quiz = { id: editId, cat, week, title, maxAttempts, timeLimitMin, questions };

      setStatus("Đang gửi lưu bài (no-cors)...");
      await postNoCors({ action:"upsertQuiz", adminPassword: ADMIN_PASSWORD, quiz });

      $("save").dataset.editId = "";
      setStatus("✅ Đã gửi lưu bài. Đang tải lại CSV để xác nhận...");
      await refreshList();

    } catch (e) {
      setStatus("❌ " + (e?.message || "Lỗi dữ liệu/mạng."));
    }
  });

  await refreshList();
});
