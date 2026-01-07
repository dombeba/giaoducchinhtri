const SESSION_KEY = "KTQN_SESSION_V1";
const QUIZ_KEY = "KTQN_QUIZZES_V2";
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
function requireLogin(){
  const s = loadSession();
  if(!s?.username){
    window.location.href = `dangnhapktqn.html?return=${encodeURIComponent("kienthucquannhan.html")}`;
    return null;
  }
  return s;
}
function loadQuizzes(){
  try{
    const arr = JSON.parse(localStorage.getItem(QUIZ_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function loadResults(){
  try{
    const arr = JSON.parse(localStorage.getItem(RESULT_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveResults(arr){
  localStorage.setItem(RESULT_KEY, JSON.stringify(arr));
}
function esc(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function countAttempts(results, quizId, username){
  return results.filter(r => r.quizId === quizId && (r.user?.username || "") === username).length;
}

document.addEventListener("DOMContentLoaded", ()=>{
  const sess = requireLogin();
  if(!sess) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const quizzes = loadQuizzes();
  const quiz = quizzes.find(q => q.id === id);

  const statusEl = document.getElementById("status");
  const formEl = document.getElementById("form");

  document.getElementById("userBox").textContent = `${sess.fullName || ""} • ${sess.unit || ""}`;

  if(!quiz){
    document.getElementById("quizTitle").textContent = "❌ Không tìm thấy bài thi";
    statusEl.textContent = "Bài thi không tồn tại hoặc đã bị xóa.";
    return;
  }

  const maxAttempts = Number(quiz.maxAttempts ?? 3);
  const timeLimitMin = Number(quiz.timeLimitMin ?? 0);

  // ✅ chặn nếu đã hết lượt thi
  const resultsNow = loadResults();
  const used = countAttempts(resultsNow, quiz.id, sess.username);
  if(used >= maxAttempts){
    alert(`Bạn đã thi đủ ${maxAttempts} lần cho bài này.`);
    window.location.href = `ktqn-bai-thi.html?cat=${encodeURIComponent(quiz.cat)}`;
    return;
  }

  // UI title
  document.getElementById("backBtn").href = `ktqn-bai-thi.html?cat=${encodeURIComponent(quiz.cat)}`;
  document.getElementById("quizTitle").textContent = quiz.title || "Bài thi";
  document.getElementById("quizMeta").textContent =
    `Mục: ${CAT_LABEL[quiz.cat] || quiz.cat} • Tuần ${quiz.week} • Thi lần ${used+1}/${maxAttempts}` +
    (timeLimitMin > 0 ? ` • Thời gian: ${timeLimitMin} phút` : "");

  const qs = Array.isArray(quiz.questions) ? quiz.questions : [];
  document.getElementById("qCount").textContent = qs.length;

  // render questions
  formEl.innerHTML = qs.map((q, idx) => {
    const name = `q_${idx}`;
    const opts = Array.isArray(q.options) ? q.options : [];
    return `
      <div class="q">
        <div class="q-title">Câu ${idx+1}: ${esc(q.text || "")}</div>
        <div class="opts">
          ${opts.map((op, j)=>`
            <label class="opt">
              <input type="radio" name="${name}" value="${j}" />
              <span>${esc(op)}</span>
            </label>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  // ✅ đồng hồ đếm ngược (nếu có)
  let timerId = null;
  let remainingSec = timeLimitMin > 0 ? timeLimitMin * 60 : 0;
  const startAt = Date.now();

  if(timeLimitMin > 0){
    // tạo pill hiển thị thời gian ở panel-head
    const head = document.querySelector(".panel-head");
    if(head){
      const t = document.createElement("span");
      t.className = "pill";
      t.id = "timerPill";
      t.textContent = "⏳ ...";
      head.appendChild(t);
    }

    const tick = () => {
      const pill = document.getElementById("timerPill");
      const m = Math.floor(remainingSec / 60);
      const s = remainingSec % 60;
      if(pill) pill.textContent = `⏳ ${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;

      if(remainingSec <= 0){
        clearInterval(timerId);
        timerId = null;
        statusEl.textContent = "⏰ Hết giờ. Hệ thống đang tự động nộp bài...";
        submit(true); // auto submit
        return;
      }
      remainingSec -= 1;
    };

    tick();
    timerId = setInterval(tick, 1000);
  }

  function calcScore(){
    let score = 0;
    let maxScore = 0;

    qs.forEach((q, idx)=>{
      const pts = Number(q.points || 1);
      maxScore += pts;

      const correct = Number(q.correctIndex);
      const chosen = formEl.querySelector(`input[name="q_${idx}"]:checked`);
      if(chosen && Number(chosen.value) === correct){
        score += pts;
      }
    });

    return { score, maxScore };
  }

  function submit(autoSubmitted = false){
    // nếu bấm nộp thủ công: bắt buộc trả lời hết
    if(!autoSubmitted){
      const unanswered = qs.findIndex((q, idx)=> !formEl.querySelector(`input[name="q_${idx}"]:checked`));
      if(unanswered >= 0){
        statusEl.textContent = `⚠️ Chưa trả lời Câu ${unanswered+1}.`;
        return;
      }
    }

    // chặn double submit
    const btn = document.getElementById("submitBtn");
    if(btn) btn.disabled = true;

    // dừng timer
    if(timerId){
      clearInterval(timerId);
      timerId = null;
    }

    // tính điểm
    const { score, maxScore } = calcScore();

    // attemptNo tính theo results mới nhất tại thời điểm submit
    const results = loadResults();
    const attemptNo = countAttempts(results, quiz.id, sess.username) + 1;

    // nếu trong lúc làm có ai đó đã nộp thêm (hiếm), vẫn chặn vượt maxAttempts
    if(attemptNo > maxAttempts){
      alert(`Bạn đã thi đủ ${maxAttempts} lần cho bài này.`);
      window.location.href = `ktqn-bai-thi.html?cat=${encodeURIComponent(quiz.cat)}`;
      return;
    }

    const durationSec = Math.round((Date.now() - startAt) / 1000);

    const rid = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
    results.push({
      id: rid,
      submittedAt: new Date().toISOString(),

      quizId: quiz.id,
      cat: quiz.cat,
      week: quiz.week,
      quizTitle: quiz.title,

      attemptNo,
      maxAttempts,
      timeLimitMin,
      durationSec,
      autoSubmitted,

      user: {
        username: sess.username,
        fullName: sess.fullName,
        rank: sess.rank,
        position: sess.position,
        unit: sess.unit,
        phone: sess.phone,
      },

      score,
      maxScore
    });

    saveResults(results);

    // ✅ chuyển sang trang kết quả
    window.location.href = `ktqn-ketqua.html?rid=${encodeURIComponent(rid)}`;
  }

  document.getElementById("submitBtn").addEventListener("click", ()=> submit(false));
});
