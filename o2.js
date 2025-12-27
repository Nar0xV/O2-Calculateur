import { clamp, round, safeJSONParse } from "./shared.js";

const EXTRA_BOTTLE_BAR = 200;
const EXTRA_BOTTLE_VOL = 5;
const KEY = "o2_state_v4";

const flowInput = document.getElementById("flow");
const minsInput = document.getElementById("mins");
const p15 = document.getElementById("p15");
const p5a = document.getElementById("p5a");
const p5b = document.getElementById("p5b");

const needEl = document.getElementById("need");
const availableEl = document.getElementById("available");
const timeAvailEl = document.getElementById("timeAvailable");
const timeMarginEl = document.getElementById("timeMargin");
const statusLine = document.getElementById("statusLine");
const badge = document.getElementById("badge");
const bottlesEl = document.getElementById("bottles");
const marginLabel = document.getElementById("marginLabel");

let marginPct = 20;

// ---- ONGLET AUTONOMIE ----
const flowAutoInput = document.getElementById("flowAuto");
const autoTotalEl = document.getElementById("autoTotal");
const autoDetailEl = document.getElementById("autoDetail");
const autoBottlesEl = document.getElementById("autoBottles");

function liters(bar, volume){ return Math.max(0, +bar) * volume; }

function pressureClass(bar){
  bar = +bar;
  if (bar <= 50) return { cls:"pRed" };
  if (bar <= 100) return { cls:"pYellow" };
  if (bar <= 200) return { cls:"pGreen" };
  return { cls:"pBlue" };
}

function setBadge(kind, text){
  badge.className = "badge " + kind;
  badge.textContent = text;
}

function updateMarginUI(){
  marginLabel.textContent = marginPct + "%";
  document.querySelectorAll("#marginChips .chip").forEach(c => {
    c.classList.toggle("active", +c.dataset.margin === marginPct);
  });
}

function updateMinsUI(){
  const v = +minsInput.value;
  document.querySelectorAll("[data-mins]").forEach(c => {
    c.classList.toggle("active", +c.dataset.mins === v);
  });
}

function bottleCard(name, bar, vol, flow){
  const L = liters(bar, vol);
  const t = flow > 0 ? (L/flow) : 0;
  const p = pressureClass(bar);

  return `
    <div class="bottle">
      <div class="name">${name}</div>
      <div class="meta">
        O₂ : <b>${round(L)} L</b> • Autonomie : <b>${round(t)} min</b>
      </div>
      <div class="pTag ${p.cls}">
        <span class="dotP"></span>
        <span>${bar} bar</span>
      </div>
    </div>
  `;
}

