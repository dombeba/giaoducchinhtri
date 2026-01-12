/**************** ADMIN - TIN TỨC (FULL - GITHUB PAGES SAFE) ****************/
const ADMIN_PASSWORD = "123321";
const API_URL = "https://script.google.com/macros/s/AKfycbzctYLpyy5xceGNdO_WYDCPgIAYzIAov2OV3GslYiSULNuoWPYtkRxwq90ZNBtqSeC29A/exec"; // 🔴 dán link /exec

const $ = (id) => document.getElementById(id);

// --- Form fields (phải đúng id trong HTML) ---
const titleEl   = $("title");
const dateEl    = $("date");
const cateEl    = $("category");
const authorEl  = $("author");
const sourceEl  = $("source");
const excerptEl = $("excerpt");
const contentEl = $("content");
const statusEl  = $("status");
const listEl    = $("list");
const saveBtn   = $("save");
const cancelBtn = $("cancelEdit");

// --- Helpers ---
function setStatus(msg) { if (statusEl) statusEl.textContent = msg || ""; }
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function esc(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- JSONP (GET) ---
function jsonp(url, timeoutMs = 12000){
  return new Promise((resolve, reject) => {
    const cb = "__cb_" + Math.random().toString(16).slice(2);
    const s = document.createElement("script");
    const timer = setTimeout(() => { cleanup(); reject(new Error("JSONP_TIMEOUT")); }, timeoutMs);

    function cleanup(){
      clearTimeout(timer);
      try { delete window[cb]; } catch { window[cb] = undefined; }
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }

    window[cb] = (data) => { cleanup(); resolve(data); };
    s.onerror = () => { cleanup(); reject(new Error("JSONP_LOAD_FAILED")); };

    s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb + "&_=" + Date.now();
    document.head.appendChild(s);
  });
}

async function apiListNews(){
  const res = await jsonp(`${API_URL}?action=listNews`);
  if (!res || res.ok !== true) throw new Error(res?.error || "LIST_FAILED");
  return Array.isArray(res.items) ? res.items : [];
}

// --- POST no-cors (WRITE) ---
async function postNoCors(payload){
  await fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => {});
}

// --- State ---
let ITEMS = [];
let editingId = ""; // id bài đang sửa

