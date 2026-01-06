// ===== BẢO VỆ TRANG ADMIN (CÁCH 1) =====
const ADMIN_PASSWORD = "123321"; // 🔴 ĐỔI MẬT KHẨU TẠI ĐÂY

const input = prompt("🔐 Nhập mật khẩu quản trị:");
if (input !== ADMIN_PASSWORD) {
  alert("❌ Sai mật khẩu. Không có quyền truy cập.");
  window.location.href = "index.html";
}

// ===== PHẦN CODE CŨ (GIỮ NGUYÊN) =====
const KEY = "KIENTHUC_QUIZZES_V1";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const listEl = $("list");

function setStatus(msg){ statusEl.textContent = msg || ""; }

function default4(){
  return [1,2,3,4].map(i => ({
    slot: i,
    title: `BÀI KIỂM TRA ${i}`,
    embed: "",
    link: ""
  }));
}

function loadQuizzes(){
  try {
    const raw = localStorage.getItem(KEY);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveQuizzes(items){
  localStorage.setItem(KEY, JSON.stringify(items));
}

function ensure4(){
  let items = loadQuizzes();
  if(!items){
    items = default4();
    saveQuizzes(items);
    return items;
  }

  // đảm bảo đủ slot 1-4
  const map = new Map(items.map(x => [x.slot, x]));
  const fixed = [1,2,3,4].map(i => {
    const old = map.get(i);
    return {
      slot: i,
      title: (old?.title || `BÀI KIỂM TRA ${i}`),
      embed: (old?.embed || ""),
      link: (old?.link || "")
    };
  });
  saveQuizzes(fixed);
  return fixed;
}

/** chấp nhận cả /forms/d/e/... và /forms/d/... */
function isEmbedUrl(url = "") {
  return /docs\.google\.com\/forms\/d(\/e)?\/.+\/viewform\?embedded=true/i.test(url.trim());
}
function toOpenLink(embedUrl = "") {
  return embedUrl.trim().replace(/\?embedded=true\b/i, "");
}

function getSlot(){
  return Number($("slot").value);
}

function fillFormBySlot(slot){
  const items = ensure4();
  const q = items.find(x => x.slot === slot);
  $("title").value = q?.title || `BÀI KIỂM TRA ${slot}`;
  $("embed").value = q?.embed || "";
  $("link").value = q?.link || "";
  setStatus(`Đã tải dữ liệu Bài ${slot}.`);
}

function esc(s){
  return String(s || "").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function renderList(){
  const items = ensure4();

  listEl.innerHTML = items.map(q => {
    const embedOk = q.embed && isEmbedUrl(q.embed);
    const open = (q.link || "").trim() || (embedOk ? toOpenLink(q.embed) : "");
    return `
      <div class="item">
        <h3>Bài ${q.slot}: ${esc(q.title)}</h3>
        <div class="meta">
          Embed: ${embedOk ? "✅ đúng" : (q.embed ? "⚠️ có nhưng chưa đúng" : "❌ trống")}
          <br/>
          Link mở ngoài: ${open ? `✅ có` : "⚠️ trống (sẽ tự lấy từ embed nếu embed đúng)"}
          <br/>
          <span>Gợi ý: embed phải có <code>?embedded=true</code></span>
        </div>
      </div>
    `;
  }).join("");
}

$("slot").addEventListener("change", () => fillFormBySlot(getSlot()));

$("reload").addEventListener("click", () => fillFormBySlot(getSlot()));

$("save").addEventListener("click", () => {
  const slot = getSlot();
  const title = $("title").value.trim();
  const embed = $("embed").value.trim();
  const linkInput = $("link").value.trim();

  if(!title){
    setStatus("Cần nhập tiêu đề.");
    return;
  }
  if(!embed){
    setStatus("Cần dán Embed (link nhúng).");
    return;
  }
  if(!isEmbedUrl(embed)){
    setStatus("Embed chưa đúng. Phải là link Google Form có ?embedded=true");
    return;
  }

  const link = linkInput || toOpenLink(embed);

  const items = ensure4();
  const idx = items.findIndex(x => x.slot === slot);
  items[idx] = { slot, title, embed, link };
  saveQuizzes(items);

  renderList();
  setStatus(`Đã lưu ✅ Bài ${slot}. Mở trang Kiến thức quân nhân là đổi ngay.`);
});

$("resetDefault").addEventListener("click", () => {
  if(confirm("Khôi phục về 4 bài mặc định (xóa embed/link hiện tại)?")){
    saveQuizzes(default4());
    fillFormBySlot(1);
    renderList();
    setStatus("Đã khôi phục 4 bài mặc định.");
  }
});

// init
ensure4();
fillFormBySlot(1);
renderList();
