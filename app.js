
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

function loadConfig(){try{return JSON.parse(localStorage.getItem(KEY))||clone(exampleConfig)}catch{return clone(exampleConfig)}}
let config=loadConfig();
function saveConfig(){localStorage.setItem(KEY,JSON.stringify(config))}
function getRecent(){try{return JSON.parse(localStorage.getItem(RECENT_KEY))||[]}catch{return[]}}
function addRecent(item){
  const old=getRecent().filter(x=>x.url!==item.url);
  localStorage.setItem(RECENT_KEY,JSON.stringify([{title:item.title,url:item.url},...old].slice(0,10)));
  renderRecent();
}

function renderSections(filter=""){
  const root=document.getElementById("sections"); root.innerHTML="";
  const q=filter.trim().toLowerCase();
  config.sections.forEach(section=>{
    const items=section.items.filter(item=>!q||item.title.toLowerCase().includes(q)||(item.subtitle||"").toLowerCase().includes(q)||(item.url||"").toLowerCase().includes(q));
    if(q&&!items.length)return;
    const card=document.createElement("section");
    card.className="section-card";
    card.innerHTML=`<div class="eyebrow">COLLECTION</div><h2>${escapeHtml(section.title)}</h2><div class="link-grid"></div>`;
    const grid=card.querySelector(".link-grid");
    items.forEach(item=>{
      const a=document.createElement("a");
      a.className="link-item"; a.href=item.url||"#";
      if(item.url){a.target="_blank";a.rel="noopener"}
      a.innerHTML=`<div class="link-icon">${escapeHtml(item.icon||"🔗")}</div>
        <div class="link-copy"><div class="link-title">${escapeHtml(item.title)}</div>
        <div class="link-sub">${escapeHtml(item.url?(item.subtitle||item.url):"Add link in Organize")}</div></div>`;
      a.addEventListener("click",e=>{if(!item.url){e.preventDefault();openManager()}else addRecent(item)});
      grid.appendChild(a);
    });
    root.appendChild(card);
  });
  if(!root.children.length)root.innerHTML=`<section class="section-card"><span class="empty">No matching shortcuts.</span></section>`;
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

function renderManager(){
  const root=document.getElementById("managerSections"); root.innerHTML="";
  config.sections.forEach((section,sIndex)=>{
    const wrap=document.createElement("div"); wrap.className="manager-section";
    wrap.innerHTML=`<div class="section-name-row">
      <input class="section-title" value="${escapeHtml(section.title)}" data-section="${sIndex}" aria-label="Section name">
      <button type="button" class="danger small remove-section" data-section="${sIndex}">Remove section</button>
      </div><div class="items-editor"></div>
      <button type="button" class="ghost small add-item" data-section="${sIndex}">+ Add shortcut</button>`;
    const itemsRoot=wrap.querySelector(".items-editor");
    section.items.forEach((item,iIndex)=>{
      const row=document.createElement("div"); row.className="item-editor";
      row.innerHTML=`<input class="icon-input" value="${escapeHtml(item.icon||"🔗")}" data-s="${sIndex}" data-i="${iIndex}" data-field="icon" aria-label="Icon">
        <input class="title-input" value="${escapeHtml(item.title)}" data-s="${sIndex}" data-i="${iIndex}" data-field="title" placeholder="Name">
        <input class="subtitle-input" value="${escapeHtml(item.subtitle||"")}" data-s="${sIndex}" data-i="${iIndex}" data-field="subtitle" placeholder="Description">
        <input class="url-input" type="url" value="${escapeHtml(item.url||"")}" data-s="${sIndex}" data-i="${iIndex}" data-field="url" placeholder="https://…">
        <button type="button" class="danger small remove-item" data-s="${sIndex}" data-i="${iIndex}">×</button>`;
      itemsRoot.appendChild(row);
    });
    root.appendChild(wrap);
  });

  root.querySelectorAll(".add-item").forEach(btn=>btn.addEventListener("click",()=>{
    syncManagerInputs(); const s=Number(btn.dataset.section);
    config.sections[s].items.push({title:"New shortcut",subtitle:"",icon:"🔗",url:""}); renderManager();
  }));
  root.querySelectorAll(".remove-item").forEach(btn=>btn.addEventListener("click",()=>{
    syncManagerInputs(); config.sections[Number(btn.dataset.s)].items.splice(Number(btn.dataset.i),1); renderManager();
  }));
  root.querySelectorAll(".remove-section").forEach(btn=>btn.addEventListener("click",()=>{
    syncManagerInputs(); config.sections.splice(Number(btn.dataset.section),1); renderManager();
  }));
}

function syncManagerInputs(){
  document.querySelectorAll(".section-title").forEach(input=>config.sections[Number(input.dataset.section)].title=input.value);
  document.querySelectorAll(".item-editor input[data-field]").forEach(input=>{
    config.sections[Number(input.dataset.s)].items[Number(input.dataset.i)][input.dataset.field]=input.value;
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
