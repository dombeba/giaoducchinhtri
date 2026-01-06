const KEY = "TINTUC_POSTS_V1";

const esc = (s) => String(s || "")
  .replaceAll("&","&amp;")
  .replaceAll("<","&lt;")
  .replaceAll(">","&gt;")
  .replaceAll('"',"&quot;")
  .replaceAll("'","&#39;");

function toVNDate(dateStr){
  const [y,m,d] = (dateStr || "").split("-");
  if(!y || !m || !d) return dateStr || "";
  return `${d}/${m}/${y}`;
}

function loadNews(){
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function saveNews(items){
  localStorage.setItem(KEY, JSON.stringify(items));
}

// ✅ In đậm bằng **...**
function applyBold(escapedText){
  return String(escapedText).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const detail = document.getElementById("detail");
const head = document.getElementById("detailHead");

const items = loadNews();
const post = items.find(x => x.id === id);

// Token ảnh chèn giữa bài: [[IMG:src|caption]]
function renderRichContent(raw){
  const text = String(raw || "");
  const re = /\[\[IMG:([^\|\]]+)\|([^\]]*)\]\]/g;

  let html = "";
  let lastIndex = 0;

  const pushText = (chunk) => {
    const t = String(chunk || "");
    if(!t.trim()) return;

    // esc -> in đậm -> xuống dòng
    let safe = esc(t);
    safe = applyBold(safe);
    safe = safe.replaceAll("\n","<br>");

    html += `<div class="rich-text">${safe}</div>`;
  };

  let m;
  while((m = re.exec(text)) !== null){
    const before = text.slice(lastIndex, m.index);
    pushText(before);

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

  const after = text.slice(lastIndex);
  pushText(after);

  return html || `<div class="empty">Nội dung trống.</div>`;
}

if(!post){
  if(head) head.textContent = "❌ Không tìm thấy bài viết";
  if(detail) detail.innerHTML = `<div class="empty">Bài viết không tồn tại hoặc đã bị xóa.</div>`;
} else {
  post.views = Number(post.views || 0) + 1;
  saveNews(items);

  if(head) head.textContent = `📰 ${post.title || "Bài viết"}`;

  const hero = post.hero || post.thumb || "";
  const gallery = Array.isArray(post.gallery) ? post.gallery : [];

  const metaParts = [];
  metaParts.push(`📅 ${esc(toVNDate(post.date))}`);
  if(post.category) metaParts.push(`🏷 ${esc(post.category)}`);
  if(post.author) metaParts.push(`✍ ${esc(post.author)}`);
  metaParts.push(`👁 ${esc(post.views || 0)}`);

  const sourceHtml = post.source
    ? ` • <a class="detail-link" href="${esc(post.source)}" target="_blank" rel="noopener">Mở nguồn</a>`
    : "";

  detail.innerHTML = `
    <h1 class="detail-title">${esc(post.title)}</h1>

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
        ${gallery.map(src => `<img src="${esc(src)}" alt="Ảnh">`).join("")}
      </div>
    ` : ""}
  `;
}
