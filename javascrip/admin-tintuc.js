/**************** ADMIN - TIN TỨC (FIX TITLE 100%) ****************/

const ADMIN_PASSWORD = "123321";
const API_URL = "https://script.google.com/macros/s/AKfycbwHtgydq5jmIoHPaelCRkq1inb1DrnBxxSITOFiowawHzfvoFW8URUoAvAV3Ea2-n6SiA/exec";

// ===== DOM =====
const $ = id => document.getElementById(id);

const titleEl   = $("title");
const dateEl    = $("date");
const cateEl    = $("category");
const authorEl  = $("author");
const sourceEl  = $("source");
const excerptEl = $("excerpt");
const contentEl = $("content");
const statusEl  = $("status");

// ===== SAVE =====
async function savePost() {
  const title = titleEl.value.trim();
  if (!title) {
    alert("⚠️ Bắt buộc nhập TIÊU ĐỀ");
    return;
  }

  const payload = {
    action: "upsertNews",
    adminPassword: ADMIN_PASSWORD,
    post: {
      title: title,                       // ✅ ĐÚNG KEY
      date: dateEl.value,
      category: cateEl.value,
      author: authorEl.value,
      source: sourceEl.value,
      excerpt: excerptEl.value,
      content: contentEl.value,
      gallery: []                          // tạm rỗng
    }
  };

  console.log("SEND PAYLOAD:", payload);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (json.ok) {
      statusEl.innerHTML = "✅ Đã lưu bài";
      loadList();
    } else {
      alert("❌ Lỗi server: " + json.error);
    }
  } catch (e) {
    alert("❌ Không kết nối được server");
    console.error(e);
  }
}

// ===== LOAD LIST =====
function loadList() {
  const cb = "cb_" + Date.now();
  window[cb] = res => {
    if (!res.ok) return;
    console.log("LIST:", res.items);
  };
  const s = document.createElement("script");
  s.src = API_URL + "?action=listNews&callback=" + cb;
  document.body.appendChild(s);
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  console.log("admin-tintuc.js loaded");
  loadList();
});
