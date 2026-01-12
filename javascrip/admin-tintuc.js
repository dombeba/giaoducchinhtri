// =============================
// ADMIN - TIN TỨC (SERVER-FIRST) - FIX TITLE + CACHE DEBUG
// =============================

const ADMIN_PASSWORD = "123321";

// 🔴 DÁN LINK /exec TIN TỨC (web app)
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

/* ===== JSONP ===== */
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

/* ===== POST no-cors ===== */
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

/* ====== CHẶN ẢNH BASE64 QUÁ NẶNG (tránh hỏng request) ====== */
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

/* ===== DATA ===== */
let ITEMS_MEM = [];

async function loadAll() {
  const d = await jsonp(`${API_URL}?action=listNews`);
  if (!d || d.ok !== true) throw new Error(d?.error || "LIST_NEWS_FAILED");
  return Array.isArray(d.items) ? d.items : [];
}

function escMini(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  if (!ITEMS_MEM.length) {
    listEl.innerHTML = `<div style="color:#666">Chưa có bài nào.</div>`;
    return;
  }

  const items = [...ITEMS_MEM].sort((a, b) =>
    String(b.date || b.updatedAt || "").localeCompare(String(a.date || a.updatedAt || ""))
  );

  listEl.innerHTML = items.map(p => {
    const titleText = (p.title && String(p.title).trim()) ? String(p.title).trim() : "(Chưa có tiêu đề)";
    return `
      <div class="item">
        <div style="flex:1">
          <h3>${escMini(titleText)}</h3>
          <div class="meta">📅 ${escMini(p.date || "")} • 🏷 ${escMini(p.category || "")}</div>
        </div>
      </div>
    `;
  }).join("");
}

/* ===== SAVE ===== */
mustEl("save").addEventListener("click", async () => {
  try {
    // ✅ LẤY TITLE/DATE/CONTENT NGAY TỪ ĐẦU (để không bị ảnh làm rỗng)
    const title = getVal("title");
    const date = getVal("date");
    const category = String(($("category")?.value || "Hoạt động")).trim();
    const author = getVal("author");
    const source = getVal("source");
    const excerpt = String(($("excerpt")?.value || "")).trim();
    const content = String(mustEl("content").value || "").trim();

    if (!title) { alert("❌ Chưa có TIÊU ĐỀ"); mustEl("title").focus(); return; }
    if (!date) { alert("❌ Chưa có NGÀY ĐĂNG"); mustEl("date").focus(); return; }
    if (!content) { alert("❌ Chưa có NỘI DUNG"); mustEl("content").focus(); return; }

    setStatus(`⏳ Đang lưu bài: "${title}" ...`);
    console.log("DEBUG SEND title =", title);

    // ✅ XỬ LÝ ẢNH SAU CÙNG
    const thumb = await pickImage("thumbUrl", "thumbFile", "Ảnh đại diện");
    const hero  = await pickImage("heroUrl", "heroFile", "Ảnh đầu bài");

    const editId = String(mustEl("save").dataset.editId || "").trim();
    const post = {
      id: editId,
      title, date, category, author, source, excerpt,
      thumb, hero,
      content,
      gallery: []
    };

    await postNoCors({ action: "upsertNews", adminPassword: ADMIN_PASSWORD, post });

    // ✅ ĐỢI 1 CHÚT RỒI TẢI LẠI LIST ĐỂ KIỂM CHỨNG
    await sleep(1200);
    await renderList();

    // Kiểm tra xem title đã lên server chưa
    const found = ITEMS_MEM.find(x => String(x.title || "").trim() === title.trim());
    if (!found) {
      setStatus(`⚠️ Đã gửi nhưng server chưa thấy title="${title}".\nHãy Ctrl+F5 hoặc đổi ?v=...`);
      alert("⚠️ Đã gửi nhưng server chưa thấy tiêu đề.\nKhả năng cao bạn đang bị cache JS cũ.\nHãy Ctrl+F5 hoặc đổi ?v=... trong admin-tintuc.html");
      return;
    }

    setStatus("✅ Đã lưu bài (server đã có tiêu đề).");
  } catch (e) {
    console.error(e);
    alert("❌ Lỗi khi lưu: " + String(e?.message || e));
    setStatus("❌ Lỗi khi lưu bài.");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Nhắc cache
  console.log("admin-tintuc.js loaded @", new Date().toISOString());
  renderList();
});
