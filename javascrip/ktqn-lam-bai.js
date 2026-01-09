/**************************************************
 * KTQN - LÀM BÀI (SERVER-FIRST, REALTIME)
 * - Quiz: lấy từ Apps Script ?action=listQuizzes (realtime)
 * - Attempts: đếm từ ?action=listResults (xóa trên admin => thi lại)
 * - Submit: POST submitResult (no-cors)
 **************************************************/

/*************** CONFIG ***************/
const SESSION_KEY = "KTQN_SESSION_V1";
const API_URL =
  "https://script.google.com/macros/s/AKfycbxY7818jgoFttC7rl4HdhFy4RM84dPTIvAmLWo7kNr4Cw-62TAikiHaV-3iudhLpcwJ5Q/exec";

/*************** HELPERS ***************/
const $ = (id) => document.getElementById(id);

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}
function requireLogin() {
  const s = loadSession();
  if (!s?.username) {
    window.location.href =
      `dangnhapktqn.html?return=${encodeURIComponent(location.pathname + location.search)}`;
    return null;
  }
  return s;
}
function esc(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function toNum(v, d=0){ const n=Number(v); return Number.isFinite(n)?n:d; }
function fmtDate(iso){
  try{
    const d=new Date(iso); if(isNaN(d)) return "";
    const dd=String(d.getDate()).padStart(2,"0");
    const mm=String(d.getMonth()+1).padStart(2,"0");
    const yy=d.getFullYear();
    const hh=String(d.getHours()).padStart(2,"0");
    const mi=String(d.getMinutes()).padStart(2,"0");
    return `${dd}/${mm}/${yy} ${hh}:${mi}`;
  }catch{return "";}
}
async function fetchJson(url){
  const r=await fetch(url,{cache:"no-store"});
  const t=await r.text();
  try{ return JSON.parse(t);}catch{ throw new Error("INVALID_JSON");}
}

/*************** SERVER LOAD ***************/
async function loadQuizzes(){
  const d = await fetchJson(`${API_URL}?action=listQuizzes&t=${Date.now()}`);
  if(!d || d.ok!==true) throw new Error(d?.error||"LIST_QUIZZES_FAILED");
  return Array.isArray(d.quizzes)?d.quizzes:[];
}
async function loadResults(){
  const d = await fetchJson(`${API_URL}?action=listResults&t=${Date.now()}`);
  if(!d || d.ok!==true) throw new Error(d?.error||"LIST_RESULTS_FAILED");
  return Array.isArray(d.results)?d.results:[];
}

/*************** ATTEMPTS (SERVER) ***************/
function usedAttempts(results, quiz, username){
  return results.filter(r =>
    String(r.username||"")===String(username||"") &&
    String(r.cat||"")===String(quiz.cat||"") &&
    String(r.week??"")===String(quiz.week??"") &&
    String(r.quizTitle||"")===String(quiz.title||"")
  ).length;
}

/*************** SUBMIT (NO-CORS) ***************/
function submitResult(payload){
  fetch(API_URL,{
    method:"POST", mode:"no-cors",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify({ action:"submitResult", ...payload }),
    keepalive:true
  }).catch(()=>{});
}

/*************** MAIN ***************/
document.addEventListener("DOMContentLoaded", async ()=>{
  const sess = requireLogin(); if(!sess) return;

  const params = new URLSearchParams(location.search);
  const quizId = params.get("id");
  const statusEl = $("status");
  const formEl = $("form");
  if($("userBox")) $("userBox").textContent = `${sess.fullName||""} • ${sess.unit||""}`;

  try{
    // 1) Load quizzes realtime
    const quizzes = await loadQuizzes();
    const quiz = quizzes.find(q => String(q.id)===String(quizId));
    if(!quiz){
      if($("quizTitle")) $("quizTitle").textContent="❌ Không tìm thấy bài thi";
      if(statusEl) statusEl.textContent="Bài thi chưa được publish hoặc link id không đúng.";
      return;
    }

    // 2) Count attempts realtime
    const results = await loadResults();
    const maxAttempts = toNum(quiz.maxAttempts,3);
    const used = usedAttempts(results, quiz, sess.username);
    if(used >= maxAttempts){
      alert(`Bạn đã thi đủ ${maxAttempts} lần cho bài này.`);
      location.href = `ktqn-bai-thi.html?cat=${encodeURIComponent(quiz.cat)}`;
      return;
    }

    // Header
    if($("quizTitle")) $("quizTitle").textContent = quiz.title || "Bài thi";
    if($("quizMeta")){
      $("quizMeta").textContent =
        `Mục: ${quiz.cat} • Tuần ${quiz.week} • Lần ${used+1}/${maxAttempts}` +
        (toNum(quiz.timeLimitMin,0)>0?` • ${quiz.timeLimitMin} phút`:"");
    }

    // 3) Render questions
    const qs = Array.isArray(quiz.questions)?quiz.questions:[];
    if($("qCount")) $("qCount").textContent = qs.length;
    formEl.innerHTML = qs.map((q,i)=>{
      const name=`q_${i}`;
      const opts = Array.isArray(q.options)?q.options:[];
      return `
      <div class="q">
        <div class="q-title">Câu ${i+1}: ${esc(q.text||"")}</div>
        <div class="opts">
          ${opts.map((op,j)=>`
            <label class="opt">
              <input type="radio" name="${name}" value="${j}"/>
              <span>${esc(op)}</span>
            </label>`).join("")}
        </div>
      </div>`;
    }).join("");

    // 4) Timer
    let timer=null;
    let remain = toNum(quiz.timeLimitMin,0)*60;
    const startAt = Date.now();
    if(remain>0){
      const head=document.querySelector(".panel-head");
      if(head){
        const pill=document.createElement("span");
        pill.id="timerPill"; pill.className="pill";
        head.appendChild(pill);
      }
      const tick=()=>{
        const m=Math.floor(remain/60), s=remain%60;
        if($("timerPill")) $("timerPill").textContent =
          `⏳ ${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
        if(remain<=0){ clearInterval(timer); timer=null; doSubmit(true); return; }
        remain--;
      };
      tick(); timer=setInterval(tick,1000);
    }

    function calcScore(){
      let score=0, maxScore=0;
      qs.forEach((q,i)=>{
        const pts=toNum(q.points,1); maxScore+=pts;
        const correct=toNum(q.correctIndex,-1);
        const chosen=formEl.querySelector(`input[name="q_${i}"]:checked`);
        if(chosen && toNum(chosen.value,-2)===correct) score+=pts;
      });
      return {score,maxScore};
    }

    async function doSubmit(auto=false){
      if(!auto){
        const miss = qs.findIndex((_,i)=>!formEl.querySelector(`input[name="q_${i}"]:checked`));
        if(miss>=0){ if(statusEl) statusEl.textContent=`⚠️ Chưa trả lời Câu ${miss+1}.`; return; }
      }
      if(timer){ clearInterval(timer); timer=null; }
      if($("submitBtn")) $("submitBtn").disabled=true;

      // Recheck attempts (tránh mở 2 tab)
      const fresh = await loadResults();
      const usedNow = usedAttempts(fresh, quiz, sess.username);
      if(usedNow>=maxAttempts){
        alert(`Bạn đã thi đủ ${maxAttempts} lần.`);
        location.href=`ktqn-bai-thi.html?cat=${encodeURIComponent(quiz.cat)}`;
        return;
      }

      const {score,maxScore}=calcScore();
      submitResult({
        submittedAt:new Date().toISOString(),
        cat:quiz.cat, week:quiz.week, quizTitle:quiz.title,
        attemptNo: usedNow+1, maxAttempts,
        autoSubmitted:auto?1:0,
        timeLimitMin:toNum(quiz.timeLimitMin,0),
        durationSec: Math.round((Date.now()-startAt)/1000),
        fullName:sess.fullName, rank:sess.rank, position:sess.position,
        unit:sess.unit, phone:sess.phone, username:sess.username,
        score, maxScore
      });

      location.href="ktqn-ketqua.html";
    }

    if($("submitBtn")) $("submitBtn").addEventListener("click",()=>doSubmit(false));

  }catch(err){
    console.error(err);
    if(statusEl) statusEl.textContent="❌ Không tải được bài thi. Kiểm tra API /exec.";
  }
});
