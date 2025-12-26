import { pad2, fmtFR, safeJSONParse } from "./shared.js";

const PL_KEY = "planning_v3";

// planning[iso] = {
//   INF: { J1:[], J2:[], N1:[], N2:[] },
//   AMB: { J1:[], J2:[], N1:[], N2:[] }
// }
let planning = {};

const plDate = document.getElementById("plDate");
const plDayTitle = document.getElementById("plDayTitle");
const gridInf = document.getElementById("teamsGridInf");
const gridAmb = document.getElementById("teamsGridAmb");
const plImport = document.getElementById("plImport");

function emptyTeams(){
  return { J1:[], J2:[], N1:[], N2:[] };
}

function emptyDay(){
  return { INF: emptyTeams(), AMB: emptyTeams() };
}

function loadPlanning(){
  const raw = localStorage.getItem(PL_KEY);
  planning = raw ? safeJSONParse(raw, {}) : {};
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

function renderGroup(gridEl, entryTeams){
  const order = ["J1","J2","N1","N2"];
  gridEl.innerHTML = order.map(team => {
    const names = Array.isArray(entryTeams?.[team]) ? entryTeams[team] : [];
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

function renderTeamsForDate(iso){
  const entry = planning[iso] || emptyDay();
  plDayTitle.textContent = fmtFR(iso);

  renderGroup(gridInf, entry.INF);
  renderGroup(gridAmb, entry.AMB);
}

function normalizeCell(v){
  const x = String(v || "").trim().toUpperCase();
  if (x === "J1" || x === "J2" || x === "N1" || x === "N2") return x;
  return ""; // ignore CP/FC/Réu/etc
}

function splitLine(line){
  if(line.includes("\t")) return line.split("\t");
  if(line.includes(";")) return line.split(";");
  return line.split(/\s{2,}|\s+/);
}

/**
 * Attend 2 sections:
 * [INF] ...table...
 * [AMB] ...table...
 * (les tags peuvent être INF/INFI/INFIRMIERS et AMB/AMBULANCIERS)
 */
function importTwoTables(text){
  const raw = (text || "").trim();
  if(!raw) return { updated:0, msg:"Rien à importer." };

  // Découpe sur les balises [XXX]
  // On accepte aussi "INF:" / "AMB:"
  const blocks = raw
    .replace(/^INF\s*:/gim, "[INF]\n")
    .replace(/^AMB\s*:/gim, "[AMB]\n")
    .split(/\[(INF|INFI|INFIRMIERS|AMB|AMBULANCIERS)\]/i);

  // blocks = [before, tag1, content1, tag2, content2, ...]
  const sections = {};
  for(let i=1;i<blocks.length;i+=2){
    const tag = String(blocks[i] || "").toUpperCase();
    const content = String(blocks[i+1] || "").trim();
    if(!content) continue;

    if(tag.startsWith("INF")) sections.INF = content;
    if(tag.startsWith("AMB")) sections.AMB = content;
  }

  if(!sections.INF && !sections.AMB){
    // fallback: si l'utilisateur n'a collé qu'un tableau -> on le met en AMB par défaut
    sections.AMB = raw;
  }

  const base = plDate.value || new Date().toISOString().slice(0,10);
  const [Y,M] = base.split("-");

  let updated = 0;

  function importOneTable(kind, tableText){
    const lines = tableText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if(lines.length < 2) return;

    const header = splitLine(lines[0]).map(s => s.trim());
    if(header.length < 2) return;

    const dayCols = [];
    for(let i=1;i<header.length;i++){
      const d = parseInt(header[i],10);
      if(Number.isFinite(d) && d>=1 && d<=31) dayCols.push({ idx:i, day:d });
    }
    if(dayCols.length === 0) return;

    for(let r=1; r<lines.length; r++){
      const cells = splitLine(lines[r]).map(s => (s ?? "").trim());
      const name = (cells[0] || "").trim();
      if(!name) continue;

      for(const col of dayCols){
        const team = normalizeCell(cells[col.idx] ?? "");
        if(!team) continue;

        const iso = `${Y}-${M}-${pad2(col.day)}`;
        if(!planning[iso]) planning[iso] = emptyDay();

        const arr = planning[iso][kind][team];
        if(!arr.includes(name)){
          arr.push(name);
          updated++;
        }
      }
    }
  }

  if(sections.INF) importOneTable("INF", sections.INF);
  if(sections.AMB) importOneTable("AMB", sections.AMB);

  if(updated) savePlanning();
  return { updated, msg: updated ? "OK" : "Aucune case J1/J2/N1/N2 détectée." };
}

// Events
document.getElementById("plImportBtn").addEventListener("click", () => {
  const res = importTwoTables(plImport.value);
  renderTeamsForDate(plDate.value);
  plImport.value = "";
  alert(res.updated ? `✅ Import terminé : ${res.updated} affectation(s) ajoutée(s).` : `⚠️ ${res.msg}`);
});

document.getElementById("plClearBtn").addEventListener("click", () => {
  if(confirm("Effacer TOUTES les affectations INF+AMB enregistrées ?")){
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