// --- Render list with Edit/Delete ---
function renderListUI(items){
  if (!listEl) return;

  if (!items.length) {
    listEl.innerHTML = `<div style="color:#666">Chưa có bài nào.</div>`;
    return;
  }

  const sorted = [...items].sort((a,b) =>
    String(b.date || b.updatedAt || "").localeCompare(String(a.date || a.updatedAt || ""))
  );

  listEl.innerHTML = sorted.map(p => {
    const title = (p.title && String(p.title).trim()) ? String(p.title).trim() : "(Chưa có tiêu đề)";
    const date = p.date || "";
    const cat  = p.category || "";
    const author = p.author || "";
    const thumb = p.thumb || p.hero || "";

    return `
      <div class="item" style="display:flex; gap:12px; align-items:flex-start; padding:12px; border:1px solid #eee; border-radius:12px; margin-bottom:10px;">
        <div style="width:110px; height:70px; border-radius:10px; overflow:hidden; background:#f2f2f2; flex:0 0 auto;">
          ${thumb ? `<img src="${esc(thumb)}" alt="thumb" style="width:100%; height:100%; object-fit:cover;">` : ""}
        </div>
        <div style="flex:1;">
          <h3 style="margin:0 0 6px 0;">${esc(title)}</h3>
          <div style="color:#666; font-size:13px; margin-bottom:8px;">
            📅 ${esc(date)} • 🏷 ${esc(cat)} ${author ? `• ✍ ${esc(author)}` : ""}
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <a class="btn" href="tintuc-post.html?id=${encodeURIComponent(p.id)}" target="_blank">Xem</a>
            <button class="btn" type="button" data-edit="${esc(p.id)}">Sửa</button>
            <button class="btn danger" type="button" data-del="${esc(p.id)}">Xóa</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Bind edit
  listEl.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit") || "";
      const p = ITEMS.find(x => String(x.id) === String(id));
      if (!p) return;

      editingId = String(p.id);
      fillForm(p);
      setStatus(`✍️ Đang sửa bài: "${p.title || ""}"`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // Bind delete
  listEl.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del") || "";
      if (!id) return;
      if (!confirm("Xóa bài này?")) return;

      setStatus("⏳ Đang xóa...");
      await postNoCors({ action:"deleteNews", adminPassword: ADMIN_PASSWORD, id });

      // Poll để chắc chắn xóa xong
      for (let i=0;i<10;i++){
        await sleep(700);
        const items = await apiListNews();
        const still = items.find(x => String(x.id) === String(id));
        if (!still) break;
      }

      // Nếu đang sửa đúng bài vừa xóa thì reset
      if (editingId === id) { editingId = ""; clearForm(); }

      await loadAndRender();
      setStatus("✅ Đã xóa.");
    });
  });
}

// --- Load + render ---
async function loadAndRender(){
  setStatus("⏳ Đang tải danh sách...");
  ITEMS = await apiListNews();
  renderListUI(ITEMS);
  setStatus(`✅ Đã tải ${ITEMS.length} bài`);
}

// --- Fill/Clear form ---
function fillForm(p){
  titleEl.value = p.title || "";
  dateEl.value = p.date || "";
  if (cateEl) cateEl.value = p.category || (cateEl.value || "");
  if (authorEl) authorEl.value = p.author || "";
  if (sourceEl) sourceEl.value = p.source || "";
  if (excerptEl) excerptEl.value = p.excerpt || "";
  contentEl.value = p.content || "";
}

function clearForm(){
  titleEl.value = "";
  dateEl.value = "";
  if (cateEl) cateEl.value = cateEl.value || "";
  if (authorEl) authorEl.value = "";
  if (sourceEl) sourceEl.value = "";
  if (excerptEl) excerptEl.value = "";
  contentEl.value = "";
}

// --- Save (create OR update) ---
async function savePost(){
  const title = (titleEl?.value || "").trim();
  const date  = (dateEl?.value || "").trim();
  const content = (contentEl?.value || "").trim();

  if (!title) { alert("⚠️ Bắt buộc nhập TIÊU ĐỀ"); titleEl.focus(); return; }
  if (!date) { alert("⚠️ Bắt buộc chọn NGÀY"); dateEl.focus(); return; }
  if (!content) { alert("⚠️ Bắt buộc nhập NỘI DUNG"); contentEl.focus(); return; }

  // ✅ Nếu đang sửa -> giữ id cũ. Nếu tạo mới -> tạo id mới
  const id = editingId || uuidv4();

  const post = {
    id,
    title,
    date,
    category: cateEl?.value || "",
    author: (authorEl?.value || "").trim(),
    source: (sourceEl?.value || "").trim(),
    excerpt: (excerptEl?.value || "").trim(),
    content,
    // nếu chủ tướng cần ảnh sau này ta mở rộng (thumb/hero/gallery)
    thumb: "",
    hero: "",
    gallery: []
  };

  const payload = { action:"upsertNews", adminPassword: ADMIN_PASSWORD, post };
  console.log("SEND:", payload);

  setStatus(editingId ? `⏳ Đang cập nhật: "${title}"...` : `⏳ Đang đăng: "${title}"...`);
  await postNoCors(payload);

  // Poll để chắc chắn server ghi xong và title đúng
  let ok = false;
  for (let i=0;i<10;i++){
    await sleep(800);
    const items = await apiListNews();
    const found = items.find(x => String(x.id) === String(id));
    if (found && String(found.title||"").trim() === title) { ok = true; break; }
  }

  if (!ok) {
    setStatus(`⚠️ Đã gửi nhưng chưa thấy server cập nhật title="${title}".`);
    alert("⚠️ Đã gửi nhưng chưa thấy cập nhật.\nMở sheet NEWS_LOG xem POST_IN/POST_ERR để biết lỗi thật.");
    return;
  }

  // thành công
  editingId = "";
  clearForm();
  await loadAndRender();
  setStatus("✅ Đã lưu thành công.");
}

// --- Cancel edit ---
function cancelEdit(){
  editingId = "";
  clearForm();
  setStatus("Đã hủy sửa.");
}

// --- Hook buttons ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("admin-tintuc.js loaded");
  try {
    await loadAndRender();
  } catch (e) {
    console.error(e);
    setStatus("❌ Không tải được danh sách.");
  }
});

saveBtn?.addEventListener("click", (e) => {
  e.preventDefault?.();
  savePost();
});

cancelBtn?.addEventListener("click", (e) => {
  e.preventDefault?.();
  cancelEdit();
});
