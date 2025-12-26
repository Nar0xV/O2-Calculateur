// Service worker (PWA)
(function registerSW(){
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
})();

export function pad2(n){ return String(n).padStart(2,"0"); }

export function fmtFR(iso){
  const d = new Date(iso + "T00:00:00");
  const days = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  return `${days[d.getDay()]} ${pad2(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function clamp(n, min, max){
  n = Number.isFinite(n) ? n : min;
  return Math.min(max, Math.max(min, n));
}

export function round(x){ return Math.round(x); }

export function safeJSONParse(raw, fallback){
  try{ return JSON.parse(raw) ?? fallback; } catch { return fallback; }
}