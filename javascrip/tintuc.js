/**************** TIN TỨC - LIST (SERVER JSONP, ALL DEVICES) ****************/
const API_URL = "https://script.google.com/macros/s/AKfycbzctYLpyy5xceGNdO_WYDCPgIAYzIAov2OV3GslYiSULNuoWPYtkRxwq90ZNBtqSeC29A/exec"; // 🔴 dán /exec
const CACHE_KEY = "NEWS_CACHE_V2";

const newsEl = document.getElementById("news");
const countEl = document.getElementById("count");
const qEl = document.getElementById("q");
const catEl = document.getElementById("category");
const sortEl = document.getElementById("sort");
const suggestedEl = document.getElementById("suggested");

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
function normalize(s){ return String(s || "").toLowerCase().trim(); }

// In đậm bằng **...**
function applyBold(escapedText){
  return String(escapedText).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// JSONP helper
function jsonp(url, timeoutMs = 12000){
  return new Promise((resolve, reject) => {
    const cb = "__cb_" + Math.random().toString(16).slice(2);
    const s = document.createElement("script");
    const timer = setTimeout(() => { cleanup(); reject(new Error("JSONP_TIMEOUT")); }, timeoutMs);

    function cleanup(){
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

async function fetchFromServer(){
  const res = await jsonp(`${API_URL}?action=listNews`);
  if(!res || res.ok !== true) throw new Error(res?.error || "LIST_FAILED");
  return Array.isArray(res.items) ? res.items : [];
}

function readCache(){
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"); }
  catch { return []; }
}
function writeCache(items){
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(items || [])); } catch {}
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
    .slice(0, 7);

  if(!items.length){
    suggestedEl.innerHTML = `<div class="suggest-empty">Chưa có bài nào.</div>`;
    return;
  }

  suggestedEl.innerHTML = items.map(p => `
    <a class="suggest-item" href="tintuc-post.html?id=${encodeURIComponent(p.id)}" title="${esc(p.title)}">
      <div class="suggest-title">${esc(p.title || "(Chưa có tiêu đề)")}</div>
      <div class="suggest-meta">📅 ${esc(toVNDate(p.date))}${p.category ? ` • 🏷 ${esc(p.category)}` : ""}</div>
    </a>
  `).join("");
}

function render(itemsAll){
  const items = applyFilters(itemsAll);

  renderSuggested(itemsAll);
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
          <a class="title" href="tintuc-post.html?id=${encodeURIComponent(p.id)}">${esc(p.title || "(Chưa có tiêu đề)")}</a>
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

let ALL = [];

async function reload(){
  // render cache trước cho nhanh
  const cached = readCache();
  if(cached.length){
    ALL = cached;
    render(ALL);
  }

  // lấy server
  const serverItems = await fetchFromServer();
  ALL = serverItems;
  writeCache(ALL);
  render(ALL);
}

["input","change"].forEach(evt=>{
  qEl?.addEventListener(evt, ()=>render(ALL));
  catEl?.addEventListener(evt, ()=>render(ALL));
  sortEl?.addEventListener(evt, ()=>render(ALL));
});

document.addEventListener("DOMContentLoaded", ()=>{
  reload().catch(err=>{
    console.error(err);
    const cached = readCache();
    ALL = cached;
    render(ALL);
  });
});
