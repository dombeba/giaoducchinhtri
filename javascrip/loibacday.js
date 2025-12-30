const KEY = "LOIBACDAY_POSTS_V1";

const postsWrap = document.getElementById("posts");
const panelHead = document.getElementById("panelHead");
const monthHint = document.getElementById("monthHint");
const statusEl = document.getElementById("status");

const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg || ""; };

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

// ===== Đồng hồ =====
const todayTextEl = document.getElementById("todayText");
const pad = (n) => String(n).padStart(2,"0");
const formatVN = (d) => {
  const days = ["Chủ nhật","Thứ hai","Thứ ba","Thứ tư","Thứ năm","Thứ sáu","Thứ bảy"];
  return `${days[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const tick = () => { if(todayTextEl) todayTextEl.textContent = formatVN(new Date()); };
tick(); setInterval(tick, 1000*30);

// ===== Dropdown =====
const dd = document.getElementById("monthDropdown");
const btn = document.getElementById("monthBtn");
if(dd && btn){
  btn.addEventListener("click",(e)=>{ e.stopPropagation(); dd.classList.toggle("open"); });
  document.addEventListener("click",()=> dd.classList.remove("open"));
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") dd.classList.remove("open"); });
}

// ===== Render danh sách (click -> trang chi tiết) =====
function renderPosts(filterMonth){
  const all = loadPosts().sort((a,b)=> (b.date || "").localeCompare(a.date || ""));
  const posts = (filterMonth >= 1 && filterMonth <= 12)
    ? all.filter(p => Number(p.month) === Number(filterMonth))
    : all;

  if(panelHead){
    panelHead.textContent = (filterMonth >= 1 && filterMonth <= 12)
      ? `📁 Lời Bác dạy ngày này năm xưa (Tháng ${filterMonth})`
      : `📁 Lời Bác dạy ngày này năm xưa`;
  }

  if(monthHint){
    monthHint.textContent = (filterMonth >= 1 && filterMonth <= 12)
      ? `Đang xem: Tháng ${filterMonth} • ${posts.length} bài`
      : `Đang xem: Tất cả • ${posts.length} bài`;
  }

  if(!postsWrap) return;

  if(!posts.length){
    postsWrap.innerHTML = `<div class="empty">Chưa có bài cho mục này.</div>`;
    setStatus("Chưa có bài để hiển thị.");
    return;
  }

  postsWrap.innerHTML = posts.map(p => {
    const imgHtml = p.image ? `<img src="${p.image}" alt="Ảnh minh hoạ">` : "";
    return `
      <article class="post">
        <div class="thumb">${imgHtml}</div>

        <div class="post-body">
          <!-- CLICK vào đây sẽ mở trang bài viết chính -->
          <a class="post-title" href="loibacday-post.html?id=${esc(p.id)}">
            ${esc(p.title)}
          </a>

          <div class="meta">
            <span>🕒 ${esc(toVNDate(p.date))}</span>
            <span>👁 ${esc(p.views || 0)}</span>
          </div>

          ${p.quote ? `<div class="quote">${esc(p.quote)}</div>` : ""}
          ${p.content ? `<p class="excerpt">${esc(p.content)}</p>` : ""}
        </div>
      </article>
    `;
  }).join("");

  setStatus(`Đã tải ${posts.length} bài.`);
}

// lọc theo ?m=
const params = new URLSearchParams(window.location.search);
const m = Number(params.get("m") || "");
renderPosts(m);

// demo chọn ngày
const pickDate = document.getElementById("pickDate");
const applyDate = document.getElementById("applyDate");
if(applyDate && pickDate){
  applyDate.addEventListener("click", () => {
    const v = pickDate.value;
    if(!v) return alert("Chọn ngày trước đã, chủ tướng!");
    setStatus(`Đã chọn ngày: ${v} (demo).`);
  });
}
