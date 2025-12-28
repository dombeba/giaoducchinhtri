const playBtn = document.getElementById("playBtn");
const status = document.getElementById("status");
const qrBox = document.getElementById("qrBox");

// Link trắc nghiệm (chủ tướng thay link thật)
const QUIZ_URL = "";

playBtn.addEventListener("click", () => {
  if (!QUIZ_URL) {
    status.textContent = "Chưa gắn link trắc nghiệm";
    qrBox.style.borderColor = "red";
    return;
  }
  window.location.href = QUIZ_URL;
});

qrBox.addEventListener("click", () => {
  if (!QUIZ_URL) {
    alert("Chưa có link QR");
    return;
  }
  navigator.clipboard.writeText(QUIZ_URL);
  status.textContent = "Đã copy link";
});
// đổi trạng thái khi click các link bên trái (tuỳ chọn)
document.querySelectorAll(".bullets a").forEach(a => {
  a.addEventListener("click", () => {
    status.textContent = "Đang mở nội dung...";
  });
});
