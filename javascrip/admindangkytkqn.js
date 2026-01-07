// ===== BẢO VỆ TRANG ADMIN (CÁCH 1) =====
const ADMIN_PASSWORD = "123321"; // 🔴 ĐỔI MẬT KHẨU TẠI ĐÂY

const input = prompt("🔐 Nhập mật khẩu quản trị:");
if (input !== ADMIN_PASSWORD) {
  alert("❌ Sai mật khẩu. Không có quyền truy cập.");
  window.location.href = "index.html";
}

// ===== APP =====
const REQ_KEY = "KTQN_REG_REQUESTS_V1";
const USERS_KEY = "KTQN_USERS_V1";

const $ = (id) => document.getElementById(id);

function load(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
function setStatus(msg){
  const el = $("status");
  if(el) el.textContent = msg || "";
}

function esc(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function renderUsers(){
  const users = load(USERS_KEY, []);
  const box = $("users");
  const cnt = $("userCount");
  if(cnt) cnt.textContent = `${users.length} tài khoản`;

  if(!box) return;
  if(!users.length){
    box.innerHTML = `<div style="color:#666">Chưa có tài khoản nào.</div>`;
    return;
  }

  const sorted = [...users].sort((a,b)=> (a.fullName||"").localeCompare(b.fullName||""));
  box.innerHTML = sorted.map(u => `
    <div class="user">
      <div class="u1">${esc(u.fullName)} — <span class="badge approved">Đang hoạt động</span></div>
      <div class="u2">
        Username: <b>${esc(u.username)}</b> • Password: <b>${esc(u.password)}</b><br/>
        ${esc(u.rank)} • ${esc(u.position)} • ${esc(u.unit)} • SĐT: ${esc(u.phone)}
      </div>
    </div>
  `).join("");
}

function approveRequest(id){
  const reqs = load(REQ_KEY, []);
  const users = load(USERS_KEY, []);

  const idx = reqs.findIndex(r => r.id === id);
  if(idx < 0) return;

  const r = reqs[idx];

  // nếu đã approved rồi thì bỏ qua
  if(r.status === "approved"){
    setStatus("Đăng ký này đã được xác nhận trước đó.");
    return;
  }

  // chống trùng username hoặc sđt
  if(users.some(u => String(u.username).toLowerCase() === String(r.proposedUsername).toLowerCase())){
    alert("Trùng username với tài khoản đã có. Không thể xác nhận.");
    return;
  }
  if(users.some(u => String(u.phone) === String(r.phone))){
    alert("Trùng SĐT với tài khoản đã có. Không thể xác nhận.");
    return;
  }

  users.push({
    id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())),
    fullName: r.fullName,
    rank: r.rank,
    position: r.position,
    unit: r.unit,
    phone: r.phone,
    username: r.proposedUsername,
    password: r.proposedPassword,
    active: true,
    createdAt: new Date().toISOString()
  });

  r.status = "approved";
  r.approvedAt = new Date().toISOString();

  reqs[idx] = r;

  save(USERS_KEY, users);
  save(REQ_KEY, reqs);

  setStatus(`✅ Đã xác nhận: ${r.fullName} (username: ${r.proposedUsername})`);
  render();
}

function rejectRequest(id){
  const reqs = load(REQ_KEY, []);
  const idx = reqs.findIndex(r => r.id === id);
  if(idx < 0) return;

  reqs[idx].status = "rejected";
  reqs[idx].rejectedAt = new Date().toISOString();
  save(REQ_KEY, reqs);

  setStatus(`⛔ Đã từ chối: ${reqs[idx].fullName}`);
  render();
}

function delRequest(id){
  const reqs = load(REQ_KEY, []);
  const next = reqs.filter(r => r.id !== id);
  save(REQ_KEY, next);
  setStatus("Đã xóa 1 đăng ký.");
  render();
}

function render(){
  const reqs = load(REQ_KEY, []);
  const tbody = $("tbody");
  if(!tbody) return;

  if(!reqs.length){
    tbody.innerHTML = `<tr><td colspan="9" style="color:#666;padding:14px;">Chưa có đăng ký nào.</td></tr>`;
    renderUsers();
    return;
  }

  const sorted = [...reqs].sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""));

  tbody.innerHTML = sorted.map(r => {
    const badge =
      r.status === "approved" ? `<span class="badge approved">approved</span>` :
      r.status === "rejected" ? `<span class="badge rejected">rejected</span>` :
      `<span class="badge pending">pending</span>`;

    const actions = r.status === "approved"
      ? `
        <button class="btn" data-del="${esc(r.id)}" type="button">Xóa</button>
      `
      : `
        <button class="btn primary" data-approve="${esc(r.id)}" type="button">Xác nhận</button>
        <button class="btn danger" data-reject="${esc(r.id)}" type="button">Từ chối</button>
        <button class="btn" data-del="${esc(r.id)}" type="button">Xóa</button>
      `;

    return `
      <tr>
        <td>${esc(r.fullName)}</td>
        <td>${esc(r.rank)}</td>
        <td>${esc(r.position)}</td>
        <td>${esc(r.unit)}</td>
        <td>${esc(r.phone)}</td>
        <td><b>${esc(r.proposedUsername)}</b></td>
        <td><b>${esc(r.proposedPassword)}</b></td>
        <td>${badge}</td>
        <td style="white-space:nowrap">${actions}</td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-approve]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-approve");
      approveRequest(id);
    });
  });
  tbody.querySelectorAll("[data-reject]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-reject");
      rejectRequest(id);
    });
  });
  tbody.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-del");
      if(confirm("Xóa đăng ký này?")) delRequest(id);
    });
  });

  renderUsers();
}

$("clearAll")?.addEventListener("click", ()=>{
  if(confirm("Xóa toàn bộ danh sách đăng ký?")){
    localStorage.removeItem(REQ_KEY);
    setStatus("Đã xóa toàn bộ đăng ký.");
    render();
  }
});

document.addEventListener("DOMContentLoaded", render);
