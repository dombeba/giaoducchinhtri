const inp = document.getElementById("inp");
const outUC = document.getElementById("outUC");
const outThumb = document.getElementById("outThumb");

const btnConvert = document.getElementById("btnConvert");
const btnClear = document.getElementById("btnClear");
const btnCopyUC = document.getElementById("btnCopyUC");
const btnCopyThumb = document.getElementById("btnCopyThumb");
const btnCopyBoth = document.getElementById("btnCopyBoth");

/** Tách nhiều dòng */
function lines(text){
  return String(text || "")
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);
}

/** Lấy ID Drive từ nhiều kiểu link */
function extractDriveId(url){
  const u = String(url || "").trim();
  if(!u) return "";

  // 1) /file/d/ID/
  let m = u.match(/\/file\/d\/([^\/\?]+)/i);
  if(m && m[1]) return m[1];

  // 2) ?id=ID (open?id=..., uc?id=..., thumbnail?id=...)
  m = u.match(/[?&]id=([^&]+)/i);
  if(m && m[1]) return decodeURIComponent(m[1]);

  // 3) dạng share "folders/..." -> (không phải ảnh file) => không hỗ trợ
  return "";
}

function toUC(id){
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`;
}
function toThumb(id, size="w1200"){
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=${encodeURIComponent(size)}`;
}

/** Copy helper */
async function copyText(text){
  const t = String(text || "");
  if(!t.trim()){
    alert("⚠️ Không có gì để copy.");
    return;
  }

  try{
    await navigator.clipboard.writeText(t);
    alert("✅ Đã copy vào clipboard.");
  }catch{
    // fallback
    const ta = document.createElement("textarea");
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    alert(ok ? "✅ Đã copy vào clipboard." : "❌ Không copy được (trình duyệt chặn).");
  }
}

function convert(){
  const arr = lines(inp?.value);
  if(!arr.length){
    alert("⚠️ Hãy dán ít nhất 1 link Drive.");
    return;
  }

  const ucList = [];
  const thList = [];
  const bothList = [];

  let bad = 0;

  for(const link of arr){
    const id = extractDriveId(link);
    if(!id){ bad++; continue; }

    const uc = toUC(id);
    const th = toThumb(id, "w1200");

    ucList.push(uc);
    thList.push(th);
    bothList.push(`${uc} | ${th}`);
  }

  outUC.value = ucList.join("\n");
  outThumb.value = thList.join("\n");

  if(bad){
    alert(`✅ Đã đổi xong.\n⚠️ Có ${bad} link không lấy được ID (bỏ qua).`);
  }else{
    alert("✅ Đã đổi xong.");
  }

  // lưu bản bothList tạm để copy
  window.__BOTH_LIST__ = bothList.join("\n");
}

btnConvert?.addEventListener("click", convert);

btnClear?.addEventListener("click", ()=>{
  inp.value = "";
  outUC.value = "";
  outThumb.value = "";
  window.__BOTH_LIST__ = "";
  inp.focus();
});

btnCopyUC?.addEventListener("click", ()=>copyText(outUC.value));
btnCopyThumb?.addEventListener("click", ()=>copyText(outThumb.value));
btnCopyBoth?.addEventListener("click", ()=>copyText(window.__BOTH_LIST__ || ""));
