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
const SUPABASE_URL="https://zyyzwndmfwlhgpltkocb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_y4QO69KX7_O02I5l1HNXtg_PMa3_NeS";
const SYNC_TABLE="demessifier_data";
const SYNC_POLL_MS=15000;

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
function saveConfigLocal(){localStorage.setItem(KEY,JSON.stringify(config))}
function getRecent(){try{return JSON.parse(localStorage.getItem(RECENT_KEY))||[]}catch{return[]}}
function addRecent(item){
  const old=getRecent().filter(x=>x.url!==item.url);
  localStorage.setItem(RECENT_KEY,JSON.stringify([{title:item.title,url:item.url},...old].slice(0,10)));
  renderRecent();
}

let supabaseClient=null;
let currentUser=null;
let lastCloudUpdatedAt=null;
let syncTimer=null;
let syncBusy=false;

function setSyncStatus(message,state=""){
  const el=document.getElementById("syncStatus");
  if(!el)return;
  el.textContent=message;
  el.dataset.state=state;
}
function renderAuthState(){
  const signedIn=!!currentUser;
  document.getElementById("signedOutControls").hidden=signedIn;
  document.getElementById("signedInControls").hidden=!signedIn;
  if(signedIn){
    document.getElementById("signedInEmail").textContent=currentUser.email||"Signed in";
  }
}
function validCloudConfig(value){return value&&Array.isArray(value.sections)}

async function initSupabase(){
  if(!window.supabase?.createClient){
    setSyncStatus("Cloud sync unavailable: Supabase library did not load.","error");
    return;
  }
  supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
  const {data:{session}}=await supabaseClient.auth.getSession();
  currentUser=session?.user||null;
  renderAuthState();
  if(currentUser){
    setSyncStatus("Signing in to sync…","working");
    await loadCloudConfig({firstLoad:true});
    startSyncPolling();
  }else{
    setSyncStatus("Not signed in — this device is using its local copy.","local");
  }
  supabaseClient.auth.onAuthStateChange(async (event,sessionNow)=>{
    const nextUser=sessionNow?.user||null;
    const changed=nextUser?.id!==currentUser?.id;
    currentUser=nextUser;
    renderAuthState();
    if(currentUser&&changed){
      setSyncStatus("Signed in. Connecting your layout…","working");
      await loadCloudConfig({firstLoad:true});
      startSyncPolling();
    }
    if(!currentUser){
      stopSyncPolling();
      lastCloudUpdatedAt=null;
      setSyncStatus("Not signed in — this device is using its local copy.","local");
    }
  });
}

async function loadCloudConfig({firstLoad=false}={}){
  if(!supabaseClient||!currentUser||syncBusy)return;
  if(document.getElementById("managerDialog")?.open&&!firstLoad)return;
  syncBusy=true;
  try{
    const {data,error}=await supabaseClient
      .from(SYNC_TABLE)
      .select("data,updated_at")
      .eq("user_id",currentUser.id)
      .order("updated_at",{ascending:false})
      .limit(1);
    if(error)throw error;
    const row=data?.[0];
    if(!row){
      await saveCloudConfig({forceInsert:true});
      setSyncStatus("Synced — this device's layout is now your cloud copy.","synced");
      return;
    }
    const cloudTime=row.updated_at?Date.parse(row.updated_at):0;
    const knownTime=lastCloudUpdatedAt?Date.parse(lastCloudUpdatedAt):0;
    if(firstLoad||cloudTime>knownTime){
      if(validCloudConfig(row.data)){
        config=clone(row.data);
        saveConfigLocal();
        renderSections(document.getElementById("searchBox").value);
        if(document.getElementById("managerDialog")?.open)renderManager();
      }
      lastCloudUpdatedAt=row.updated_at||lastCloudUpdatedAt;
    }
    setSyncStatus(`Synced as ${currentUser.email||"your account"}.`,"synced");
  }catch(err){
    console.error("Cloud load failed",err);
    setSyncStatus(`Sync problem: ${err.message||"could not load cloud data"}. Local copy is still safe.`,"error");
  }finally{syncBusy=false}
}

