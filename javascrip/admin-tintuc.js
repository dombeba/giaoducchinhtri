/**************************************************
 * ADMIN - TIN TỨC (FIX TITLE + IMAGE)
 **************************************************/

const ADMIN_PASSWORD = "123321";
const API_URL = "https://script.google.com/macros/s/AKfycbwHtgydq5jmIoHPaelCRkq1inb1DrnBxxSITOFiowawHzfvoFW8URUoAvAV3Ea2-n6SiA/exec";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}

/* ========= JSONP ========= */
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "__cb_" + Math.random().toString(36).slice(2);
    window[cb] = (data) => {
      delete window[cb];
      script.remove();
      resolve(data);
    };
    const script = document.createElement("script");
    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
    script.onerror = () => reject("JSONP_FAILED");
    document.body.appendChild(script);
  });
}

/* ========= POST ========= */
function postNoCors(payload) {
  return fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
}

/* ========= IMAGE ========= */
const MAX_FILE = 25_000;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function pickImage(urlId, fileId) {
  const url = ($(urlId)?.value || "").trim();
  const file = $(fileId)?.files?.[0];
  if (file) {
    if (file.size > MAX_FILE) {
      alert("Ảnh quá nặng (>25KB). Hãy dùng link.");
      return "";
    }
    return await fileToBase64(file);
  }
  return url;
}

/* ========= SAVE ========= */
$("save")?.addEventListener("click", async () => {
  try {
    // 🔴 LẤY TEXT TRƯỚC – KHÔNG ĐỤNG ẢNH
    const title = $("title").value.trim();
    const date = $("date").value.trim();
    const category = $("category").value;
    const author = $("author").value.trim();
    const source = $("source").value.trim();
    const excerpt = $("excerpt").value.trim();
    const content = $("content").value.trim();

    if (!title) {
      alert("❌ Chưa nhập TIÊU ĐỀ");
      $("title").focus();
      return;
    }
    if (!date) {
      alert("❌ Chưa chọn NGÀY");
      $("date").focus();
      return;
    }
    if (!content) {
      alert("❌ Chưa có NỘI DUNG");
      $("content").focus();
      return;
    }

    // 🔴 SAU ĐÓ MỚI XỬ LÝ ẢNH
    const thumb = await pickImage("thumbUrl", "thumbFile");
    const hero  = await pickImage("heroUrl", "heroFile");

    const postId = $("postId")?.value || "";

    const post = {
      id: postId,
      title,
      date,
      category,
      author,
      source,
      excerpt,
      thumb,
      hero,
      content,
      gallery: []
    };

    console.log("SEND POST =", post);

    setStatus("⏳ Đang lưu bài...");
    await postNoCors({
      action: "upsertNews",
      adminPassword: ADMIN_PASSWORD,
      post
    });

    setTimeout(async () => {
      setStatus("✅ Đã lưu bài");
      document.querySelector("form")?.reset();
      await renderList();
    }, 1200);

  } catch (e) {
    console.error(e);
    alert("Lỗi khi lưu bài");
  }
});

/* ========= LOAD LIST ========= */
async function renderList() {
  const res = await jsonp(API_URL + "?action=listNews");
  if (!res.ok) return;

  const list = $("list");
  list.innerHTML = res.items.map(p => `
    <div class="item">
      <h3>${p.title || "(Chưa có tiêu đề)"}</h3>
      <div>${p.date} • ${p.category}</div>
    </div>
  `).join("");
}

document.addEventListener("DOMContentLoaded", renderList);
