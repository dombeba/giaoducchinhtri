// =============================
// ADMIN - TIN TỨC (SERVER-FIRST, REALTIME via JSONP)
// - LIST/GET: JSONP (không CORS)
// - UPSERT/DELETE: POST no-cors
// File: javascrip/admin-tintuc.js
// =============================

// ===== BẢO VỆ ADMIN (CÁCH 1) =====
const ADMIN_PASSWORD = "123321";
const input = prompt("🔐 Nhập mật khẩu quản trị:");
if (input !== ADMIN_PASSWORD) {
  alert("❌ Sai mật khẩu. Không có quyền truy cập.");
  window.location.href = "index.html";
}

// ====== CONFIG ======
const API_URL =
  "https://script.google.com/macros/s/AKfycbwHtgydq5jmIoHPaelCRkq1inb1DrnBxxSITOFiowawHzfvoFW8URUoAvAV3Ea2-n6SiA/exec"; // 🔴 DÁN LINK /exec TIN TỨC (SCRIPT RIÊNG)

// ====== DOM ======
const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const listEl = $("list");

// ====== UI ======
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}

function escMini(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toVNDate(dateStr) {
  const [y, m, d] = (dateStr || "").split("-");
  if (!y || !m || !d) return dateStr || "";
  return `${d}/${m}/${y}`;
}

// ====== JSONP (NO CORS) ======
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
      try {
        delete window[cb];
      } catch {
        window[cb] = undefined;
      }
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };

    s.onerror = () => {
      cleanup();
      reject(new Error("JSONP_LOAD_FAILED"));
    };

    const sep = url.includes("?") ? "&" : "?";
    s.src = `${url}${sep}callback=${cb}&_=${Date.now()}`;
    document.head.appendChild(s);
  });
}

// ====== POST no-cors ======
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function postNoCors(payload) {
  // no-cors: gửi được, không đọc response
  return fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

// ====== FILE -> BASE64 ======
const MAX_FILE_BYTES = 900_000;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result || ""));
    rd.onerror = reject;
    rd.readAsDataURL(file);
  });
}

async function pickImage(urlId, fileId) {
  const url = ($(urlId)?.value || "").trim();
  const file = $(fileId)?.files?.[0];

  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      const ok = confirm("Ảnh khá nặng. Lưu base64 có thể nhanh đầy dung lượng. Vẫn lưu?");
      if (!ok) return "";
    }
    return await fileToBase64(file);
  }
  return url;
}

async function pickGallery(urlsId, filesId) {
  const urlRaw = ($(urlsId)?.value || "").trim();
  const urlList = urlRaw
    ? urlRaw.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];

  const files = Array.from($(filesId)?.files || []);
  const base64List = [];
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      const ok = confirm(`Ảnh "${f.name}" khá nặng. Vẫn lưu?`);
      if (!ok) continue;
    }
    base64List.push(await fileToBase64(f));
  }
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
  const safeCaption = String(caption || "")
    .replaceAll("]", ")")
    .replaceAll("|", "/");
  return `\n\n[[IMG:${src}|${safeCaption}]]\n\n`;
}

async function handleInsertInlineImage() {
  const ta = $("content");
  const url = ($("inlineImgUrl")?.value || "").trim();
  const file = $("inlineImgFile")?.files?.[0];
  const caption = ($("inlineImgCaption")?.value || "").trim();

  let src = "";
  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      const ok = confirm("Ảnh khá nặng. Lưu base64 có thể nhanh đầy dung lượng. Vẫn lưu?");
      if (!ok) return;
    }
    src = await fileToBase64(file);
  } else {
    src = url;
  }

  if (!src) return setStatus("Cần chọn file ảnh hoặc dán link ảnh để chèn.");
  insertAtCursor(ta, buildImgToken(src, caption));

  if ($("inlineImgUrl")) $("inlineImgUrl").value = "";
  if ($("inlineImgFile")) $("inlineImgFile").value = "";
  if ($("inlineImgCaption")) $("inlineImgCaption").value = "";

  setStatus("✅ Đã chèn ảnh vào nội dung.");
}

$("insertInlineImage")?.addEventListener("click", () => {
  handleInsertInlineImage().catch(() => setStatus("❌ Lỗi khi chèn ảnh."));
});

