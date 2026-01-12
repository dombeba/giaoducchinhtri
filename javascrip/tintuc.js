const API_URL = "https://script.google.com/macros/s/AKfycbzBLnOi4PGSkGnUAw8t8dRo2W3y1JmKdNBFTnQSHXw9yHk_-Wg6Vu-Qw-3K0LyuASZQGw/exec"; // <-- DÁN /exec Tin tức

const newsEl = document.getElementById("news");
const countEl = document.getElementById("count");
const qEl = document.getElementById("q");
const catEl = document.getElementById("category");
const sortEl = document.getElementById("sort");
const suggestedEl = document.getElementById("suggested");

const esc = (s) => String(s || "")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#39;");

function toVNDate(dateStr){
  const [y,m,d] = (dateStr || "").split("-");
  if(!y || !m || !d) return dateStr || "";
  return `${d}/${m}/${y}`;
}
function normalize(s){ return String(s || "").toLowerCase().trim(); }

function applyBold(escapedText){
  return String(escapedText).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

async function fetchJson(url){
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error("INVALID_JSON"); }
}

async function loadAll(){
  const d = await fetchJson(`${API_URL}?action=listNews&t=${Date.now()}`);
  if(!d || d.ok !== true) throw new Error(d?.error || "LIST_NEWS_FAILED");
  return Array.isArray(d.items) ? d.items : [];
}

function applyFilters(items){
  const q = normalize(qEl?.value);
  const cat = (catEl?.value || "").trim();
  const sort = (sortEl?.value || "new").trim();

  let out = [...items];

  if(cat) out = out.filter(x => (x.category || "") === cat);

  if(q){
    out = out.filter(x => {
      const t = normalize(x.title);
      const e = normalize(x.excerpt);
      const c = normalize(x.content);
      return t.includes(q) || e.includes(q) || c.includes(q);
    });
  }

  if(sort === "old") out.sort((a,b)=> (a.date || "").localeCompare(b.date || ""));
  else if(sort === "views") out.sort((a,b)=> Number(b.views||0) - Number(a.views||0));
  else out.sort((a,b)=> (b.date || "").localeCompare(a.date || ""));

  return out;
}

function renderSuggested(allItems){
  if(!suggestedEl) return;

  const items = [...allItems]
    .sort((a,b)=> (b.date || "").localeCompare(a.date || ""))
    .slice(0,7);

  if(!items.length){
    suggestedEl.innerHTML = `<div class="suggest-empty">Chưa có bài nào.</div>`;
    return;
  }

  suggestedEl.innerHTML = items.map(p => `
    <a class="suggest-item" href="tintuc-post.html?id=${encodeURIComponent(p.id)}" title="${esc(p.title)}">
      <div class="suggest-title">${esc(p.title)}</div>
      <div class="suggest-meta">📅 ${esc(toVNDate(p.date))}${p.category ? ` • 🏷 ${esc(p.category)}` : ""}</div>
    </a>
  `).join("");
}

let ALL_CACHE = [];

function render(){
  const items = applyFilters(ALL_CACHE);

  renderSuggested(ALL_CACHE);

  if(countEl) countEl.textContent = `${items.length} bài`;

  if(!newsEl) return;

  if(!items.length){
    newsEl.innerHTML = `<div class="empty">Chưa có bài nào.</div>`;
    return;
  }

  newsEl.innerHTML = items.map(p => {
    const thumb = p.thumb || p.hero || "";
    const thumbHtml = thumb
      ? `<img src="${esc(thumb)}" alt="Ảnh">`
      : `<img src="" alt="Ảnh" style="opacity:.12">`;

    const badge = p.category ? `<span class="badge">🏷 ${esc(p.category)}</span>` : "";
    const author = p.author ? `<span>✍ ${esc(p.author)}</span>` : "";
    const views = `<span>👁 ${esc(p.views || 0)}</span>`;

    const excerptHtml = p.excerpt ? applyBold(esc(p.excerpt)) : `Chưa có tóm tắt.`;

    return `
      <article class="item">
        <div class="thumb">${thumbHtml}</div>
        <div>
          <a class="title" href="tintuc-post.html?id=${encodeURIComponent(p.id)}">${esc(p.title)}</a>

          <div class="meta">
            <span>📅 ${esc(toVNDate(p.date))}</span>
            ${badge}
            ${author}
            ${views}
          </div>

          <p class="excerpt">${excerptHtml}</p>
        </div>
      </article>
    `;
  }).join("");
}

async function boot(){
  if(newsEl) newsEl.innerHTML = `<div class="empty">⏳ Đang tải tin từ server...</div>`;
  try{
    ALL_CACHE = await loadAll();
    render();
  }catch(e){
    console.error(e);
    if(newsEl) newsEl.innerHTML = `<div class="empty" style="color:#b00020">❌ Không tải được tin tức từ server.</div>`;
  }
}

["input","change"].forEach(evt=>{
  qEl?.addEventListener(evt, render);
  catEl?.addEventListener(evt, render);
  sortEl?.addEventListener(evt, render);
});

document.addEventListener("DOMContentLoaded", boot);
