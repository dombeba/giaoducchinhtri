/**************************************************
 * KTQN - KẾT QUẢ BÀI THI (SERVER-FIRST, MOBILE SAFE)
 * - Đọc kết quả từ Apps Script: ?action=listResults
 * - Dò đúng dòng vừa nộp bằng submittedAt/username/quizTitle/attemptNo
 * - Poll 12 lần (mỗi 1s) để bắt kịp độ trễ ghi sheet
 **************************************************/

const SESSION_KEY = "KTQN_SESSION_V1";
const API_URL =
  "https://script.google.com/macros/s/AKfycbxY7818jgoFttC7rl4HdhFy4RM84dPTIvAmLWo7kNr4Cw-62TAikiHaV-3iudhLpcwJ5Q/exec";

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function norm(v){ return String(v ?? "").trim(); }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

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

async function fetchJson(url) {
  const res = await fetch(url, { method:"GET", cache:"no-store" });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error("INVALID_JSON: " + text.slice(0,200)); }
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${dd}/${mm}/${yy} ${hh}:${mi}:${ss}`;
  } catch {
    return "";
  }
}

async function listResults() {
  const d = await fetchJson(`${API_URL}?action=listResults&t=${Date.now()}`);
  if (!d || d.ok !== true) throw new Error(d?.error || "LIST_RESULTS_FAILED");
  return Array.isArray(d.results) ? d.results : [];
}

function readHint() {
  // Ưu tiên query at=... (vừa nộp), fallback localStorage hint
  const params = new URLSearchParams(location.search);
  const at = params.get("at") || "";

  let hint = null;
  try { hint = JSON.parse(localStorage.getItem("KTQN_LAST_RESULT_HINT") || "null"); }
  catch { hint = null; }

  if (at && hint) hint.submittedAt = at; // overwrite cho chắc
  if (at && !hint) hint = { submittedAt: at };

  return hint;
}

function matchRow(r, hint, sess){
  // Nếu có đủ hint: match chính xác
  const okAt = hint?.submittedAt ? norm(r.submittedAt) === norm(hint.submittedAt) : false;

  const okUser = hint?.username
    ? norm(r.username) === norm(hint.username)
    : norm(r.username) === norm(sess.username);

  const okTitle = hint?.quizTitle ? norm(r.quizTitle) === norm(hint.quizTitle) : true;

  const okAttempt = hint?.attemptNo !== undefined && hint?.attemptNo !== null && String(hint.attemptNo) !== ""
    ? String(r.attemptNo ?? "") === String(hint.attemptNo)
    : true;

  // Nếu có submittedAt thì lấy theo submittedAt (mạnh nhất)
  if (hint?.submittedAt) return okAt && okUser && okTitle && okAttempt;

  // Nếu không có submittedAt: lấy “mới nhất” theo user + title + attempt
  return okUser && okTitle && okAttempt;
}

function pickLatestOfUser(rows, sess){
  const mine = rows.filter(r => norm(r.username) === norm(sess.username));
  mine.sort((a,b)=> norm(b.submittedAt).localeCompare(norm(a.submittedAt)));
  return mine[0] || null;
}

function renderResult(row, sess){
  const box = $("box");
  const pill = $("pill");
  const sub = $("sub");

  if(!row){
    if(pill) pill.textContent = "❌ Không tìm thấy";
    if(sub) sub.textContent = "Chưa lấy được kết quả từ server.";
    if(box){
      box.innerHTML = `
        <div style="color:#b00020;font-weight:900">
          Kết quả không tồn tại (chưa đồng bộ kịp hoặc bạn chưa có kết quả).
        </div>
        <div style="margin-top:10px;color:#666">
          Gợi ý: thử mở lại sau vài giây hoặc vào “Kết quả của tôi”.
        </div>
      `;
    }
    return;
  }

  const score = (row.score ?? "");
  const maxScore = (row.maxScore ?? "");
  const scoreText = (String(score) !== "" && String(maxScore) !== "")
    ? `${score} / ${maxScore}`
    : (String(score) !== "" ? String(score) : "—");

  if(pill) pill.textContent = `✅ ${scoreText}`;
  if(sub){
    sub.textContent = `Tài khoản: ${sess.username} • ${sess.fullName || ""} • ${sess.unit || ""}`;
  }

  const meta = [
    `⏱ Thời gian nộp: <b>${esc(fmtDate(row.submittedAt))}</b>`,
    `📌 Mục: <b>${esc(row.cat)}</b> • Tuần: <b>${esc(row.week)}</b>`,
    `📝 Bài: <b>${esc(row.quizTitle)}</b>`,
    `🔁 Lần thi: <b>${esc(row.attemptNo)}</b> / ${esc(row.maxAttempts ?? "")}`,
    `⌛ Thời lượng: <b>${esc(row.durationSec ?? 0)}s</b>${Number(row.autoSubmitted||0) ? ` • <span style="color:#b00020;font-weight:900">Tự nộp</span>` : ""}`
  ].join("<br>");

  if(box){
    box.innerHTML = `
      <div style="line-height:1.8">
        <div style="font-size:18px;font-weight:900;margin-bottom:8px">
          🎯 Điểm: ${esc(scoreText)}
        </div>
        <div style="color:#333">${meta}</div>
        <hr style="border:none;border-top:1px solid #eee;margin:12px 0">
        <div style="color:#666">
          Nếu chưa thấy kết quả mới nhất, hãy chờ vài giây và tải lại trang.
        </div>
      </div>
    `;
  }

  // backList đúng mục
  const back = $("backList");
  if(back){
    back.href = `ktqn-bai-thi.html?cat=${encodeURIComponent(row.cat || "")}`;
  }
}

document.addEventListener("DOMContentLoaded", async ()=>{
  const sess = requireLogin();
  if(!sess) return;

  const hint = readHint();
  const just = new URLSearchParams(location.search).get("just") === "1";

  // UI “đang đồng bộ”
  if($("pill")) $("pill").textContent = "⏳ Đang đồng bộ...";
  if($("sub")) $("sub").textContent = "Đang lấy kết quả từ server...";

  try{
    let rows = [];
    let found = null;

    // ✅ Poll tối đa 12s nếu vừa nộp bài (điện thoại cần cái này)
    const tries = just ? 12 : 1;

    for(let i=0;i<tries;i++){
      rows = await listResults();

      // nếu có hint => tìm đúng dòng
      if(hint){
        found = rows.find(r => matchRow(r, hint, sess)) || null;
      }

      // nếu không tìm được và không có hint => lấy mới nhất của user
      if(!found && !hint){
        found = pickLatestOfUser(rows, sess);
      }

      if(found) break;

      if(just){
        if($("sub")) $("sub").textContent = `⏳ Đang đồng bộ kết quả... (${i+1}/${tries})`;
        await sleep(1000);
      }
    }

    // Nếu vẫn chưa thấy: fallback lấy newest của user
    if(!found){
      found = pickLatestOfUser(rows, sess);
    }

    renderResult(found, sess);

  }catch(err){
    console.error(err);
    if($("pill")) $("pill").textContent = "❌ Lỗi tải";
    if($("sub")) $("sub").textContent = "Không lấy được kết quả từ server.";
    if($("box")){
      $("box").innerHTML = `
        <div style="color:#b00020;font-weight:900">Không tải được dữ liệu từ server.</div>
        <div style="margin-top:10px;color:#666">
          Thử mở: <b>${esc(API_URL)}?action=listResults</b>
        </div>
      `;
    }
  }
});
