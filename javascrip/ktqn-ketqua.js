const SESSION_KEY = "KTQN_SESSION_V1";
const RESULT_KEY = "KTQN_RESULTS_V1";

const CAT_LABEL = {
  chiensi: "Chiến sĩ",
  qncn: "QNCN",
  syquan: "Sỹ quan",
  nhanthuc: "Nhận thức chính trị",
};

function loadSession(){
  try{ return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
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

document.addEventListener("DOMContentLoaded", ()=>{
  const sess = loadSession();
  const userBox = document.getElementById("userBox");
  if(userBox && sess?.fullName) userBox.textContent = `${sess.fullName} • ${sess.unit || ""}`;

  const params = new URLSearchParams(window.location.search);
  const rid = params.get("rid");
  const results = loadResults();
  const r = results.find(x => x.id === rid);

  const box = document.getElementById("box");
  const sub = document.getElementById("sub");
  const pill = document.getElementById("pill");
  const backList = document.getElementById("backList");

  if(!r){
    sub.textContent = "Không tìm thấy kết quả.";
    pill.textContent = "—";
    box.innerHTML = `<div style="color:#666">Kết quả không tồn tại hoặc đã bị xóa.</div>`;
    return;
  }

  const u = r.user || {};
  const catName = CAT_LABEL[r.cat] || r.cat;

  sub.textContent = `${catName} • Tuần ${r.week} • ${esc(r.quizTitle || "")}`;
  pill.textContent = `Điểm: ${r.score}/${r.maxScore}`;

  if(backList) backList.href = `ktqn-bai-thi.html?cat=${encodeURIComponent(r.cat)}`;

  const auto = r.autoSubmitted ? " (Tự động nộp do hết giờ)" : "";
  const attempt = (r.attemptNo && r.maxAttempts) ? `${r.attemptNo}/${r.maxAttempts}` : "—";

  box.innerHTML = `
    <div style="font-weight:900; font-size:16px;">KẾT QUẢ</div>
    <div style="margin-top:10px; line-height:1.7;">
      Họ và tên: <b>${esc(u.fullName||"")}</b><br/>
      Cấp bậc: <b>${esc(u.rank||"")}</b> • Chức vụ: <b>${esc(u.position||"")}</b><br/>
      Đơn vị: <b>${esc(u.unit||"")}</b><br/>
      SĐT: <b>${esc(u.phone||"")}</b><br/>
      Thi lần: <b>${esc(attempt)}</b>${auto}<br/>
      Thời gian nộp: <b>${esc(fmt(r.submittedAt))}</b>
    </div>
  `;
});
