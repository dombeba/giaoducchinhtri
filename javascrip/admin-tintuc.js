/**************** ADMIN - TIN TỨC (FINAL - GITHUB PAGES SAFE) ****************/
const ADMIN_PASSWORD = "123321";

// 🔴 DÁN LINK /exec của Apps Script Tin tức
const API_URL = "https://script.google.com/macros/s/AKfycbzctYLpyy5xceGNdO_WYDCPgIAYzIAov2OV3GslYiSULNuoWPYtkRxwq90ZNBtqSeC29A/exec";

const $ = (id) => document.getElementById(id);

const titleEl   = $("title");
const dateEl    = $("date");
const cateEl    = $("category");
const authorEl  = $("author");
const sourceEl  = $("source");
const excerptEl = $("excerpt");
const contentEl = $("content");
const statusEl  = $("status");

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ===== JSONP helper (GET) =====
function jsonp(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const cb = "__cb_" + Math.random().toString(16).slice(2);
    const s = document.createElement("script");
    const timer = setTimeout(() => { cleanup(); reject(new Error("JSONP_TIMEOUT")); }, timeoutMs);

    function cleanup() {
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

async function listNews() {
  const res = await jsonp(`${API_URL}?action=listNews`);
  if (!res || res.ok !== true) throw new Error(res?.error || "LIST_FAILED");
  return Array.isArray(res.items) ? res.items : [];
}

// ===== POST no-cors (GitHub Pages safe) =====
async function postNoCors(payload) {
  // no-cors: gửi được nhưng không đọc response
  await fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => {});
}

// ===== SAVE =====
async function savePost() {
  const title = (titleEl?.value || "").trim();
  if (!title) { alert("⚠️ Bắt buộc nhập TIÊU ĐỀ"); titleEl?.focus(); return; }

  const date = (dateEl?.value || "").trim();
  if (!date) { alert("⚠️ Bắt buộc chọn NGÀY"); dateEl?.focus(); return; }

  const content = (contentEl?.value || "").trim();
  if (!content) { alert("⚠️ Bắt buộc nhập NỘI DUNG"); contentEl?.focus(); return; }

  // ✅ tạo id client để xác nhận (vì POST no-cors không đọc response)
  const id = uuidv4();

  const post = {
    id,
    title,
    date,
    category: cateEl?.value || "",
    author: (authorEl?.value || "").trim(),
    source: (sourceEl?.value || "").trim(),
    excerpt: (excerptEl?.value || "").trim(),
    content,
    thumb: "",
    hero: "",
    gallery: []
  };

  const payload = { action: "upsertNews", adminPassword: ADMIN_PASSWORD, post };
  console.log("SEND PAYLOAD:", payload);

  setStatus(`⏳ Đang lưu: "${title}"...`);
  await postNoCors(payload);

  // ✅ Poll listNews để chắc chắn server đã ghi đúng title
  for (let i = 0; i < 10; i++) {
    await sleep(800);
    const items = await listNews();
    const found = items.find(x => String(x.id) === String(id));
    if (found && String(found.title || "").trim() === title) {
      setStatus("✅ Đã lưu bài (server đã cập nhật).");
      console.log("CONFIRMED:", found);
      // nếu muốn reset form:
      // document.querySelector("form")?.reset();
      return;
    }
  }

  setStatus(`⚠️ Đã gửi nhưng chưa thấy server cập nhật title="${title}".`);
  alert("⚠️ Đã gửi nhưng chưa thấy server cập nhật.\nHãy mở sheet NEWS_LOG để xem server nhận được gì.");
}

// ===== LOAD LIST (chỉ log; muốn render thì làm thêm) =====
async function loadList() {
  try {
    const items = await listNews();
    console.log("LIST:", items);
  } catch (e) {
    console.error(e);
    setStatus("❌ Không tải được danh sách bài.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("admin-tintuc.js loaded");
  loadList();
});

// ✅ Nếu nút Lưu trong HTML dùng onclick="savePost()" thì giữ nguyên.
// ✅ Nếu nút có id="save" và chưa gắn, có thể bật dòng này:
$("save")?.addEventListener("click", (e) => {
  // nếu nó là <button type="submit"> trong form thì chặn submit
  e.preventDefault?.();
  savePost();
});
