/***************** CONFIG *****************/
const API_URL = "https://script.google.com/macros/s/AKfycbwgaMvuwQK7ISGsXRWjr0z0SfpIppM9NtXyg7Ch2Gk-dy7pXMmiHPMR9CFry1_NbwWw/exec";
const CATEGORY = "NHANTHUC"; // tách kho tài liệu

/***************** LOADING *****************/
function showLoading(text = "Đang tải dữ liệu...") {
  const el = document.getElementById("loading");
  if (!el) return;
  const t = el.querySelector(".loading-text");
  if (t) t.textContent = text;
  el.classList.remove("hidden");
}
function hideLoading() {
  const el = document.getElementById("loading");
  if (!el) return;
  el.classList.add("hidden");
}

/***************** DOM *****************/
const listEl = document.getElementById("docList");
const searchEl = document.getElementById("searchBox");
const countEl = document.getElementById("resultCount");
const tabs = document.querySelectorAll(".tab");

let allDocs = [];
let currentType = "all";

/***************** UTIL *****************/
function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function fmtTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

/***************** API *****************/
async function loadDocs() {
  try {
    showLoading("Đang tải dữ liệu...");
    const res = await fetch(`${API_URL}?action=list&type=all&cat=${encodeURIComponent(CATEGORY)}`);
    const data = await res.json();

    if (!data.ok) {
      listEl.innerHTML = `<p class="empty">❌ Không tải được dữ liệu</p>`;
      return;
    }

    allDocs = data.items || [];
    render();
  } catch (e) {
    listEl.innerHTML = `<p class="empty">❌ Lỗi mạng / không gọi được API</p>`;
  } finally {
    hideLoading();
  }
}

/***************** RENDER *****************/
function render() {
  const q = (searchEl.value || "").trim().toLowerCase();

  let items = allDocs.filter(d => {
    if (currentType !== "all" && d.type !== currentType) return false;
    if (q && !(d.title || "").toLowerCase().includes(q)) return false;
    return true;
  });

  countEl.textContent = `Tổng: ${items.length} tài liệu`;

  if (items.length === 0) {
    listEl.innerHTML = `<p class="empty">📭 Không có tài liệu phù hợp</p>`;
    return;
  }

  listEl.innerHTML = items.map(d => `
    <article class="doc-item">
      <div class="doc-type ${esc(d.type)}">${esc(String(d.type || "").toUpperCase())}</div>

      <div class="doc-main">
        <h3 class="doc-title">${esc(d.title)}</h3>
        <div class="doc-meta">🕒 ${esc(fmtTime(d.createdAt))}</div>
      </div>

      <div class="doc-actions">
        <a href="${esc(d.viewUrl)}" target="_blank" rel="noopener">👁️ Xem</a>
        <a href="${esc(d.downloadUrl)}" target="_blank" rel="noopener">⬇️ Tải</a>
      </div>
    </article>
  `).join("");
}

/***************** EVENTS *****************/
searchEl?.addEventListener("input", render);

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentType = tab.dataset.type || "all";
    render();
  });
});

/***************** INIT *****************/
loadDocs();
