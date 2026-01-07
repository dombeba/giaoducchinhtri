const SESSION_KEY = "KTQN_SESSION_V1";

function loadSession(){
  try{
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function requireLogin(){
  const sess = loadSession();
  if(!sess || !sess.username){
    const back = encodeURIComponent("kienthucquannhan.html");
    window.location.href = `dangnhapktqn.html?return=${back}`;
    return null;
  }
  return sess;
}

function setText(id, msg){
  const el = document.getElementById(id);
  if(el) el.textContent = msg || "";
}

document.addEventListener("DOMContentLoaded", () => {
  const sess = requireLogin();
  if(!sess) return;

  setText("userPill", `✅ ${sess.username}`);
  setText("userInfo", `${sess.rank || ""} • ${sess.position || ""} • ${sess.unit || ""} • SĐT: ${sess.phone || ""}`);

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    const back = encodeURIComponent("kienthucquannhan.html");
    window.location.href = `dangnhapktqn.html?return=${back}`;
  });
});
