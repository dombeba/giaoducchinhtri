// ====== CẤU HÌNH ======
const APPROVED_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQutwuXk3RybTMjkp3qqZ_jomt3gnMqDhQkaLF0Xd2ggq-0is6uNkMWJA6_ihSJT9mmT8tedbbWifZf/pub?gid=112761703&single=true&output=csv";

// 🔴 LINK GOOGLE FORM ĐĂNG KÝ (ĐÃ GẮN)
const REGISTER_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSe5f3B8pUm4pzfbOUfexSokGGUMrRoAey2Z2eEtQyfBDDWBKg/viewform";

// ====== KEY ======
const SESSION_KEY = "KTQN_SESSION_V1";

// ====== HELPERS ======
const $ = (id) => document.getElementById(id);

function setText(id, msg) {
  const el = $(id);
  if (el) el.textContent = msg || "";
}

function getReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("return") || "kienthucquannhan.html";
}

function saveSession(user) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: user.username,
      fullName: user.fullName,
      rank: user.rank,
      position: user.position,
      unit: user.unit,
      phone: user.phone,
      loginAt: new Date().toISOString(),
    })
  );
}

function normalizeUsername(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

// ====== CSV ======
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }

    cur += ch;
  }

  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

function toObjects(csvText) {
  const rows = parseCSV(csvText);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h).trim());
  return rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = r[i] ?? ""));
    return o;
  });
}

async function fetchApprovedUsers() {
  const url = `${APPROVED_CSV_URL}&_=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("FETCH_FAILED");
  return toObjects(await res.text());
}

// ====== LOGIN ======
async function login() {
  const rawU = ($("loginUser")?.value || "").trim();
  const rawP = ($("loginPass")?.value || "").trim();
  if (!rawU || !rawP) return setText("loginStatus", "Cần nhập đủ thông tin.");

  const u = normalizeUsername(rawU);
  const p = String(rawP).trim();

  setText("loginStatus", "Đang kiểm tra...");

  try {
    const users = await fetchApprovedUsers();
    const found = users.find((x) => normalizeUsername(x.username) === u);
    if (!found) return setText("loginStatus", "❌ Tài khoản chưa được duyệt.");

    if (String(found.password).trim() !== p)
      return setText("loginStatus", "❌ Sai mật khẩu.");

    saveSession(found);
    setText("loginStatus", "✅ Thành công. Đang chuyển...");
    setTimeout(() => (window.location.href = getReturnUrl()), 400);
  } catch {
    setText("loginStatus", "❌ Không đọc được danh sách duyệt.");
  }
}

// ====== REGISTER ======
function openRegisterForm() {
  const w = window.open(REGISTER_FORM_URL, "_blank", "noopener,noreferrer");
  if (!w) window.location.href = REGISTER_FORM_URL;
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  $("btnLogin")?.addEventListener("click", login);
  $("btnRegister")?.addEventListener("click", openRegisterForm);

  $("loginUser")?.addEventListener("keydown", (e) => e.key === "Enter" && login());
  $("loginPass")?.addEventListener("keydown", (e) => e.key === "Enter" && login());
  $("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  setText("loginStatus", "Đã đăng xuất.");
});

});
