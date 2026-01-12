// =============================
// ADMIN - TIN TỨC (SERVER-FIRST) - v2 FIX TITLE
// - LIST/GET: JSONP (không CORS)
// - UPSERT/DELETE: POST no-cors
// =============================

const ADMIN_PASSWORD = "123321";
const input = prompt("🔐 Nhập mật khẩu quản trị:");
if (input !== ADMIN_PASSWORD) {
  alert("❌ Sai mật khẩu. Không có quyền truy cập.");
  window.location.href = "index.html";
}

// 🔴 DÁN LINK /exec TIN TỨC
const API_URL = "https://script.google.com/macros/s/AKfycbwHtgydq5jmIoHPaelCRkq1inb1DrnBxxSITOFiowawHzfvoFW8URUoAvAV3Ea2-n6SiA/exec";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const listEl = $("list");

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}

function mustEl(id) {
  const el = $(id);
  if (!el) throw new Error(`MISSING_ELEMENT_ID_${id}`);
  return el;
}

function getVal(id) {
  return String(mustEl(id).value ?? "").trim();
}

function escMini(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toVNDate(v) {
  if (!v) return "";
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }
  return s;
}

// ===== JSONP =====
function jsonp(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const cb = "__jsonp_cb_" + Math.random().toString(16).slice(2);
    const s = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("JSONP_TIMEOUT"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[cb]; } catch { window[cb] = undefined; }
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }

    window[cb] = (data) => { cleanup(); resolve(data); };
    s.onerror = () => { cleanup(); reject(new Error("JSONP_LOAD_FAILED")); };

    const sep = url.includes("?") ? "&" : "?";
    s.src = `${url}${sep}callback=${cb}&_=${Date.now()}`;
    document.head.appendChild(s);
  });
}

// ===== POST no-cors =====
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function postNoCors(payload) {
  return fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

// ===== FILE -> BASE64 (CHẶN ẢNH NẶNG) =====
const MAX_FILE_BYTES = 25_000;

function tooLargeMsg(name = "Ảnh") {
  return (
    `❌ ${name} quá nặng để lưu trực tiếp lên Google Sheet.\n\n` +
    `Cách xử lý:\n` +
    `1) Dán LINK ảnh (khuyến nghị)\n` +
    `2) Hoặc nén ảnh xuống < 25KB rồi chọn lại\n\n` +
    `Nếu ảnh nặng, bài sẽ không lưu ổn định.`
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result || ""));
    rd.onerror = reject;
    rd.readAsDataURL(file);
  });
}

async function pickImage(urlId, fileId, label = "Ảnh") {
  const url = String(($(urlId)?.value || "")).trim();
  const file = $(fileId)?.files?.[0];

  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      alert(tooLargeMsg(label));
      try { $(fileId).value = ""; } catch {}
      return "";
    }
    return await fileToBase64(file);
  }
  return url;
}

async function pickGallery(urlsId, filesId) {
  const urlRaw = String(($(urlsId)?.value || "")).trim();
  const urlList = urlRaw ? urlRaw.split("\n").map(s => s.trim()).filter(Boolean) : [];

  const files = Array.from($(filesId)?.files || []);
  const base64List = [];
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      alert(tooLargeMsg(`Ảnh "${f.name}"`));
      continue;
    }
    base64List.push(await fileToBase64(f));
  }
  try { $(filesId).value = ""; } catch {}

  return [...base64List, ...urlList];
}

