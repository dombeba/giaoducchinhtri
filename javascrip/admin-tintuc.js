/**************** ADMIN - TIN TỨC (FULL SAFE: JSONP GET + no-cors POST) ****************/
const ADMIN_PASSWORD = "123321";
const API_URL = "https://script.google.com/macros/s/AKfycbzctYLpyy5xceGNdO_WYDCPgIAYzIAov2OV3GslYiSULNuoWPYtkRxwq90ZNBtqSeC29A/exec"; // 🔴 dán /exec

const $ = (id) => document.getElementById(id);

const titleEl   = $("title");
const dateEl    = $("date");
const cateEl    = $("category");
const authorEl  = $("author");
const sourceEl  = $("source");
const excerptEl = $("excerpt");
const contentEl = $("content");

const thumbUrlEl = $("thumbUrl");
const heroUrlEl  = $("heroUrl");
const galleryUrlsEl = $("galleryUrls");

const inlineImgUrlEl = $("inlineImgUrl");
const inlineImgCaptionEl = $("inlineImgCaption");
const insertInlineBtn = $("insertInlineImage");

const saveBtn = $("save");
const cancelBtn = $("cancelEdit");
const statusEl = $("status");
const listEl = $("list");

// file inputs (tạm vô hiệu để tránh base64 -> lỗi #ERROR!)
const thumbFileEl = $("thumbFile");
const heroFileEl = $("heroFile");
const inlineImgFileEl = $("inlineImgFile");
const galleryFilesEl = $("galleryFiles");

function setStatus(msg){ if(statusEl) statusEl.textContent = msg || ""; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function esc(s){
  return String(s||"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

function uuidv4(){
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random()*16)|0;
    const v = c==="x"? r : (r&0x3)|0x8;
    return v.toString(16);
  });
}

// JSONP GET
function jsonp(url, timeoutMs=12000){
  return new Promise((resolve,reject)=>{
    const cb="__cb_"+Math.random().toString(16).slice(2);
    const s=document.createElement("script");
    const timer=setTimeout(()=>{cleanup();reject(new Error("JSONP_TIMEOUT"));},timeoutMs);

    function cleanup(){
      clearTimeout(timer);
      try{delete window[cb];}catch{window[cb]=undefined;}
      if(s&&s.parentNode) s.parentNode.removeChild(s);
    }
    window[cb]=(data)=>{cleanup();resolve(data);};
    s.onerror=()=>{cleanup();reject(new Error("JSONP_LOAD_FAILED"));};

    s.src=url+(url.includes("?")?"&":"?")+"callback="+cb+"&_="+Date.now();
    document.head.appendChild(s);
  });
}

async function apiList(){
  const res = await jsonp(`${API_URL}?action=listNews`);
  if(!res || res.ok !== true) throw new Error(res?.error || "LIST_FAILED");
  return Array.isArray(res.items)?res.items:[];
}

// POST no-cors
async function postNoCors(payload){
  await fetch(API_URL,{
    method:"POST",
    mode:"no-cors",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    keepalive:true
  }).catch(()=>{});
}

function splitLinks(text){
  return String(text||"")
    .split("\n")
    .map(x=>x.trim())
    .filter(Boolean);
}

let ITEMS = [];
let editingId = "";

// Insert [[IMG:src|caption]] at cursor
function insertAtCursor(textarea, insertText){
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0,start);
  const after = textarea.value.slice(end);
  textarea.value = before + insertText + after;
  const pos = (before + insertText).length;
  textarea.setSelectionRange(pos,pos);
  textarea.focus();
}

// Disable file uploads (avoid huge base64 -> #ERROR!)
function warnFileIgnored(el){
  if(!el) return;
  el.addEventListener("change", ()=>{
    if(el.files && el.files.length){
      alert("⚠️ Tạm thời chưa dùng upload từ máy (dễ lỗi #ERROR! do dữ liệu quá dài).\nHãy dùng LINK ảnh.");
      el.value = "";
    }
  });
}

warnFileIgnored(thumbFileEl);
warnFileIgnored(heroFileEl);
warnFileIgnored(inlineImgFileEl);
warnFileIgnored(galleryFilesEl);

// Inline insert handler
insertInlineBtn?.addEventListener("click", ()=>{
  const src = (inlineImgUrlEl?.value || "").trim();
  if(!src){ alert("⚠️ Hãy dán LINK ảnh để chèn."); inlineImgUrlEl?.focus(); return; }
  const cap = (inlineImgCaptionEl?.value || "").trim();
  const token = `[[IMG:${src}|${cap}]]\n`;
  insertAtCursor(contentEl, token);
});

// Fill form for edit
function fillForm(p){
  titleEl.value = p.title || "";
  dateEl.value = p.date || "";
  if(cateEl) cateEl.value = p.category || cateEl.value;
  if(authorEl) authorEl.value = p.author || "";
  if(sourceEl) sourceEl.value = p.source || "";
  if(excerptEl) excerptEl.value = p.excerpt || "";
  contentEl.value = p.content || "";
  if(thumbUrlEl) thumbUrlEl.value = p.thumb || "";
  if(heroUrlEl) heroUrlEl.value = p.hero || "";
  if(galleryUrlsEl) galleryUrlsEl.value = (Array.isArray(p.gallery)?p.gallery:[]).join("\n");
}

