const KEY = "LOIBACDAY_POSTS_V1";

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

function loadPosts(){
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function savePosts(posts){
  localStorage.setItem(KEY, JSON.stringify(posts));
}

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const detail = document.getElementById("detail");
const head = document.getElementById("detailHead");

const posts = loadPosts();
const post = posts.find(p => p.id === id);

if(!post){
  head.textContent = "❌ Không tìm thấy bài viết";
  detail.innerHTML = `<div class="detail-empty">Bài viết không tồn tại hoặc đã bị xóa.</div>`;
} else {
  // tăng lượt xem
  post.views = Number(post.views || 0) + 1;
  savePosts(posts);

  head.textContent = `📰 ${post.title || "Bài viết"}`;

  const heroImg = post.detailImage || post.image || "";
  const gallery = Array.isArray(post.detailImages) ? post.detailImages : [];

  detail.innerHTML = `
    <h1 class="detail-title">${esc(post.title)}</h1>

    <div class="detail-meta">
      <span>📅 ${esc(toVNDate(post.date))}</span>
      <span>•</span>
      <span>👁 ${esc(post.views)}</span>
      <span>•</span>
      <span>Tháng ${esc(post.month)}</span>
      ${post.link ? `<span>•</span><a class="detail-link" href="${esc(post.link)}" target="_blank" rel="noopener">Mở nguồn</a>` : ""}
    </div>

    ${heroImg ? `<div class="detail-hero"><img src="${heroImg}" alt="Ảnh bài viết"></div>` : ""}

    ${post.quote ? `<div class="detail-quote">${esc(post.quote)}</div>` : ""}

    ${post.detailContent
      ? `<div class="detail-content">${esc(post.detailContent).replaceAll("\n","<br>")}</div>`
      : `<div class="detail-content muted">Chưa có nội dung chi tiết.</div>`
    }

    ${gallery.length ? `
      <div class="detail-gallery">
        ${gallery.map(src => `<img src="${src}" alt="Ảnh">`).join("")}
      </div>
    ` : ""}
  `;
}
