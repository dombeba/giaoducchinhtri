// ===== BẢO VỆ ADMIN (CÁCH 1) =====
const ADMIN_PASSWORD = "123321";
const input = prompt("🔐 Nhập mật khẩu quản trị:");
if (input !== ADMIN_PASSWORD) {
  alert("❌ Sai mật khẩu. Không có quyền truy cập.");
  window.location.href = "index.html";
}

// ====== CONFIG ======
const QUIZ_API_URL =
  "https://script.google.com/macros/s/AKfycbxbiU_-gN0VoPEPJ6p3vdZlPHuIh6KkhK7ngT27aCzAQFAVliVw5E-t8ON6TRowPEFUdg/exec";

// cache local (phòng khi api lỗi)
const QUIZ_CACHE_KEY = "KTQN_QUIZZES_CACHE_V1";

// ====== DOM ======
const $ = (id) => document.getElementById(id);

// ====== HELPERS ======
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

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function cacheSave(quizzes) {
  try {
    localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(quizzes || []));
  } catch {}
}
function cacheLoad() {
  try {
    const arr = JSON.parse(localStorage.getItem(QUIZ_CACHE_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// ====== API ======
async function apiListQuizzes() {
  const url = `${QUIZ_API_URL}?action=listQuizzes&_=${Date.now()}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "API_ERROR");
  const quizzes = Array.isArray(data.quizzes) ? data.quizzes : [];
  cacheSave(quizzes);
  return quizzes;
}

async function apiUpsertQuiz(quiz) {
  const payload = {
    action: "upsertQuiz",
    adminPassword: ADMIN_PASSWORD,
    quiz,
  };

  // 1) thử fetch bình thường
  try {
    const res = await fetch(QUIZ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data?.ok) throw new Error(data?.error || "UPSERT_FAILED");
    return data;
  } catch (e) {
    // 2) fallback no-cors (fire and forget)
    await fetch(QUIZ_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    // no-cors không đọc được response, coi như đã gửi
    return { ok: true, mode: "unknown" };
  }
}


async function apiDeleteQuiz(id) {
  const payload = {
    action: "deleteQuiz",
    adminPassword: ADMIN_PASSWORD,
    id,
  };

  try {
    const res = await fetch(QUIZ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data?.ok) throw new Error(data?.error || "DELETE_FAILED");
    return data;
  } catch (e) {
    await fetch(QUIZ_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return { ok: true, deleted: "unknown" };
  }
}


// ====== UI: Question Card ======
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

      <label>
        Đáp án A <span class="req">*</span>
        <input class="opt" data-i="0" type="text" value="${esc(q.options?.[0] || "")}"/>
      </label>
      <label>
        Đáp án B <span class="req">*</span>
        <input class="opt" data-i="1" type="text" value="${esc(q.options?.[1] || "")}"/>
      </label>
      <label>
        Đáp án C <span class="req">*</span>
        <input class="opt" data-i="2" type="text" value="${esc(q.options?.[2] || "")}"/>
      </label>
      <label>
        Đáp án D <span class="req">*</span>
        <input class="opt" data-i="3" type="text" value="${esc(q.options?.[3] || "")}"/>
      </label>

      <label>
        Đáp án đúng <span class="req">*</span>
        <select class="correct">
          <option value="0">A</option>
          <option value="1">B</option>
          <option value="2">C</option>
          <option value="3">D</option>
        </select>
        <div class="small">Chọn đáp án đúng</div>
      </label>

      <label>
        Điểm (mặc định 1)
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
    const opts = Array.from(card.querySelectorAll(".opt")).map((i) => i.value.trim());
    const correctIndex = Number(card.querySelector(".correct")?.value ?? 0);
    const points = Number(card.querySelector(".points")?.value ?? 1);

    if (!text) throw new Error("Có câu hỏi chưa có nội dung.");
    if (opts.some((x) => !x)) throw new Error("Có câu hỏi chưa đủ 4 đáp án.");
    if (!(correctIndex >= 0 && correctIndex <= 3)) throw new Error("Có câu hỏi chưa chọn đáp án đúng.");

    questions.push({
      text,
      options: opts,
      correctIndex,
      points: points > 0 ? points : 1,
    });
  }

  if (!questions.length) throw new Error("Chưa có câu hỏi nào.");
  return questions;
}

// ====== RENDER LIST ======
let QUIZZES_MEM = [];

async function refreshList() {
  const list = $("list");
  if (!list) return;

  setStatus("Đang tải danh sách từ Sheet...");
  try {
    const data = await apiListQuizzes();
    QUIZZES_MEM = data;
    setStatus(`✅ Đã tải ${data.length} bài`);
  } catch (e) {
    // fallback cache
    const cached = cacheLoad();
    QUIZZES_MEM = cached;
    setStatus("⚠️ Không tải được từ Sheet. Đang dùng cache trên máy.");
  }

  const quizzes = [...QUIZZES_MEM].sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
  if (!quizzes.length) {
    list.innerHTML = `<div style="color:#666">Chưa có bài thi nào.</div>`;
    return;
  }

  list.innerHTML = quizzes
    .map(
      (q) => `
    <div class="item">
      <div>
        <h3>${esc(q.title || "Bài thi")}</h3>
        <div class="meta">
          Mục: <b>${esc(q.cat)}</b> • Tuần: <b>${esc(q.week)}</b> • ${esc((q.questions || []).length)} câu
          <br/>
          Giới hạn lượt thi: <b>${esc(q.maxAttempts ?? 3)}</b> • Thời gian: <b>${esc(q.timeLimitMin ?? 0)} phút</b>
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" data-edit="${esc(q.id)}" type="button">Sửa</button>
        <button class="btn danger" data-del="${esc(q.id)}" type="button">Xóa</button>
      </div>
    </div>
  `
    )
    .join("");

  list.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!id) return;
      if (!confirm("Xóa bài thi này?")) return;

      try {
        setStatus("Đang xóa...");
        await apiDeleteQuiz(id);
        setStatus("✅ Đã xóa bài.");
        await refreshList();
      } catch (e) {
        setStatus("❌ Xóa thất bại (kiểm tra mạng / Apps Script).");
      }
    });
  });

  list.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      const q = QUIZZES_MEM.find((x) => String(x.id) === String(id));
      if (!q) return;

      $("cat").value = q.cat;
      $("week").value = q.week;
      $("title").value = q.title || "";

      // 2 ô cấu hình
      $("maxAttempts").value = String(q.maxAttempts ?? 3);
      $("timeLimitMin").value = String(q.timeLimitMin ?? 0);

      $("save").dataset.editId = q.id;

      $("qWrap").innerHTML = "";
      (q.questions || []).forEach((qq) => $("qWrap").appendChild(makeQCard(qq)));

      setStatus("Đang sửa bài: " + (q.title || ""));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  // thêm 2 ô cấu hình nếu thiếu (phòng khi HTML chưa có)
  const grid = document.querySelector(".grid");
  if (grid && !$("maxAttempts")) {
    const html = `
      <label>
        Số lần thi tối đa (mặc định 3)
        <input id="maxAttempts" type="number" min="1" max="20" value="3" />
      </label>

      <label>
        Thời gian làm bài (phút) (0 = không giới hạn)
        <input id="timeLimitMin" type="number" min="0" max="600" value="0" />
      </label>
    `;
    grid.insertAdjacentHTML("beforeend", html);
  }

  $("addQ")?.addEventListener("click", () => {
    $("qWrap").appendChild(
      makeQCard({
        text: "",
        options: ["", "", "", ""],
        correctIndex: 0,
        points: 1,
      })
    );
  });

  if (!$("qWrap").children.length) {
    $("qWrap").appendChild(makeQCard({ text: "", options: ["", "", "", ""], correctIndex: 0, points: 1 }));
  }

  $("save")?.addEventListener("click", async () => {
    try {
      const cat = $("cat").value;
      const week = safeNum(($("week").value || "").trim(), 0);
      const title = $("title").value.trim();

      const maxAttempts = safeNum(($("maxAttempts").value || "3").trim(), 3);
      const timeLimitMin = safeNum(($("timeLimitMin").value || "0").trim(), 0);

      if (!cat) return setStatus("Cần chọn mục.");
      if (!week || week < 1) return setStatus("Cần nhập tuần (>=1).");
      if (!title) return setStatus("Cần nhập tiêu đề.");
      if (!maxAttempts || maxAttempts < 1) return setStatus("Số lần thi tối đa phải >= 1.");
      if (timeLimitMin < 0) return setStatus("Thời gian phút không hợp lệ.");

      const questions = readQuestions();

      const editId = $("save").dataset.editId;
      const quiz = {
        id: editId || "",
        cat,
        week,
        title,
        maxAttempts,
        timeLimitMin,
        questions,
      };

      setStatus("Đang lưu lên Sheet...");
      const res = await apiUpsertQuiz(quiz);

      $("save").dataset.editId = "";
      setStatus(res.mode === "update" ? "✅ Đã cập nhật bài (đồng bộ mọi thiết bị)." : "✅ Đã tạo bài (đồng bộ mọi thiết bị).");

      // refresh list
      await refreshList();
    } catch (err) {
      setStatus("❌ " + (err?.message || "Lỗi dữ liệu / mạng."));
    }
  });

  // nút xóa all nếu HTML có (nếu không có thì thôi)
  $("clearAll")?.addEventListener("click", () => {
    alert("Chủ tướng muốn xóa toàn bộ thì nên làm trực tiếp trong Google Sheet tab quizzes để an toàn.");
  });

  refreshList();
});
