/**
 * KIẾN THỨC QUÂN NHÂN - Danh sách bài thi
 * - embed: link nhúng Google Form (bắt buộc có ?embedded=true)
 * - link : link mở ngoài (tab mới). Nếu không khai báo, hệ thống tự tạo từ embed.
 */

const QUIZZES = [
  {
    title: "KIỂM TRA CHÍNH TRỊ CSM",
    embed:
      "https://docs.google.com/forms/d/e/1FAIpQLSeXK2tEJiW1gJ_pzEbpFpsZvSp4UHCPtFyD3qWRT3rBMhhUug/viewform?embedded=true",
     link: "https://forms.gle/HV3tyx6HCKPsy33Z9",
  },
  {
    title: "KIỂM TRA NHẬN THỨC QUÂN SỰ",
    embed: "", // dán link nhúng vào đây
  },
  {
    title: "KIỂM TRA NHẬN THỨC HC-KT",
    embed: "", // dán link nhúng vào đây
  },
  {
    title: "KIỂM TRA CHÍNH TRỊ HSQ-BS",
    embed: "", // dán link nhúng vào đây
  },
];

/** chấp nhận cả dạng /forms/d/e/... và /forms/d/... */
function isEmbedUrl(url = "") {
  return /docs\.google\.com\/forms\/d(\/e)?\/.+\/viewform\?embedded=true/i.test(
    url
  );
}

/** tạo link mở ngoài từ link nhúng */
function toOpenLink(embedUrl = "") {
  // bỏ ?embedded=true để mở full trang form
  return embedUrl.replace(/\?embedded=true\b/i, "");
}

function makeMissingEmbedHtml() {
  return `
    <div style="font-family:Arial;padding:16px;">
      <h3 style="margin:0 0 10px;">Chưa gắn link bài thi</h3>
      <p style="margin:0 0 8px;line-height:1.4;">
        Hãy thay <b>embed</b> bằng link nhúng Google Form dạng:
      </p>
      <code style="display:block;background:#f2f2f2;padding:10px;border-radius:8px;overflow:auto;">
        https://docs.google.com/forms/d/e/&lt;FORM_ID&gt;/viewform?embedded=true
      </code>
    </div>
  `;
}

function renderQuizzes() {
  const grid = document.getElementById("quizGrid");
  if (!grid) return;

  grid.innerHTML = "";

  QUIZZES.forEach((q) => {
    const card = document.createElement("article");
    card.className = "quiz-card";
    // đảm bảo nút nổi định vị đúng (CSS cũng nên có quiz-card{position:relative})
    card.style.position = "relative";

    // ===== NÚT MỞ LINK NGOÀI (đè lên góc phải) =====
    const embed = (q.embed || "").trim();
    const canEmbed = embed !== "" && isEmbedUrl(embed);

    const openLink = (q.link || "").trim() || (canEmbed ? toOpenLink(embed) : "");

    if (openLink) {
      const openBtn = document.createElement("a");
      openBtn.href = openLink;
      openBtn.target = "_blank";
      openBtn.rel = "noopener noreferrer";
      openBtn.className = "open-external";
      openBtn.title = "Mở bài thi";

      // icon kiểu "mở ra ngoài"
      openBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor"
            d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42
               9.3-9.29H14V3z"/>
          <path fill="currentColor"
            d="M5 5h6V3H5c-1.1 0-2 .9-2 2v14
               c0 1.1.9 2 2 2h14c1.1 0
               2-.9 2-2v-6h-2v6H5V5z"/>
        </svg>
      `;

      // append trước iframe để nằm “trên bài”
      card.appendChild(openBtn);
    }

    // ===== IFRAME =====
    const iframe = document.createElement("iframe");
    iframe.className = "quiz-frame";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.allow = "clipboard-read; clipboard-write";
    iframe.title = q.title;

    if (canEmbed) {
      iframe.src = embed;
    } else {
      iframe.srcdoc = makeMissingEmbedHtml();
    }

    // ===== CAPTION =====
    const caption = document.createElement("div");
    caption.className = "quiz-caption";
    caption.textContent = q.title;

    card.appendChild(iframe);
    card.appendChild(caption);
    grid.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", renderQuizzes);
