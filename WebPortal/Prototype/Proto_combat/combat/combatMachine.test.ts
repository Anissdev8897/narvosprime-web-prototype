// ══════════════════════════════════════════════════════════════════════════════
// Proto_combat/combat/combatMachine.test.ts
//
// Toute la machine se teste SANS DOM, SANS three.js et SANS afficher un pixel :
// l'horloge est un paramètre, pas `performance.now()`. C'est la raison d'être du
// pattern « logique pure / coquille impure » — une fenêtre de combo se vérifie à
// la milliseconde, ce qu'aucune capture d'écran ne saura faire.
//
// Repères de `punch1` (combatCatalog.ts) :
//   anticipation 0..110 · actif 110..180 · récupération 180..440
//   fenêtre d'enchaînement 180..380 · enchaîne vers punch2
// ══════════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";

import {
  COMBO_MAINS_NUES,
  REGLAGES_DEFAUT,
  validerCatalogue,
  type AttackDef,
  type AttackId,
} from "./combatCatalog";
import { CombatMachine, type CombatEvent } from "./combatMachine";
import { dansConeDeGarde, hitDirection, normaliseAngle } from "./hitDirection";

/** Machine + journal des événements. Le journal EST l'assertion : ce que la
 *  coquille R3F recevrait réellement, pas un état interne reconstitué. */
function banc(reglages: Partial<typeof REGLAGES_DEFAUT> = {}) {
  const journal: CombatEvent[] = [];
  const machine = new CombatMachine({
    reglages: { ...REGLAGES_DEFAUT, ...reglages },
    onEvent: (ev) => journal.push(ev),
  });
  return {
    machine,
    journal,
    /** Clips demandés, dans l'ordre. */
    anims: () => journal.filter((e) => e.type === "anim").map((e) => (e as { action: string }).action),
    types: () => journal.map((e) => e.type),
    vider: () => journal.splice(0, journal.length),
  };
}

describe("phases d'une attaque", () => {
  it("passe anticipation → actif → récupération → neutre aux bornes du catalogue", () => {
    const { machine } = banc();
    machine.pressAttack(0);
    expect(machine.phase).toBe("anticipation");

    machine.update(109);
    expect(machine.phase).toBe("anticipation");

    machine.update(110);
    expect(machine.phase).toBe("actif");

    machine.update(180);
    expect(machine.phase).toBe("recuperation");

    machine.update(440);
    expect(machine.phase).toBe("neutre");
    expect(machine.attaqueCourante).toBeNull();
  });

  it("n'applique aucun dégât pendant l'anticipation — l'impact tombe à sa fin", () => {
    const { machine, journal } = banc();
    machine.pressAttack(0);
    machine.update(109);
    expect(journal.filter((e) => e.type === "impact")).toHaveLength(0);

    machine.update(110);
    const impacts = journal.filter((e) => e.type === "impact");
    expect(impacts).toHaveLength(1);
    expect(impacts[0]).toMatchObject({ attaque: "punch1", degats: COMBO_MAINS_NUES.punch1.damage });
  });

  it("n'émet l'impact QU'UNE fois, même appelé à chaque frame", () => {
    const { machine, journal } = banc();
    machine.pressAttack(0);
    for (let t = 0; t <= 440; t += 16) machine.update(t);
    expect(journal.filter((e) => e.type === "impact")).toHaveLength(1);
  });
});