function clearForm(){
  editingId = "";
  titleEl.value = "";
  dateEl.value = "";
  if(authorEl) authorEl.value = "";
  if(sourceEl) sourceEl.value = "";
  if(excerptEl) excerptEl.value = "";
  contentEl.value = "";
  if(thumbUrlEl) thumbUrlEl.value = "";
  if(heroUrlEl) heroUrlEl.value = "";
  if(galleryUrlsEl) galleryUrlsEl.value = "";
}

function renderList(items){
  if(!listEl) return;
  if(!items.length){
    listEl.innerHTML = `<div class="empty">Chưa có bài nào.</div>`;
    return;
  }

  const sorted = [...items].sort((a,b)=> (b.date||"").localeCompare(a.date||""));

  listEl.innerHTML = sorted.map(p=>{
    const title = (p.title && String(p.title).trim()) ? p.title : "(Chưa có tiêu đề)";
    const thumb = p.thumb || p.hero || "";
    const img = thumb ? `<img src="${esc(thumb)}" alt="thumb">` : `<div class="thumb-empty"></div>`;
    return `
      <div class="row" style="display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid #eee;border-radius:12px;margin-bottom:10px;">
        <div style="width:110px;height:70px;border-radius:10px;overflow:hidden;background:#f2f2f2;flex:0 0 auto;">${img}</div>
        <div style="flex:1;">
          <div style="font-weight:900;margin-bottom:6px;">${esc(title)}</div>
          <div style="color:#666;font-size:13px;margin-bottom:8px;">
            📅 ${esc(p.date||"")} ${p.category?`• 🏷 ${esc(p.category)}`:""} ${p.author?`• ✍ ${esc(p.author)}`:""}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <a class="btn" href="tintuc-post.html?id=${encodeURIComponent(p.id)}" target="_blank">Xem</a>
            <button class="btn" type="button" data-edit="${esc(p.id)}">Sửa</button>
            <button class="btn" type="button" data-del="${esc(p.id)}" style="border-color:#ffb3b3;color:#b00020;">Xóa</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  listEl.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-edit");
      const p = ITEMS.find(x=>String(x.id)===String(id));
      if(!p) return;
      editingId = String(p.id);
      fillForm(p);
      setStatus(`✍️ Đang sửa: "${p.title || ""}"`);
      window.scrollTo({top:0,behavior:"smooth"});
    });
  });

  listEl.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-del");
      if(!id) return;
      if(!confirm("Xóa bài này?")) return;

      setStatus("⏳ Đang xóa...");
      await postNoCors({ action:"deleteNews", adminPassword: ADMIN_PASSWORD, id });

      // poll xác nhận đã xóa
      for(let i=0;i<10;i++){
        await sleep(700);
        const items = await apiList();
        const still = items.find(x=>String(x.id)===String(id));
        if(!still) break;
      }

      if(editingId===id) clearForm();
      await reload();
      setStatus("✅ Đã xóa.");
    });
  });
}

async function reload(){
  setStatus("⏳ Đang tải danh sách...");
  ITEMS = await apiList();
  renderList(ITEMS);
  setStatus(`✅ Đã tải ${ITEMS.length} bài`);
}

async function save(){
  const title = (titleEl?.value||"").trim();
  const date  = (dateEl?.value||"").trim();
  const content = (contentEl?.value||"").trim();

  if(!title){ alert("⚠️ Bắt buộc nhập TIÊU ĐỀ"); titleEl.focus(); return; }
  if(!date){ alert("⚠️ Bắt buộc chọn NGÀY"); dateEl.focus(); return; }
  if(!content){ alert("⚠️ Bắt buộc nhập NỘI DUNG"); contentEl.focus(); return; }

  const id = editingId || uuidv4();

  const post = {
    id,
    title,
    date,
    category: cateEl?.value || "",
    author: (authorEl?.value||"").trim(),
    source: (sourceEl?.value||"").trim(),
    excerpt: (excerptEl?.value||"").trim(),
    thumb: (thumbUrlEl?.value||"").trim(), // ✅ link ảnh đại diện
    hero: (heroUrlEl?.value||"").trim(),   // ✅ link ảnh đầu bài
    content,
    gallery: splitLinks(galleryUrlsEl?.value) // ✅ gallery link
  };

  setStatus(editingId ? "⏳ Đang cập nhật..." : "⏳ Đang đăng...");
  await postNoCors({ action:"upsertNews", adminPassword: ADMIN_PASSWORD, post });

  // poll xác nhận server đã cập nhật title (và thumb/hero nếu có)
  let ok=false;
  for(let i=0;i<12;i++){
    await sleep(800);
    const items = await apiList();
    const found = items.find(x=>String(x.id)===String(id));
    if(found && String(found.title||"").trim()===title){
      ok=true; break;
    }
  }
  if(!ok){
    setStatus(`⚠️ Đã gửi nhưng chưa thấy server cập nhật.`);
    alert("⚠️ Đã gửi nhưng chưa thấy cập nhật.\nMở NEWS_LOG để xem lỗi thật.");
    return;
  }

  editingId = "";
  clearForm();
  await reload();
  setStatus("✅ Đã lưu.");
}

saveBtn?.addEventListener("click",(e)=>{ e.preventDefault?.(); save(); });
cancelBtn?.addEventListener("click",(e)=>{ e.preventDefault?.(); clearForm(); setStatus("Đã hủy sửa."); });

document.addEventListener("DOMContentLoaded", ()=>{
  reload().catch(err=>{
    console.error(err);
    setStatus("❌ Không tải được danh sách.");
  });
});
