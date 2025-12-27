import { safeJSONParse, clamp } from "./shared.js";

const KEY = "fleet_state_v2";

const TEAMS = [
  { id:"E1", name:"Équipe 1", code:"E1" },
  { id:"E2", name:"Équipe 2", code:"E2" },
  { id:"SJU", name:"Saint Julien", code:"SJU" },
];

const DEFAULT_VEHICLES = [
  // ✅ VLM (ajout VLM SJU)
  { id:"VLM1",  type:"VLM", name:"VLM 1" },
  { id:"VLM2",  type:"VLM", name:"VLM 2" },
  { id:"VLM3",  type:"VLM", name:"VLM 3" },
  { id:"VLM4",  type:"VLM", name:"VLM 4" },
  { id:"VLMSJU",type:"VLM", name:"VLM SJU" },

  // UMH
  { id:"UMH1",  type:"UMH", name:"UMH 1" },
  { id:"UMH2",  type:"UMH", name:"UMH 2" },
  { id:"UMH3",  type:"UMH", name:"UMH 3" },
  { id:"UMHSJU",type:"UMH", name:"UMH SJU" },
  { id:"UMHTIB",type:"UMH", name:"UMH TIB" },
];

function uid(prefix="P"){
  return prefix + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function nowISO(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/**
 * State shape:
 * {
 *   vehicles: {
 *     VLM1: { status:"DISPO"|"INDISPO", team:null|"E1"|"E2"|"SJU", slot:null|"VLM"|"UMH", pannes:[{id, when, title, desc}] }
 *   },
 *   reserveFilter: "ALL"|"VLM"|"UMH"
 * }
 */
function defaultState(){
  const vehicles = {};
  for(const v of DEFAULT_VEHICLES){
    vehicles[v.id] = {
      status: "DISPO",
      team: null,
      slot: null,
      pannes: []
    };
  }
  // par défaut tout en réserve (non affectés)
  return { vehicles, reserveFilter:"ALL" };
}

function loadState(){
  const raw = localStorage.getItem(KEY);
  if(!raw) return defaultState();
  const s = safeJSONParse(raw, null);
  if(!s || !s.vehicles) return defaultState();

  // merge si nouveaux véhicules (ex: VLM SJU)
  const base = defaultState();
  const merged = {
    reserveFilter: s.reserveFilter || "ALL",
    vehicles: { ...base.vehicles, ...s.vehicles }
  };
  // garantie champs
  for(const id of Object.keys(merged.vehicles)){
    const v = merged.vehicles[id];
    v.status = (v.status === "INDISPO") ? "INDISPO" : "DISPO";
    v.team = v.team ?? null;
    v.slot = v.slot ?? null;
    v.pannes = Array.isArray(v.pannes) ? v.pannes : [];
  }
  return merged;
}

function saveState(){
  localStorage.setItem(KEY, JSON.stringify(state));
}

let state = loadState();

const teamsEl = document.getElementById("teams");
const reserveEl = document.getElementById("reserveList");

const kpiDispo = document.getElementById("kpiDispo");
const kpiIndispo = document.getElementById("kpiIndispo");
const kpiReserve = document.getElementById("kpiReserve");

const filterAll = document.getElementById("filterAll");
const filterVLM = document.getElementById("filterVLM");
const filterUMH = document.getElementById("filterUMH");

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalSub = document.getElementById("modalSub");
const modalBody = document.getElementById("modalBody");
const modalFoot = document.getElementById("modalFoot");
const modalClose = document.getElementById("modalClose");

let modalCtx = null; // { vehicleId, mode:"actions"|"pannes"|"panneEdit", panneId? }

function vehicleDef(id){
  return DEFAULT_VEHICLES.find(v => v.id === id);
}

function pill(status, isReserve){
  if(isReserve) return `<span class="pill reserve"><span class="dot"></span>Réserve</span>`;
  if(status === "INDISPO") return `<span class="pill indispo"><span class="dot"></span>Indispo</span>`;
  return `<span class="pill dispo"><span class="dot"></span>Dispo</span>`;
}

function isReserveVehicle(vState){
  return !vState.team || !vState.slot;
}

function counts(){
  let dispo=0, indispo=0, reserve=0;
  for(const id of Object.keys(state.vehicles)){
    const vs = state.vehicles[id];
    if(vs.status === "INDISPO") indispo++; else dispo++;
    if(isReserveVehicle(vs)) reserve++;
  }
  return { dispo, indispo, reserve };
}

function setFilter(cat){
  state.reserveFilter = cat;
  saveState();
  [filterAll, filterVLM, filterUMH].forEach(x => x.classList.remove("active"));
  if(cat === "ALL") filterAll.classList.add("active");
  if(cat === "VLM") filterVLM.classList.add("active");
  if(cat === "UMH") filterUMH.classList.add("active");
  render();
}

filterAll.addEventListener("click", () => setFilter("ALL"));
filterVLM.addEventListener("click", () => setFilter("VLM"));
filterUMH.addEventListener("click", () => setFilter("UMH"));

function openModal(ctx){
  modalCtx = ctx;
  modalOverlay.classList.add("open");
  modalOverlay.setAttribute("aria-hidden","false");
  renderModal();
}
function closeModal(){
  modalCtx = null;
  modalOverlay.classList.remove("open");
  modalOverlay.setAttribute("aria-hidden","true");
}
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if(e.target === modalOverlay) closeModal();
});

