const API_URL = "https://script.google.com/macros/s/AKfycbzjuWQw_4ZWPsnt5l22arq1RZ-xSddfYdVV-lhx_tmiHK971oZkqrgqpzJavnpEGuab6Q/exec";
const CATEGORY = "NGHIQUYET14";

/***************** LOADING *****************/
function showLoading(text="Đang xử lý..."){
  const el = document.getElementById("loading");
  if(!el) return;
  const t = el.querySelector(".loading-text");
  if(t) t.textContent = text;
  el.classList.remove("hidden");
}
function hideLoading(){
  const el = document.getElementById("loading");
  if(!el) return;
  el.classList.add("hidden");
}

const $ = (id)=>document.getElementById(id);

/***************** TABS *****************/
const tabDocs = $("tabDocs");
const tabPosts = $("tabPosts");
const panelDocs = $("panelDocs");
const panelPosts = $("panelPosts");

function setActiveTab(which){
  const isDocs = which === "docs";
  tabDocs.classList.toggle("active", isDocs);
  tabPosts.classList.toggle("active", !isDocs);
  panelDocs.classList.toggle("hiddenPanel", !isDocs);
  panelPosts.classList.toggle("hiddenPanel", isDocs);
}
tabDocs.addEventListener("click", ()=> setActiveTab("docs"));
tabPosts.addEventListener("click", ()=> setActiveTab("posts"));

/***************** COMMON *****************/
function esc(s){
  return String(s||"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function fmtTime(iso){
  if(!iso) return "";
  try{ return new Date(iso).toLocaleString("vi-VN"); } catch { return iso; }
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
    r.onload = ()=> resolve(String(r.result||"").split(",")[1] || "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function apiPost(payload){
  const res = await fetch(API_URL, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

/***************** DOCS *****************/
const passEl = $("pass");
const typeEl = $("type");
const titleEl = $("title");
const fileEl = $("file");
const statusDocs = $("statusDocs");

const qDocs = $("qDocs");
const listDocs = $("listDocs");
const countDocs = $("countDocs");

let docsAll = [];
let docsFilter = "all";

function setStatusDocs(msg, ok=true){
  statusDocs.className = "status " + (ok ? "ok" : "bad");
  statusDocs.textContent = msg || "";
}

async function refreshDocs(){
  try{
    showLoading("Đang tải tài liệu...");
    setStatusDocs("Đang tải...", true);

    const url = `${API_URL}?action=list&category=${encodeURIComponent(CATEGORY)}`;
    const r = await fetch(url).then(x=>x.json());
    if(!r.ok) return setStatusDocs(`Không tải được: ${r.error||"unknown"}`, false);

    docsAll = r.items || [];
    setStatusDocs(`OK • ${docsAll.length} tài liệu`, true);
    renderDocs();
  }catch(e){
    setStatusDocs("Lỗi mạng / không gọi được API", false);
  }finally{
    hideLoading();
  }
}

function renderDocs(){
  const q = (qDocs.value||"").trim().toLowerCase();
  let items = docsAll.slice();

  if(docsFilter !== "all") items = items.filter(x=> x.type === docsFilter);
  if(q) items = items.filter(x=> (x.title||"").toLowerCase().includes(q));

  countDocs.textContent = `${items.length} tài liệu`;

  if(items.length === 0){
    listDocs.innerHTML = `<div class="k-note">Không có tài liệu phù hợp.</div>`;
    return;
  }

  listDocs.innerHTML = items.map(x=>`
    <div class="item">
      <div style="min-width:72px;">
        <div class="pill">${esc(String(x.type||"").toUpperCase())}</div>
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
        <button class="k-btn" data-del-doc="${esc(x.id)}">🗑️ Xóa</button>
      </div>
    </div>
  `).join("");

  listDocs.querySelectorAll("button[data-del-doc]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-del-doc");
      const pass = (passEl.value||"").trim();
      if(!pass) return setStatusDocs("Thiếu mật khẩu Admin.", false);
      if(!confirm("Xóa tài liệu này? (File trên Drive sẽ chuyển vào thùng rác)")) return;

      try{
        showLoading("Đang xóa tài liệu...");
        const r = await apiPost({ action:"delete", pass, id });
        if(!r.ok) return setStatusDocs(`Xóa thất bại: ${r.error||"unknown"}`, false);
        setStatusDocs("Đã xóa.", true);
        await refreshDocs();
      }finally{
        hideLoading();
      }
    });
  });
}

document.querySelectorAll("button[data-filter]").forEach(b=>{
  b.addEventListener("click", ()=>{
    docsFilter = b.dataset.filter || "all";
    renderDocs();
  });
});
qDocs.addEventListener("input", renderDocs);
$("btnRefreshDocs").addEventListener("click", refreshDocs);

