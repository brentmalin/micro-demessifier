
const exampleConfig = {
  sections: [
    {
      title: "Work",
      items: [
        { title:"Main SharePoint Site", subtitle:"Team or department home", icon:"🏛️", url:"" },
        { title:"Shared Resources", subtitle:"A document library, folder, or page", icon:"📁", url:"" }
      ]
    },
    {
      title: "Microsoft 365",
      items: [
        { title:"OneDrive", subtitle:"My files", icon:"☁️", url:"https://www.microsoft365.com/launch/onedrive" },
        { title:"Outlook", subtitle:"Email", icon:"✉️", url:"https://outlook.office.com/" },
        { title:"Calendar", subtitle:"Calendar", icon:"📅", url:"https://outlook.office.com/calendar/" },
        { title:"Teams", subtitle:"Teams", icon:"💬", url:"https://teams.microsoft.com/" }
      ]
    },
    {
      title: "Pinned",
      items: [
        { title:"Important Folder", subtitle:"Paste any Microsoft 365 or web link", icon:"⭐", url:"" }
      ]
    }
  ]
};

const KEY="microDemessifierConfigV1";
const RECENT_KEY="microDemessifierRecentV1";
const clone=x=>JSON.parse(JSON.stringify(x));
const escapeHtml=(v="")=>String(v).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));