describe("fenêtre d'enchaînement", () => {
  it("signale son ouverture puis sa fermeture", () => {
    const { machine, journal } = banc();
    machine.pressAttack(0);
    for (let t = 0; t <= 440; t += 10) machine.update(t);

    const fenetres = journal.filter((e) => e.type === "fenetre") as Array<{ ouverte: boolean }>;
    expect(fenetres.map((f) => f.ouverte)).toEqual([true, false]);
  });

  it("enchaîne punch1 → punch2 quand l'appui tombe DANS la fenêtre", () => {
    const b = banc();
    b.machine.pressAttack(0);
    b.machine.update(200);
    expect(b.machine.enFenetre).toBe(true);

    b.vider();
    b.machine.pressAttack(200);
    expect(b.anims()).toContain("punch2");
    expect(b.machine.rang).toBe(2);
    expect(b.machine.phase).toBe("anticipation");
  });

  it("RELANCE le combo au premier maillon quand l'appui tombe APRÈS la fermeture", () => {
    const b = banc();
    b.machine.pressAttack(0);
    for (let t = 0; t <= 400; t += 10) b.machine.update(t);

    b.vider();
    b.machine.pressAttack(400);
    expect(b.journal).toContainEqual({ type: "combo_reset", raison: "FENETRE_RATEE" });
    expect(b.anims()).toContain("punch1");
    expect(b.machine.rang).toBe(1);
  });

  it("refuse d'enchaîner pendant l'ANTICIPATION (règle ACF stricte)", () => {
    const b = banc();
    b.machine.pressAttack(0);
    b.vider();
    b.machine.pressAttack(50);
    expect(b.journal).toContainEqual({ type: "refus", raison: "phase" });
    expect(b.machine.rang).toBe(1);
  });

  it("`tamponDesAnticipation` change ce refus en mise en tampon", () => {
    const b = banc({ tamponDesAnticipation: true });
    b.machine.pressAttack(0);
    b.machine.pressAttack(50);
    expect(b.machine.tamponArme(50)).toBe(true);

    b.vider();
    b.machine.update(185);
    expect(b.anims()).toContain("punch2");
  });

  it("`ignorerFenetre` élargit l'enchaînement à toute la récupération", () => {
    const b = banc({ ignorerFenetre: true });
    b.machine.pressAttack(0);
    b.machine.update(430); // bien après windowCloseMs = 380
    expect(b.machine.enFenetre).toBe(true);

    b.vider();
    b.machine.pressAttack(430);
    expect(b.anims()).toContain("punch2");
  });
});

describe("tampon d'entrée", () => {
  it("mémorise un appui de la phase ACTIVE et le consomme à l'ouverture", () => {
    const b = banc();
    b.machine.pressAttack(0);
    b.machine.update(150);
    expect(b.machine.phase).toBe("actif");

    b.machine.pressAttack(150);
    expect(b.machine.attaqueCourante).toBe("punch1"); // pas d'annulation du coup en cours
    expect(b.machine.tamponArme(150)).toBe(true);

    b.vider();
    b.machine.update(185);
    expect(b.anims()).toContain("punch2");
    expect(b.machine.rang).toBe(2);
  });

  it("oublie l'appui passé la péremption — il ne ressort pas plus tard", () => {
    const b = banc({ bufferTtlMs: 10 });
    b.machine.pressAttack(0);
    b.machine.update(150);
    b.machine.pressAttack(150);

    b.vider();
    b.machine.update(185); // 35 ms après l'appui, TTL = 10 ms
    expect(b.anims()).not.toContain("punch2");
    expect(b.machine.attaqueCourante).toBe("punch1");
  });

  it("ne garde qu'UNE entrée : marteler la touche ne produit pas 4 coups", () => {
    const b = banc();
    b.machine.pressAttack(0);
    for (const t of [120, 130, 140, 150, 160]) b.machine.pressAttack(t);

    b.vider();
    for (let t = 170; t <= 900; t += 10) b.machine.update(t);
    const coups = b.anims().filter((a) => a.startsWith("punch") || a === "kick");
    expect(coups).toEqual(["punch2"]); // un seul enchaînement, pas une rafale
  });
});

describe("fin du combo", () => {
  it("le finisher clôt le combo par END_COMBO et n'enchaîne pas", () => {
    const b = banc();
    b.machine.pressAttack(0);   // punch1
    b.machine.update(200);
    b.machine.pressAttack(200); // punch2 démarré à 200
    b.machine.update(200 + 240);
    b.machine.pressAttack(200 + 240); // punch3 (finisher)
    expect(b.machine.attaqueCourante).toBe("punch3");
    expect(b.machine.rang).toBe(3);

    b.vider();
    const debutP3 = 440;
    for (let t = debutP3; t <= debutP3 + 800; t += 10) b.machine.update(t);
    expect(b.journal).toContainEqual({ type: "combo_reset", raison: "END_COMBO" });
    expect(b.machine.rang).toBe(0);
  });

  it("n'ouvre jamais de fenêtre sur un finisher", () => {
    const b = banc();
    b.machine.pressAttack(0);
    b.machine.update(200);
    b.machine.pressAttack(200);
    b.machine.update(440);
    b.machine.pressAttack(440); // punch3

    b.vider();
    for (let t = 440; t <= 1200; t += 10) b.machine.update(t);
    expect(b.journal.filter((e) => e.type === "fenetre")).toHaveLength(0);
  });
});