// ===== CHÈN ẢNH GIỮA NỘI DUNG =====
function insertAtCursor(textarea, text) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
  const pos = start + text.length;
  textarea.focus();
  textarea.setSelectionRange(pos, pos);
}
function buildImgToken(src, caption) {
  const safeCaption = String(caption || "").replaceAll("]", ")").replaceAll("|", "/");
  return `\n\n[[IMG:${src}|${safeCaption}]]\n\n`;
}
async function handleInsertInlineImage() {
  const ta = mustEl("content");
  const url = String(($( "inlineImgUrl")?.value || "")).trim();
  const file = $("inlineImgFile")?.files?.[0];
  const caption = String(($( "inlineImgCaption")?.value || "")).trim();

  let src = "";
  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      alert(tooLargeMsg(`Ảnh chèn "${file.name}"`));
      try { $("inlineImgFile").value = ""; } catch {}
      return;
    }
    src = await fileToBase64(file);
  } else {
    src = url;
  }

  if (!src) return setStatus("⚠️ Cần chọn ảnh hoặc dán link để chèn.");
  insertAtCursor(ta, buildImgToken(src, caption));

  if ($("inlineImgUrl")) $("inlineImgUrl").value = "";
  if ($("inlineImgFile")) $("inlineImgFile").value = "";
  if ($("inlineImgCaption")) $("inlineImgCaption").value = "";
  setStatus("✅ Đã chèn ảnh vào nội dung.");
}
$("insertInlineImage")?.addEventListener("click", () => {
  handleInsertInlineImage().catch((e) => {
    console.error(e);
    setStatus("❌ Lỗi khi chèn ảnh.");
  });
});

// ===== FORM =====
async function getFormData() {
  // ✅ đọc chắc chắn element tồn tại
  const title = getVal("title");
  const date = getVal("date");
  const category = String(($("category")?.value || "Hoạt động")).trim();
  const author = getVal("author");
  const source = getVal("source");
  const excerpt = String(($( "excerpt")?.value || "")).trim();

  const thumb = await pickImage("thumbUrl", "thumbFile", "Ảnh đại diện");
  const hero = await pickImage("heroUrl", "heroFile", "Ảnh đầu bài");

  const content = String(mustEl("content").value || "").trim();
  const gallery = await pickGallery("galleryUrls", "galleryFiles");

  return { title, date, category, author, source, excerpt, thumb, hero, content, gallery };
}

function fillForm(p) {
  mustEl("title").value = p.title || "";
  mustEl("date").value = p.date || "";
  mustEl("category").value = p.category || "Hoạt động";
  mustEl("author").value = p.author || "";
  mustEl("source").value = p.source || "";
  mustEl("excerpt").value = p.excerpt || "";

  mustEl("thumbUrl").value = (p.thumb && String(p.thumb).startsWith("data:")) ? "" : (p.thumb || "");
  mustEl("thumbFile").value = "";

  mustEl("heroUrl").value = (p.hero && String(p.hero).startsWith("data:")) ? "" : (p.hero || "");
  mustEl("heroFile").value = "";

  mustEl("content").value = p.content || "";

  const g = Array.isArray(p.gallery) ? p.gallery : [];
  const linksOnly = g.filter(x => !String(x).startsWith("data:"));
  mustEl("galleryUrls").value = linksOnly.join("\n");
  mustEl("galleryFiles").value = "";

  // ✅ lưu id để sửa đúng bài
  if ($("postId")) $("postId").value = p.id || "";
  mustEl("save").dataset.editId = p.id || "";
}

function clearForm() {
  ["postId","title","date","author","source","excerpt","thumbUrl","heroUrl","content","galleryUrls"].forEach(id => {
    if ($(id)) $(id).value = "";
  });
  ["thumbFile","heroFile","galleryFiles","inlineImgFile"].forEach(id => {
    if ($(id)) $(id).value = "";
  });
  ["inlineImgUrl","inlineImgCaption"].forEach(id => {
    if ($(id)) $(id).value = "";
  });
  if ($("category")) $("category").value = "Hoạt động";
  mustEl("save").dataset.editId = "";
}

// ===== SERVER DATA =====
let ITEMS_MEM = [];

async function loadAll() {
  const d = await jsonp(`${API_URL}?action=listNews`);
  if (!d || d.ok !== true) throw new Error(d?.error || "LIST_NEWS_FAILED");
  return Array.isArray(d.items) ? d.items : [];
}

