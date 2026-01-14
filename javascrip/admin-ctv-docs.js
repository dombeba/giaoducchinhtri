/***************** CONFIG *****************/
const API_URL = "https://script.google.com/macros/s/AKfycbwYTBVosKA3ykgY9C-sns3vLmZ4jth6cmbvYEPYzePMk7ru-pKhOFb_aGSACMIE2A9R/exec";

/***************** DOM *****************/
const $ = (id)=>document.getElementById(id);

const passEl = $("pass");
const typeEl = $("type");
const titleEl = $("title");
const fileEl = $("file");
const statusEl = $("status");

const qEl = $("q");
const listEl = $("list");
const countEl = $("count");

let allItems = [];
let currentFilter = "all";

/***************** HELPERS *****************/
function setStatus(msg, ok=true){
  statusEl.className = "status " + (ok ? "ok" : "bad");
  statusEl.textContent = msg || "";
}

function esc(s){
  return String(s||"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

function fmtTime(iso){
  if(!iso) return "";
  try{
    const d = new Date(iso);
    return d.toLocaleString("vi-VN");
  }catch(_){
    return iso;
  }
}

function extOk(type, filename){
  const name = (filename||"").toLowerCase();
  if(type==="pdf") return name.endsWith(".pdf");
  if(type==="word") return name.endsWith(".doc") || name.endsWith(".docx");
  return false;
}

function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> {
      const res = r.result || "";
      // res dạng: data:application/pdf;base64,xxxx
      const base64 = String(res).split(",")[1] || "";
      resolve(base64);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/***************** API *****************/
async function apiList(){
  const url = `${API_URL}?action=list&type=all`;
  const res = await fetch(url);
  return res.json();
}

async function apiUpload(payload){
  const res = await fetch(API_URL, {
    method:"POST",
    // Dùng text/plain để tránh CORS preflight (Apps Script không handle OPTIONS)
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function apiDelete(pass, id){
  const res = await fetch(API_URL, {
    method:"POST",
    // Dùng text/plain để tránh CORS preflight
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify({ action:"delete", pass, id })
  });
  return res.json();
}

/***************** RENDER *****************/
function applyFilterAndSearch(){
  const q = (qEl.value||"").trim().toLowerCase();
  let items = allItems.slice();

  if(currentFilter !== "all"){
    items = items.filter(x => x.type === currentFilter);
  }
  if(q){
    items = items.filter(x => (x.title||"").toLowerCase().includes(q));
  }

  countEl.textContent = `${items.length} tài liệu`;

  if(items.length === 0){
    listEl.innerHTML = `<div class="k-note">Không có tài liệu phù hợp.</div>`;
    return;
  }

  listEl.innerHTML = items.map(x=>`
    <div class="item">
      <div style="min-width:72px;">
        <div class="pill">${x.type.toUpperCase()}</div>
      </div>

      <div style="flex:1; min-width:0;">
        <div class="title">${esc(x.title)}</div>
        <div class="meta">
          <div>🕒 ${esc(fmtTime(x.createdAt))}</div>
          <div>🆔 ${esc(x.id)}</div>
        </div>
      </div>

      <div class="actions">
        <a class="k-btn" href="${esc(x.viewUrl)}" target="_blank" rel="noopener">👁️ Xem</a>
        <a class="k-btn" href="${esc(x.downloadUrl)}" target="_blank" rel="noopener">⬇️ Tải</a>
        <button class="k-btn" data-del="${esc(x.id)}">🗑️ Xóa</button>
      </div>
    </div>
  `).join("");

  // bind delete buttons
  listEl.querySelectorAll("button[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-del");
      const pass = (passEl.value||"").trim();
      if(!pass) return setStatus("Thiếu mật khẩu Admin.", false);

      if(!confirm("Xóa tài liệu này? (File trên Drive sẽ chuyển vào thùng rác)")) return;

      setStatus("Đang xóa...", true);
      const r = await apiDelete(pass, id);
      if(!r.ok){
        setStatus(`Xóa thất bại: ${r.error || "unknown"}`, false);
        return;
      }
      setStatus("Đã xóa.", true);
      await refreshList();
    });
  });
}

async function refreshList(){
  setStatus("Đang tải danh sách...", true);
  const r = await apiList();
  if(!r.ok){
    setStatus(`Lỗi tải danh sách: ${r.error || "unknown"}`, false);
    return;
  }
  allItems = r.items || [];
  setStatus(`OK • ${allItems.length} tài liệu`, true);
  applyFilterAndSearch();
}

/***************** EVENTS *****************/
document.addEventListener("DOMContentLoaded", ()=>{
  // filter buttons
  document.querySelectorAll("button[data-filter]").forEach(b=>{
    b.addEventListener("click", ()=>{
      currentFilter = b.getAttribute("data-filter") || "all";
      applyFilterAndSearch();
    });
  });

  qEl.addEventListener("input", applyFilterAndSearch);

  $("btnRefresh").addEventListener("click", refreshList);

  $("btnUpload").addEventListener("click", async ()=>{
    const pass = (passEl.value||"").trim();
    const type = (typeEl.value||"").trim();
    const title = (titleEl.value||"").trim();
    const file = fileEl.files && fileEl.files[0];

    if(!pass) return setStatus("Thiếu mật khẩu Admin.", false);
    if(!title) return setStatus("Thiếu tiêu đề.", false);
    if(!file) return setStatus("Chưa chọn file.", false);
    if(!extOk(type, file.name)) return setStatus("Sai định dạng file so với loại đã chọn.", false);

    setStatus("Đang đọc file...", true);
    const base64 = await fileToBase64(file);

    setStatus("Đang upload lên Drive...", true);
    const r = await apiUpload({
      action: "upload",
      pass,
      type,
      title,
      filename: file.name,
      base64,
      uploader: "admin"
    });

    if(!r.ok){
      setStatus(`Upload thất bại: ${r.error || "unknown"}`, false);
      return;
    }

    setStatus("Upload thành công ✅", true);
    titleEl.value = "";
    fileEl.value = "";

    await refreshList();
  });

  // init
  refreshList();
});
