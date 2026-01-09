// =========================================
// ADMIN - KTQN KẾT QUẢ (ĐỒNG BỘ GOOGLE SHEET)
// ✅ READ: Google Sheet Published CSV (không CORS)
// ✅ FILTER + EXPORT CSV
// ❌ DELETE/CLEAR: cần Apps Script endpoint riêng (tạm khóa)
// File: javascrip/admin-ktqn-ketqua.js
// =========================================

// ===== BẢO VỆ ADMIN (CÁCH 1) =====
const ADMIN_PASSWORD = "123321";
const input = prompt("🔐 Nhập mật khẩu quản trị:");
if (input !== ADMIN_PASSWORD) {
  alert("❌ Sai mật khẩu. Không có quyền truy cập.");
  window.location.href = "index.html";
}
const RESULTS_API_URL =
  "https://script.google.com/macros/s/AKfycbynj-8QUyqFOYFM5ZG-_HmEYrTjQlknZK57GNRbfULNYZj4ab3SJ5EkYwzgIQYUWsYGhw/exec";

// ====== CONFIG ======
// 🔴 DÁN LINK CSV TAB RESULTS (Publish to web -> CSV) VÀO ĐÂY
const RESULTS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRll8YoIR4meYyIMQ4zscJfwj6hc4FBXKYBr6al7BGXGFR8bIHBKJvi2ATlTgBlT2nQUPNtbUb-DZcS/pub?gid=1443146912&single=true&output=csv";

// cache local phòng khi CSV lỗi
const CACHE_KEY = "KTQN_RESULTS_CSV_CACHE_V1";

const $ = (id) => document.getElementById(id);

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

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso || "");
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(
      d.getHours()
    ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return String(iso || "");
  }
}

