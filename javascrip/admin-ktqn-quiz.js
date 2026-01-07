// ===== BẢO VỆ ADMIN (CÁCH 1) =====
const ADMIN_PASSWORD = "123321";
const input = prompt("🔐 Nhập mật khẩu quản trị:");
if(input !== ADMIN_PASSWORD){
  alert("❌ Sai mật khẩu. Không có quyền truy cập.");
  window.location.href = "index.html";
}

const QUIZ_KEY = "KTQN_QUIZZES_V2";
const $ = (id)=>document.getElementById(id);

function loadQuizzes(){
  try{
    const arr = JSON.parse(localStorage.getItem(QUIZ_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveQuizzes(arr){
  localStorage.setItem(QUIZ_KEY, JSON.stringify(arr));
}
function setStatus(msg){
  const el = $("status");
  if(el) el.textContent = msg || "";
}
function esc(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function makeQCard(q = {}){
  const wrap = document.createElement("div");
  wrap.className = "qcard";
  wrap.innerHTML = `
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <div style="font-weight:900;">Câu hỏi</div>
      <button class="btn danger del" type="button">Xóa câu</button>
    </div>

    <div class="qrow">
      <label class="full">
        Nội dung câu <span class="req">*</span>
        <input class="qText" type="text" placeholder="Nhập câu hỏi..." value="${esc(q.text||"")}"/>
      </label>

      <label>
        Đáp án A <span class="req">*</span>
        <input class="opt" data-i="0" type="text" value="${esc(q.options?.[0]||"")}"/>
      </label>
      <label>
        Đáp án B <span class="req">*</span>
        <input class="opt" data-i="1" type="text" value="${esc(q.options?.[1]||"")}"/>
      </label>
      <label>
        Đáp án C <span class="req">*</span>
        <input class="opt" data-i="2" type="text" value="${esc(q.options?.[2]||"")}"/>
      </label>
      <label>
        Đáp án D <span class="req">*</span>
        <input class="opt" data-i="3" type="text" value="${esc(q.options?.[3]||"")}"/>
      </label>

      <label>
        Đáp án đúng <span class="req">*</span>
        <select class="correct">
          <option value="0">A</option>
          <option value="1">B</option>
          <option value="2">C</option>
          <option value="3">D</option>
        </select>
        <div class="small">Chọn đáp án đúng</div>
      </label>

      <label>
        Điểm (mặc định 1)
        <input class="points" type="number" min="1" max="10" value="${esc(q.points||"1")}"/>
      </label>
    </div>
  `;
  wrap.querySelector(".correct").value = String(q.correctIndex ?? 0);
  wrap.querySelector(".del").addEventListener("click", ()=> wrap.remove());
  return wrap;
}

function readQuestions(){
  const qWrap = $("qWrap");
  const cards = Array.from(qWrap.querySelectorAll(".qcard"));
  const questions = [];

  for(const card of cards){
    const text = card.querySelector(".qText")?.value?.trim();
    const opts = Array.from(card.querySelectorAll(".opt")).map(i=> i.value.trim());
    const correctIndex = Number(card.querySelector(".correct")?.value ?? 0);
    const points = Number(card.querySelector(".points")?.value ?? 1);

    if(!text) throw new Error("Có câu hỏi chưa có nội dung.");
    if(opts.some(x=>!x)) throw new Error("Có câu hỏi chưa đủ 4 đáp án.");
    if(!(correctIndex>=0 && correctIndex<=3)) throw new Error("Có câu hỏi chưa chọn đáp án đúng.");

    questions.push({ text, options: opts, correctIndex, points: points>0?points:1 });
  }
  if(!questions.length) throw new Error("Chưa có câu hỏi nào.");

  return questions;
}

function renderList(){
  const list = $("list");
  const quizzes = loadQuizzes().sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""));

  if(!quizzes.length){
    list.innerHTML = `<div style="color:#666">Chưa có bài thi nào.</div>`;
    return;
  }

  list.innerHTML = quizzes.map(q => `
    <div class="item">
      <div>
        <h3>${esc(q.title || "Bài thi")}</h3>
        <div class="meta">
          Mục: <b>${esc(q.cat)}</b> • Tuần: <b>${esc(q.week)}</b> • ${esc((q.questions||[]).length)} câu
          <br/>
          Giới hạn lượt thi: <b>${esc(q.maxAttempts ?? 3)}</b> • Thời gian: <b>${esc(q.timeLimitMin ?? 0)} phút</b>
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" data-edit="${esc(q.id)}" type="button">Sửa</button>
        <button class="btn danger" data-del="${esc(q.id)}" type="button">Xóa</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-del");
      if(!confirm("Xóa bài thi này?")) return;
      const next = loadQuizzes().filter(x=> x.id !== id);
      saveQuizzes(next);
      setStatus("Đã xóa bài.");
      renderList();
    });
  });

  list.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-edit");
      const q = loadQuizzes().find(x=> x.id === id);
      if(!q) return;

      $("cat").value = q.cat;
      $("week").value = q.week;
      $("title").value = q.title || "";

      // ✅ mới
      $("maxAttempts").value = String(q.maxAttempts ?? 3);
      $("timeLimitMin").value = String(q.timeLimitMin ?? 0);

      $("save").dataset.editId = q.id;

      $("qWrap").innerHTML = "";
      (q.questions||[]).forEach(qq => $("qWrap").appendChild(makeQCard(qq)));

      setStatus("Đang sửa bài: " + (q.title||""));
      window.scrollTo({ top: 0, behavior:"smooth" });
    });
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  // ✅ thêm 2 ô cấu hình
  const grid = document.querySelector(".grid");
  if(grid && !$("maxAttempts")){
    const html = `
      <label>
        Số lần thi tối đa (mặc định 3)
        <input id="maxAttempts" type="number" min="1" max="20" value="3" />
      </label>

      <label>
        Thời gian làm bài (phút) (0 = không giới hạn)
        <input id="timeLimitMin" type="number" min="0" max="600" value="0" />
      </label>
    `;
    grid.insertAdjacentHTML("beforeend", html);
  }

  $("addQ").addEventListener("click", ()=>{
    $("qWrap").appendChild(makeQCard({
      text:"",
      options:["","","",""],
      correctIndex:0,
      points:1
    }));
  });

  if(!$("qWrap").children.length){
    $("qWrap").appendChild(makeQCard({ text:"", options:["","","",""], correctIndex:0, points:1 }));
  }

  $("save").addEventListener("click", ()=>{
    try{
      const cat = $("cat").value;
      const week = Number(($("week").value||"").trim());
      const title = $("title").value.trim();

      // ✅ mới
      const maxAttempts = Number(($("maxAttempts").value||"3").trim());
      const timeLimitMin = Number(($("timeLimitMin").value||"0").trim());

      if(!cat) return setStatus("Cần chọn mục.");
      if(!week || week < 1) return setStatus("Cần nhập tuần (>=1).");
      if(!title) return setStatus("Cần nhập tiêu đề.");
      if(!maxAttempts || maxAttempts < 1) return setStatus("Số lần thi tối đa phải >= 1.");
      if(timeLimitMin < 0) return setStatus("Thời gian phút không hợp lệ.");

      const questions = readQuestions();

      const quizzes = loadQuizzes();
      const editId = $("save").dataset.editId;

      if(editId){
        const idx = quizzes.findIndex(x=> x.id === editId);
        if(idx >= 0){
          quizzes[idx] = {
            ...quizzes[idx],
            cat, week, title,
            maxAttempts,
            timeLimitMin,
            questions,
            updatedAt: new Date().toISOString()
          };
          saveQuizzes(quizzes);
          $("save").dataset.editId = "";
          setStatus("✅ Đã cập nhật bài.");
          renderList();
          return;
        }
      }

      const id = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
      quizzes.push({
        id, cat, week, title,
        maxAttempts,
        timeLimitMin,
        questions,
        createdAt: new Date().toISOString()
      });
      saveQuizzes(quizzes);

      setStatus("✅ Đã lưu bài.");
      $("save").dataset.editId = "";
      renderList();
    } catch(err){
      setStatus("❌ " + (err?.message || "Lỗi dữ liệu."));
    }
  });

  $("clearAll").addEventListener("click", ()=>{
    if(confirm("Xóa toàn bộ bài thi?")){
      localStorage.removeItem(QUIZ_KEY);
      setStatus("Đã xóa toàn bộ bài thi.");
      renderList();
    }
  });

  renderList();
});
