// world/worldSim.ts — SIMULATION D'UNIVERS VIVANT (pure, déterministe, testable).
//
// Un "tick" fait évoluer : puissance des factions, contrôle des régions (territoires qui
// basculent), économie (indice de prix par région), et événements (guerre/essor/famine/raid)
// qui apparaissent, durent, et influent. Déterministe par (seed, epoch) → rejouable +
// rattrapage hors-ligne (on rejoue N ticks au chargement). Aucun effet de bord : `stepWorld`
// renvoie le NOUVEL état + les événements fraîchement déclenchés (le driver les pousse au feed).
import { mulberry32 } from "../mapgen/mapGenerator";
import type { FactionId } from "../runtime/core/worldTypes";

export const SIM_FACTIONS: FactionId[] = ["akarlys", "mezalayis", "zayan"];

export type WorldEventKind = "conquete" | "essor" | "famine" | "raid" | "guerre";

export interface WorldEvent {
  id: string;
  kind: WorldEventKind;
  region?: string;
  faction?: FactionId;
  text: string;
  startEpoch: number;
  ttl: number;            // ticks restants
}

export interface RegionState {
  controller: FactionId;
  contest: number;        // 0..1 — progression du challenger vers la prise
  price: number;          // indice économique 0.5..1.6 (1 = normal)
}

export interface WorldState {
  epoch: number;
  seed: number;
  factions: Record<FactionId, { power: number }>; // 0..100
  regions: Record<string, RegionState>;
  events: WorldEvent[];
}

// Régions = planètes/zones de l'univers (3 fiefs de faction + 2 neutres contestés).
const REGION_OWNER: Record<string, FactionId> = {
  aquarys: "akarlys", desertica: "mezalayis", fungaria: "zayan",
  hub: "akarlys", espace: "zayan",
};
export const REGION_LABEL: Record<string, string> = {
  aquarys: "Aquarys-4", desertica: "Désertica", fungaria: "Fungaria", hub: "Station Hub", espace: "Vide Spatial",
};

export function createWorld(seed = 1): WorldState {
  const regions: Record<string, RegionState> = {};
  for (const [id, owner] of Object.entries(REGION_OWNER)) regions[id] = { controller: owner, contest: 0, price: 1 };
  return {
    epoch: 0, seed,
    factions: { akarlys: { power: 50 }, mezalayis: { power: 50 }, zayan: { power: 50 } },
    regions,
    events: [],
  } as WorldState;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Faction ennemie la plus PUISSANTE face au contrôleur (challenger d'une région). */
function topChallenger(s: WorldState, controller: FactionId): FactionId {
  let best: FactionId = controller, bestPow = -1;
  for (const f of SIM_FACTIONS) {
    if (f === controller) continue;
    if (s.factions[f].power > bestPow) { bestPow = s.factions[f].power; best = f; }
  }
  return best;
}

/** Un tick de simulation. PUR : renvoie le nouvel état + les événements neufs. */
export function stepWorld(prev: WorldState): { state: WorldState; newEvents: WorldEvent[] } {
  const rng = mulberry32((prev.seed ^ (prev.epoch * 2654435761)) >>> 0);
  const epoch = prev.epoch + 1;
  const newEvents: WorldEvent[] = [];
  const uid = (p: string) => `${p}_${epoch}_${Math.floor(rng() * 1e6)}`;

  // 1. Puissance des factions : marche aléatoire + bonus par région contrôlée.
  const factions = { ...prev.factions } as WorldState["factions"];
  const owned: Record<FactionId, number> = { akarlys: 0, mezalayis: 0, zayan: 0 };
  for (const r of Object.values(prev.regions)) owned[r.controller]++;
  for (const f of SIM_FACTIONS) {
    factions[f] = { power: clamp(prev.factions[f].power + (rng() - 0.5) * 6 + owned[f] * 0.4, 5, 100) };
  }

  // 2. Régions : contestation + bascule de contrôle + économie.
  const regions: Record<string, RegionState> = {};
  for (const [id, reg] of Object.entries(prev.regions)) {
    const challenger = topChallenger({ ...prev, factions } as WorldState, reg.controller);
    const delta = (factions[challenger].power - factions[reg.controller].power) / 100; // -1..1
    let contest = clamp(reg.contest + delta * 0.18 + (rng() - 0.5) * 0.08, 0, 1.2);
    let controller = reg.controller;
    let price = reg.price;
    if (contest >= 1) {
      // Prise de la région.
      controller = challenger; contest = 0; price = clamp(price * 0.85, 0.5, 1.6); // guerre → prix chahuté
      newEvents.push({ id: uid("conq"), kind: "conquete", region: id, faction: challenger, startEpoch: epoch, ttl: 6,
        text: `${challenger.toUpperCase()} s'empare de ${REGION_LABEL[id] ?? id}` });
    }
    // Économie : retour vers 1 + bruit ; la contestation élevée rend volatil.
    price = clamp(price + (1 - price) * 0.05 + (rng() - 0.5) * (0.04 + contest * 0.06), 0.5, 1.6);
    regions[id] = { controller, contest, price };
  }

  // 3. Événements aléatoires (essor/famine/raid) + décrément des TTL.
  const events: WorldEvent[] = [];
  for (const e of prev.events) if (e.ttl > 1) events.push({ ...e, ttl: e.ttl - 1 });
  const ids = Object.keys(regions);
  if (rng() < 0.18) {
    const id = ids[Math.floor(rng() * ids.length)];
    const roll = rng();
    if (roll < 0.4) { regions[id].price = clamp(regions[id].price * 1.3, 0.5, 1.6); newEvents.push({ id: uid("ess"), kind: "essor", region: id, startEpoch: epoch, ttl: 8, text: `Essor économique à ${REGION_LABEL[id] ?? id}` }); }
    else if (roll < 0.75) { regions[id].price = clamp(regions[id].price * 0.7, 0.5, 1.6); newEvents.push({ id: uid("fam"), kind: "famine", region: id, startEpoch: epoch, ttl: 8, text: `Pénurie à ${REGION_LABEL[id] ?? id}` }); }
    else { regions[id].contest = clamp(regions[id].contest + 0.25, 0, 1.2); newEvents.push({ id: uid("raid"), kind: "raid", region: id, startEpoch: epoch, ttl: 5, text: `Raid sur ${REGION_LABEL[id] ?? id}` }); }
  }
  events.push(...newEvents);

  return { state: { epoch, seed: prev.seed, factions, regions, events }, newEvents };
}

/** Rejoue N ticks (rattrapage hors-ligne). Renvoie l'état final + TOUS les événements neufs. */
export function advanceWorld(state: WorldState, ticks: number): { state: WorldState; newEvents: WorldEvent[] } {
  let cur = state;
  const all: WorldEvent[] = [];
  for (let i = 0; i < ticks; i++) { const r = stepWorld(cur); cur = r.state; all.push(...r.newEvents); }
  return { state: cur, newEvents: all };
}
