/***************** CONFIG *****************/
// ✅ DÁN LINK WEB APP /exec CỦA APPS SCRIPT VÀO ĐÂY:
const QR_API_URL = "https://script.google.com/macros/s/AKfycbx2Gqi5q08EAcSHiMeWncN4EyHuhmpjioB2N64jmDfoEW9xmqVYCvNyIcqXk_9-l3LD9g/exec";
// ví dụ: https://script.google.com/macros/s/XXXX/exec

// Sheet đang dùng: QR_INDEX
// KEY: tintuc, chinhtri, quansu, haucan, nhanthuc, phapluat, quiz
// App Script action dùng: list, upsert

/***************** DOM *****************/
const $ = (s) => document.querySelector(s);

const passEl = $("#pass");
const statusEl = $("#status");

const selKeyEl = $("#selKey");
const qrUrlEl = $("#qrUrl");

const previewImg = $("#previewImg");
const previewHint = $("#previewHint");
const currentBox = $("#currentBox");

/***************** STATE *****************/
let itemsMap = {}; // key -> item

document.addEventListener("DOMContentLoaded", () => {
  wire();
  refreshPreview();
});

function wire(){
  $("#btnLoad").addEventListener("click", loadAll);
  $("#btnSave").addEventListener("click", saveCurrent);
  $("#btnPreview").addEventListener("click", refreshPreview);

  selKeyEl.addEventListener("change", () => {
    fillFormFromKey(selKeyEl.value);
    refreshPreview();
  });

  qrUrlEl.addEventListener("input", refreshPreview);
}

/***************** UI *****************/
function setStatus(msg, isBad){
  statusEl.textContent = msg;
  statusEl.classList.toggle("bad", !!isBad);
  statusEl.classList.toggle("ok", !isBad);
}

function mustApi(){
  const u = (QR_API_URL || "").trim();
  if (!u || u.includes("PASTE_YOUR_WEB_APP_EXEC_URL_HERE")) {
    throw new Error("Chưa dán QR_API_URL trong javascrip/admin-qrindex.js");
  }
  return u;
}

/***************** DRIVE LINK -> UC *****************/
function extractDriveId(url){
  if (!url) return "";
  const s = String(url).trim();

  let m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];

  m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];

  m = s.match(/uc\?export=view&id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];

  m = s.match(/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];

  return "";
}

function driveToUC(url){
  const id = extractDriveId(url);
  if (!id) return url;
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

/***************** LOAD *****************/
async function loadAll(){
  try{
    setStatus("Đang tải...", false);
    const api = mustApi();

    const res = await fetch(`${api}?action=list`, { cache:"no-store" });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Load lỗi");

    itemsMap = {};
    (data.items || []).forEach(it => { if (it && it.key) itemsMap[it.key] = it; });

    fillFormFromKey(selKeyEl.value);
    renderCurrent(selKeyEl.value);
    refreshPreview();

    setStatus("OK: Đã tải dữ liệu.", false);
  }catch(err){
    setStatus(String(err), true);
  }
}

function fillFormFromKey(key){
  const it = itemsMap[key];
  qrUrlEl.value = (it && it.qr) ? it.qr : "";
  renderCurrent(key);
}

/***************** PREVIEW *****************/
function refreshPreview(){
  const raw = qrUrlEl.value.trim();
  if (!raw){
    previewImg.removeAttribute("src");
    previewHint.textContent = "—";
    return;
  }
  const u = driveToUC(raw);
  previewImg.src = u;
  previewHint.textContent = u;
}

/***************** SAVE (UPSERT) *****************/
async function saveCurrent(){
  try{
    const api = mustApi();
    const pass = passEl.value;

    const key = selKeyEl.value;
    const name = selKeyEl.options[selKeyEl.selectedIndex].text; // tên theo dropdown
    const qr = driveToUC(qrUrlEl.value.trim());

    if (!qr) return setStatus("Chưa dán link ảnh QR.", true);

    setStatus("Đang lưu...", false);

    // chỉ update QR, không đụng link đích => target để trống
    const url = `${api}?action=upsert&pass=${encodeURIComponent(pass)}`
      + `&key=${encodeURIComponent(key)}`
      + `&name=${encodeURIComponent(name)}`
      + `&target=${encodeURIComponent("")}`
      + `&qr=${encodeURIComponent(qr)}`;

    const res = await fetch(url, { cache:"no-store" });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Lưu lỗi");

    // cập nhật local map + hiển thị
    itemsMap[key] = { key, name, target:"", qr, updatedAt: new Date().toISOString() };
    renderCurrent(key);
    refreshPreview();

    setStatus("Đã lưu thành công.", false);
  }catch(err){
    setStatus(String(err), true);
  }
}

/***************** CURRENT BOX *****************/
function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function renderCurrent(key){
  const it = itemsMap[key];
  const label = selKeyEl.options[selKeyEl.selectedIndex].text;

  if (!it){
    currentBox.innerHTML = `
      <div class="row"><span class="k">Mục:</span> ${esc(label)} (${esc(key)})</div>
      <div class="row"><span class="k">QR hiện tại:</span> (chưa có dữ liệu)</div>
    `;
    return;
  }

  currentBox.innerHTML = `
    <div class="row"><span class="k">Mục:</span> ${esc(label)} (${esc(it.key)})</div>
    <div class="row"><span class="k">QR hiện tại:</span> <a href="${esc(it.qr)}" target="_blank" rel="noopener">${esc(it.qr)}</a></div>
    <div class="row"><span class="k">Cập nhật:</span> ${esc(it.updatedAt || "")}</div>
  `;
}
