
/***************** CONFIG *****************/
// ✅ DÁN URL WEB APP (APPS SCRIPT RIÊNG) CỦA PHÁP LUẬT TẠI ĐÂY
const API_URL = "https://script.google.com/macros/s/AKfycbxVvVxsllW-UjCs3xHwjt6o0KfuNVSWbYuxIdivt6r8JEH3ILsGvGhQsySt17ZDfBJyfQ/exec";

/***************** DOM *****************/
const listEl = document.getElementById("docList");
const searchEl = document.getElementById("searchBox");
const countEl = document.getElementById("resultCount");
const tabs = document.querySelectorAll(".tab");

let allDocs = [];
let currentType = "all";

function esc(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function fmtTime(iso){
  if(!iso) return "";
  try { return new Date(iso).toLocaleString("vi-VN"); }
  catch { return iso; }
}

async function loadDocs(){
  const res = await fetch(`${API_URL}?action=list`);
  const data = await res.json();

  if(!data.ok){
    listEl.innerHTML = `<p class="empty">❌ Không tải được dữ liệu</p>`;
    return;
  }
  allDocs = data.items || [];
  render();
}

function render(){
  const q = (searchEl.value || "").trim().toLowerCase();

  let items = allDocs.filter(d => {
    if(currentType !== "all" && d.type !== currentType) return false;
    if(q && !(d.title || "").toLowerCase().includes(q)) return false;
    return true;
  });

  countEl.textContent = `Tổng: ${items.length} tài liệu`;

  if(items.length === 0){
    listEl.innerHTML = `<p class="empty">📭 Không có tài liệu phù hợp</p>`;
    return;
  }

  listEl.innerHTML = items.map(d => `
    <article class="doc-item">
      <div class="doc-type ${esc(d.type)}">${esc(String(d.type||"").toUpperCase())}</div>
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

searchEl?.addEventListener("input", render);

tabs.forEach(tab=>{
  tab.addEventListener("click", ()=>{
    tabs.forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");
    currentType = tab.dataset.type || "all";
    render();
  });
});

loadDocs();
