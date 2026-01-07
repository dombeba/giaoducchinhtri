// ===== BẢO VỆ ADMIN (CÁCH 1) =====
const ADMIN_PASSWORD = "123321";
const input = prompt("🔐 Nhập mật khẩu quản trị:");
if (input !== ADMIN_PASSWORD) {
  alert("❌ Sai mật khẩu. Không có quyền truy cập.");
  window.location.href = "index.html";
}

const RESULT_KEY = "KTQN_RESULTS_V1";
const $ = (id) => document.getElementById(id);

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

function fmt(iso) {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}

function applyFilters(items) {
  const cat = ($("cat")?.value || "").trim();
  const week = Number(($("week")?.value || "").trim() || 0);
  const q = ($("q")?.value || "").trim().toLowerCase();

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
  out.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  return out;
}

function ensureTableHeaderHasDelete() {
  const theadRow = document.querySelector("table.tbl thead tr");
  if (!theadRow) return;

  // Header đầy đủ + cột Xóa cuối (không cần sửa HTML)
  theadRow.innerHTML = `
    <th>Thời gian</th>
    <th>Mục</th>
    <th>Tuần</th>
    <th>Bài</th>
    <th>Thi lần</th>
    <th>Giới hạn</th>
    <th>Thời lượng</th>
    <th>Họ và tên</th>
    <th>Cấp bậc</th>
    <th>Chức vụ</th>
    <th>Đơn vị</th>
    <th>SĐT</th>
    <th>Điểm</th>
    <th>Xóa</th>
  `;
}

function render() {
  ensureTableHeaderHasDelete();

  const all = loadResults();
  const items = applyFilters(all);

  const tbody = $("tbody");
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="14" style="padding:14px;color:#666">Chưa có kết quả.</td></tr>`;
    setStatus(`0 kết quả`);
    return;
  }

  tbody.innerHTML = items
    .map((r) => {
      const u = r.user || {};
      const attempt = r.attemptNo && r.maxAttempts ? `${r.attemptNo}/${r.maxAttempts}` : "—";
      const auto = r.autoSubmitted ? " (Auto)" : "";
      const dur =
        typeof r.durationSec === "number"
          ? `${Math.floor(r.durationSec / 60)}m${String(r.durationSec % 60).padStart(2, "0")}s`
          : "—";
      const limit =
        typeof r.timeLimitMin === "number"
          ? r.timeLimitMin > 0
            ? `${r.timeLimitMin}p`
            : "∞"
          : "—";

      return `
        <tr>
          <td>${esc(fmt(r.submittedAt))}</td>
          <td>${esc(r.cat)}</td>
          <td>${esc(r.week)}</td>
          <td>${esc(r.quizTitle)}</td>
          <td><b>${esc(attempt)}</b>${esc(auto)}</td>
          <td>${esc(limit)}</td>
          <td>${esc(dur)}</td>
          <td>${esc(u.fullName)}</td>
          <td>${esc(u.rank)}</td>
          <td>${esc(u.position)}</td>
          <td>${esc(u.unit)}</td>
          <td>${esc(u.phone)}</td>
          <td><b>${esc(r.score)} / ${esc(r.maxScore)}</b></td>
          <td style="white-space:nowrap;">
            <button class="btn danger del-one" type="button" data-id="${esc(r.id)}">❌</button>
          </td>
        </tr>
      `;
    })
    .join("");

  setStatus(`${items.length} kết quả`);
}

function exportCSV() {
  const all = loadResults();
  const items = applyFilters(all);

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
  a.download = `KTQN_KETQUA_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

document.addEventListener("DOMContentLoaded", () => {
  // lọc
  ["input", "change"].forEach((evt) => {
    $("cat")?.addEventListener(evt, render);
    $("week")?.addEventListener(evt, render);
    $("q")?.addEventListener(evt, render);
  });

  // export
  $("exportCsv")?.addEventListener("click", exportCSV);

  // xóa toàn bộ
  $("clearAll")?.addEventListener("click", () => {
    if (confirm("Xóa toàn bộ kết quả?")) {
      localStorage.removeItem(RESULT_KEY);
      render();
      setStatus("Đã xóa toàn bộ kết quả.");
    }
  });

  // ✅ XÓA TỪNG BÀI (delegation)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".del-one");
    if (!btn) return;

    const id = btn.getAttribute("data-id");
    if (!id) return;

    if (!confirm("Xóa kết quả bài thi này?")) return;

    const all = loadResults();
    const next = all.filter((r) => String(r.id) !== String(id));
    saveResults(next);

    render();
    setStatus("✅ Đã xóa 1 kết quả.");
  });

  render();
});
