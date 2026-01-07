const REQ_KEY = "KTQN_REG_REQUESTS_V1";   // danh sách đăng ký chờ duyệt
const USERS_KEY = "KTQN_USERS_V1";        // danh sách user đã duyệt
const SESSION_KEY = "KTQN_SESSION_V1";    // phiên đăng nhập

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

function normalizeNameToUsername(fullName){
  // chuyển về không dấu + viết liền
  let s = String(fullName || "").trim().toLowerCase();

  // bỏ dấu tiếng Việt
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/đ/g, "d");

  // chỉ giữ chữ/số, bỏ khoảng trắng, ký tự lạ
  s = s.replace(/[^a-z0-9\s]/g, "");
  s = s.replace(/\s+/g, "");

  return s;
}

function isPhoneValid(phone){
  const p = String(phone || "").trim();
  // đơn giản: 9-11 số
  return /^[0-9]{9,11}$/.test(p);
}

function setText(id, msg){
  const el = $(id);
  if(el) el.textContent = msg || "";
}

function getReturnUrl(){
  const params = new URLSearchParams(window.location.search);
  const ret = params.get("return");
  return ret ? ret : "kienthucquannhan.html";
}

function currentSession(){
  return load(SESSION_KEY, null);
}

function login(){
  const u = ($("loginUser")?.value || "").trim().toLowerCase();
  const p = ($("loginPass")?.value || "").trim();

  if(!u || !p){
    setText("loginStatus", "Cần nhập tên đăng nhập và mật khẩu.");
    return;
  }

  const users = load(USERS_KEY, []);
  const user = users.find(x => String(x.username || "").toLowerCase() === u);

  if(!user){
    setText("loginStatus", "Tài khoản không tồn tại hoặc chưa được Admin xác nhận.");
    return;
  }
  if(!user.active){
    setText("loginStatus", "Tài khoản chưa được kích hoạt. Vui lòng chờ Admin xác nhận.");
    return;
  }
  if(String(user.password || "") !== p){
    setText("loginStatus", "Sai mật khẩu.");
    return;
  }

  save(SESSION_KEY, {
    username: user.username,
    fullName: user.fullName,
    unit: user.unit,
    rank: user.rank,
    position: user.position,
    phone: user.phone,
    loginAt: new Date().toISOString()
  });

  setText("loginStatus", "Đăng nhập thành công ✅ Đang chuyển vào trang thi...");
  setTimeout(() => {
    window.location.href = getReturnUrl();
  }, 600);
}

function logout(){
  localStorage.removeItem(SESSION_KEY);
  setText("loginStatus", "Đã đăng xuất.");
}

function clearRegisterForm(){
  ["fullName","rank","position","unit","phone"].forEach(id=>{
    const el = $(id);
    if(el) el.value = "";
  });
}

function register(){
  const fullName = ($("fullName")?.value || "").trim();
  const rank = ($("rank")?.value || "").trim();
  const position = ($("position")?.value || "").trim();
  const unit = ($("unit")?.value || "").trim();
  const phone = ($("phone")?.value || "").trim();

  if(!fullName || !rank || !position || !unit || !phone){
    setText("regStatus", "Cần nhập đủ: Họ tên, Cấp bậc, Chức vụ, Đơn vị, SĐT.");
    return;
  }
  if(!isPhoneValid(phone)){
    setText("regStatus", "SĐT chưa đúng (chỉ số, 9–11 ký tự).");
    return;
  }

  const username = normalizeNameToUsername(fullName);
  if(!username){
    setText("regStatus", "Không tạo được username từ họ tên. Vui lòng nhập họ tên rõ ràng.");
    return;
  }

  const reqs = load(REQ_KEY, []);
  const users = load(USERS_KEY, []);

  // chặn trùng (đang chờ) theo SĐT
  if(reqs.some(x => String(x.phone) === phone && x.status === "pending")){
    setText("regStatus", "SĐT này đã gửi đăng ký và đang chờ duyệt.");
    return;
  }
  // chặn trùng (đã có user) theo username hoặc SĐT
  if(users.some(x => String(x.username).toLowerCase() === username.toLowerCase())){
    setText("regStatus", "Họ tên này đã có tài khoản (username trùng). Liên hệ Admin.");
    return;
  }
  if(users.some(x => String(x.phone) === phone)){
    setText("regStatus", "SĐT này đã có tài khoản. Vui lòng đăng nhập.");
    return;
  }

  reqs.push({
    id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())),
    fullName,
    rank,
    position,
    unit,
    phone,
    proposedUsername: username,   // họ tên viết liền không dấu
    proposedPassword: phone,      // mật khẩu = SĐT
    status: "pending",
    createdAt: new Date().toISOString()
  });

  save(REQ_KEY, reqs);

  // mô phỏng “gửi về SĐT”
  setText("regStatus",
    "✅ Đã nhận được thông tin đăng ký. Tài khoản/mật khẩu sẽ được gửi về SĐT của bạn sau khi Admin xác nhận."
  );

  clearRegisterForm();
}

document.addEventListener("DOMContentLoaded", () => {
  $("btnLogin")?.addEventListener("click", login);
  $("btnLogout")?.addEventListener("click", logout);
  $("btnRegister")?.addEventListener("click", register);
  $("btnClear")?.addEventListener("click", () => {
    clearRegisterForm();
    setText("regStatus", "");
  });

  // hiển thị trạng thái nếu đang đăng nhập
  const sess = currentSession();
  if(sess?.username){
    setText("loginStatus", `Đang đăng nhập: ${sess.username} (${sess.fullName || ""})`);
  }
});
