// ====== CẤU HÌNH ======
const APPROVED_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQutwuXk3RybTMjkp3qqZ_jomt3gnMqDhQkaLF0Xd2ggq-0is6uNkMWJA6_ihSJT9mmT8tedbbWifZf/pub?gid=112761703&single=true&output=csv";

// (tuỳ chọn) link Google Form đăng ký – để nút Đăng ký mở form
// Nếu chưa có nút đăng ký thì bỏ qua
const REGISTER_FORM_URL = ""; // dán link form nếu muốn

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

// Parse CSV (có hỗ trợ dấu phẩy trong ngoặc kép)
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

  // last cell
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  // drop empty last line
  const cleaned = rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  return cleaned;
}

function toObjects(csvText) {
  const rows = parseCSV(csvText);
  if (!rows.length) return [];

  const headers = rows[0].map((h) => String(h).trim());
  const items = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = r[idx] ?? ""));
    items.push(obj);
  }
  return items;
}

async function fetchApprovedUsers() {
  // cache-bust để GitHub pages không bị cache
  const url = `${APPROVED_CSV_URL}&_=${Date.now()}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error("FETCH_FAILED");
  const text = await res.text();
  return toObjects(text);
}

// ====== LOGIN ======
async function login() {
  // ⚠️ các id input này phải đúng với dangnhapktqn.html của chủ tướng
  const rawU = ($("loginUser")?.value || "").trim();
  const rawP = ($("loginPass")?.value || "").trim();

  if (!rawU || !rawP) return setText("loginStatus", "Cần nhập tên đăng nhập và mật khẩu.");

  const u = normalizeUsername(rawU);
  const p = String(rawP).trim(); // giữ nguyên số 0

  setText("loginStatus", "Đang kiểm tra tài khoản...");

  try {
    const users = await fetchApprovedUsers();

    // tìm user theo username (đã normalize)
    const found = users.find((x) => normalizeUsername(x.username) === u);

    if (!found) {
      return setText("loginStatus", "❌ Tài khoản chưa được duyệt hoặc không tồn tại.");
    }

    // password phải so sánh chuỗi (giữ số 0)
    const pw = String(found.password ?? "").trim();
    if (pw !== p) {
      return setText("loginStatus", "❌ Sai mật khẩu.");
    }

    saveSession({
      username: String(found.username || u).trim(),
      fullName: String(found.fullName || "").trim(),
      rank: String(found.rank || "").trim(),
      position: String(found.position || "").trim(),
      unit: String(found.unit || "").trim(),
      phone: String(found.phone || "").trim(),
    });

    setText("loginStatus", "✅ Đăng nhập thành công. Đang chuyển...");
    setTimeout(() => (window.location.href = getReturnUrl()), 400);
  } catch (e) {
    setText("loginStatus", "❌ Không đọc được danh sách duyệt (CSV). Kiểm tra lại Publish.");
  }
}

// ====== REGISTER ======
function openRegisterForm() {
  if (!REGISTER_FORM_URL) {
    alert("Chưa cấu hình link Google Form đăng ký.");
    return;
  }
  window.open(REGISTER_FORM_URL, "_blank");
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  // nút đăng nhập
  $("btnLogin")?.addEventListener("click", login);

  // Enter để đăng nhập
  $("loginUser")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
  $("loginPass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });

  // nút đăng ký (nếu có)
  $("btnRegister")?.addEventListener("click", openRegisterForm);
});
