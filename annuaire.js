const KEY = "annuaire_v1";

let contacts = []; // {id, name, cat, tel, note, createdAt}
let editingId = null;

const $ = (id) => document.getElementById(id);

const q = $("q");
const cat = $("cat");
const list = $("list");
const countLine = $("countLine");

const modal = $("modal");
const importModal = $("importModal");

const fName = $("fName");
const fCat = $("fCat");
const fTel = $("fTel");
const fNote = $("fNote");

const modalTitle = $("modalTitle");
const deleteBtn = $("deleteBtn");

function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function cleanTel(s){
  // garde + et chiffres
  const raw = String(s || "").trim();
  const plus = raw.startsWith("+") ? "+" : "";
  const digits = raw.replace(/[^\d]/g, "");
  return plus + digits;
}

function prettyTel(raw){
  // format FR simple si 10 chiffres
  const t = cleanTel(raw);
  if(t.startsWith("+")) return t;
  if(t.length === 10){
    return t.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  return raw || "";
}

function save(){
  localStorage.setItem(KEY, JSON.stringify(contacts));
}

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    contacts = raw ? JSON.parse(raw) : [];
  }catch{
    contacts = [];
  }
}

function catColor(c){
  // simple mapping visuel
  const map = {
    "Régulation": "pYellow",
    "SMUR": "pGreen",
    "SAU": "pBlue",
    "Réanimation": "pRed",
    "Bloc": "pBlue",
    "Imagerie": "pBlue",
    "Laboratoire": "pYellow",
    "Ambulances": "pGreen",
    "Police / Gendarmerie": "pRed",
    "Pompier": "pRed",
    "Autre": "pBlue"
  };
  return map[c] || "pBlue";
}

function render(){
  const needle = (q.value || "").trim().toLowerCase();
  const catFilter = cat.value || "";

  const filtered = contacts
    .filter(c => !catFilter || c.cat === catFilter)
    .filter(c => {
      if(!needle) return true;
      const blob = `${c.name} ${c.cat} ${c.tel} ${c.note || ""}`.toLowerCase();
      return blob.includes(needle);
    })
    .sort((a,b) => (a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name)));

  countLine.textContent = `${filtered.length} contact(s) affiché(s) • ${contacts.length} au total`;

  if(filtered.length === 0){
    list.innerHTML = `<div class="hint">Aucun résultat. Ajoute un contact avec “+ Ajouter”.</div>`;
    return;
  }

  list.innerHTML = filtered.map(c => {
    const cls = catColor(c.cat);
    const telClean = cleanTel(c.tel);
    const telPretty = prettyTel(c.tel);

    return `
      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemName">${escapeHTML(c.name)}</div>
            <div class="itemMeta">${escapeHTML(c.cat)} • ${escapeHTML(telPretty)}${c.note ? ` • ${escapeHTML(c.note)}` : ""}</div>
          </div>
          <div class="tag ${cls}">
            <span class="dot"></span>
            <span>${escapeHTML(c.cat)}</span>
          </div>
        </div>

        <div class="actions">
          <a class="aBtn" href="tel:${telClean}">Appeler</a>
          <button class="aBtn secondary" data-copy="${escapeAttr(telClean)}">Copier</button>
          <button class="aBtn secondary" data-edit="${escapeAttr(c.id)}">Éditer</button>
        </div>
      </div>
    `;
  }).join("");

  // handlers
  list.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openEdit(btn.dataset.edit));
  });
  list.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const val = btn.dataset.copy || "";
      try{
        await navigator.clipboard.writeText(val);
        btn.textContent = "Copié ✅";
        setTimeout(()=> btn.textContent = "Copier", 900);
      }catch{
        alert("Copie impossible sur ce navigateur. Sélectionne le numéro et copie manuellement.");
      }
    });
  });
}

function openAdd(){
  editingId = null;
  modalTitle.textContent = "Ajouter un contact";
  deleteBtn.style.display = "none";
  fName.value = "";
  fCat.value = "Régulation";
  fTel.value = "";
  fNote.value = "";
  showModal(modal, true);
}