function cacheSave(arr) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(arr || []));
  } catch {}
}
function cacheLoad() {
  try {
    const arr = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
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

// ====== LOAD RESULTS FROM CSV ======
function normalizeRow(x) {
  // Hệ thống gửi lên Apps Script (ktqn-lam-bai.js) có các field phổ biến:
  // username, fullName, rank, position, unit, phone, quizTitle, cat, week,
  // attemptNo, maxAttempts, timeLimitMin, duration (hoặc durationSec), autoSubmitted, score, maxScore, submittedAt

  // hỗ trợ nhiều tên cột khác nhau (nếu Apps Script của chủ tướng đặt khác)
  const user = {
    username: String(x.username || x.user_username || x.user || "").trim(),
    fullName: String(x.fullName || x.name || x.full_name || "").trim(),
    rank: String(x.rank || "").trim(),
    position: String(x.position || "").trim(),
    unit: String(x.unit || "").trim(),
    phone: String(x.phone || x.sdt || "").trim(),
  };

  const rec = {
    id: String(x.id || x.rid || x.resultId || "").trim() || `${user.username}_${x.quizId || ""}_${x.submittedAt || ""}`,
    submittedAt: String(x.submittedAt || x.time || x.timestamp || "").trim(),

    cat: String(x.cat || x.category || "").trim(),
    week: safeNum(x.week, 0),
    quizTitle: String(x.quizTitle || x.title || "").trim(),

    attemptNo: safeNum(x.attemptNo || x.attempt || 0, 0),
    maxAttempts: safeNum(x.maxAttempts || 0, 0),

    timeLimitMin: safeNum(x.timeLimitMin || x.timeLimit || 0, 0),

    durationSec: safeNum(x.durationSec || x.duration || 0, 0),
    autoSubmitted: String(x.autoSubmitted || "").trim() === "1" || String(x.autoSubmitted || "").toLowerCase() === "true",

    score: safeNum(x.score || 0, 0),
    maxScore: safeNum(x.maxScore || x.total || 0, 0),

    user,
  };

  return rec;
}

async function fetchResultsCSV() {
  if (!RESULTS_CSV_URL || RESULTS_CSV_URL.includes("DAN_LINK_CSV")) {
    throw new Error("CHUA_DAN_LINK_CSV_RESULTS");
  }
  const url = `${RESULTS_CSV_URL}${RESULTS_CSV_URL.includes("?") ? "&" : "?"}_=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("FETCH_CSV_FAILED");
  const csv = await res.text();

  const raw = toObjects(csv);
  const results = raw.map(normalizeRow).filter((r) => r.submittedAt || r.quizTitle || r.user?.fullName);

  cacheSave(results);
  return results;
}

// ====== FILTERS ======
function applyFilters(items) {
  const cat = ($("cat")?.value || "").trim();
  const week = safeNum(($("week")?.value || "").trim(), 0);
  const q = String(($("q")?.value || "").trim()).toLowerCase();

  let out = [...items];

  if (cat) out = out.filter((x) => x.cat === cat);
  if (week) out = out.filter((x) => Number(x.week) === week);

  if (q) {
    out = out.filter((x) => {
      const u = x.user || {};
      const blob = `${u.fullName || ""} ${u.unit || ""} ${u.phone || ""} ${u.rank || ""} ${u.position || ""} ${x.quizTitle || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }

  // mới nhất lên đầu
  out.sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
  return out;
}

// ====== RENDER ======
let RESULTS_MEM = [];

function renderTable() {
  const tbody = $("tbody");
  if (!tbody) return;

  const items = applyFilters(RESULTS_MEM);

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="padding:14px;color:#666">Chưa có kết quả.</td></tr>`;
    setStatus(`0 kết quả`);
    return;
  }

  tbody.innerHTML = items
    .map((r) => {
      const u = r.user || {};
      const attempt = r.attemptNo && r.maxAttempts ? `${r.attemptNo}/${r.maxAttempts}` : "—";
      const dur =
        typeof r.durationSec === "number"
          ? `${Math.floor(r.durationSec / 60)}m${String(r.durationSec % 60).padStart(2, "0")}s`
          : "—";
      const limit = r.timeLimitMin > 0 ? `${r.timeLimitMin}p` : "∞";

      return `
        <tr>
          <td>${esc(fmt(r.submittedAt))}</td>
          <td>${esc(r.cat)}</td>
          <td>${esc(r.week)}</td>
          <td>${esc(r.quizTitle)}</td>
          <td><b>${esc(attempt)}</b>${r.autoSubmitted ? " (Auto)" : ""}</td>
          <td>${esc(limit)}</td>
          <td>${esc(dur)}</td>
          <td>${esc(u.fullName)}</td>
          <td>${esc(u.unit)}</td>
          <td>${esc(u.phone)}</td>
          <td><b>${esc(r.score)} / ${esc(r.maxScore)}</b></td>
        </tr>
      `;
    })
    .join("");

  setStatus(`${items.length} kết quả`);
}

function exportCSV() {
  const items = applyFilters(RESULTS_MEM);

  const header = [
    "submittedAt",
    "cat",
    "week",
    "quizTitle",
    "attemptNo",
    "maxAttempts",
    "autoSubmitted",
    "timeLimitMin",
    "durationSec",
    "fullName",
    "rank",
    "position",
    "unit",
    "phone",
    "username",
    "score",
    "maxScore",
  ];

  const rows = items.map((r) => {
    const u = r.user || {};
    return [
      r.submittedAt || "",
      r.cat || "",
      r.week || "",
      r.quizTitle || "",
      r.attemptNo ?? "",
      r.maxAttempts ?? "",
      r.autoSubmitted ? "true" : "false",
      r.timeLimitMin ?? "",
      r.durationSec ?? "",
      u.fullName || "",
      u.rank || "",
      u.position || "",
      u.unit || "",
      u.phone || "",
      u.username || "",
      r.score ?? "",
      r.maxScore ?? "",
    ];
  });

  const csv = [header, ...rows]
    .map((line) => line.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `KTQN_RESULTS_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ====== INIT ======
async function init() {
  setStatus("Đang tải kết quả từ Google Sheet (CSV)...");
  try {
    RESULTS_MEM = await fetchResultsCSV();
    setStatus(`✅ Đã tải ${RESULTS_MEM.length} kết quả`);
  } catch (e) {
    RESULTS_MEM = cacheLoad();
    if (String(e?.message).includes("CHUA_DAN_LINK_CSV_RESULTS")) {
      setStatus("❌ Chưa dán link CSV RESULTS (Publish to web).");
    } else {
      setStatus("⚠️ Không đọc được CSV. Đang dùng cache trên máy.");
    }
  }

  renderTable();
}

document.addEventListener("DOMContentLoaded", () => {
  ["input", "change"].forEach((evt) => {
    $("cat")?.addEventListener(evt, renderTable);
    $("week")?.addEventListener(evt, renderTable);
    $("q")?.addEventListener(evt, renderTable);
  });

  $("exportCsv")?.addEventListener("click", exportCSV);

  // Nút clearAll: tạm khóa vì muốn xóa thật trên Sheet phải có API riêng
  $("clearAll")?.addEventListener("click", () => {
    alert("Tạm thời trang web chỉ ĐỌC kết quả từ Sheet (CSV). Nếu muốn xóa hàng loạt, hãy xóa trực tiếp trong tab RESULTS trên Google Sheet, hoặc yêu cầu tôi viết thêm API xóa trong Apps Script.");
  });

  init();
});