function fmtHM(mins){
  if(!Number.isFinite(mins) || mins <= 0) return "0 min";
  const m = Math.round(mins);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if(h <= 0) return `${r} min`;
  if(r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

function saveState(){
  const s = {
    flow: flowInput.value,
    mins: minsInput.value,
    marginPct,
    p15: p15.value,
    p5a: p5a.value,
    p5b: p5b.value,
    flowAuto: flowAutoInput ? flowAutoInput.value : undefined
  };
  localStorage.setItem(KEY, JSON.stringify(s));
}

function loadState(){
  const raw = localStorage.getItem(KEY);
  if(!raw) return;
  const s = safeJSONParse(raw, null);
  if(!s) return;

  if (s.flow != null) flowInput.value = s.flow;
  if (s.mins != null) minsInput.value = s.mins;
  if (s.p15 != null) p15.value = s.p15;
  if (s.p5a != null) p5a.value = s.p5a;
  if (s.p5b != null) p5b.value = s.p5b;
  if (s.marginPct != null) marginPct = s.marginPct;

  if (flowAutoInput && s.flowAuto != null) flowAutoInput.value = s.flowAuto;
}

function normalizeInputs(){
  flowInput.value = Math.max(0, parseFloat(flowInput.value || "0"));
  minsInput.value = clamp(parseInt(minsInput.value || "0", 10), 0, 600);
  p15.value = clamp(parseInt(p15.value || "0", 10), 0, 250);
  p5a.value = clamp(parseInt(p5a.value || "0", 10), 0, 250);
  p5b.value = clamp(parseInt(p5b.value || "0", 10), 0, 250);

  if(flowAutoInput){
    flowAutoInput.value = Math.max(0, parseFloat(flowAutoInput.value || "0"));
  }
}

function updateAutonomy(){
  if(!flowAutoInput) return;

  const flow = +flowAutoInput.value;
  const L15 = liters(p15.value, 15);
  const L5a = liters(p5a.value, 5);
  const L5b = liters(p5b.value, 5);
  const total = L15 + L5a + L5b;

  if(flow <= 0){
    autoTotalEl.textContent = "—";
    autoDetailEl.textContent = "Renseigne un débit > 0.";
    autoBottlesEl.innerHTML =
      bottleCard("15 L", p15.value, 15, 1) +
      bottleCard("5 L #1", p5a.value, 5, 1) +
      bottleCard("5 L #2", p5b.value, 5, 1);
    return;
  }

  const tTotal = total / flow;
  const t15 = L15 / flow;
  const t5a = L5a / flow;
  const t5b = L5b / flow;

  autoTotalEl.textContent = fmtHM(tTotal);
  autoDetailEl.textContent = `Total ≈ ${round(total)} L à ${flow} L/min`;

  autoBottlesEl.innerHTML =
    bottleCard("15 L", p15.value, 15, flow) +
    bottleCard("5 L #1", p5a.value, 5, flow) +
    bottleCard("5 L #2", p5b.value, 5, flow);

  // Petite sécurité visuelle : si une bouteille est rouge, tu le vois déjà au code couleur.
}

function calc(){
  normalizeInputs();

  const flow = +flowInput.value;
  const mins = +minsInput.value;

  updateMinsUI();

  if (flow <= 0 || mins <= 0){
    setBadge("warn", "SAISIE");
    statusLine.textContent = "Renseigne un débit et une durée supérieurs à 0.";
    bottlesEl.innerHTML =
      bottleCard("15 L", p15.value, 15, Math.max(1, flow)) +
      bottleCard("5 L #1", p5a.value, 5, Math.max(1, flow)) +
      bottleCard("5 L #2", p5b.value, 5, Math.max(1, flow));
    needEl.textContent = "—";
    availableEl.textContent = "—";
    timeAvailEl.textContent = "—";
    timeMarginEl.textContent = "—";

    updateAutonomy();
    saveState();
    return;
  }

  const need = flow * mins * (1 + marginPct/100);
  const total = liters(p15.value, 15) + liters(p5a.value, 5) + liters(p5b.value, 5);

  const timeAvailable = total / flow;
  const timeMargin = timeAvailable - (mins * (1 + marginPct/100));

  needEl.textContent = round(need) + " L";
  availableEl.textContent = round(total) + " L";
  timeAvailEl.textContent = round(timeAvailable) + " min";
  timeMarginEl.textContent = (timeMargin >= 0 ? "+" : "") + round(timeMargin) + " min";

  bottlesEl.innerHTML =
    bottleCard("15 L", p15.value, 15, flow) +
    bottleCard("5 L #1", p5a.value, 5, flow) +
    bottleCard("5 L #2", p5b.value, 5, flow);

  const redAny = (+p15.value <= 50) || (+p5a.value <= 50) || (+p5b.value <= 50);
  const yellowAny = (!redAny) && ((+p15.value <= 100) || (+p5a.value <= 100) || (+p5b.value <= 100));

  if (total >= need){
    setBadge(redAny || yellowAny ? "warn" : "ok", redAny || yellowAny ? "OK + ⚠️" : "OK");
    statusLine.innerHTML =
      `Suffisant avec marge. Marge temps ≈ <b>${round(timeMargin)} min</b>.` +
      (redAny ? ` <span style="color:var(--bad); font-weight:900;">Au moins une bouteille est en rouge.</span>` :
       yellowAny ? ` <span style="color:var(--warn); font-weight:900;">Au moins une bouteille est en jaune.</span>` :
       ``);
  } else {
    const missing = need - total;
    const oneExtra = EXTRA_BOTTLE_BAR * EXTRA_BOTTLE_VOL; // 1000 L
    const count = Math.ceil(missing / oneExtra);
    setBadge("bad", "KO");
    statusLine.innerHTML =
      `Insuffisant : manque ≈ <b>${round(missing)} L</b>. ` +
      `Prévoir <b>${count}</b> bouteille(s) supplémentaire(s) <b>5 L à 200 bar</b>.`;
  }

  updateAutonomy();
  saveState();
}

// ---- Onglets ----
function setupTabs(){
  const tabs = document.querySelectorAll("#viewTabs .chip");
  const pNeed = document.getElementById("panelNeed");
  const pAuto = document.getElementById("panelAuto");

  function setView(v){
    tabs.forEach(t => t.classList.toggle("active", t.dataset.view === v));
    pNeed.classList.toggle("active", v === "need");
    pAuto.classList.toggle("active", v === "auto");
    // recalcul utile quand on affiche autonomie
    if(v === "auto") updateAutonomy();
  }

  tabs.forEach(t => {
    t.addEventListener("click", () => setView(t.dataset.view));
  });

  // Par défaut : besoin
  setView("need");
}

// Events
document.querySelectorAll("[data-mins]").forEach(chip => {
  chip.addEventListener("click", () => {
    minsInput.value = chip.dataset.mins;
    calc();
  });
});

document.querySelectorAll("#marginChips .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    marginPct = +chip.dataset.margin;
    updateMarginUI();
    calc();
  });
});

[flowInput, minsInput, p15, p5a, p5b].forEach(el => {
  el.addEventListener("input", calc);
  el.addEventListener("change", calc);
});

if(flowAutoInput){
  flowAutoInput.addEventListener("input", () => { normalizeInputs(); updateAutonomy(); saveState(); });
  flowAutoInput.addEventListener("change", () => { normalizeInputs(); updateAutonomy(); saveState(); });
}

document.getElementById("resetBtn").addEventListener("click", () => {
  localStorage.removeItem(KEY);
  flowInput.value = 3;
  minsInput.value = 15;
  marginPct = 10;
  p15.value = 200;
  p5a.value = 200;
  p5b.value = 200;
  if(flowAutoInput) flowAutoInput.value = 6;

  updateMarginUI();
  updateMinsUI();
  calc();
});

// Init
loadState();
updateMarginUI();
updateMinsUI();
setupTabs();
calc();