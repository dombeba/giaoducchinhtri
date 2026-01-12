/**************************************************
 * ADMIN - TIN TỨC (SERVER-FIRST, FIX TITLE 100%)
 * - GET: JSONP (listNews)
 * - POST: no-cors (upsert/delete) + poll list để xác nhận
 **************************************************/

// ====== CONFIG ======
const ADMIN_PASSWORD = "123321";

// 🔴 DÁN LINK /exec TIN TỨC CỦA CHỦ TƯỚNG
const API_URL = "PASTE_YOUR_NEWS_EXEC_HERE";

// Nếu muốn khóa admin bằng mật khẩu ngay khi mở trang:
(() => {
  const pw = prompt("🔐 Nhập mật khẩu quản trị:");
  if (pw !== ADMIN_PASSWORD) {
    alert("❌ Sai mật khẩu.");
    location.href = "index.html";
  }
})();

// ====== DOM ======
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

function val(id) {
  return String(mustEl(id).value ?? "").trim();
}

// ====== UTILS ======
function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function uuidv4() {
  // uuid v4 đơn giản (đủ dùng)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ====== JSONP (GET listNews/getNews) ======
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

async function apiListNews() {
  const d = await jsonp(`${API_URL}?action=listNews`);
  if (!d || d.ok !== true) throw new Error(d?.error || "LIST_NEWS_FAILED");
  return Array.isArray(d.items) ? d.items : [];
}

// ====== POST no-cors (upsert/delete) ======
async function postNoCors(payload) {
  // no-cors: gửi được nhưng không đọc response
  await fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

// ====== IMAGE (limit base64) ======
const MAX_FILE_BYTES = 25_000;

function tooLargeMsg(name = "Ảnh") {
  return `❌ ${name} quá nặng (>25KB).\nHãy dùng LINK ảnh hoặc nén ảnh xuống <25KB.`;
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

// ====== INLINE IMAGE TOKEN ======
function insertAtCursor(textarea, text) {
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
  const url = String(($("inlineImgUrl")?.value || "")).trim();
  const file = $("inlineImgFile")?.files?.[0];
  const caption = String(($("inlineImgCaption")?.value || "")).trim();

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

// ====== FORM ======
function clearForm() {
  ["title","date","author","source","excerpt","thumbUrl","heroUrl","content","galleryUrls"].forEach(id => {
    if ($(id)) $(id).value = "";
  });
  ["thumbFile","heroFile","galleryFiles","inlineImgFile"].forEach(id => {
    if ($(id)) $(id).value = "";
  });
  ["inlineImgUrl","inlineImgCaption"].forEach(id => {
    if ($(id)) $(id).value = "";
  });
  if ($("category")) $("category").value = "Hoạt động";

  // lưu id bài đang sửa
  $("save").dataset.editId = "";
}

function fillForm(p) {
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

  const g = Array.isArray(p.gallery) ? p.gallery : [];
  const linksOnly = g.filter(x => !String(x).startsWith("data:"));
  $("galleryUrls").value = linksOnly.join("\n");
  $("galleryFiles").value = "";

  $("save").dataset.editId = p.id || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ====== RENDER LIST ======
let ITEMS = [];

async function renderList() {
  setStatus("⏳ Đang tải danh sách bài từ server...");
  try {
    ITEMS = await apiListNews();
    setStatus(`✅ Đã tải ${ITEMS.length} bài`);
  } catch (e) {
    console.error(e);
    setStatus("❌ Không tải được danh sách bài.");
    if (listEl) listEl.innerHTML = `<div style="color:#b00020;font-weight:900">❌ Không tải được danh sách bài từ server.</div>`;
    return;
  }

  if (!listEl) return;
  if (!ITEMS.length) {
    listEl.innerHTML = `<div style="color:#666">Chưa có bài nào.</div>`;
    return;
  }

  const items = [...ITEMS].sort((a, b) =>
    String(b.date || b.updatedAt || "").localeCompare(String(a.date || a.updatedAt || ""))
  );

  listEl.innerHTML = items.map(p => {
    const titleText = (p.title && String(p.title).trim()) ? String(p.title).trim() : "(Chưa có tiêu đề)";
    const thumb = p.thumb || p.hero || "";
    const imgHtml = thumb ? `<img src="${esc(thumb)}" alt="thumb">` : `<div class="thumb-ph">thumb</div>`;

    return `
      <div class="item">
        ${imgHtml}
        <div style="flex:1">
          <h3>${esc(titleText)}</h3>
          <div class="meta">📅 ${esc(p.date || "")} • 🏷 ${esc(p.category || "")} ${p.author ? `• ✍ ${esc(p.author)}` : ""}</div>
          <div class="actions">
            <a class="btn" href="tintuc-post.html?id=${encodeURIComponent(p.id)}">Xem</a>
            <button class="btn" data-edit="${esc(p.id)}" type="button">Sửa</button>
            <button class="btn danger" data-del="${esc(p.id)}" type="button">Xóa</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // edit
  listEl.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      const p = ITEMS.find(x => String(x.id) === String(id));
      if (p) fillForm(p);
    });
  });

  // delete
  listEl.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!id) return;
      if (!confirm("Xóa bài viết này?")) return;

      setStatus("⏳ Đang xóa bài...");
      await postNoCors({ action: "deleteNews", adminPassword: ADMIN_PASSWORD, id });
      await sleep(900);
      await renderList();
      setStatus("✅ Đã xóa.");
    });
  });
}

// ====== SAVE ======
$("save")?.addEventListener("click", async () => {
  try {
    // ✅ LẤY TEXT TRƯỚC (không để ảnh làm rỗng title)
    const title = val("title");
    const date = val("date");
    const category = String(($("category")?.value || "Hoạt động")).trim();
    const author = val("author");
    const source = val("source");
    const excerpt = String(($("excerpt")?.value || "")).trim();
    const content = String(mustEl("content").value || "").trim();

    if (!title) { alert("❌ Chưa có TIÊU ĐỀ"); mustEl("title").focus(); return; }
    if (!date) { alert("❌ Chưa chọn NGÀY ĐĂNG"); mustEl("date").focus(); return; }
    if (!content) { alert("❌ Chưa có NỘI DUNG"); mustEl("content").focus(); return; }

    // ✅ tạo id ở client để poll xác nhận (vì POST no-cors không đọc response)
    const editId = String($("save").dataset.editId || "").trim();
    const id = editId || uuidv4();

    // ✅ XỬ LÝ ẢNH SAU
    const thumb = await pickImage("thumbUrl", "thumbFile", "Ảnh đại diện");
    const hero  = await pickImage("heroUrl", "heroFile", "Ảnh đầu bài");
    const gallery = await pickGallery("galleryUrls", "galleryFiles");

    // ✅ SCHEMA ĐÚNG CHO APPS SCRIPT: post:{title,...}
    const post = { id, title, date, category, author, source, excerpt, thumb, hero, content, gallery };

    console.log("DEBUG SEND title =", title);
    console.log("DEBUG SEND post =", post);

    setStatus(`⏳ Đang lưu bài: "${title}" ...`);
    await postNoCors({ action: "upsertNews", adminPassword: ADMIN_PASSWORD, post });

    // ✅ Poll listNews để chắc chắn bài đã lên sheet và có title
    let ok = false;
    for (let i = 0; i < 10; i++) {
      await sleep(800);
      const items = await apiListNews();
      const found = items.find(x => String(x.id) === String(id));
      if (found && String(found.title || "").trim() === title.trim()) {
        ok = true;
        break;
      }
    }

    if (!ok) {
      setStatus(`⚠️ Đã gửi nhưng chưa thấy cập nhật title trên server. Hãy thử bấm Lưu lại lần nữa.`);
      alert("⚠️ Đã gửi nhưng chưa thấy title cập nhật trên server.\nHãy bấm Lưu lại lần nữa (đôi khi Apps Script ghi chậm).");
      return;
    }

    setStatus("✅ Đã lưu bài (server đã nhận tiêu đề).");
    $("save").dataset.editId = "";
    clearForm();
    await renderList();
  } catch (e) {
    console.error(e);
    alert("❌ Lỗi khi lưu: " + String(e?.message || e));
    setStatus("❌ Lỗi khi lưu.");
  }
});

$("cancelEdit")?.addEventListener("click", () => {
  clearForm();
  setStatus("Đã hủy sửa.");
});

document.addEventListener("DOMContentLoaded", () => {
  console.log("admin-tintuc.js loaded @", new Date().toISOString());
  renderList();
});
