const API_URL = "https://script.google.com/macros/s/AKfycbyDjCplmNZe4YJkrbdcKDunORDSc0PPR4U-SgfD-yfAktDb4UCVCV8dx0EwJgftoyY3sA/exec"; // <-- DÁN /exec Tin tức

const esc = (s) => String(s || "")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#39;");

function toVNDate(dateStr){
  const [y,m,d] = (dateStr || "").split("-");
  if(!y || !m || !d) return dateStr || "";
  return `${d}/${m}/${y}`;
}

// ✅ In đậm bằng **...**
function applyBold(escapedText){
  return String(escapedText).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

async function fetchJson(url){
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error("INVALID_JSON"); }
}

// Token ảnh chèn giữa bài: [[IMG:src|caption]]
function renderRichContent(raw){
  const text = String(raw || "");
  const re = /\[\[IMG:([^\|\]]+)\|([^\]]*)\]\]/g;

  let html = "";
  let lastIndex = 0;

  const pushText = (chunk) => {
    const t = String(chunk || "");
    if(!t.trim()) return;

    let safe = esc(t);
    safe = applyBold(safe);
    safe = safe.replaceAll("\n","<br>");
    html += `<div class="rich-text">${safe}</div>`;
  };

  let m;
  while((m = re.exec(text)) !== null){
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

// no-cors bump view
function postNoCors(payload){
  fetch(API_URL,{
    method:"POST",
    mode:"no-cors",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    keepalive:true
  }).catch(()=>{});
}

(async function main(){
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const detail = document.getElementById("detail");
  const head = document.getElementById("detailHead");

  if(!id){
    if(head) head.textContent = "❌ Thiếu id bài viết";
    if(detail) detail.innerHTML = `<div class="empty">Không có id.</div>`;
    return;
  }

  try{
    // lấy bài
    const d = await fetchJson(`${API_URL}?action=getNews&id=${encodeURIComponent(id)}&t=${Date.now()}`);
    if(!d || d.ok !== true || !d.post){
      if(head) head.textContent = "❌ Không tìm thấy bài viết";
      if(detail) detail.innerHTML = `<div class="empty">Bài viết không tồn tại hoặc đã bị xóa.</div>`;
      return;
    }

    const post = d.post;

    if(head) head.textContent = `📰 ${post.title || "Bài viết"}`;

    // bump views (server)
    postNoCors({ action:"bumpNewsView", id });

    const hero = post.hero || post.thumb || "";
    const gallery = Array.isArray(post.gallery) ? post.gallery : [];

    const metaParts = [];
    metaParts.push(`📅 ${esc(toVNDate(post.date))}`);
    if(post.category) metaParts.push(`🏷 ${esc(post.category)}`);
    if(post.author) metaParts.push(`✍ ${esc(post.author)}`);
    metaParts.push(`👁 ${esc(post.views || 0)}+`); // + vì vừa bump

    const sourceHtml = post.source
      ? ` • <a class="detail-link" href="${esc(post.source)}" target="_blank" rel="noopener">Mở nguồn</a>`
      : "";

    if(detail){
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

  }catch(e){
    console.error(e);
    if(head) head.textContent = "❌ Lỗi tải bài viết";
    if(detail) detail.innerHTML = `<div class="empty" style="color:#b00020">Không tải được dữ liệu từ server.</div>`;
  }
})();
