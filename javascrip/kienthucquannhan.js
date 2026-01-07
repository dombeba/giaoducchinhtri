// ====== CẤU HÌNH ======
const SESSION_KEY = "KTQN_SESSION_V1";
const LOGIN_PAGE = "dangnhapktqn.html";

// ====== HELPERS ======
const $ = (id) => document.getElementById(id);

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  const session = getSession();

  // ❌ Chưa đăng nhập → đá về trang đăng nhập
  if (!session || !session.username) {
    window.location.href =
      LOGIN_PAGE + "?return=kienthucquannhan.html";
    return;
  }

  // ✅ Đã đăng nhập → hiển thị thông tin
  const pill = $("userPill");
  const info = $("userInfo");

  if (pill) pill.textContent = session.username;

  if (info) {
    info.textContent = `${session.rank} • ${session.position} • ${session.unit} • SDT: ${session.phone}`;
  }

  // ====== ĐĂNG XUẤT ======
  const logoutBtn = $("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (!confirm("Bạn chắc chắn muốn đăng xuất?")) return;
      clearSession();
      window.location.href = LOGIN_PAGE;
    });
  }
});