async function saveCloudConfig({forceInsert=false}={}){
  if(!supabaseClient||!currentUser)return false;
  const now=new Date().toISOString();
  try{
    let updatedRows=[];
    if(!forceInsert){
      const {data,error}=await supabaseClient
        .from(SYNC_TABLE)
        .update({data:config,updated_at:now})
        .eq("user_id",currentUser.id)
        .select("id");
      if(error)throw error;
      updatedRows=data||[];
    }
    if(forceInsert||!updatedRows.length){
      const {error}=await supabaseClient
        .from(SYNC_TABLE)
        .insert({user_id:currentUser.id,data:config,updated_at:now});
      if(error)throw error;
    }
    lastCloudUpdatedAt=now;
    setSyncStatus(`Synced as ${currentUser.email||"your account"}.`,"synced");
    return true;
  }catch(err){
    console.error("Cloud save failed",err);
    setSyncStatus(`Saved on this device, but cloud sync failed: ${err.message||"unknown error"}.`,"error");
    return false;
  }
}
async function saveConfig(){
  saveConfigLocal();
  if(currentUser){
    setSyncStatus("Saving to cloud…","working");
    await saveCloudConfig();
  }
}
function startSyncPolling(){
  stopSyncPolling();
  syncTimer=setInterval(()=>loadCloudConfig(),SYNC_POLL_MS);
}
function stopSyncPolling(){if(syncTimer){clearInterval(syncTimer);syncTimer=null}}