const ICONS = [["auto","Auto"],["📁","Folder"],["📄","Document"],["🏛️","SharePoint"],["☁️","OneDrive"],["💬","Teams"],["🔗","Link"],["📅","Calendar"],["✉️","Email"],["⭐","Star"],["custom","Custom emoji"]];
function displayIcon(item){
  if(item.icon && item.icon!=="auto")return item.icon;
  if(Array.isArray(item.items))return "📁";
  const url=(item.url||"").toLowerCase();
  if(url.includes("/calendar"))return "📅";
  if(url.includes("teams.microsoft.com"))return "💬";
  if(url.includes("outlook."))return "✉️";
  if(url.includes("onedrive")||url.includes("1drv.ms"))return "☁️";
  if(url.includes("/folders/")||url.includes("folder="))return "📁";
  if(/\.(pdf|docx?|xlsx?|pptx?)([?#]|$)/.test(url))return "📄";
  if(url.includes("sharepoint.com"))return "🏛️";
  return "🔗";
}
function iconEditor(item,s,i){
  const current=item.icon||"auto";
  const choice=ICONS.some(([value])=>value===current)?current:"custom";
  return `<div class="icon-picker"><label for="icon-${s}-${i}">Icon</label><select id="icon-${s}-${i}" class="icon-choice">${ICONS.map(([value,label])=>`<option value="${value}" ${value===choice?"selected":""}>${value!=="auto"&&value!=="custom"?value+" ":""}${label}</option>`).join("")}</select><input class="icon-input" value="${escapeHtml(choice==="custom"?current:"")}" data-s="${s}" data-i="${i}" data-field="icon" aria-label="Custom emoji" placeholder="Paste emoji" ${choice!=="custom"?"hidden":""}></div>`;
}

function loadConfig(){try{return JSON.parse(localStorage.getItem(KEY))||clone(exampleConfig)}catch{return clone(exampleConfig)}}
let config=loadConfig();
function saveConfig(){localStorage.setItem(KEY,JSON.stringify(config))}
function getRecent(){try{return JSON.parse(localStorage.getItem(RECENT_KEY))||[]}catch{return[]}}
function addRecent(item){
  const old=getRecent().filter(x=>x.url!==item.url);
  localStorage.setItem(RECENT_KEY,JSON.stringify([{title:item.title,url:item.url},...old].slice(0,10)));
  renderRecent();
}

function matchesItem(item,q){
  return !q||[item.title,item.subtitle,item.url].some(value=>String(value||"").toLowerCase().includes(q))||(item.items||[]).some(child=>matchesItem(child,q));
}
function renderItem(item,grid,q=""){
  if(Array.isArray(item.items)){
    const folder=document.createElement("details");folder.className="shortcut-folder";folder.open=!!q;
    const summary=document.createElement("summary");summary.className="link-item";
    summary.innerHTML=`<div class="link-icon">${escapeHtml(displayIcon(item))}</div><div class="link-copy"><div class="link-title">${escapeHtml(item.title)}</div><div class="link-sub">${escapeHtml(item.subtitle||`${item.items.length} items`)}</div></div>`;
    folder.appendChild(summary);
    const contents=document.createElement("div");contents.className="folder-links";
    const children=item.items.filter(child=>matchesItem(item,q)&&([item.title,item.subtitle].some(v=>String(v||"").toLowerCase().includes(q))||matchesItem(child,q)));
    children.forEach(child=>renderItem(child,contents,q));
    if(!children.length)contents.innerHTML='<span class="empty">No links yet. Add them in Organize.</span>';
    folder.appendChild(contents);grid.appendChild(folder);return;
  }
  const a=document.createElement("a");a.className="link-item";a.href=item.url||"#";
  if(item.url){a.target="_blank";a.rel="noopener"}
  a.innerHTML=`<div class="link-icon">${escapeHtml(displayIcon(item))}</div><div class="link-copy"><div class="link-title">${escapeHtml(item.title)}</div><div class="link-sub">${escapeHtml(item.url?(item.subtitle||item.url):"Add link in Organize")}</div></div>`;
  a.addEventListener("click",e=>{if(!item.url){e.preventDefault();openManager()}else addRecent(item)});grid.appendChild(a);
}
function renderSections(filter=""){
  const root=document.getElementById("sections");root.innerHTML="";
  const q=filter.trim().toLowerCase();
  config.sections.forEach(section=>{
    const items=section.items.filter(item=>matchesItem(item,q));if(q&&!items.length)return;
    const card=document.createElement("section");card.className="section-card";
    card.innerHTML=`<div class="eyebrow">COLLECTION</div><h2>${escapeHtml(section.title)}</h2><div class="link-grid"></div>`;
    items.forEach(item=>renderItem(item,card.querySelector(".link-grid"),q));root.appendChild(card);
  });
  if(!root.children.length)root.innerHTML='<section class="section-card"><span class="empty">No matching shortcuts.</span></section>';
}

function renderRecent(){
  const root=document.getElementById("recentList"); root.innerHTML="";
  const recent=getRecent();
  if(!recent.length){root.innerHTML=`<span class="empty">Nothing opened from Micro Demessifier yet.</span>`;return}
  recent.forEach(item=>{
    const a=document.createElement("a"); a.className="recent-chip"; a.href=item.url; a.target="_blank"; a.rel="noopener"; a.textContent=item.title; root.appendChild(a);
  });
}

function openManager(){renderManager();document.getElementById("managerDialog").showModal()}

function itemAt(s,path){return path.split(".").reduce((parent,index)=>parent.items[Number(index)],config.sections[s])}
function itemsAt(s,path){return path?itemAt(s,path).items:config.sections[s].items}
function renderEditor(items,root,s,parent=""){
  items.forEach((item,i)=>{
    const path=parent?`${parent}.${i}`:String(i);
    const wrap=document.createElement("div");wrap.className=Array.isArray(item.items)?"folder-editor":"shortcut-editor";
    const row=document.createElement("div");row.className="item-editor";row.dataset.s=s;row.dataset.path=path;
    row.innerHTML=`${iconEditor(item,s,path)}
      <input data-field="title" class="title-input" aria-label="Name" value="${escapeHtml(item.title)}" placeholder="Name">
      <input data-field="subtitle" class="subtitle-input" aria-label="Description" value="${escapeHtml(item.subtitle||"")}" placeholder="Description">
      ${Array.isArray(item.items)?'<span class="folder-label">Folder</span>':`<input data-field="url" class="url-input" type="url" aria-label="Link URL" value="${escapeHtml(item.url||"")}" placeholder="https://…">`}
      <button type="button" class="danger small remove-item" aria-label="Remove item">×</button>`;
    row.querySelector(".remove-item").addEventListener("click",()=>{
      if(Array.isArray(item.items)&&item.items.length&&!confirm("Remove this folder and all its links?"))return;
      syncManagerInputs();itemsAt(s,parent).splice(i,1);renderManager();
    });
    wrap.appendChild(row);
    if(Array.isArray(item.items)){
      const children=document.createElement("div");children.className="folder-editor-children";renderEditor(item.items,children,s,path);wrap.appendChild(children);
      addEditorButtons(wrap,s,path);
    }
    root.appendChild(wrap);
  });
}
function addEditorButtons(root,s,path=""){
  const bar=document.createElement("div");bar.className="manager-toolbar";
  for(const folder of [false,true]){
    const button=document.createElement("button");button.type="button";button.className="ghost small";button.textContent=folder?"+ Add folder":"+ Add shortcut";
    button.addEventListener("click",()=>{syncManagerInputs();itemsAt(s,path).push(folder?{title:"New folder",subtitle:"",icon:"📁",items:[]}:{title:"New shortcut",subtitle:"",icon:"auto",url:""});renderManager()});bar.appendChild(button);
  }
  root.appendChild(bar);
}
function renderManager(){
  const root=document.getElementById("managerSections");root.innerHTML="";
  config.sections.forEach((section,s)=>{
    const wrap=document.createElement("div");wrap.className="manager-section";
    wrap.innerHTML=`<div class="section-name-row"><input class="section-title" value="${escapeHtml(section.title)}" data-section="${s}" aria-label="Section name"><button type="button" class="danger small remove-section">Remove section</button></div>`;
    wrap.querySelector(".remove-section").addEventListener("click",()=>{syncManagerInputs();config.sections.splice(s,1);renderManager()});
    renderEditor(section.items,wrap,s);addEditorButtons(wrap,s);root.appendChild(wrap);
  });
  root.querySelectorAll(".icon-choice").forEach(select=>select.addEventListener("change",()=>{const input=select.parentElement.querySelector(".icon-input");input.hidden=select.value!=="custom";if(!input.hidden)input.focus()}));
}
function syncManagerInputs(){
  document.querySelectorAll(".section-title").forEach(input=>config.sections[Number(input.dataset.section)].title=input.value);
  document.querySelectorAll(".item-editor").forEach(row=>{
    const item=itemAt(Number(row.dataset.s),row.dataset.path);
    row.querySelectorAll("input[data-field]").forEach(input=>{
      const select=row.querySelector(".icon-choice");
      item[input.dataset.field]=input.dataset.field==="icon"?(select.value==="custom"?(input.value.trim()||"🔗"):select.value):input.value;
    });
  });
}

document.getElementById("manageBtn").addEventListener("click",openManager);
document.getElementById("addSection").addEventListener("click",()=>{syncManagerInputs();config.sections.push({title:"New section",items:[]});renderManager()});
document.getElementById("saveChanges").addEventListener("click",()=>{syncManagerInputs();saveConfig();renderSections(document.getElementById("searchBox").value);document.getElementById("managerDialog").close()});
document.getElementById("resetDefaults").addEventListener("click",()=>{config=clone(exampleConfig);saveConfig();renderManager();renderSections()});
document.getElementById("searchBox").addEventListener("input",e=>renderSections(e.target.value));
document.getElementById("clearSearch").addEventListener("click",()=>{document.getElementById("searchBox").value="";renderSections()});
document.getElementById("clearRecent").addEventListener("click",()=>{localStorage.removeItem(RECENT_KEY);renderRecent()});

document.getElementById("exportConfig").addEventListener("click",()=>{
  syncManagerInputs();
  const blob=new Blob([JSON.stringify(config,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="micro-demessifier-layout.json";a.click();
  URL.revokeObjectURL(url);
});
document.getElementById("importConfig").addEventListener("click",()=>document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change",async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{
    const parsed=JSON.parse(await file.text());
    if(!parsed.sections||!Array.isArray(parsed.sections))throw new Error("Invalid layout");
    config=parsed; saveConfig(); renderManager(); renderSections();
  }catch{alert("That doesn't look like a Micro Demessifier layout file.")}
  e.target.value="";
});

if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"))}
renderSections(); renderRecent();