// ===== FORM =====
async function getFormData() {
  const title = ($("title")?.value || "").trim();
  const date = $("date")?.value || "";
  const category = ($("category")?.value || "Hoạt động").trim();
  const author = ($("author")?.value || "").trim();
  const source = ($("source")?.value || "").trim();
  const excerpt = ($("excerpt")?.value || "").trim();

  const thumb = await pickImage("thumbUrl", "thumbFile");
  const hero = await pickImage("heroUrl", "heroFile");

  const content = ($("content")?.value || "").trim();
  const gallery = await pickGallery("galleryUrls", "galleryFiles");

  return { title, date, category, author, source, excerpt, thumb, hero, content, gallery };
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
  const linksOnly = g.filter((x) => !String(x).startsWith("data:"));
  $("galleryUrls").value = linksOnly.join("\n");
  $("galleryFiles").value = "";

  $("save").dataset.editId = p.id || "";
}

function clearForm() {
  ["title", "date", "author", "source", "excerpt", "thumbUrl", "heroUrl", "content", "galleryUrls"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });
  ["thumbFile", "heroFile", "galleryFiles", "inlineImgFile"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });
  ["inlineImgUrl", "inlineImgCaption"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });

  if ($("category")) $("category").value = "Hoạt động";
  $("save").dataset.editId = "";
}

// ===== SERVER LIST (JSONP) =====
async function loadAll() {
  const d = await jsonp(`${API_URL}?action=listNews`);
  if (!d || d.ok !== true) throw new Error(d?.error || "LIST_NEWS_FAILED");
  return Array.isArray(d.items) ? d.items : [];
}

let ITEMS_MEM = [];

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

  // sort: mới nhất theo date, fallback updatedAt
  const items = [...ITEMS_MEM].sort((a, b) =>
    String(b.date || b.updatedAt || "").localeCompare(String(a.date || a.updatedAt || ""))
  );

  if (!items.length) {
    listEl.innerHTML = `<div style="color:#666">Chưa có bài nào.</div>`;
    return;
  }

  listEl.innerHTML = items
    .map((p) => {
      const thumb = p.thumb || p.hero || "";
      const imgHtml = thumb
        ? `<img src="${escMini(thumb)}" alt="thumb">`
        : `<img src="" alt="thumb" style="opacity:.12">`;

      return `
        <div class="item">
          ${imgHtml}
          <div style="flex:1">
            <h3>${escMini(p.title)}</h3>
            <div class="meta">
              📅 ${escMini(toVNDate(p.date))} • 🏷 ${escMini(p.category || "")}
              ${p.author ? `• ✍ ${escMini(p.author)}` : ""}
              • 👁 ${escMini(p.views || 0)}
            </div>

            ${p.excerpt ? `<div class="meta" style="margin-top:6px">${escMini(String(p.excerpt)).slice(0,160)}${String(p.excerpt).length>160?"…":""}</div>` : ""}

            <div class="actions">
              <a class="btn" href="tintuc-post.html?id=${encodeURIComponent(p.id)}">Xem</a>
              <button class="btn" data-edit="${escMini(p.id)}" type="button">Sửa</button>
              <button class="btn danger" data-del="${escMini(p.id)}" type="button">Xóa</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  // edit
  listEl.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      const p = ITEMS_MEM.find((x) => String(x.id) === String(id));
      if (!p) return;
      fillForm(p);
      setStatus("✍️ Đang sửa bài: " + (p.title || ""));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // delete
  listEl.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!id) return;
      if (!confirm("Xóa bài viết này?")) return;

      setStatus("⏳ Đang xóa (server)...");
      await postNoCors({ action: "deleteNews", adminPassword: ADMIN_PASSWORD, id });

      // chờ server ghi sheet
      await sleep(900);

      await renderList();
      setStatus("✅ Đã xóa bài.");
    });
  });
}

// ===== SAVE =====
$("save")?.addEventListener("click", async () => {
  try {
    const data = await getFormData();
    if (!data.title || !data.date || !data.content) {
      setStatus("⚠️ Cần nhập: Tiêu đề + Ngày đăng + Nội dung chi tiết.");
      return;
    }

    const editId = $("save").dataset.editId || "";
    const post = { id: editId, ...data };

    setStatus("⏳ Đang lưu bài (server)...");
    await postNoCors({ action: "upsertNews", adminPassword: ADMIN_PASSWORD, post });

    // chờ server ghi sheet
    await sleep(1000);

    $("save").dataset.editId = "";
    clearForm();

    await renderList();
    setStatus(editId ? "✅ Đã cập nhật bài" : "✅ Đã lưu bài");
  } catch (e) {
    console.error(e);
    setStatus("❌ Lỗi khi lưu bài.");
  }
});

$("cancelEdit")?.addEventListener("click", () => {
  clearForm();
  setStatus("Đã hủy sửa.");
});

// init
document.addEventListener("DOMContentLoaded", renderList);
