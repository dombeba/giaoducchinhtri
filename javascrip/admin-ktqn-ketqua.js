/***************** CONFIG *****************/
const API_URL =
  "https://script.google.com/macros/s/AKfycbxY7818jgoFttC7rl4HdhFy4RM84dPTIvAmLWo7kNr4Cw-62TAikiHaV-3iudhLpcwJ5Q/exec";

const ADMIN_PASSWORD = "123321";

/***************** ADMIN LOCK *****************/
(() => {
  const input = prompt("🔐 Nhập mật khẩu quản trị:");
  if (input !== ADMIN_PASSWORD) {
    alert("❌ Sai mật khẩu.");
    window.location.href = "kienthucquannhan.html";
  }
})();

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

function norm(v) { return String(v ?? "").trim(); }
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

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

/***************** NETWORK *****************/
async function fetchJson(url) {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error("INVALID_JSON: " + text.slice(0, 200)); }
}

async function postNoCors(payload) {
  await fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

/***************** DATA *****************/
let ALL_RESULTS = [];
let VIEW_RESULTS = [];

function makeKey(r) {
  // key: submittedAt||username||quizTitle||attemptNo
  return [norm(r.submittedAt), norm(r.username), norm(r.quizTitle), norm(r.attemptNo)].join("||");
}

async function loadResults() {
  setStatus("⏳ Đang tải kết quả...");
  const url = `${API_URL}?action=listResults&t=${Date.now()}`;
  const data = await fetchJson(url);
  if (!data || data.ok !== true) throw new Error(data?.error || "LOAD_FAILED");

  const results = Array.isArray(data.results) ? data.results : [];
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
    score: x.score ?? "",
    maxScore: x.maxScore ?? "",
  }));

  setStatus(`✅ Đã tải ${ALL_RESULTS.length} dòng`);
}

function applyFilters(items) {
  const cat = norm($("cat")?.value);
  const weekVal = norm($("week")?.value);
  const week = weekVal ? toNum(weekVal) : 0;
  const q = norm($("q")?.value).toLowerCase();

  let out = [...items];

  if (cat) out = out.filter((x) => norm(x.cat) === cat);
  if (week) out = out.filter((x) => toNum(x.week) === week);

  if (q) {
    out = out.filter((x) => {
      const blob = [
        x.quizTitle, x.fullName, x.rank, x.position, x.unit,
        x.phone, x.username, x.cat, x.week
      ].map(v => norm(v).toLowerCase()).join(" ");
      return blob.includes(q);
    });
  }

  out.sort((a, b) => norm(b.submittedAt).localeCompare(norm(a.submittedAt))); // mới nhất lên đầu
  return out;
}

function render() {
  const tbody = $("tbody");
  if (!tbody) return;

  const items = applyFilters(ALL_RESULTS);
  VIEW_RESULTS = items;

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="padding:14px;color:#666">Chưa có kết quả.</td></tr>`;
    setStatus("0 kết quả (đã lọc)");
    return;
  }

  tbody.innerHTML = items.map((r) => {
    const scoreText =
      norm(r.score) || norm(r.maxScore)
        ? `<b>${esc(r.score)} / ${esc(r.maxScore)}</b>`
        : `<span style="color:#666">—</span>`;

    const key = esc(makeKey(r));

    return `
      <tr>
        <td>${esc(fmtDate(r.submittedAt))}</td>
        <td>${esc(r.cat)}</td>
        <td>${esc(r.week)}</td>
        <td>${esc(r.quizTitle)}</td>
        <td>${esc(r.fullName)}</td>
        <td>${esc(r.rank)}</td>
        <td>${esc(r.position)}</td>
        <td>${esc(r.unit)}</td>
        <td>${esc(r.phone)}</td>
        <td>${scoreText}</td>
        <td><button class="btn danger del-one" data-key="${key}" type="button">✖</button></td>
      </tr>
    `;
  }).join("");

  setStatus(`${items.length} kết quả (đã lọc)`);
}

/***************** EXPORT CSV *****************/
function exportCSV() {
  const items = VIEW_RESULTS || [];

  const header = [
    "submittedAt","cat","week","quizTitle","attemptNo","maxAttempts","autoSubmitted",
    "timeLimitMin","durationSec","fullName","rank","position","unit","phone","username",
    "score","maxScore"
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
    .map(line => line.map(v => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `KTQN_RESULTS_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/***************** DELETE SERVER (REAL) *****************/
async function deleteOneServer(key) {
  await postNoCors({
    action: "deleteResult",
    adminPassword: ADMIN_PASSWORD,
    key
  });
}

async function clearAllServer() {
  await postNoCors({
    action: "clearResults",
    adminPassword: ADMIN_PASSWORD
  });
}

/***************** INIT *****************/
document.addEventListener("DOMContentLoaded", async () => {
  // filter
  ["input", "change"].forEach((evt) => {
    $("cat")?.addEventListener(evt, render);
    $("week")?.addEventListener(evt, render);
    $("q")?.addEventListener(evt, render);
  });

  $("exportCsv")?.addEventListener("click", exportCSV);

  $("clearAll")?.addEventListener("click", async () => {
    if (!confirm("Xóa TOÀN BỘ kết quả trong Google Sheet (tab RESULTS)?")) return;
    setStatus("⏳ Đang xóa toàn bộ trên Sheet...");
    await clearAllServer();
    await loadResults();
    render();
    setStatus("✅ Đã xóa toàn bộ trên Google Sheet.");
  });

  // delete one
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".del-one");
    if (!btn) return;

    const key = btn.getAttribute("data-key");
    if (!key) return;

    if (!confirm("Xóa dòng này trong Google Sheet (tab RESULTS)?")) return;

    setStatus("⏳ Đang xóa trên Sheet...");
    await deleteOneServer(key);
    await loadResults();
    render();
    setStatus("✅ Đã xóa trên Google Sheet.");
  });

  // load
  try {
    await loadResults();
    render();
  } catch (err) {
    console.error(err);
    setStatus("❌ Không lấy được kết quả. Kiểm tra Apps Script có action=listResults và đúng link /exec.");
    const tbody = $("tbody");
    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="11" style="padding:14px;color:#b00020">
          Không tải được dữ liệu.<br/>
          Hãy thử mở: <b>${esc(API_URL)}?action=listResults</b>
        </td></tr>`;
    }
  }
});