$("btnUpload").addEventListener("click", async ()=>{
  const pass = (passEl.value||"").trim();
  const type = (typeEl.value||"").trim();
  const title = (titleEl.value||"").trim();
  const file = fileEl.files && fileEl.files[0];

  if(!pass) return setStatusDocs("Thiếu mật khẩu Admin.", false);
  if(!title) return setStatusDocs("Thiếu tiêu đề.", false);
  if(!file) return setStatusDocs("Chưa chọn file.", false);
  if(!extOk(type, file.name)) return setStatusDocs("Sai định dạng file theo loại đã chọn.", false);

  try{
    showLoading("Đang đọc file...");
    const base64 = await fileToBase64(file);

    showLoading("Đang upload...");
    const r = await apiPost({
      action:"upload",
      category: CATEGORY,
      pass, type, title,
      filename: file.name,
      mimeType: file.type || "",
      base64
    });

    if(!r.ok) return setStatusDocs(`Upload thất bại: ${r.error||"unknown"}`, false);

    titleEl.value = "";
    fileEl.value = "";
    setStatusDocs("✅ Upload thành công!", true);
    await refreshDocs();
  }catch(e){
    setStatusDocs("Upload lỗi / mạng lỗi", false);
  }finally{
    hideLoading();
  }
});

/***************** POSTS *****************/
const postTitle = $("postTitle");
const postExcerpt = $("postExcerpt");
const postContent = $("postContent");
const statusPosts = $("statusPosts");

const qPosts = $("qPosts");
const listPosts = $("listPosts");
const countPosts = $("countPosts");

let postsAll = [];

function setStatusPosts(msg, ok=true){
  statusPosts.className = "status " + (ok ? "ok" : "bad");
  statusPosts.textContent = msg || "";
}

async function refreshPosts(){
  try{
    showLoading("Đang tải bài viết...");
    setStatusPosts("Đang tải...", true);

    const url = `${API_URL}?action=post_list&category=${encodeURIComponent(CATEGORY)}`;
    const r = await fetch(url).then(x=>x.json());
    if(!r.ok) return setStatusPosts(`Không tải được: ${r.error||"unknown"}`, false);

    postsAll = r.items || [];
    setStatusPosts(`OK • ${postsAll.length} bài`, true);
    renderPosts();
  }catch(e){
    setStatusPosts("Lỗi mạng / không gọi được API", false);
  }finally{
    hideLoading();
  }
}

function renderPosts(){
  const q = (qPosts.value||"").trim().toLowerCase();
  let items = postsAll.slice();
  if(q) items = items.filter(x=> (x.title||"").toLowerCase().includes(q));

  countPosts.textContent = `${items.length} bài`;

  if(items.length === 0){
    listPosts.innerHTML = `<div class="k-note">Chưa có bài nào.</div>`;
    return;
  }

  listPosts.innerHTML = items.map(x=>`
    <div class="item">
      <div style="min-width:72px;">
        <div class="pill">BÀI</div>
      </div>

      <div style="flex:1; min-width:0;">
        <div class="title">${esc(x.title)}</div>
        <div class="meta">
          <div>🕒 ${esc(fmtTime(x.createdAt))}</div>
          ${x.excerpt ? `<div>📝 ${esc(x.excerpt)}</div>` : ``}
          <div>🆔 ${esc(x.id)}</div>
        </div>
      </div>

      <div class="actions">
        <button class="k-btn" data-view-post="${esc(x.id)}">👁️ Xem</button>
        <button class="k-btn" data-del-post="${esc(x.id)}">🗑️ Xóa</button>
      </div>
    </div>
  `).join("");

  // xem nội dung
  listPosts.querySelectorAll("button[data-view-post]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-view-post");
      const p = postsAll.find(z=> String(z.id)===String(id));
      if(!p) return;
      alert(`${p.title}\n\n${p.content}`);
    });
  });

  // xóa
  listPosts.querySelectorAll("button[data-del-post]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-del-post");
      const pass = (passEl.value||"").trim();
      if(!pass) return setStatusPosts("Thiếu mật khẩu Admin.", false);
      if(!confirm("Xóa bài viết này?")) return;

      try{
        showLoading("Đang xóa bài...");
        const r = await apiPost({ action:"post_delete", pass, id });
        if(!r.ok) return setStatusPosts(`Xóa thất bại: ${r.error||"unknown"}`, false);
        setStatusPosts("Đã xóa.", true);
        await refreshPosts();
      }finally{
        hideLoading();
      }
    });
  });
}

qPosts.addEventListener("input", renderPosts);
$("btnRefreshPosts").addEventListener("click", refreshPosts);

$("btnPost").addEventListener("click", async ()=>{
  const pass = (passEl.value||"").trim();
  const title = (postTitle.value||"").trim();
  const excerpt = (postExcerpt.value||"").trim();
  const content = (postContent.value||"").trim();

  if(!pass) return setStatusPosts("Thiếu mật khẩu Admin.", false);
  if(!title) return setStatusPosts("Thiếu tiêu đề bài.", false);
  if(!content) return setStatusPosts("Thiếu nội dung bài.", false);

  try{
    showLoading("Đang đăng bài...");
    const r = await apiPost({
      action:"post_create",
      pass,
      category: CATEGORY,
      title, excerpt, content
    });
    if(!r.ok) return setStatusPosts(`Đăng bài thất bại: ${r.error||"unknown"}`, false);

    postTitle.value = "";
    postExcerpt.value = "";
    postContent.value = "";
    setStatusPosts("✅ Đăng bài thành công!", true);
    await refreshPosts();
  }catch(e){
    setStatusPosts("Lỗi mạng / không gọi được API", false);
  }finally{
    hideLoading();
  }
});

/***************** INIT *****************/
refreshDocs();
refreshPosts();