async function signIn(){
  const email=document.getElementById("authEmail").value.trim();
  const password=document.getElementById("authPassword").value;
  if(!email||!password){setSyncStatus("Enter your email and password first.","error");return}
  setSyncStatus("Signing in…","working");
  const {error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error)setSyncStatus(`Sign-in failed: ${error.message}`,"error");
}
async function createAccount(){
  const email=document.getElementById("authEmail").value.trim();
  const password=document.getElementById("authPassword").value;
  if(!email||!password){setSyncStatus("Enter an email and password first.","error");return}
  setSyncStatus("Creating account…","working");
  const {data,error}=await supabaseClient.auth.signUp({email,password});
  if(error){setSyncStatus(`Account setup failed: ${error.message}`,"error");return}
  if(data.session){setSyncStatus("Account created and signed in.","synced")}
  else setSyncStatus("Account created. Check your email to confirm it, then return here and sign in.","working");
}
async function signOut(){
  if(!supabaseClient)return;
  await supabaseClient.auth.signOut();
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
      ${Array.isArray(item.items)?'<div class="folder-kind-actions"><span class="folder-label">Folder</span></div>':`<input data-field="url" class="url-input" type="url" aria-label="Link URL" value="${escapeHtml(item.url||"")}" placeholder="https://…">`}
      <button type="button" class="ghost small move-item">Move…</button>
      <button type="button" class="danger small remove-item" aria-label="Remove item">×</button>`;
    row.querySelector(".remove-item").addEventListener("click",()=>{
      if(Array.isArray(item.items)&&item.items.length&&!confirm("Remove this folder and all its links?"))return;
      syncManagerInputs();itemsAt(s,parent).splice(i,1);renderManager();
    });
    const moveButton=row.querySelector(".move-item");
    if(moveButton)moveButton.addEventListener("click",()=>{syncManagerInputs();openMoveItemDialog(s,path)});
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
let pendingItemMove=null;
function itemDestinations(){
  const out=[];
  config.sections.forEach((section,s)=>{
    out.push({s,path:"",label:section.title||`Section ${s+1}`,items:section.items});
    const walk=(items,parentPath,labelParts)=>{
      items.forEach((item,i)=>{
        if(!Array.isArray(item.items))return;
        const path=parentPath?`${parentPath}.${i}`:String(i);
        const parts=[...labelParts,item.title||"Untitled folder"];
        out.push({s,path,label:`${section.title} / ${parts.join(" / ")}`,items:item.items});
        walk(item.items,path,parts);
      });
    };
    walk(section.items,"",[]);
  });
  return out;
}
function openMoveItemDialog(s,path){
  const source=itemAt(s,path);
  if(!source)return;
  const isFolder=Array.isArray(source.items);
  const parentPath=path.includes(".")?path.slice(0,path.lastIndexOf(".")):"";
  const select=document.getElementById("moveItemDestination");
  select.innerHTML="";
  itemDestinations().forEach(dest=>{
    if(dest.s===s){
      if(dest.path===parentPath)return; // already there
      if(isFolder){
        if(dest.path===path)return;
        if(dest.path&&dest.path.startsWith(path+"."))return; // cannot move a folder into itself/descendant
      }
    }
    const option=document.createElement("option");
    option.value=`${dest.s}|${dest.path}`;
    option.textContent=dest.label;
    select.appendChild(option);
  });
  if(!select.options.length){
    alert("There isn't another folder or section to move this item into yet.");
    return;
  }
  pendingItemMove={s,path,title:source.title||(isFolder?"Folder":"Shortcut"),isFolder};
  document.getElementById("moveItemTitle").textContent=`Move “${pendingItemMove.title}”`;
  document.getElementById("moveItemCopy").textContent=isFolder
    ? "The folder and everything inside it will move together."
    : "This shortcut will move to the destination you choose.";
  document.getElementById("confirmMoveItem").textContent=isFolder?"Move folder":"Move shortcut";
  document.getElementById("moveItemDialog").showModal();
}
function performItemMove(){
  if(!pendingItemMove)return;
  syncManagerInputs();
  const {s,path}=pendingItemMove;
  const source=itemAt(s,path);
  if(!source){pendingItemMove=null;return}
  const value=document.getElementById("moveItemDestination").value;
  const [destSRaw,destPath=""]=value.split("|");
  const destS=Number(destSRaw);
  // Take a reference to the destination array before removing the source so same-section index shifts don't matter.
  const destinationItems=destPath?itemAt(destS,destPath).items:config.sections[destS].items;
  const parentPath=path.includes(".")?path.slice(0,path.lastIndexOf(".")):"";
  const sourceItems=itemsAt(s,parentPath);
  const sourceIndex=Number(path.split(".").pop());
  const [moved]=sourceItems.splice(sourceIndex,1);
  destinationItems.push(moved);
  pendingItemMove=null;
  document.getElementById("moveItemDialog").close();
  renderManager();
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

document.getElementById("confirmMoveItem").addEventListener("click",performItemMove);
document.getElementById("manageBtn").addEventListener("click",openManager);
document.getElementById("addSection").addEventListener("click",()=>{syncManagerInputs();config.sections.push({title:"New section",items:[]});renderManager()});
document.getElementById("saveChanges").addEventListener("click",async()=>{syncManagerInputs();await saveConfig();renderSections(document.getElementById("searchBox").value);document.getElementById("managerDialog").close()});
document.getElementById("resetDefaults").addEventListener("click",async()=>{if(!confirm("Replace your current layout with the example layout?"))return;config=clone(exampleConfig);await saveConfig();renderManager();renderSections()});
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
    config=parsed; await saveConfig(); renderManager(); renderSections();
  }catch{alert("That doesn't look like a Micro Demessifier layout file.")}
  e.target.value="";
});

document.getElementById("signInBtn").addEventListener("click",signIn);
document.getElementById("createAccountBtn").addEventListener("click",createAccount);
document.getElementById("signOutBtn").addEventListener("click",signOut);
document.getElementById("syncNowBtn").addEventListener("click",()=>loadCloudConfig({firstLoad:true}));
document.getElementById("authPassword").addEventListener("keydown",e=>{if(e.key==="Enter")signIn()});
window.addEventListener("focus",()=>{if(currentUser)loadCloudConfig()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&currentUser)loadCloudConfig()});

if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"))}
renderSections(); renderRecent(); renderAuthState(); initSupabase();
