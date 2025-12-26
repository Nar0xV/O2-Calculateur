import { pad2, fmtFR, safeJSONParse } from "./shared.js";

const PL_KEY = "planning_assignments_v2";

// structure:
// planning["YYYY-MM-DD"] = { J1:[...], J2:[...], N1:[...], N2:[...] }
let planning = {};

const plDate = document.getElementById("plDate");
const plDayTitle = document.getElementById("plDayTitle");
const teamsGrid = document.getElementById("teamsGrid");
const plImport = document.getElementById("plImport");

function loadPlanning(){
  const raw = localStorage.getItem(PL_KEY);
  if(!raw) { planning = {}; return; }
  planning = safeJSONParse(raw, {});
}

function savePlanning(){
  localStorage.setItem(PL_KEY, JSON.stringify(planning));
}

function teamColor(team){
  if(team === "J1") return "pGreen";
  if(team === "J2") return "pYellow";
  if(team === "N1") return "pBlue";
  return "pRed"; // N2
}

function renderTeamsForDate(iso){
  const entry = planning[iso] || {};
  plDayTitle.textContent = fmtFR(iso);

  const order = ["J1","J2","N1","N2"];
  teamsGrid.innerHTML = order.map(team => {
    const names = Array.isArray(entry[team]) ? entry[team] : [];
    const content = names.length ? names.join("\n") : "—";
    const muted = names.length ? "" : "muted";
    const cls = teamColor(team);

    return `
      <div class="teamTile">
        <div class="head">
          <div class="tag ${cls}">
            <span class="dot"></span>
            <span>${team}</span>
          </div>
          <div class="hint">${team.startsWith("J") ? "Jour" : "Nuit"}</div>
        </div>
        <div class="names ${muted}">${content}</div>
      </div>
    `;
  }).join("");
}

function normalizeCell(v){
  const x = String(v || "").trim().toUpperCase();
  if (x === "J1" || x === "J2" || x === "N1" || x === "N2") return x;
  return ""; // ignore CP/FC/Réu/etc
}

// Import tableau : première colonne = nom, colonnes = jours 1..31
function importMonthlyGrid(text){
  const lines = (text || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if(lines.length < 2) return { updated:0, msg:"Tableau trop court." };

  // auto separator: tab > ; > multiple spaces
  const splitLine = (line) => {
    if(line.includes("\t")) return line.split("\t");
    if(line.includes(";")) return line.split(";");
    return line.split(/\s{2,}|\s+/); // fallback
  };

  const header = splitLine(lines[0]).map(s => s.trim());
  if(header.length < 2) return { updated:0, msg:"En-tête invalide." };

  // identifier days columns
  // header like: NOM 1 2 3 ... (or name/nom)
  const dayCols = [];
  for(let i=1;i<header.length;i++){
    const d = parseInt(header[i],10);
    if(Number.isFinite(d) && d>=1 && d<=31) dayCols.push({ idx:i, day:d });
  }
  if(dayCols.length === 0) return { updated:0, msg:"Aucune colonne jour (1..31) trouvée." };

  // Determine month/year from date picker (so we know YYYY-MM)
  const base = plDate.value || new Date().toISOString().slice(0,10);
  const [Y,M] = base.split("-");

  // Reset only that month? -> on n’efface pas automatiquement, on écrase les jours importés
  let updated = 0;

  for(let r=1; r<lines.length; r++){
    const cells = splitLine(lines[r]).map(s => (s ?? "").trim());
    if(cells.length === 0) continue;

    const name = (cells[0] || "").trim();
    if(!name) continue;

    for(const col of dayCols){
      const raw = cells[col.idx] ?? "";
      const team = normalizeCell(raw);
      if(!team) continue;

      const iso = `${Y}-${M}-${pad2(col.day)}`;
      if(!planning[iso]) planning[iso] = { J1:[], J2:[], N1:[], N2:[] };
      if(!planning[iso][team]) planning[iso][team] = [];

      // avoid duplicates
      if(!planning[iso][team].includes(name)){
        planning[iso][team].push(name);
        updated++;
      }
    }
  }

  if(updated) savePlanning();
  return { updated, msg: updated ? "OK" : "Aucune case J1/J2/N1/N2 détectée." };
}

// Events
document.getElementById("plImportBtn").addEventListener("click", () => {
  const res = importMonthlyGrid(plImport.value);
  renderTeamsForDate(plDate.value);
  plImport.value = "";
  alert(res.updated ? `✅ Import terminé : ${res.updated} affectation(s) ajoutée(s).` : `⚠️ ${res.msg}`);
});

document.getElementById("plClearBtn").addEventListener("click", () => {
  if(confirm("Effacer TOUTES les affectations enregistrées ?")){
    planning = {};
    savePlanning();
    renderTeamsForDate(plDate.value);
  }
});

plDate.addEventListener("change", () => renderTeamsForDate(plDate.value));

// Init
loadPlanning();
const today = new Date();
const isoToday = `${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}`;
plDate.value = isoToday;
renderTeamsForDate(isoToday);