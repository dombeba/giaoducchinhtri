const SESSION_KEY = "KTQN_SESSION_V1";
const RESULT_KEY  = "KTQN_RESULTS_V1";

const CAT_LABEL = {
  chiensi: "Chiến sĩ",
  qncn: "QNCN",
  syquan: "Sỹ quan",
  nhanthuc: "Nhận thức chính trị",
};

const $ = (id) => document.getElementById(id);

function loadSession(){
  try{ return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
function requireLogin(){
  const s = loadSession();
  if(!s?.username){
    window.location.href = `dangnhapktqn.html?return=${encodeURIComponent("ktqn-ketqua-cua-toi.html")}`;
    return null;
  }
  return s;
}
function loadResults(){
  try{
    const arr = JSON.parse(localStorage.getItem(RESULT_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function esc(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function fmt(iso){
  try{
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  } catch { return ""; }
}

function filterMine(all, username){
  return all.filter(r => (r.user?.username || "") === username);
}

function applyFilters(items){
  const q = ($("q").value || "").trim().toLowerCase();
  const cat = ($("cat").value || "").trim();

  let out = [...items];

  if(cat) out = out.filter(x => x.cat === cat);

  if(q){
    out = out.filter(x=>{
      const blob = `${x.quizTitle||""} ${x.week||""} ${x.cat||""}`.toLowerCase();
      return blob.includes(q);
    });
  }

  // mới nhất lên đầu
  out.sort((a,b)=> (b.submittedAt||"").localeCompare(a.submittedAt||""));
  return out;
}

function calcSummary(items){
  const total = items.length;
  if(!total) return { total:0, avg:0, best:null };

  // tính % điểm
  const percents = items.map(r => {
    const max = Number(r.maxScore || 0);
    const sc  = Number(r.score || 0);
    return max > 0 ? (sc / max) * 100 : 0;
  });

  const avg = percents.reduce((a,b)=>a+b,0) / total;

  // best theo %
  let bestIdx = 0;
  for(let i=1;i<items.length;i++){
    const a = percents[i];
    const b = percents[bestIdx];
    if(a > b) bestIdx = i;
  }
  return { total, avg, best: items[bestIdx] };
}

function exportCSV(items, sess){
  const header = [
    "submittedAt","cat","week","quizTitle",
    "attemptNo","maxAttempts","score","maxScore",
    "fullName","rank","position","unit","phone","username"
  ];

  const rows = items.map(r=>{
    const u = r.user || {};
    return [
      r.submittedAt || "",
      r.cat || "",
      r.week || "",
      r.quizTitle || "",
      r.attemptNo ?? "",
      r.maxAttempts ?? "",
      r.score ?? "",
      r.maxScore ?? "",
      u.fullName || "",
      u.rank || "",
      u.position || "",
      u.unit || "",
      u.phone || "",
      u.username || ""
    ];
  });

  const csv = [header, ...rows]
    .map(line => line.map(v => `"${String(v).replaceAll('"','""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `KTQN_KETQUA_${sess.username}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function render(items, sess){
  const tbody = $("tbody");
  const empty = $("empty");

  $("countPill").textContent = String(items.length);

  if(!items.length){
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = items.map(r=>{
    const catName = CAT_LABEL[r.cat] || r.cat;
    const attempt = (r.attemptNo && r.maxAttempts) ? `${r.attemptNo}/${r.maxAttempts}` : "—";
    return `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #eee;">${esc(fmt(r.submittedAt))}</td>
        <td style="padding:10px; border-bottom:1px solid #eee;">${esc(catName)}</td>
        <td style="padding:10px; border-bottom:1px solid #eee;">${esc(r.week)}</td>
        <td style="padding:10px; border-bottom:1px solid #eee;">${esc(r.quizTitle)}</td>
        <td style="padding:10px; border-bottom:1px solid #eee;"><b>${esc(attempt)}</b></td>
        <td style="padding:10px; border-bottom:1px solid #eee;"><b>${esc(r.score)} / ${esc(r.maxScore)}</b></td>
        <td style="padding:10px; border-bottom:1px solid #eee;">
          <a class="btn" style="padding:6px 10px; font-weight:900; text-decoration:none;" href="ktqn-ketqua.html?rid=${encodeURIComponent(r.id)}">Xem</a>
        </td>
      </tr>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", ()=>{
  const sess = requireLogin();
  if(!sess) return;

  $("userBox").textContent = `${sess.fullName || ""} • ${sess.unit || ""}`;

  const all = loadResults();
  const mine = filterMine(all, sess.username);

  // summary
  const sum = calcSummary(mine);
  $("sumPill").textContent = `${sum.total} bài`;

  const best = sum.best;
  const bestLine = best
    ? `Bài tốt nhất: <b>${esc(best.quizTitle)}</b> (Tuần ${esc(best.week)} • ${esc(best.score)}/${esc(best.maxScore)})`
    : "Chưa có bài nào.";

  $("summaryBox").innerHTML = `
    <div style="line-height:1.7;">
      Tài khoản: <b>${esc(sess.username)}</b><br/>
      Họ và tên: <b>${esc(sess.fullName||"")}</b> • ${esc(sess.rank||"")} • ${esc(sess.position||"")}<br/>
      Đơn vị: <b>${esc(sess.unit||"")}</b> • SĐT: <b>${esc(sess.phone||"")}</b><br/>
      Tổng số bài đã nộp: <b>${sum.total}</b><br/>
      Điểm trung bình (theo %): <b>${sum.total ? sum.avg.toFixed(1) : "0.0"}%</b><br/>
      ${bestLine}
    </div>
  `;

  function refresh(){
    const filtered = applyFilters(mine);
    render(filtered, sess);
  }

  $("q").addEventListener("input", refresh);
  $("cat").addEventListener("change", refresh);

  $("exportMine").addEventListener("click", ()=>{
    const filtered = applyFilters(mine);
    exportCSV(filtered, sess);
  });

  refresh();
});
