// Parc véhicules — SAMU 74
// Drag & drop + statuts + fiche panne
// Stockage localStorage

const STORAGE_KEY = "fleet_v1";

const VEHICLES_MASTER = [
  { id:"VLM1", name:"VLM 1", type:"VLM" },
  { id:"VLM2", name:"VLM 2", type:"VLM" },
  { id:"VLM3", name:"VLM 3", type:"VLM" },
  { id:"VLM4", name:"VLM 4", type:"VLM" },
  { id:"UMH1", name:"UMH 1", type:"UMH" },
  { id:"UMH2", name:"UMH 2", type:"UMH" },
  { id:"UMH3", name:"UMH 3", type:"UMH" },
  { id:"UMHSJU", name:"UMH SJU", type:"UMH" },
  { id:"UMHTIB", name:"UMH TIB", type:"UMH" },
];

const TEAMS = [
  { id:"E1", name:"Équipe 1" },
  { id:"E2", name:"Équipe 2" },
  { id:"SJU", name:"Saint Julien" },
];

const $teams = document.getElementById("teams");
const $reserve = document.getElementById("reserveList");

const $countDispo = document.getElementById("countDispo");
const $countIndispo = document.getElementById("countIndispo");
const $countReserve = document.getElementById("countReserve");

// Modal
const $modalWrap = document.getElementById("modalWrap");
const $modalTitle = document.getElementById("modalTitle");
const $modalSub = document.getElementById("modalSub");
const $closeModal = document.getElementById("closeModal");
const $savePanneBtn = document.getElementById("savePanneBtn");
const $cancelPanneBtn = document.getElementById("cancelPanneBtn");

const $pDate = document.getElementById("pDate");
const $pImmobil = document.getElementById("pImmobil");
const $pDesc = document.getElementById("pDesc");
const $pAction = document.getElementById("pAction");
const $pContact = document.getElementById("pContact");

let state = null;

/**
 * state = {
 *   vehicles: {
 *     [id]: { status:"DISPO"|"INDISPO", team:null|"E1"|"E2"|"SJU", slot:null|"VLM"|"UMH", pannes:[...] }
 *   }
 * }
 */

function nowLocalInputValue(){
  const d = new Date();
  const pad = n => String(n).padStart(2,"0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function load(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{
      state = JSON.parse(raw);
      // sécurité si master change
      for(const v of VEHICLES_MASTER){
        if(!state.vehicles[v.id]){
          state.vehicles[v.id] = { status:"DISPO", team:null, slot:null, pannes:[] };
        }
      }
      return;
    }catch{}
  }

  state = { vehicles:{} };
  for(const v of VEHICLES_MASTER){
    state.vehicles[v.id] = { status:"DISPO", team:null, slot:null, pannes:[] };
  }
  save();
}

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getVehicleDef(id){
  return VEHICLES_MASTER.find(v => v.id === id);
}

function assignedVehicle(teamId, slot){
  const entries = Object.entries(state.vehicles);
  const found = entries.find(([vid, meta]) => meta.team === teamId && meta.slot === slot);
  return found ? found[0] : null;
}

function setAssignment(vehId, teamId, slot){
  // retire l'occupant actuel du slot (si existe)
  const occupant = assignedVehicle(teamId, slot);
  if(occupant && occupant !== vehId){
    state.vehicles[occupant].team = null;
    state.vehicles[occupant].slot = null;
  }

  // affecte
  state.vehicles[vehId].team = teamId;
  state.vehicles[vehId].slot = slot;
}

function clearAssignment(vehId){
  state.vehicles[vehId].team = null;
  state.vehicles[vehId].slot = null;
}

function badgeFor(vehId){
  const m = state.vehicles[vehId];
  if(m.status === "INDISPO") return { cls:"bIndispo", label:"Indispo" };
  if(!m.team) return { cls:"bReserve", label:"Réserve" };
  return { cls:"bDispo", label:"Dispo" };
}

