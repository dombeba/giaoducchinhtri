/***************** ADMIN PROTECT *****************/
const ADMIN_PASSWORD = "123321";
const input = prompt("🔐 Nhập mật khẩu quản trị:");
if (input !== ADMIN_PASSWORD) {
  alert("❌ Sai mật khẩu. Không có quyền truy cập.");
  window.location.href = "index.html";
}

/***************** CONFIG *****************/
// ✅ DÁN ĐÚNG LINK /exec MỚI (link chủ tướng đã tạo container-bound)
const API_URL =
  "https://script.google.com/macros/s/AKfycbyLDBHqICMGY4GY-ITdiUMEDSU_69cFTmJiFp7bg3obR81hNrw2PiTVe4XisO8A1UuwwQ/exec";

/***************** DOM *****************/
const $ = (id) => document.getElementById(id);

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmt(iso) {
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

/***************** NETWORK *****************/
async function fetchJson(url) {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  // Apps Script đôi khi trả 200 nhưng body không phải JSON nếu lỗi
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`INVALID_JSON: ${text.slice(0, 200)}`);
  }
}

// POST no-cors (để khỏi dính CORS). Không đọc được response -> chỉ dùng khi cần.
async function postNoCors(payload) {
  await fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

/***************** DATA *****************/
let ALL_RESULTS = []; // dữ liệu gốc từ API
let VIEW_RESULTS = []; // dữ liệu sau lọc (để export)

function normStr(v) {
  return String(v ?? "").trim();
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Tạo “id” tạm để xóa trên giao diện (vì sheet RESULTS không có cột id)
function makeRowKey(r) {
  // đủ ổn định: thời gian + username + bài + attempt
  return [
    normStr(r.submittedAt),
    normStr(r.username),
    normStr(r.quizTitle),
    normStr(r.attemptNo),
  ].join("||");
}

/***************** LOAD FROM API *****************/
async function loadResultsFromApi() {
  setStatus("⏳ Đang tải kết quả từ Google Sheet...");

  // cache-buster để tránh cache trung gian
  const url = `${API_URL}?action=listResults&t=${Date.now()}`;

  const data = await fetchJson(url);
  if (!data || data.ok !== true) {
    throw new Error(data?.error || "LOAD_FAILED");
  }

  // data.results = mảng object theo header sheet
  const results = Array.isArray(data.results) ? data.results : [];

  // Chuẩn hóa key (vì sheet có thể có score/maxScore hoặc không)
  ALL_RESULTS = results.map((x) => ({
    submittedAt: x.submittedAt || "",
    cat: x.cat || "",
    week: x.week ?? "",
    quizTitle: x.quizTitle || "",
    attemptNo: x.attemptNo ?? "",
    maxAttempts: x.maxAttempts ?? "",
    autoSubmitted: x.autoSubmitted ?? 0,
    timeLimitMin: x.timeLimitMin ?? 0,
    durationSec: x.durationSec ?? 0,

    fullName: x.fullName || "",
    rank: x.rank || "",
    position: x.position || "",
    unit: x.unit || "",
    phone: x.phone || "",
    username: x.username || "",

    // có thể có hoặc không
    score: x.score ?? "",
    maxScore: x.maxScore ?? "",
  }));

  setStatus(`✅ Đã tải: ${ALL_RESULTS.length} dòng`);
}

/***************** FILTER + RENDER *****************/
function applyFilters(items) {
  const cat = normStr($("cat")?.value);
  const weekVal = normStr($("week")?.value);
  const week = weekVal ? Number(weekVal) : 0;
  const q = normStr($("q")?.value).toLowerCase();

  let out = [...items];

  if (cat) out = out.filter((x) => normStr(x.cat) === cat);
  if (week) out = out.filter((x) => Number(x.week) === week);

  if (q) {
    out = out.filter((x) => {
      const blob = [
        x.quizTitle,
        x.fullName,
        x.rank,
        x.position,
        x.unit,
        x.phone,
        x.username,
        x.cat,
        x.week,
      ]
        .map((v) => normStr(v).toLowerCase())
        .join(" ");
      return blob.includes(q);
    });
  }

  // mới nhất lên đầu
  out.sort((a, b) => normStr(b.submittedAt).localeCompare(normStr(a.submittedAt)));
  return out;
}

function render() {
  const tbody = $("tbody");
  if (!tbody) return;

  const items = applyFilters(ALL_RESULTS);
  VIEW_RESULTS = items;

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="padding:14px;color:#666">Chưa có kết quả.</td></tr>`;
    setStatus(`0 kết quả`);
    return;
  }

  tbody.innerHTML = items
    .map((r) => {
      const key = makeRowKey(r);

      const scoreText =
        normStr(r.score) || normStr(r.maxScore)
          ? `<b>${esc(r.score)} / ${esc(r.maxScore)}</b>`
          : `<span style="color:#666">—</span>`;

      return `
        <tr>
          <td>${esc(fmt(r.submittedAt))}</td>
          <td>${esc(r.cat)}</td>
          <td>${esc(r.week)}</td>
          <td>${esc(r.quizTitle)}</td>
          <td>${esc(r.fullName)}</td>
          <td>${esc(r.rank)}</td>
          <td>${esc(r.position)}</td>
          <td>${esc(r.unit)}</td>
          <td>${esc(r.phone)}</td>
          <td>${scoreText}</td>
          <td style="white-space:nowrap;">
            <button class="btn danger del-one" type="button" data-key="${esc(key)}">❌</button>
          </td>
        </tr>
      `;
    })
    .join("");

  setStatus(`${items.length} kết quả (đã lọc)`);
}

/***************** EXPORT CSV *****************/
function exportCSV() {
  const items = VIEW_RESULTS || [];

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

  const rows = items.map((r) => [
    r.submittedAt || "",
    r.cat || "",
    r.week ?? "",
    r.quizTitle || "",
    r.attemptNo ?? "",
    r.maxAttempts ?? "",
    String(r.autoSubmitted ?? ""),
    r.timeLimitMin ?? "",
    r.durationSec ?? "",
    r.fullName || "",
    r.rank || "",
    r.position || "",
    r.unit || "",
    r.phone || "",
    r.username || "",
    r.score ?? "",
    r.maxScore ?? "",
  ]);

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

/***************** DELETE / CLEAR (UI FIRST) *****************/
// NOTE: Apps Script hiện tại của chủ tướng CHƯA có action xóa server.
// Tôi cho xóa trên giao diện + reload lại từ server.
// Nếu chủ tướng muốn xóa thật trên sheet, tôi sẽ bổ sung action deleteResult/clearResults bên Apps Script sau.

function deleteOneUI(key) {
  ALL_RESULTS = ALL_RESULTS.filter((r) => makeRowKey(r) !== key);
  render();
}

async function clearAllUI() {
  ALL_RESULTS = [];
  render();
}

/***************** INIT *****************/
document.addEventListener("DOMContentLoaded", async () => {
  // filter events
  ["input", "change"].forEach((evt) => {
    $("cat")?.addEventListener(evt, render);
    $("week")?.addEventListener(evt, render);
    $("q")?.addEventListener(evt, render);
  });

  // export
  $("exportCsv")?.addEventListener("click", exportCSV);

  // clear all (UI + reload)
  $("clearAll")?.addEventListener("click", async () => {
    if (!confirm("Xóa toàn bộ kết quả HIỂN THỊ trên admin? (Sheet vẫn giữ nếu chưa bật xóa server)")) return;
    await clearAllUI();
    setStatus("✅ Đã xóa trên giao diện. (Nếu muốn xóa luôn trên Sheet, báo tôi để bật API clearResults)");
  });

  // delete one (delegation)
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".del-one");
    if (!btn) return;

    const key = btn.getAttribute("data-key");
    if (!key) return;

    if (!confirm("Xóa kết quả này khỏi giao diện admin? (Sheet vẫn giữ nếu chưa bật xóa server)")) return;

    // xóa ngay trên UI (không phụ thuộc cache)
    deleteOneUI(key);

    // (tuỳ chọn) nếu sau này chủ tướng muốn xóa trên server, bật action deleteResult ở Apps Script rồi mở lại đoạn dưới:
    // await postNoCors({ action:"deleteResult", adminPassword: ADMIN_PASSWORD, key });

    setStatus("✅ Đã xóa trên giao diện. (Muốn xóa thật trên Sheet, báo tôi để bật API deleteResult)");
  });

  // load data
  try {
    await loadResultsFromApi();
    render();
  } catch (err) {
    console.error(err);
    setStatus("❌ Không lấy được kết quả từ API. Kiểm tra Apps Script có action=listResults và đúng link /exec.");
    const tbody = $("tbody");
    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="11" style="padding:14px;color:#b00020">
          Không tải được dữ liệu. Hãy kiểm tra:<br/>
          • Apps Script đã thêm action=listResults trong doGet<br/>
          • Đang dùng đúng link /exec mới<br/>
        </td></tr>`;
    }
  }
});