describe("endurance — une porte, pas une file", () => {
  it("refuse l'attaque sans endurance et NE la met PAS en tampon", () => {
    const b = banc({ enduranceMax: 5, enduranceRegenParSec: 0 });
    b.machine.pressAttack(0);
    expect(b.journal).toContainEqual({ type: "refus", raison: "endurance" });
    expect(b.machine.phase).toBe("neutre");
    expect(b.machine.tamponArme(0)).toBe(false);

    // Et elle ne ressort pas toute seule plus tard.
    b.vider();
    for (let t = 0; t <= 3000; t += 50) b.machine.update(t);
    expect(b.anims()).not.toContain("punch1");
  });

  it("chaque coup coûte son montant", () => {
    const b = banc();
    const depart = b.machine.enduranceCourante;
    b.machine.pressAttack(0);
    expect(b.machine.enduranceCourante).toBe(depart - COMBO_MAINS_NUES.punch1.staminaCost);
  });

  it("régénère hors action, après le délai", () => {
    const b = banc();
    b.machine.pressAttack(0);
    const apresCoup = b.machine.enduranceCourante;
    for (let t = 0; t <= 3000; t += 16) b.machine.update(t);
    expect(b.machine.enduranceCourante).toBeGreaterThan(apresCoup);
    expect(b.machine.enduranceCourante).toBeLessThanOrEqual(REGLAGES_DEFAUT.enduranceMax);
  });
});

describe("encaisser un coup", () => {
  it("interrompt même la phase ACTIVE et perd le combo", () => {
    const b = banc();
    b.machine.pressAttack(0);
    b.machine.update(150);
    expect(b.machine.phase).toBe("actif");

    b.vider();
    const subis = b.machine.recevoirCoup(150, { degats: 10, angleRad: 0 });
    expect(subis).toBe(10);
    expect(b.machine.phase).toBe("hitstun");
    expect(b.machine.rang).toBe(0);
    expect(b.journal).toContainEqual({ type: "combo_reset", raison: "INTERROMPU" });
    expect(b.anims()).toContain("hit");
  });

  it("le hitstun bloque toute attaque, puis rend la main", () => {
    const b = banc();
    b.machine.recevoirCoup(0, { degats: 10, angleRad: 0 });

    b.vider();
    b.machine.pressAttack(100);
    expect(b.journal).toContainEqual({ type: "refus", raison: "phase" });

    b.machine.update(REGLAGES_DEFAUT.hitstunMs);
    expect(b.machine.phase).toBe("neutre");
    b.machine.pressAttack(REGLAGES_DEFAUT.hitstunMs);
    expect(b.machine.attaqueCourante).toBe("punch1");
  });

  it("rapporte la direction du coup dans le repère du défenseur", () => {
    const b = banc();
    b.machine.recevoirCoup(0, { degats: 10, angleRad: Math.PI });
    expect(b.journal).toContainEqual(
      expect.objectContaining({ type: "encaisse", direction: "back", bloque: false }),
    );
  });
});

