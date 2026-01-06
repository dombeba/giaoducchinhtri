// ===== BẢO VỆ TRANG ADMIN (CÁCH 1) =====
const ADMIN_PASSWORD = "123321"; // 🔴 ĐỔI MẬT KHẨU TẠI ĐÂY

const input = prompt("🔐 Nhập mật khẩu quản trị:");
if (input !== ADMIN_PASSWORD) {
  alert("❌ Sai mật khẩu. Không có quyền truy cập.");
  window.location.href = "index.html";
}

// ===== APP =====
const KEY = "TINTUC_POSTS_V1";

// DOM
const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const listEl = $("list");

function setStatus(msg){ if(statusEl) statusEl.textContent = msg || ""; }

// Storage
function loadNews(){
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function saveNews(items){
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Utils
function escMini(s){
  return String(s || "").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
function toVNDate(dateStr){
  const [y,m,d] = (dateStr || "").split("-");
  if(!y || !m || !d) return dateStr || "";
  return `${d}/${m}/${y}`;
}

// File -> base64
async function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// chặn ảnh quá nặng để khỏi đầy localStorage
const MAX_FILE_BYTES = 900_000; // ~900KB

async function pickImage(urlId, fileId){
  const url = ($(urlId)?.value || "").trim();
  const file = $(fileId)?.files?.[0];

  if(file){
    if(file.size > MAX_FILE_BYTES){
      const ok = confirm("Ảnh khá nặng. Lưu base64 có thể nhanh đầy bộ nhớ. Vẫn lưu?");
      if(!ok) return "";
    }
    return await fileToBase64(file);
  }
  return url;
}

async function pickGallery(urlsId, filesId){
  const urlRaw = ($(urlsId)?.value || "").trim();
  const urlList = urlRaw ? urlRaw.split("\n").map(s=>s.trim()).filter(Boolean) : [];

  const files = Array.from($(filesId)?.files || []);
  const base64List = [];

  for(const f of files){
    if(f.size > MAX_FILE_BYTES){
      const ok = confirm(`Ảnh "${f.name}" khá nặng. Vẫn lưu?`);
      if(!ok) continue;
    }
    base64List.push(await fileToBase64(f));
  }

  return [...base64List, ...urlList];
}

// ===== CHÈN ẢNH VÀO GIỮA NỘI DUNG =====
function insertAtCursor(textarea, text){
  if(!textarea) return;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;

  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);

  textarea.value = before + text + after;

  const pos = (before + text).length;
  textarea.focus();
  textarea.setSelectionRange(pos, pos);
}

function buildImgToken(src, caption){
  const safeCaption = String(caption || "").replaceAll("]", ")").replaceAll("|", "/");
  return `\n\n[[IMG:${src}|${safeCaption}]]\n\n`;
}

async function handleInsertInlineImage(){
  const contentTa = $("content");
  if(!contentTa){
    setStatus("Không tìm thấy ô nội dung.");
    return;
  }

  const url = ($("inlineImgUrl")?.value || "").trim();
  const file = $("inlineImgFile")?.files?.[0];
  const caption = ($("inlineImgCaption")?.value || "").trim();

  let src = "";

  if(file){
    if(file.size > MAX_FILE_BYTES){
      const ok = confirm("Ảnh khá nặng. Lưu base64 có thể nhanh đầy bộ nhớ. Vẫn lưu?");
      if(!ok) return;
    }
    src = await fileToBase64(file);
  } else {
    src = url;
  }

  if(!src){
    setStatus("Cần chọn file ảnh hoặc dán link ảnh để chèn.");
    return;
  }

  const token = buildImgToken(src, caption);
  insertAtCursor(contentTa, token);

  // clear input
  if($("inlineImgUrl")) $("inlineImgUrl").value = "";
  if($("inlineImgFile")) $("inlineImgFile").value = "";
  if($("inlineImgCaption")) $("inlineImgCaption").value = "";

  setStatus("Đã chèn ảnh vào nội dung ✅");
}

$("insertInlineImage")?.addEventListener("click", () => {
  handleInsertInlineImage().catch(() => setStatus("Lỗi khi chèn ảnh."));
});

// Form
async function getForm(){
  const title = ($("title")?.value || "").trim();
  const date = $("date")?.value || "";
  const category = ($("category")?.value || "Hoạt động").trim();
  const author = ($("author")?.value || "").trim();
  const source = ($("source")?.value || "").trim();

  const excerpt = ($("excerpt")?.value || "").trim();

  const thumb = await pickImage("thumbUrl", "thumbFile");
  const hero = await pickImage("heroUrl", "heroFile");

  // ✅ content giờ có thể chứa token [[IMG:...|...]]
  const content = ($("content")?.value || "").trim();

  const gallery = await pickGallery("galleryUrls", "galleryFiles");

  return { title, date, category, author, source, excerpt, thumb, hero, content, gallery };
}

function fillForm(p){
  $("title").value = p.title || "";
  $("date").value = p.date || "";
  $("category").value = p.category || "Hoạt động";
  $("author").value = p.author || "";
  $("source").value = p.source || "";
  $("excerpt").value = p.excerpt || "";

  $("thumbUrl").value = (p.thumb && String(p.thumb).startsWith("data:")) ? "" : (p.thumb || "");
  $("thumbFile").value = "";

  $("heroUrl").value = (p.hero && String(p.hero).startsWith("data:")) ? "" : (p.hero || "");
  $("heroFile").value = "";

  $("content").value = p.content || "";

  // gallery: chỉ đưa link vào textarea để tránh dài
  const g = Array.isArray(p.gallery) ? p.gallery : [];
  const linksOnly = g.filter(x => !String(x).startsWith("data:"));
  $("galleryUrls").value = linksOnly.join("\n");
  $("galleryFiles").value = "";

  $("save").dataset.editId = p.id || "";
}

function clearForm(){
  ["title","date","author","source","excerpt","thumbUrl","heroUrl","content","galleryUrls"].forEach(id=>{
    if($(id)) $(id).value = "";
  });
  ["thumbFile","heroFile","galleryFiles","inlineImgFile"].forEach(id=>{
    if($(id)) $(id).value = "";
  });
  ["inlineImgUrl","inlineImgCaption"].forEach(id=>{
    if($(id)) $(id).value = "";
  });

  if($("category")) $("category").value = "Hoạt động";
  $("save").dataset.editId = "";
}

function render(){
  const items = loadNews().sort((a,b)=> (b.date || "").localeCompare(a.date || ""));
  if(!items.length){
    listEl.innerHTML = `<div style="color:#666">Chưa có bài nào.</div>`;
    return;
  }

  listEl.innerHTML = items.map(p => `
    <div class="item">
      <img src="${p.thumb || p.hero || ""}" alt="">
      <div style="flex:1">
        <h3>${escMini(p.title)}</h3>
        <div class="meta">
          📅 ${escMini(toVNDate(p.date))} • 🏷 ${escMini(p.category || "")}
          ${p.author ? `• ✍ ${escMini(p.author)}` : ""}
          • 👁 ${escMini(p.views || 0)}
        </div>

        ${p.excerpt ? `<div class="meta" style="margin-top:6px">${escMini(p.excerpt).slice(0,160)}${p.excerpt.length>160?"…":""}</div>` : ""}

        <div class="actions">
          <a class="btn" href="tintuc-post.html?id=${encodeURIComponent(p.id)}">Xem</a>
          <button class="btn" data-edit="${p.id}" type="button">Sửa</button>
          <button class="btn danger" data-del="${p.id}" type="button">Xóa</button>
        </div>
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-del");
      const next = loadNews().filter(x => x.id !== id);
      saveNews(next);
      render();
      setStatus("Đã xóa bài.");
    });
  });

  listEl.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-edit");
      const p = loadNews().find(x => x.id === id);
      if(!p) return;
      fillForm(p);
      setStatus("Đang sửa bài: " + (p.title || ""));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

// Events
$("save").addEventListener("click", async ()=>{
  const data = await getForm();

  if(!data.title || !data.date || !data.content){
    setStatus("Cần nhập: Tiêu đề + Ngày đăng + Nội dung chi tiết.");
    return;
  }

  const items = loadNews();
  const editId = $("save").dataset.editId;

  if(editId){
    const idx = items.findIndex(x => x.id === editId);
    if(idx >= 0){
      items[idx] = { ...items[idx], ...data };
      saveNews(items);
      setStatus("Đã cập nhật bài ✅");
      clearForm();
      render();
    }
    return;
  }

  const id = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
  items.push({
    id,
    ...data,
    views: 0,
    createdAt: new Date().toISOString()
  });
  saveNews(items);

  setStatus("Đã lưu bài ✅");
  clearForm();
  render();
});

$("cancelEdit").addEventListener("click", ()=>{
  clearForm();
  setStatus("Đã hủy sửa.");
});

$("clearAll").addEventListener("click", ()=>{
  if(confirm("Xóa toàn bộ dữ liệu tin tức?")){
    localStorage.removeItem(KEY);
    clearForm();
    render();
    setStatus("Đã xóa toàn bộ.");
  }
});

// init
render();