function canDrag(vehId){
  const m = state.vehicles[vehId];
  return m.status === "DISPO";
}

function render(){
  // Teams
  $teams.innerHTML = TEAMS.map(t => {
    return `
      <div class="teamCard">
        <div class="teamTitle">
          <span>${t.name}</span>
          <span class="hint">${t.id}</span>
        </div>

        <div class="slots">
          ${slotHTML(t.id, "VLM")}
          ${slotHTML(t.id, "UMH")}
        </div>
      </div>
    `;
  }).join("");

  // Drop targets listeners
  document.querySelectorAll("[data-drop]").forEach(el => {
    el.addEventListener("dragover", e => {
      e.preventDefault();
      el.classList.add("dropHover");
    });
    el.addEventListener("dragleave", () => el.classList.remove("dropHover"));
    el.addEventListener("drop", e => {
      e.preventDefault();
      el.classList.remove("dropHover");
      const vehId = e.dataTransfer.getData("text/plain");
      if(!vehId) return;
      if(!canDrag(vehId)) return;

      const teamId = el.dataset.team;
      const slot = el.dataset.slot;
      const vDef = getVehicleDef(vehId);
      if(!vDef) return;

      // only matching types into slots
      if(vDef.type !== slot) return;

      setAssignment(vehId, teamId, slot);
      save();
      render();
    });
  });

  // Reserve list
  const reserveIds = VEHICLES_MASTER
    .map(v => v.id)
    .filter(id => !state.vehicles[id].team);

  if(reserveIds.length === 0){
    $reserve.innerHTML = `<div class="hint">Aucun véhicule en réserve.</div>`;
  }else{
    $reserve.innerHTML = reserveIds.map(id => vehicleCardHTML(id)).join("");
  }

  // Attach card events (teams + reserve)
  document.querySelectorAll("[data-veh]").forEach(card => {
    const vehId = card.dataset.veh;

    // drag
    card.setAttribute("draggable", canDrag(vehId) ? "true" : "false");
    if(canDrag(vehId)){
      card.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", vehId);
        e.dataTransfer.effectAllowed = "move";
      });
    }

    // buttons
    const toggleBtn = card.querySelector("[data-toggle]");
    const reserveBtn = card.querySelector("[data-reserve]");
    const panneBtn = card.querySelector("[data-panne]");

    if(toggleBtn){
      toggleBtn.addEventListener("click", () => {
        const m = state.vehicles[vehId];
        if(m.status === "DISPO"){
          // passer Indispo -> fiche panne obligatoire
          openPanneModal(vehId);
        }else{
          m.status = "DISPO";
          save();
          render();
        }
      });
    }

    if(reserveBtn){
      reserveBtn.addEventListener("click", () => {
        // remettre en réserve
        if(state.vehicles[vehId].status !== "DISPO"){
          alert("Passe le véhicule en DISPO avant de le remettre en réserve.");
          return;
        }
        clearAssignment(vehId);
        save();
        render();
      });
    }

    if(panneBtn){
      panneBtn.addEventListener("click", () => {
        showPannes(vehId);
      });
    }
  });

  // Counters
  const allIds = VEHICLES_MASTER.map(v => v.id);
  const dispo = allIds.filter(id => state.vehicles[id].status === "DISPO").length;
  const indispo = allIds.filter(id => state.vehicles[id].status === "INDISPO").length;
  const reserve = allIds.filter(id => !state.vehicles[id].team).length;

  $countDispo.textContent = `${dispo}`;
  $countIndispo.textContent = `${indispo}`;
  $countReserve.textContent = `${reserve}`;
}

function slotHTML(teamId, slot){
  const vehId = assignedVehicle(teamId, slot);
  const content = vehId ? vehicleCardHTML(vehId, { inSlot:true }) : `<div class="hint">Dépose un ${slot} ici</div>`;
  return `
    <div class="slot" data-drop="1" data-team="${teamId}" data-slot="${slot}">
      <div class="slotHdr">
        <div class="slotLabel">${slot}</div>
        <div class="slotHint">${teamId}</div>
      </div>
      ${content}
    </div>
  `;
}