describe("garde angulaire", () => {
  it("absorbe un coup de FACE sans interrompre", () => {
    const b = banc();
    b.machine.setGarde(true);
    b.machine.update(0);
    expect(b.machine.enGarde).toBe(true);

    const subis = b.machine.recevoirCoup(0, { degats: 20, angleRad: 0 });
    expect(subis).toBeCloseTo(20 * REGLAGES_DEFAUT.gardePassthrough);
    expect(b.machine.phase).not.toBe("hitstun");
  });

  it("laisse passer un coup dans le DOS : la garde est un cône, pas une immunité", () => {
    const b = banc();
    b.machine.setGarde(true);
    b.machine.update(0);

    const subis = b.machine.recevoirCoup(0, { degats: 20, angleRad: Math.PI });
    expect(subis).toBe(20);
    expect(b.machine.phase).toBe("hitstun");
  });

  it("une attaque imblocable traverse la garde frontale", () => {
    const b = banc();
    b.machine.setGarde(true);
    b.machine.update(0);
    expect(b.machine.recevoirCoup(0, { degats: 20, angleRad: 0, imblocable: true })).toBe(20);
  });

  it("rompt la garde quand l'endurance tombe à zéro", () => {
    const b = banc();
    b.machine.setGarde(true);
    b.machine.update(0);

    let t = 0;
    for (let i = 0; i < 20 && b.machine.phase !== "garde_brisee"; i++) {
      t += 20;
      b.machine.recevoirCoup(t, { degats: 10, angleRad: 0 });
    }
    expect(b.machine.phase).toBe("garde_brisee");
    expect(b.journal).toContainEqual({ type: "garde_brisee" });

    b.vider();
    b.machine.pressAttack(t + 10);
    expect(b.journal).toContainEqual({ type: "refus", raison: "garde_brisee" });
  });

  it("ne se met pas en garde pendant la phase active d'une attaque", () => {
    const b = banc();
    b.machine.pressAttack(0);
    b.machine.setGarde(true);
    b.machine.update(150);
    expect(b.machine.phase).toBe("actif");
    expect(b.machine.enGarde).toBe(false);

    b.machine.update(200); // récupération : la garde est acceptée
    expect(b.machine.enGarde).toBe(true);
  });
});

describe("attaque chargée", () => {
  it("ARBITRAGE 1 — relâchement AVANT le seuil : le coup normal part", () => {
    const b = banc();
    b.machine.chargeCommencee(0);
    b.vider();
    b.machine.chargeRelachee(200); // seuil = 350 ms

    expect(b.anims()).toContain("punch1");
    expect(b.machine.attaqueCourante).toBe("punch1");
    expect(b.journal).toContainEqual({ type: "charge", etat: "annulee" });
  });

  it("ARBITRAGE 1 — relâchement APRÈS le seuil : la variante chargée part", () => {
    const b = banc();
    b.machine.chargeCommencee(0);
    for (let t = 0; t <= 400; t += 16) b.machine.update(t);

    b.vider();
    b.machine.chargeRelachee(400);
    expect(b.machine.attaqueCourante).toBe("punch_charged");
    expect(b.anims()).toContain("punch_charged");
    expect(b.journal).toContainEqual({ type: "charge", etat: "relachee" });
  });

  it("signale le franchissement du seuil pendant le maintien", () => {
    const b = banc();
    b.machine.chargeCommencee(0);
    b.machine.update(300);
    expect(b.machine.chargePreteMaintenant).toBe(false);

    b.machine.update(360);
    expect(b.machine.chargePreteMaintenant).toBe(true);
    expect(b.journal).toContainEqual({ type: "charge", etat: "prete" });
  });

  it("joue une boucle de visée VISIBLE dès l'appui", () => {
    const b = banc();
    b.machine.chargeCommencee(0);
    expect(b.anims()).toContain("ability_e_targeting_loop");
  });

  it("ARBITRAGE 2 — le maintien draine l'endurance", () => {
    const b = banc();
    const depart = b.machine.enduranceCourante;
    b.machine.chargeCommencee(0);
    for (let t = 0; t <= 1000; t += 16) b.machine.update(t);

    // 18/s pendant 1 s → ~18 points. La régénération ne doit PAS compenser.
    expect(b.machine.enduranceCourante).toBeLessThan(depart - 15);
  });

  it("ARBITRAGE 2 — endurance à sec en chargeant : la charge est perdue", () => {
    const b = banc({ enduranceMax: 20, chargeCoutParSec: 40 });
    b.machine.chargeCommencee(0);
    for (let t = 0; t <= 1200; t += 16) b.machine.update(t);

    expect(b.machine.enCharge).toBe(false);
    expect(b.journal).toContainEqual({ type: "charge", etat: "annulee" });

    // Et le relâchement tardif ne ressort pas un coup chargé fantôme.
    b.vider();
    b.machine.chargeRelachee(1200);
    expect(b.anims()).not.toContain("punch_charged");
  });

  it("ARBITRAGE 3 — encaisser un coup perd la charge", () => {
    const b = banc();
    b.machine.chargeCommencee(0);
    b.machine.update(400);
    expect(b.machine.chargePreteMaintenant).toBe(true);

    b.machine.recevoirCoup(400, { degats: 10, angleRad: 0 });
    expect(b.machine.enCharge).toBe(false);

    b.vider();
    b.machine.chargeRelachee(400 + REGLAGES_DEFAUT.hitstunMs + 10);
    expect(b.anims()).not.toContain("punch_charged");
  });

  it("ARBITRAGE 3 — un coup GARDÉ perd aussi la charge", () => {
    const b = banc();
    b.machine.setGarde(true);
    b.machine.update(0);
    b.machine.chargeCommencee(0);
    b.machine.update(400);

    b.machine.recevoirCoup(400, { degats: 10, angleRad: 0 });
    expect(b.machine.enCharge).toBe(false);
  });

  it("n'arme pas la charge en pleine attaque — le relâchement retombe sur l'appui simple", () => {
    const b = banc();
    b.machine.pressAttack(0);
    b.machine.update(150); // phase actif
    b.machine.chargeCommencee(150);
    expect(b.machine.enCharge).toBe(false);

    b.machine.chargeRelachee(150);      // → pressAttack → mise en tampon
    expect(b.machine.tamponArme(150)).toBe(true);

    b.vider();
    b.machine.update(185);
    expect(b.anims()).toContain("punch2"); // le tampon a bien été consommé
  });

  it("ignore un second appui pendant le maintien (auto-répétition clavier)", () => {
    const b = banc();
    b.machine.chargeCommencee(0);
    b.machine.chargeCommencee(100); // ne doit PAS réarmer à 100
    b.machine.update(360);
    expect(b.machine.chargePreteMaintenant).toBe(true); // seuil compté depuis 0
  });

  it("refuse la charge sans endurance et coupe la boucle de visée", () => {
    const b = banc({ enduranceMax: 5, chargeCoutParSec: 0, enduranceRegenParSec: 0 });
    b.machine.chargeCommencee(0);
    b.vider();
    b.machine.chargeRelachee(500);

    expect(b.journal).toContainEqual({ type: "refus", raison: "endurance" });
    expect(b.anims()).toContain("idle");
    expect(b.machine.attaqueCourante).toBeNull();
  });
});