function openEdit(id){
  const c = contacts.find(x => x.id === id);
  if(!c) return;
  editingId = id;
  modalTitle.textContent = "Modifier un contact";
  deleteBtn.style.display = "";
  fName.value = c.name || "";
  fCat.value = c.cat || "Autre";
  fTel.value = c.tel || "";
  fNote.value = c.note || "";
  showModal(modal, true);
}

function upsert(){
  const name = (fName.value || "").trim();
  const catVal = (fCat.value || "").trim() || "Autre";
  const telVal = (fTel.value || "").trim();
  const note = (fNote.value || "").trim();

  if(!name){
    alert("Nom / Service obligatoire.");
    return;
  }
  if(!cleanTel(telVal)){
    alert("Numéro invalide. Mets au moins des chiffres.");
    return;
  }

  if(editingId){
    const idx = contacts.findIndex(x => x.id === editingId);
    if(idx >= 0){
      contacts[idx] = { ...contacts[idx], name, cat: catVal, tel: telVal, note };
    }
  }else{
    contacts.push({ id: uid(), name, cat: catVal, tel: telVal, note, createdAt: Date.now() });
  }

  save();
  showModal(modal, false);
  render();
}

function removeCurrent(){
  if(!editingId) return;
  const c = contacts.find(x => x.id === editingId);
  if(!c) return;
  if(confirm(`Supprimer "${c.name}" ?`)){
    contacts = contacts.filter(x => x.id !== editingId);
    save();
    showModal(modal, false);
    render();
  }
}

function exportJSON(){
  const data = JSON.stringify(contacts, null, 2);
  // iOS-friendly: copie dans presse-papier + affiche
  navigator.clipboard?.writeText(data).then(()=>{
    alert("Export copié dans le presse-papier ✅\nColle-le dans Notes / Drive pour sauvegarder.");
  }).catch(()=>{
    // fallback: prompt
    prompt("Copie ce JSON :", data);
  });
}

function openImport(){
  $("importArea").value = "";
  showModal(importModal, true);
}

function doImport(){
  const raw = ($("importArea").value || "").trim();
  if(!raw) return;

  try{
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr)) throw new Error("Format invalide");

    // normalisation + fusion (évite doublons id)
    const existingIds = new Set(contacts.map(c => c.id));
    let added = 0;

    arr.forEach(c => {
      if(!c || typeof c !== "object") return;
      const name = String(c.name || "").trim();
      const catVal = String(c.cat || "Autre").trim() || "Autre";
      const telVal = String(c.tel || "").trim();
      const note = String(c.note || "").trim();

      if(!name || !cleanTel(telVal)) return;

      let id = String(c.id || "").trim();
      if(!id || existingIds.has(id)) id = uid();

      contacts.push({ id, name, cat: catVal, tel: telVal, note, createdAt: c.createdAt || Date.now() });
      existingIds.add(id);
      added++;
    });

    save();
    showModal(importModal, false);
    render();
    alert(`Import terminé ✅ (${added} ajouté(s))`);
  }catch(e){
    alert("JSON invalide. Vérifie que tu colles bien l’export complet.");
  }
}

function showModal(el, on){
  if(on){
    el.classList.add("show");
    el.setAttribute("aria-hidden","false");
  }else{
    el.classList.remove("show");
    el.setAttribute("aria-hidden","true");
  }
}

function escapeHTML(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function escapeAttr(s){ return escapeHTML(s).replaceAll('"',"&quot;"); }

// Events
$("addBtn").addEventListener("click", openAdd);
$("saveBtn").addEventListener("click", upsert);
$("deleteBtn").addEventListener("click", removeCurrent);
$("closeModal").addEventListener("click", () => showModal(modal,false));

$("exportBtn").addEventListener("click", exportJSON);
$("importBtn").addEventListener("click", openImport);
$("doImport").addEventListener("click", doImport);
$("closeImport").addEventListener("click", () => showModal(importModal,false));
$("cancelImport").addEventListener("click", () => showModal(importModal,false));

[q, cat].forEach(el => el.addEventListener("input", render));

// Init
load();
render();