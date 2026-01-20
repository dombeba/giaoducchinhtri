/*********** CONFIG ***********/
const API_URL = "https://script.google.com/macros/s/AKfycbwV1GaFzY3NJHvcAFyo8N50JvInBphSRwsDHb_oVlMq4uIUzO8xs0hPOSnkhP-V-g-Pgg/exec";

const $ = (id)=>document.getElementById(id);
const msgEl = $("msg");

function setMsg(text, ok=true){
  msgEl.className = "msg " + (ok ? "ok" : "err");
  msgEl.innerHTML = text;
}
function pad2(n){ return String(n).padStart(2,"0"); }

function makeCaption(y,m,d){
  return `Lời Bác Hồ dạy ngày này năm xưa, ngày ${d} tháng ${m} năm ${y}`;
}

function getForm(){
  const year = Number($("year").value);
  const month = Number($("month").value);
  const day = Number($("day").value);
  return {
    password: $("pass").value.trim(),
    year, month, day,
    caption: makeCaption(year,month,day),
    driveLink: ($("driveLink").value || "").trim()
  };
}

function readAsDataURL(file){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function renderPreview(){
  const f = getForm();
  $("pMeta").textContent = `📅 ${pad2(f.day)}/${pad2(f.month)}/${f.year}`;
  $("pCap").textContent = f.caption;
}
["year","month","day"].forEach(id=>$(id).addEventListener("input", renderPreview));

$("file").addEventListener("change", ()=>{
  const file = $("file").files?.[0];
  if(!file){
    $("previewImg").style.display = "none";
    return;
  }
  const url = URL.createObjectURL(file);
  $("previewImg").src = url;
  $("previewImg").style.display = "block";
});

// Nếu dán link drive -> ẩn preview ảnh local (tránh nhầm)
$("driveLink").addEventListener("input", ()=>{
  const v = $("driveLink").value.trim();
  if(v){
    $("previewImg").style.display = "none";
  }
});

$("btnUpload").addEventListener("click", async ()=>{
  try{
    const f = getForm();
    if(!f.password) return setMsg("Chưa nhập mật khẩu.", false);
    if(!f.year || !f.month || !f.day) return setMsg("Thiếu ngày/tháng/năm.", false);

    const file = $("file").files?.[0];
    const useDrive = !!f.driveLink;

    const payload = {
      action:"upsert",
      password:f.password,
      year:f.year, month:f.month, day:f.day,
      caption:f.caption
    };

    setMsg("Đang gửi dữ liệu...");

    if(useDrive){
      payload.driveLink = f.driveLink;
    }else{
      if(!file) return setMsg("Chưa chọn ảnh từ máy hoặc chưa dán link Drive.", false);
      payload.dataUrl = await readAsDataURL(file);
    }

    const res = await fetch(API_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(r=>r.json());

    if(!res.ok){
      // giải thích lỗi rõ
      const e = res.error || "unknown";
      if(e === "drive_permission_denied"){
        return setMsg("Lỗi: File Drive không thuộc quyền Script hoặc không set public được. Hãy dùng file trong Drive của chủ tướng hoặc upload từ máy.", false);
      }
      if(e === "invalid_drive_link"){
        return setMsg("Lỗi: Link Drive không hợp lệ. Hãy dán đúng link share hoặc dán thẳng fileId.", false);
      }
      return setMsg("Lỗi: " + e, false);
    }

    setMsg(`OK ✅ Đã lưu ${pad2(res.day)}/${pad2(res.month)}/${res.year}<br>Ảnh: ${res.imgUrl}`);
  }catch(err){
    setMsg("Lỗi upload: " + err.message, false);
  }
});

$("btnDelete").addEventListener("click", async ()=>{
  try{
    const f = getForm();
    if(!f.password) return setMsg("Chưa nhập mật khẩu.", false);

    const res = await fetch(API_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({ action:"delete", password:f.password, year:f.year, month:f.month, day:f.day })
    }).then(r=>r.json());

    if(!res.ok) return setMsg("Lỗi: " + (res.error||"unknown"), false);

    setMsg(`OK ✅ Đã xoá ngày ${pad2(f.day)}/${pad2(f.month)}/${f.year}`);
  }catch(err){
    setMsg("Lỗi xoá: " + err.message, false);
  }
});

$("btnLoad").addEventListener("click", async ()=>{
  try{
    const year = Number($("year").value);
    const month = Number($("month").value);

    const res = await fetch(`${API_URL}?action=list&year=${year}&month=${month}`).then(r=>r.json());
    if(!res.ok) return setMsg("Lỗi load: " + (res.error||"unknown"), false);

    const items = (res.items||[]).sort((a,b)=>Number(a.day)-Number(b.day));
    $("list").innerHTML = items.length
      ? items.map(it=>`• ${pad2(it.day)}/${pad2(it.month)}/${it.year} — <a href="${it.imgUrl}" target="_blank" rel="noopener">mở ảnh</a>`).join("<br>")
      : "Tháng này chưa có dữ liệu.";
    setMsg(`Đã tải: ${items.length} ảnh.`);
  }catch(err){
    setMsg("Lỗi load: " + err.message, false);
  }
});

renderPreview();