function vehicleCardHTML(vehId, { inSlot=false } = {}){
  const def = getVehicleDef(vehId);
  const meta = state.vehicles[vehId];
  const b = badgeFor(vehId);

  const teamLabel = meta.team ? `${meta.team} / ${meta.slot}` : "Réserve";
  const panneCount = (meta.pannes || []).length;

  const dragHint = canDrag(vehId) ? "Glisser" : "Bloqué (indispo)";
  const toggleLabel = (meta.status === "DISPO") ? "Indispo" : "Dispo";

  return `
    <div class="veh" data-veh="${vehId}">
      <div class="vehMain">
        <div class="vehName">${def.name}</div>
        <div class="vehMeta">
          <span>${def.type}</span>
          <span>•</span>
          <span>${teamLabel}</span>
          <span>•</span>
          <span>${dragHint}</span>
        </div>
      </div>

      <div class="vehActions">
        <div class="badge ${b.cls}">
          <span class="dot"></span>
          <span>${b.label}</span>
        </div>

        <button class="miniBtn" data-toggle="1">${toggleLabel}</button>
        ${inSlot ? `<button class="miniBtn" data-reserve="1">Réserve</button>` : ``}
        <button class="miniBtn" data-panne="1">Pannes (${panneCount})</button>
      </div>
    </div>
  `;
}

let modalVehId = null;

function openPanneModal(vehId){
  modalVehId = vehId;
  const def = getVehicleDef(vehId);

  $modalTitle.textContent = "Fiche panne";
  $modalSub.textContent = `${def.name} • Passage en INDISPO`;

  $pDate.value = nowLocalInputValue();
  $pImmobil.value = "";
  $pDesc.value = "";
  $pAction.value = "";
  $pContact.value = "";

  $modalWrap.classList.add("open");
  $modalWrap.setAttribute("aria-hidden", "false");
}

function closeModal(){
  modalVehId = null;
  $modalWrap.classList.remove("open");
  $modalWrap.setAttribute("aria-hidden", "true");
}

$closeModal.addEventListener("click", closeModal);
$modalWrap.addEventListener("click", (e) => {
  if(e.target === $modalWrap) closeModal();
});

// Enregistrer panne -> passe le véhicule INDISPO
$savePanneBtn.addEventListener("click", () => {
  if(!modalVehId) return;

  const desc = ($pDesc.value || "").trim();
  if(desc.length < 3){
    alert("Mets au moins une description courte de la panne.");
    return;
  }

  const m = state.vehicles[modalVehId];
  m.status = "INDISPO";
  m.pannes = m.pannes || [];
  m.pannes.unshift({
    date: $pDate.value || nowLocalInputValue(),
    immobil: ($pImmobil.value || "").trim(),
    desc,
    action: ($pAction.value || "").trim(),
    contact: ($pContact.value || "").trim(),
  });

  save();
  closeModal();
  render();
});

// Annuler -> reste DISPO (ne change rien)
$cancelPanneBtn.addEventListener("click", () => {
  closeModal();
});

function showPannes(vehId){
  const def = getVehicleDef(vehId);
  const m = state.vehicles[vehId];
  const list = (m.pannes || []);

  if(list.length === 0){
    alert(`${def.name} : aucune panne enregistrée.`);
    return;
  }

  // affichage simple (lisible, rapide)
  const lines = list.slice(0, 8).map((p, i) => {
    const d = p.date || "";
    const im = p.immobil ? ` • Immobilisation: ${p.immobil}` : "";
    const ac = p.action ? ` • Action: ${p.action}` : "";
    const ct = p.contact ? ` • Contact: ${p.contact}` : "";
    return `#${i+1} — ${d}${im}\n${p.desc}${ac}${ct}`;
  });

  alert(`${def.name} — Historique pannes\n\n${lines.join("\n\n---\n\n")}`);
}

// Init
load();
render();