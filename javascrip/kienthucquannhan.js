/**
 * KIẾN THỨC QUÂN NHÂN - 4 bài kiểm tra cố định
 * Quản lý tại: admin-kienthucquannhan.html
 */
const KEY = "KIENTHUC_QUIZZES_V1";

/** chấp nhận cả /forms/d/e/... và /forms/d/... */
function isEmbedUrl(url = "") {
  return /docs\.google\.com\/forms\/d(\/e)?\/.+\/viewform\?embedded=true/i.test(url.trim());
}
function toOpenLink(embedUrl = "") {
  return embedUrl.trim().replace(/\?embedded=true\b/i, "");
}

function default4(){
  return [1,2,3,4].map(i => ({
    slot: i,
    title: `BÀI KIỂM TRA ${i}`,
    embed: "",
    link: ""
  }));
}

function loadQuizzes(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return default4();
    const parsed = JSON.parse(raw);
    if(!Array.isArray(parsed)) return default4();

    const map = new Map(parsed.map(x => [x.slot, x]));
    return [1,2,3,4].map(i => {
      const q = map.get(i) || {};
      return {
        slot: i,
        title: q.title || `BÀI KIỂM TRA ${i}`,
        embed: q.embed || "",
        link: q.link || ""
      };
    });
  } catch {
    return default4();
  }
}

function emptyHtml(slot){
  return `
    <div style="font-family:Arial;padding:16px;">
      <h3 style="margin:0 0 10px;">Bài ${slot} chưa có nội dung</h3>
      <p style="margin:0 0 8px;line-height:1.4;">
        Vào trang <b>Admin</b> để dán embed & link.
      </p>
      <a href="admin-kienthucquannhan.html">Mở trang quản lý bài kiểm tra</a>
    </div>
  `;
}

function badEmbedHtml(){
  return `
    <div style="font-family:Arial;padding:16px;">
      <h3 style="margin:0 0 10px;">Embed chưa đúng</h3>
      <p style="margin:0 0 8px;line-height:1.4;">
        Embed phải là link Google Form có <b>?embedded=true</b>.
      </p>
      <a href="admin-kienthucquannhan.html">Mở trang quản lý bài kiểm tra</a>
    </div>
  `;
}

function renderQuizzes(){
  const grid = document.getElementById("quizGrid");
  if(!grid) return;

  const quizzes = loadQuizzes();

  // đảm bảo có đúng 4 card (nếu HTML thiếu thì tự tạo)
  grid.innerHTML = "";
  quizzes.forEach(q => {
    const card = document.createElement("article");
    card.className = "quiz-card";

    const embedOk = q.embed && isEmbedUrl(q.embed);
    const openLink = (q.link || "").trim() || (embedOk ? toOpenLink(q.embed) : "");

    if(openLink){
      const openBtn = document.createElement("a");
      openBtn.className = "open-external";
      openBtn.href = openLink;
      openBtn.target = "_blank";
      openBtn.rel = "noopener noreferrer";
      openBtn.title = "Mở bài thi";

      openBtn.textContent = "Mở bài";
      card.appendChild(openBtn);
    }

    const iframe = document.createElement("iframe");
    iframe.className = "quiz-frame";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.allow = "clipboard-read; clipboard-write";
    iframe.title = q.title || `Bài ${q.slot}`;

    if(!q.embed){
      iframe.srcdoc = emptyHtml(q.slot);
    } else if(!embedOk){
      iframe.srcdoc = badEmbedHtml();
    } else {
      iframe.src = q.embed;
    }

    const caption = document.createElement("div");
    caption.className = "quiz-caption";
    caption.textContent = q.title || `BÀI KIỂM TRA ${q.slot}`;

    card.appendChild(iframe);
    card.appendChild(caption);
    grid.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", renderQuizzes);