describe("catalogue", () => {
  it("le catalogue livré respecte ses invariants", () => {
    expect(validerCatalogue(COMBO_MAINS_NUES)).toEqual([]);
  });

  it("refuse une fenêtre qui ouvrirait pendant la phase active", () => {
    const casse: Record<AttackId, AttackDef> = {
      ...COMBO_MAINS_NUES,
      punch1: { ...COMBO_MAINS_NUES.punch1, windowOpenMs: 50 },
    };
    const erreurs = validerCatalogue(casse);
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toContain("punch1");
  });

  it("refuse un maillon suivant inatteignable (fenêtre de durée nulle)", () => {
    const casse: Record<AttackId, AttackDef> = {
      ...COMBO_MAINS_NUES,
      punch2: { ...COMBO_MAINS_NUES.punch2, windowOpenMs: 300, windowCloseMs: 300 },
    };
    expect(validerCatalogue(casse).join(" ")).toContain("inatteignable");
  });
});

describe("hitDirection", () => {
  it("range les angles cardinaux dans le bon secteur", () => {
    expect(hitDirection(0)).toBe("front");
    expect(hitDirection(Math.PI / 2)).toBe("right");
    expect(hitDirection(Math.PI)).toBe("back");
    expect(hitDirection(-Math.PI / 2)).toBe("left");
    expect(hitDirection(Math.PI / 4)).toBe("front_right");
    expect(hitDirection(-3 * Math.PI / 4)).toBe("back_left");
  });

  it("est insensible aux tours complets", () => {
    expect(hitDirection(Math.PI / 2 + Math.PI * 4)).toBe("right");
    expect(normaliseAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
  });

  it("le cône de garde suit son ouverture", () => {
    expect(dansConeDeGarde(0, 120)).toBe(true);
    expect(dansConeDeGarde(Math.PI / 3, 120)).toBe(true);   // pile 60°
    expect(dansConeDeGarde(Math.PI / 2, 120)).toBe(false);  // 90° > 60°
    expect(dansConeDeGarde(Math.PI / 2, 200)).toBe(true);   // cône élargi
  });
});
