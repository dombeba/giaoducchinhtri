function applyBoldSyntax(root){
  // **...** -> <strong>...</strong> (cho text thuần)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const texts = [];
  while(walker.nextNode()) texts.push(walker.currentNode);

  texts.forEach(node=>{
    const t = node.nodeValue;
    if(!t || !t.includes("**")) return;
    const html = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    if(html === t) return;

    const span = document.createElement("span");
    span.innerHTML = html;
    node.parentNode.replaceChild(span, node);
  });
}

function buildTOC(){
  const toc = document.getElementById("toc");
  const accs = Array.from(document.querySelectorAll("details.acc"));
  if(!toc) return;

  toc.innerHTML = accs.map((d, i)=>{
    const sum = d.querySelector("summary");
    const title = (sum?.textContent || `Mục ${i+1}`).trim();
    const id = d.id || `sec_${i+1}`;
    d.id = id;
    return `<a href="#${id}">${title}</a>`;
  }).join("");
}

function setLastUpdate(){
  const el = document.getElementById("lastUpdate");
  if(!el) return;

  // Nếu muốn cố định ngày cập nhật thì điền vào đây:
  const manual = ""; // ví dụ "13/01/2026"
  if(manual){
    el.textContent = `Cập nhật: ${manual}`;
    return;
  }

  const now = new Date();
  const dd = String(now.getDate()).padStart(2,"0");
  const mm = String(now.getMonth()+1).padStart(2,"0");
  const yy = now.getFullYear();
  el.textContent = `Cập nhật: ${dd}/${mm}/${yy}`;
}

function expandCollapseAll(open){
  document.querySelectorAll("details.acc").forEach(d => d.open = !!open);
}

function clearMarks(root){
  root.querySelectorAll("mark.k-hit").forEach(m=>{
    const text = document.createTextNode(m.textContent || "");
    m.parentNode.replaceChild(text, m);
  });
}

function highlight(root, query){
  if(!query) return 0;
  const q = query.toLowerCase();
  let hits = 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while(walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(node=>{
    const text = node.nodeValue || "";
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q);
    if(idx === -1) return;

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after  = text.slice(idx + query.length);

    const frag = document.createDocumentFragment();
    if(before) frag.appendChild(document.createTextNode(before));
    const mark = document.createElement("mark");
    mark.className = "k-hit";
    mark.textContent = match;
    frag.appendChild(mark);
    if(after) frag.appendChild(document.createTextNode(after));

    node.parentNode.replaceChild(frag, node);
    hits += 1;
  });

  return hits;
}

document.addEventListener("DOMContentLoaded", ()=>{
  const contentRoot = document.getElementById("contentRoot");
  const qEl = document.getElementById("q");
  const qHint = document.getElementById("qHint");

  if(contentRoot) applyBoldSyntax(contentRoot);

  buildTOC();
  setLastUpdate();

  document.getElementById("expandAll")?.addEventListener("click", ()=>expandCollapseAll(true));
  document.getElementById("collapseAll")?.addEventListener("click", ()=>expandCollapseAll(false));

  let timer;
  qEl?.addEventListener("input", ()=>{
    clearTimeout(timer);
    timer = setTimeout(()=>{
      if(!contentRoot) return;
      clearMarks(contentRoot);

      const q = (qEl.value || "").trim();
      if(!q){
        if(qHint) qHint.textContent = "";
        return;
      }

      // mở hết để nhìn kết quả rõ
      expandCollapseAll(true);

      const hits = highlight(contentRoot, q);
      if(qHint) qHint.textContent = hits ? `Tìm thấy ${hits} vị trí (mỗi đoạn 1 vị trí).` : `Không thấy kết quả.`;
    }, 200);
  });
});
