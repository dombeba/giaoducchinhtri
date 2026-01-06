// ===== BẢO VỆ TRANG ADMIN (CÁCH 1) =====
const ADMIN_PASSWORD = "123321"; // 🔴 ĐỔI MẬT KHẨU TẠI ĐÂY

const input = prompt("🔐 Nhập mật khẩu quản trị:");
if (input !== ADMIN_PASSWORD) {
  alert("❌ Sai mật khẩu. Không có quyền truy cập.");
  window.location.href = "index.html";
}

// ===== PHẦN CODE CŨ (GIỮ NGUYÊN) =====
const KEY = "LOIBACDAY_POSTS_V1";

// ===== DOM =====
const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const listEl = $("list");

function setStatus(msg){ statusEl.textContent = msg || ""; }

// ===== Storage =====
function loadPosts(){
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function savePosts(posts){
  localStorage.setItem(KEY, JSON.stringify(posts));
}

// ===== Utils =====
function monthFromDate(dateStr){
  const d = new Date(dateStr + "T00:00:00");
  return d.getMonth() + 1;
}
function toVNDate(dateStr){
  const [y,m,d] = (dateStr || "").split("-");
  if(!y || !m || !d) return dateStr || "";
  return `${d}/${m}/${y}`;
}
function escMini(s){
  return String(s || "").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

// ===== File -> base64 =====
async function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// chặn ảnh quá nặng để khỏi đầy localStorage (chủ tướng có thể chỉnh)
const MAX_FILE_BYTES = 900_000; // ~900KB

async function pickImage(urlInputId, fileInputId){
  const url = $(urlInputId).value.trim();
  const file = $(fileInputId).files?.[0];

  if(file){
    if(file.size > MAX_FILE_BYTES){
      const ok = confirm("Ảnh khá nặng. Lưu base64 có thể nhanh đầy bộ nhớ. Vẫn lưu?");
      if(!ok) return "";
    }
    return await fileToBase64(file);
  }

  return url; // nếu không có file thì dùng link
}

async function pickGallery(urlTextareaId, filesInputId){
  const urlRaw = $(urlTextareaId).value.trim();
  const urlList = urlRaw
    ? urlRaw.split("\n").map(s => s.trim()).filter(Boolean)
    : [];

  const files = Array.from($(filesInputId).files || []);
  const base64List = [];

  for(const f of files){
    if(f.size > MAX_FILE_BYTES){
      const ok = confirm(`Ảnh "${f.name}" khá nặng. Vẫn lưu?`);
      if(!ok) continue;
    }
    base64List.push(await fileToBase64(f));
  }

  // ưu tiên file (base64) + vẫn giữ link nếu chủ tướng dán
  return [...base64List, ...urlList];
}

// ===== Form =====
async function getForm(){
  const title = $("title").value.trim();
  const date = $("date").value;
  const link = $("link").value.trim();

  const quote = $("quote").value.trim();
  const content = $("content").value.trim();

  // ảnh danh sách: ưu tiên file
  const image = await pickImage("imageUrl", "imageFile");

  // ảnh chi tiết: ưu tiên file
  const detailImage = await pickImage("detailImageUrl", "detailImageFile");

  const detailContent = $("detailContent").value.trim();

  // gallery: ưu tiên file (có thể nhiều ảnh)
  const detailImages = await pickGallery("detailImagesUrl", "detailImagesFiles");

  return { title, date, link, quote, content, image, detailImage, detailContent, detailImages };
}

function fillForm(p){
  $("title").value = p.title || "";
  $("date").value = p.date || "";
  $("link").value = p.link || "";

  // Nếu ảnh đang là base64 thì để trống ô URL cho sạch, giữ ảnh bằng file nếu chủ tướng muốn đổi
  $("imageUrl").value = (p.image && String(p.image).startsWith("data:")) ? "" : (p.image || "");
  $("imageFile").value = "";

  $("quote").value = p.quote || "";
  $("content").value = p.content || "";

  $("detailImageUrl").value = (p.detailImage && String(p.detailImage).startsWith("data:")) ? "" : (p.detailImage || "");
  $("detailImageFile").value = "";

  $("detailContent").value = p.detailContent || "";

  // gallery: chỉ đưa phần link vào textarea (còn base64 bỏ qua để tránh dài)
  const g = Array.isArray(p.detailImages) ? p.detailImages : [];
  const linksOnly = g.filter(x => !String(x).startsWith("data:"));
  $("detailImagesUrl").value = linksOnly.join("\n");
  $("detailImagesFiles").value = "";
}

function clearForm(){
  [
    "title","date","link","quote","content","detailContent",
    "imageUrl","detailImageUrl","detailImagesUrl"
  ].forEach(id => $(id).value = "");

  ["imageFile","detailImageFile","detailImagesFiles"].forEach(id => $(id).value = "");

  $("save").dataset.editId = "";
}

// ===== Render list =====
function render(){
  const posts = loadPosts().sort((a,b)=> (b.date || "").localeCompare(a.date || ""));
  if(!posts.length){
    listEl.innerHTML = `<div style="color:#666">Chưa có bài nào.</div>`;
    return;
  }

  listEl.innerHTML = posts.map(p => `
    <div class="item">
      <img src="${p.image || p.detailImage || ""}" alt="">
      <div style="flex:1">
        <h3>${escMini(p.title)}</h3>
        <div class="meta">📅 ${toVNDate(p.date)} • Tháng ${p.month} • 👁 ${p.views || 0}</div>
        ${p.quote ? `<div class="quote">${escMini(p.quote).slice(0,140)}${p.quote.length>140?"…":""}</div>` : ""}
        <div class="actions">
          <a class="btn" href="loibacday-post.html?id=${p.id}">Xem</a>
          <button class="btn" data-edit="${p.id}" type="button">Sửa</button>
          <button class="btn danger" data-del="${p.id}" type="button">Xóa</button>
        </div>
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-del");
      const next = loadPosts().filter(x => x.id !== id);
      savePosts(next);
      render();
      setStatus("Đã xóa bài.");
    });
  });

  listEl.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-edit");
      const p = loadPosts().find(x => x.id === id);
      if(!p) return;
      fillForm(p);
      $("save").dataset.editId = id;
      setStatus("Đang sửa bài: " + (p.title || ""));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

// ===== Events =====
$("save").addEventListener("click", async () => {
  const data = await getForm();

  if(!data.title || !data.date){
    setStatus("Cần nhập Tiêu đề và chọn Ngày.");
    return;
  }

  const posts = loadPosts();
  const editId = $("save").dataset.editId;
  const month = monthFromDate(data.date);

  if(editId){
    const idx = posts.findIndex(x => x.id === editId);
    if(idx >= 0){
      posts[idx] = { ...posts[idx], ...data, month };
      savePosts(posts);
      setStatus("Đã cập nhật bài ✅");
      clearForm();
      render();
    }
    return;
  }

  const id = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
  posts.push({
    id,
    ...data,
    month,
    views: 0,
    createdAt: new Date().toISOString()
  });

  savePosts(posts);
  setStatus("Đã lưu bài ✅");
  clearForm();
  render();
});

$("cancelEdit").addEventListener("click", () => {
  clearForm();
  $("save").dataset.editId = "";
  setStatus("Đã hủy sửa.");
});

$("clearAll").addEventListener("click", ()=>{
  if(confirm("Xóa toàn bộ dữ liệu bài viết?")){
    localStorage.removeItem(KEY);
    clearForm();
    render();
    setStatus("Đã xóa toàn bộ.");
  }
});

render();