async function renderList() {
  if (!listEl) return;

  setStatus("⏳ Đang tải danh sách bài từ server...");
  try {
    ITEMS_MEM = await loadAll();
    setStatus(`✅ Đã tải ${ITEMS_MEM.length} bài`);
  } catch (e) {
    console.error(e);
    listEl.innerHTML = `<div style="color:#b00020;font-weight:800">❌ Không tải được danh sách bài từ server.</div>`;
    setStatus("❌ Không tải được dữ liệu.");
    return;
  }

  const items = [...ITEMS_MEM].sort((a, b) =>
    String(b.date || b.updatedAt || "").localeCompare(String(a.date || a.updatedAt || ""))
  );

  if (!items.length) {
    listEl.innerHTML = `<div style="color:#666">Chưa có bài nào.</div>`;
    return;
  }

  listEl.innerHTML = items.map(p => {
    const titleText = (p.title && String(p.title).trim()) ? String(p.title).trim() : "(Chưa có tiêu đề)";
    const thumb = p.thumb || p.hero || "";
    const imgHtml = thumb ? `<img src="${escMini(thumb)}" alt="thumb">` : `<img src="" alt="thumb" style="opacity:.12">`;

    return `
      <div class="item">
        ${imgHtml}
        <div style="flex:1">
          <h3>${escMini(titleText)}</h3>
          <div class="meta">
            📅 ${escMini(toVNDate(p.date))} • 🏷 ${escMini(p.category || "")}
            ${p.author ? `• ✍ ${escMini(p.author)}` : ""}
            • 👁 ${escMini(p.views || 0)}
          </div>

          <div class="actions">
            <a class="btn" href="tintuc-post.html?id=${encodeURIComponent(p.id)}">Xem</a>
            <button class="btn" data-edit="${escMini(p.id)}" type="button">Sửa</button>
            <button class="btn danger" data-del="${escMini(p.id)}" type="button">Xóa</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Edit
  listEl.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      const p = ITEMS_MEM.find(x => String(x.id) === String(id));
      if (!p) return;
      fillForm(p);
      setStatus("✍️ Đang sửa bài: " + (p.title || ""));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // Delete
  listEl.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!id) return;
      if (!confirm("Xóa bài viết này?")) return;

      setStatus("⏳ Đang xóa (server)...");
      await postNoCors({ action: "deleteNews", adminPassword: ADMIN_PASSWORD, id });
      await sleep(900);

      await renderList();
      setStatus("✅ Đã xóa bài.");
    });
  });
}

// ===== SAVE =====
mustEl("save")?.addEventListener("click", async () => {
  try {
    const data = await getFormData();

    // ✅ chặn cứng: nếu title rỗng -> không gửi
    if (!data.title) {
      alert("❌ Chưa có TIÊU ĐỀ.\nHãy nhập tiêu đề trước khi lưu.");
      mustEl("title").focus();
      setStatus("❌ Thiếu tiêu đề.");
      return;
    }
    if (!data.date) {
      alert("❌ Chưa chọn NGÀY ĐĂNG.");
      mustEl("date").focus();
      setStatus("❌ Thiếu ngày đăng.");
      return;
    }
    if (!data.content) {
      alert("❌ Chưa có NỘI DUNG.");
      mustEl("content").focus();
      setStatus("❌ Thiếu nội dung.");
      return;
    }

    // ✅ debug rõ ràng
    console.log("DEBUG SEND title =", data.title);

    const editId = mustEl("save").dataset.editId || getVal("postId") || "";
    const post = { id: editId, ...data };

    setStatus(`⏳ Đang lưu (title="${data.title}")...`);
    await postNoCors({ action: "upsertNews", adminPassword: ADMIN_PASSWORD, post });

    await sleep(1200);

    mustEl("save").dataset.editId = "";
    clearForm();
    await renderList();

    setStatus(editId ? "✅ Đã cập nhật bài" : "✅ Đã lưu bài");
  } catch (e) {
    console.error(e);
    alert("❌ Lỗi khi lưu: " + String(e?.message || e));
    setStatus("❌ Lỗi khi lưu bài.");
  }
});

mustEl("cancelEdit")?.addEventListener("click", () => {
  clearForm();
  setStatus("Đã hủy sửa.");
});

// init
document.addEventListener("DOMContentLoaded", renderList);
