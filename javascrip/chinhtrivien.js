/************ PAGE LOCK ************/
const PAGE_PASSWORD = "211"; // 🔐 đổi mật khẩu tại đây

function unlockPage(){
  const input = document.getElementById("lockPass").value;
  const msg = document.getElementById("lockMsg");

  if(input === PAGE_PASSWORD){
    sessionStorage.setItem("CTV_UNLOCK", "1");
    showContent();
  } else {
    msg.textContent = "❌ Mật khẩu không đúng";
  }
}

function showContent(){
  document.getElementById("lockScreen").style.display = "none";
  document.getElementById("protectedContent").style.display = "block";
}

/************ CHECK ON LOAD ************/
document.addEventListener("DOMContentLoaded", () => {
  if(sessionStorage.getItem("CTV_UNLOCK") === "1"){
    showContent();
  }
});

/***************** CONFIG *****************/
const API_URL = "https://script.google.com/macros/s/AKfycbwYTBVosKA3ykgY9C-sns3vLmZ4jth6cmbvYEPYzePMk7ru-pKhOFb_aGSACMIE2A9R/exec";

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
  const res = await fetch(`${API_URL}?action=list&type=all`);
  const data = await res.json();

  if (!data.ok) {
    listEl.innerHTML = `<p class="empty">❌ Không tải được dữ liệu</p>`;
    return;
  }

  allDocs = data.items || [];
  render();
}

/***************** RENDER *****************/
function render() {
  const q = searchEl.value.trim().toLowerCase();

  let items = allDocs.filter(d => {
    if (currentType !== "all" && d.type !== currentType) return false;
    if (q && !d.title.toLowerCase().includes(q)) return false;
    return true;
  });

  countEl.textContent = `Tổng: ${items.length} văn bản`;

  if (items.length === 0) {
    listEl.innerHTML = `<p class="empty">📭 Không có văn bản phù hợp</p>`;
    return;
  }

  listEl.innerHTML = items.map(d => `
    <article class="doc-item">
      <div class="doc-type ${d.type}">
        ${d.type.toUpperCase()}
      </div>

      <div class="doc-main">
        <h3 class="doc-title">${esc(d.title)}</h3>
        <div class="doc-meta">
          🕒 ${fmtTime(d.createdAt)}
        </div>
      </div>

      <div class="doc-actions">
        <a href="${d.viewUrl}" target="_blank">👁️ Xem</a>
        <a href="${d.downloadUrl}" target="_blank">⬇️ Tải</a>
      </div>
    </article>
  `).join("");
}

/***************** EVENTS *****************/
searchEl.addEventListener("input", render);

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentType = tab.dataset.type;
    render();
  });
});

/***************** INIT *****************/
loadDocs();
