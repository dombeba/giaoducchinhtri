/*********** CONFIG ***********/
const API_URL = "https://script.google.com/macros/s/AKfycbwV1GaFzY3NJHvcAFyo8N50JvInBphSRwsDHb_oVlMq4uIUzO8xs0hPOSnkhP-V-g-Pgg/exec";

const $ = (id)=>document.getElementById(id);

const yearSel = $("yearSel");
const monthSel = $("monthSel");
const daySel = $("daySel");
const listEl = $("list");
const emptyEl = $("empty");
const statEl = $("stat");

const lightbox = $("lightbox");
const lbImg = $("lbImg");
const lbCap = $("lbCap");
const lbClose = $("lbClose");

function pad2(n){ return String(n).padStart(2,"0"); }
function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function makeCaption(y,m,d){
  return `Lời Bác Hồ dạy ngày này năm xưa, ngày ${d} tháng ${m} năm ${y}`;
}

function buildYears(){
  const now = new Date();
  const y = now.getFullYear();
  const years = [y-2, y-1, y, y+1, y+2];
  yearSel.innerHTML = years.map(v=>`<option value="${v}">${v}</option>`).join("");
  yearSel.value = y;
}
function buildMonths(){
  monthSel.innerHTML = Array.from({length:12}, (_,i)=>{
    const m=i+1;
    return `<option value="${m}">Tháng ${m}</option>`;
  }).join("");
  monthSel.value = String(new Date().getMonth()+1);
}
function buildDays(year, month){
  const days = new Date(Number(year), Number(month), 0).getDate();
  let html = `<option value="">Tất cả ngày trong tháng</option>`;
  for(let d=1; d<=days; d++){
    html += `<option value="${d}">Ngày ${d}</option>`;
  }
  daySel.innerHTML = html;
  daySel.value = "";
}

async function fetchList(year, month){
  const url = `${API_URL}?action=list&year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;
  const res = await fetch(url).then(r=>r.json());
  if(!res || !res.ok) throw new Error(res?.error || "fetch_failed");
  return res.items || [];
}

function openLightbox(src, cap){
  lbImg.src = src;
  lbCap.innerHTML = cap ? cap : "";
  lightbox.classList.add("show");
  lightbox.setAttribute("aria-hidden","false");
}
function closeLightbox(){
  lightbox.classList.remove("show");
  lightbox.setAttribute("aria-hidden","true");
  lbImg.src = "";
  lbCap.innerHTML = "";
}

function render(items){
  const year = Number(yearSel.value);
  const month = Number(monthSel.value);
  const dayFilter = daySel.value ? Number(daySel.value) : null;

  let filtered = items
    .filter(it => Number(it.year)===year && Number(it.month)===month)
    .filter(it => !dayFilter || Number(it.day)===dayFilter);

  filtered.sort((a,b)=>Number(a.day)-Number(b.day));

  statEl.textContent = `${filtered.length} ảnh`;

  if(!filtered.length){
    listEl.innerHTML = "";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  listEl.innerHTML = `
    <div class="grid">
      ${filtered.map(it=>{
        const d = Number(it.day);
        const img = it.imgUrl || "css/anh/noimage.png";
        const cap = makeCaption(year, month, d);
        return `
          <div class="gcard" data-full="${img}" data-cap="${escapeHtml(cap)}">
            <img src="${img}" alt="${escapeHtml(cap)}">
            <div class="glabel">Ngày ${d}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  listEl.querySelectorAll(".gcard").forEach(card=>{
    card.addEventListener("click", ()=>{
      openLightbox(card.dataset.full, card.dataset.cap);
    });
  });
}

async function reload(){
  try{
    listEl.innerHTML = "";
    emptyEl.style.display = "none";
    statEl.textContent = "Đang tải…";

    const items = await fetchList(yearSel.value, monthSel.value);
    render(items);
  }catch(err){
    statEl.textContent = "Lỗi";
    emptyEl.style.display = "block";
    emptyEl.textContent = "Không tải được dữ liệu. Kiểm tra API_URL hoặc quyền Web App.";
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  buildYears();
  buildMonths();
  buildDays(yearSel.value, monthSel.value);

  yearSel.addEventListener("change", ()=>{
    buildDays(yearSel.value, monthSel.value);
    reload();
  });
  monthSel.addEventListener("change", ()=>{
    buildDays(yearSel.value, monthSel.value);
    reload();
  });
  daySel.addEventListener("change", reload);
  $("btnReload").addEventListener("click", reload);

  lbClose.addEventListener("click", closeLightbox);
  lightbox.querySelector(".lightbox-backdrop").addEventListener("click", closeLightbox);
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") closeLightbox();
  });

  reload();
});