function renderModal(){
  if(!modalCtx) return;
  const vd = vehicleDef(modalCtx.vehicleId);
  const vs = state.vehicles[modalCtx.vehicleId];

  const where = isReserveVehicle(vs) ? "Réserve" : `${vs.team} / ${vs.slot}`;
  modalTitle.textContent = vd ? vd.name : modalCtx.vehicleId;
  modalSub.textContent = `${vd?.type || "—"} • ${where} • ${vs.status}`;

  modalBody.innerHTML = "";
  modalFoot.innerHTML = "";

  if(modalCtx.mode === "actions"){
    const panneCount = (vs.pannes || []).length;

    modalBody.innerHTML = `
      <div class="hint">Actions rapides</div>
      <div class="row">
        <button class="btnSmall" id="actToggleStatus">${vs.status === "INDISPO" ? "Passer Dispo" : "Passer Indispo"}</button>
        <button class="btnSmall secondary" id="actReserve">Mettre en réserve</button>
        <button class="btnSmall" id="actPannes">Pannes (${panneCount})</button>
      </div>

      <div class="sep"></div>
      <div class="hint">Déplacement</div>
      <div class="hint">Glisse-dépose un véhicule <b>Dispo</b> vers un slot VLM/UMH. (Indispo = non déplaçable)</div>
    `;

    modalFoot.innerHTML = `<button class="btnSmall secondary" id="actClose">Fermer</button>`;

    document.getElementById("actToggleStatus").addEventListener("click", () => {
      vs.status = (vs.status === "INDISPO") ? "DISPO" : "INDISPO";
      saveState();
      render();
      renderModal();
    });

    document.getElementById("actReserve").addEventListener("click", () => {
      vs.team = null;
      vs.slot = null;
      saveState();
      render();
      renderModal();
    });

    document.getElementById("actPannes").addEventListener("click", () => {
      openModal({ vehicleId: modalCtx.vehicleId, mode:"pannes" });
    });

    document.getElementById("actClose").addEventListener("click", closeModal);
    return;
  }

  if(modalCtx.mode === "pannes"){
    const list = (vs.pannes || []);

    modalBody.innerHTML = `
      <div class="row" style="justify-content:space-between;">
        <div class="hint">Fiches panne</div>
        <button class="btnSmall" id="addPanne">+ Ajouter</button>
      </div>
      <div class="pList" id="pList"></div>
    `;
    modalFoot.innerHTML = `
      <button class="btnSmall secondary" id="backToActions">Retour</button>
      <button class="btnSmall secondary" id="closePannes">Fermer</button>
    `;

    const pList = document.getElementById("pList");
    if(list.length === 0){
      pList.innerHTML = `<div class="hint">Aucune panne enregistrée.</div>`;
    }else{
      pList.innerHTML = list.map(p => `
        <div class="pItem">
          <div class="pTop">
            <div>
              <div class="pTitle">${esc(p.title || "Panne")}</div>
              <div class="pWhen">${esc(p.when || "")}</div>
            </div>
          </div>
          <div class="pDesc">${esc(p.desc || "")}</div>
          <div class="pBtns">
            <button class="btnSmall" data-edit="${esc(p.id)}">Modifier</button>
            <button class="btnSmall secondary" data-del="${esc(p.id)}">Supprimer</button>
          </div>
        </div>
      `).join("");

      pList.querySelectorAll("[data-edit]").forEach(btn => {
        btn.addEventListener("click", () => {
          const panneId = btn.getAttribute("data-edit");
          openModal({ vehicleId: modalCtx.vehicleId, mode:"panneEdit", panneId });
        });
      });

      pList.querySelectorAll("[data-del]").forEach(btn => {
        btn.addEventListener("click", () => {
          const panneId = btn.getAttribute("data-del");
          const ok = confirm("Supprimer cette fiche panne ?");
          if(!ok) return;
          vs.pannes = (vs.pannes || []).filter(x => x.id !== panneId);
          saveState();
          render();
          renderModal();
        });
      });
    }

    document.getElementById("addPanne").addEventListener("click", () => {
      openModal({ vehicleId: modalCtx.vehicleId, mode:"panneEdit", panneId: null });
    });
    document.getElementById("backToActions").addEventListener("click", () => {
      openModal({ vehicleId: modalCtx.vehicleId, mode:"actions" });
    });
    document.getElementById("closePannes").addEventListener("click", closeModal);
    return;
  }

  if(modalCtx.mode === "panneEdit"){
    const list = (vs.pannes || []);
    const existing = modalCtx.panneId ? list.find(x => x.id === modalCtx.panneId) : null;

    modalBody.innerHTML = `
      <div class="hint">${existing ? "Modifier fiche panne" : "Nouvelle fiche panne"}</div>

      <label>Titre</label>
      <input id="pTitle" type="text" placeholder="Ex: Voyant moteur / Pneumatique / Brancard…" value="${esc(existing?.title || "")}"/>

      <label>Détails</label>
      <textarea id="pDesc" placeholder="Décris la panne, symptômes, actions faites…">${esc(existing?.desc || "")}</textarea>

      <div class="hint">Date/heure : <b>${esc(existing?.when || nowISO())}</b></div>
    `;

    modalFoot.innerHTML = `
      <button class="btnSmall secondary" id="cancelEdit">Annuler</button>
      <button class="btnSmall" id="savePanne">Enregistrer</button>
    `;

    document.getElementById("cancelEdit").addEventListener("click", () => {
      openModal({ vehicleId: modalCtx.vehicleId, mode:"pannes" });
    });

    document.getElementById("savePanne").addEventListener("click", () => {
      const title = (document.getElementById("pTitle").value || "").trim();
      const desc = (document.getElementById("pDesc").value || "").trim();

      if(!title && !desc){
        alert("Ajoute au moins un titre ou une description.");
        return;
      }

      if(existing){
        existing.title = title || existing.title || "Panne";
        existing.desc = desc;
      }else{
        vs.pannes = vs.pannes || [];
        vs.pannes.unshift({
          id: uid("P"),
          when: nowISO(),
          title: title || "Panne",
          desc
        });
      }

      saveState();
      render();
      openModal({ vehicleId: modalCtx.vehicleId, mode:"pannes" });
    });

    return;
  }
}

