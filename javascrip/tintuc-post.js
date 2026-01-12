// =============================
// TIN TỨC - DETAIL (SERVER-FIRST, REALTIME via JSONP)
// File: javascrip/tintuc-post.js
// =============================
const API_URL = "https://script.google.com/macros/s/AKfycbzj2lgfuel4EUutBxfd69rNO45tg7KDGzLwz1PjoLhZvUtzkwdKY6ShzwqVrfOyhWvNGQ/exec";

const esc = (s) =>
  String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

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
function applyBold(escapedText) {
  return String(escapedText).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// ====== JSONP ======
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

function postNoCors(payload) {
  fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

// Token ảnh giữa bài: [[IMG:src|caption]]
function renderRichContent(raw) {
  const text = String(raw || "");
  const re = /\[\[IMG:([^\|\]]+)\|([^\]]*)\]\]/g;
  let html = "";
  let lastIndex = 0;

  const pushText = (chunk) => {
    const t = String(chunk || "");
    if (!t.trim()) return;
    let safe = esc(t);
    safe = applyBold(safe);
    safe = safe.replaceAll("\n", "<br>");
    html += `<div class="rich-text">${safe}</div>`;
  };

  let m;
  while ((m = re.exec(text)) !== null) {
    pushText(text.slice(lastIndex, m.index));
    const src = (m[1] || "").trim();
    const cap = (m[2] || "").trim();
    html += `
      <figure class="inline-figure">
        <img src="${esc(src)}" alt="${esc(cap || "Ảnh")}">
        ${cap ? `<figcaption>${applyBold(esc(cap))}</figcaption>` : ``}
      </figure>
    `;
    lastIndex = re.lastIndex;
  }
  pushText(text.slice(lastIndex));
  return html || `<div class="empty">Nội dung trống.</div>`;
}

(async function main() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const detail = document.getElementById("detail");
  const head = document.getElementById("detailHead");

  if (!id) {
    if (head) head.textContent = "❌ Thiếu id bài viết";
    if (detail) detail.innerHTML = `<div class="empty">Không có id.</div>`;
    return;
  }

  try {
    const d = await jsonp(`${API_URL}?action=getNews&id=${encodeURIComponent(id)}`);
    if (!d || d.ok !== true || !d.post) {
      if (head) head.textContent = "❌ Không tìm thấy bài viết";
      if (detail) detail.innerHTML = `<div class="empty">Bài viết không tồn tại hoặc đã bị xóa.</div>`;
      return;
    }

    const post = d.post;
    const titleText = (post.title && String(post.title).trim()) ? String(post.title).trim() : "(Chưa có tiêu đề)";

    if (head) head.textContent = `📰 ${titleText}`;

    // bump view
    postNoCors({ action: "bumpNewsView", id });

    const hero = post.hero || post.thumb || "";
    const gallery = Array.isArray(post.gallery) ? post.gallery : [];

    const metaParts = [];
    metaParts.push(`📅 ${esc(toVNDate(post.date))}`);
    if (post.category) metaParts.push(`🏷 ${esc(post.category)}`);
    if (post.author) metaParts.push(`✍ ${esc(post.author)}`);
    metaParts.push(`👁 ${esc(post.views || 0)}+`);

    const sourceHtml = post.source
      ? ` • <a class="detail-link" href="${esc(post.source)}" target="_blank" rel="noopener">Mở nguồn</a>`
      : "";

    if (detail) {
      detail.innerHTML = `
        <h1 class="detail-title">${esc(titleText)}</h1>

        <div class="detail-meta">
          <span>${metaParts.join(" • ")}</span>
          ${sourceHtml}
        </div>

        ${hero ? `<div class="detail-hero"><img src="${esc(hero)}" alt="Ảnh bài viết"></div>` : ""}

        <div class="detail-content">
          ${renderRichContent(post.content)}
        </div>

        ${gallery.length ? `
          <div class="detail-gallery">
            ${gallery.map((src) => `<img src="${esc(src)}" alt="Ảnh">`).join("")}
          </div>
        ` : ""}
      `;
    }
  } catch (e) {
    console.error(e);
    if (head) head.textContent = "❌ Lỗi tải bài viết";
    if (detail) detail.innerHTML = `<div class="empty" style="color:#b00020">Không tải được dữ liệu từ server.</div>`;
  }
})();