function render(){
  // KPIs
  const c = counts();
  kpiDispo.textContent = c.dispo;
  kpiIndispo.textContent = c.indispo;
  kpiReserve.textContent = c.reserve;

  // Filter UI state
  if(state.reserveFilter === "ALL") { filterAll.classList.add("active"); filterVLM.classList.remove("active"); filterUMH.classList.remove("active"); }
  if(state.reserveFilter === "VLM") { filterVLM.classList.add("active"); filterAll.classList.remove("active"); filterUMH.classList.remove("active"); }
  if(state.reserveFilter === "UMH") { filterUMH.classList.add("active"); filterAll.classList.remove("active"); filterVLM.classList.remove("active"); }

  // Teams
  teamsEl.innerHTML = TEAMS.map(t => {
    return `
      <div class="teamCard">
        <div class="teamTop">
          <div class="teamName">${esc(t.name)}</div>
          <div class="teamCode">${esc(t.code)}</div>
        </div>

        <div class="slots">
          ${renderSlot(t.id, "VLM")}
          ${renderSlot(t.id, "UMH")}
        </div>
      </div>
    `;
  }).join("");

  // Bind drop zones
  document.querySelectorAll("[data-drop]").forEach(zone => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dropHover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dropHover"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dropHover");
      const vehicleId = e.dataTransfer.getData("text/vehicle");
      if(!vehicleId) return;

      const team = zone.getAttribute("data-team");
      const slot = zone.getAttribute("data-slot");

      const vd = vehicleDef(vehicleId);
      if(!vd) return;

      // type must match slot
      if(vd.type !== slot){
        alert(`Ce slot accepte uniquement des ${slot}.`);
        return;
      }

      const vs = state.vehicles[vehicleId];
      if(vs.status === "INDISPO"){
        alert("Véhicule Indispo : déplacement bloqué.");
        return;
      }

      // un slot ne peut avoir qu’un véhicule => renvoyer l’ancien en réserve
      const current = findVehicleInSlot(team, slot);
      if(current){
        state.vehicles[current].team = null;
        state.vehicles[current].slot = null;
      }

      // déplacer celui-ci
      vs.team = team;
      vs.slot = slot;

      saveState();
      render();
    });
  });

  // Reserve list
  const reserveIds = Object.keys(state.vehicles)
    .filter(id => isReserveVehicle(state.vehicles[id]))
    .filter(id => {
      const vd = vehicleDef(id);
      if(!vd) return false;
      if(state.reserveFilter === "ALL") return true;
      return vd.type === state.reserveFilter;
    });

  if(reserveIds.length === 0){
    reserveEl.innerHTML = `<div class="hint">Aucun véhicule en réserve.</div>`;
  }else{
    reserveEl.innerHTML = reserveIds.map(id => renderVehicleCard(id, true)).join("");
  }

  // Bind actions button & drag start/end
  document.querySelectorAll("[data-actions]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-actions");
      openModal({ vehicleId:id, mode:"actions" });
    });
  });

  document.querySelectorAll("[draggable='true']").forEach(card => {
    card.addEventListener("dragstart", (e) => {
      const id = card.getAttribute("data-vid");
      const vs = state.vehicles[id];
      if(vs.status === "INDISPO"){
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/vehicle", id);
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });
}

function findVehicleInSlot(teamId, slot){
  for(const id of Object.keys(state.vehicles)){
    const vs = state.vehicles[id];
    if(vs.team === teamId && vs.slot === slot) return id;
  }
  return null;
}

function renderSlot(teamId, slot){
  const vid = findVehicleInSlot(teamId, slot);
  const title = slot;
  const hint = vid ? "" : `Dépose un ${slot} ici`;

  return `
    <div class="slot" data-drop="1" data-team="${esc(teamId)}" data-slot="${esc(slot)}">
      <div class="slotHdr">
        <div class="slotTitle">${esc(title)}</div>
        <div class="slotHint">${esc(teamId)}</div>
      </div>
      ${vid ? renderVehicleCard(vid, false) : `<div class="slotHint">${esc(hint)}</div>`}
    </div>
  `;
}

function renderVehicleCard(vehicleId, isReserve){
  const vd = vehicleDef(vehicleId);
  const vs = state.vehicles[vehicleId];
  if(!vd || !vs) return "";

  const where = isReserve ? "Réserve" : `${vs.team} / ${vs.slot}`;
  const panneCount = (vs.pannes || []).length;

  return `
    <div class="vCard" draggable="true" data-vid="${esc(vehicleId)}">
      <div class="vTop">
        <div class="vLeft">
          <div class="vName">${esc(vd.name)}</div>
          <div class="vMeta">${esc(vd.type)} • ${esc(where)} • Pannes : ${panneCount}</div>
        </div>
        <div class="vRight">
          ${pill(vs.status, isReserve)}
        </div>
      </div>

      <div class="actionsRow">
        <div class="dragHint">${vs.status === "INDISPO" ? "Indispo (drag bloqué)" : "Glisser"}</div>
        <button class="btnSmall" data-actions="${esc(vehicleId)}">Actions</button>
      </div>
    </div>
  `;
}

// Init
render();