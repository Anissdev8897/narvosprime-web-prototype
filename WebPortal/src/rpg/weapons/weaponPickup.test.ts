import { describe, it, expect } from "vitest";
import { canPickup, profileForPath, pickupMessage, slotForPickup } from "./weaponPickup";
import { weaponRegistry } from "./weaponRegistry";
import type { GroundWeapon } from "./groundWeaponStore";

/** Première arme réellement équipable du registre — pas un chemin inventé. */
const REELLE = weaponRegistry.all().find((p) => /\.glb$/i.test(p.path))!;

const auSol = (path: string, label = "Arme"): GroundWeapon => ({
  id: "gw1", weaponPath: path, label, pos: [0, 0, 0], rot: [0, 0, 0],
});

describe("profileForPath", () => {
  it("résout une arme du catalogue par son CHEMIN", () => {
    // Le sol connaît le fichier, pas l'identifiant interne : la recherche doit
    // se faire par chemin.
    expect(profileForPath(REELLE.path)?.path).toBe(REELLE.path);
  });

  it("rend undefined pour un chemin inconnu", () => {
    expect(profileForPath("/models/armes/nexiste_pas.glb")).toBeUndefined();
  });
});

describe("canPickup", () => {
  it("accepte une vraie arme du catalogue", () => {
    const r = canPickup(auSol(REELLE.path));
    expect(r.ok).toBe(true);
    expect(r.profile?.path).toBe(REELLE.path);
  });

  it("refuse quand l'arme n'est plus au sol", () => {
    // Cas du double appui : la première pression a déjà retiré l'arme.
    const r = canPickup(null);
    expect(r).toEqual({ ok: false, reason: "introuvable" });
  });

  it("refuse une MUNITION avec le bon motif", () => {
    // « ce n'est pas une arme » est plus juste que « profil manquant » pour une
    // flèche — d'où l'ordre des contrôles.
    const r = canPickup(auSol("/models/armes/weapon/arrow/Arrow00_mesh.glb", "Flèche"));
    expect(r).toEqual({ ok: false, reason: "pas_une_arme" });
  });

  it("refuse un CLIP D'ANIMATION ramassé par erreur", () => {
    const r = canPickup(auSol("/models/armes/revolver/AS_HS_WP03_Revolver_Fire.glb"));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("pas_une_arme");
  });

  it("refuse une arme sans profil PLUTÔT que de la détruire", () => {
    // Le point d'ordre : la résolution du profil passe AVANT le retrait du sol.
    // Ici l'arme est bien typée mais absente du registre.
    const r = canPickup(auSol("/models/armes/inconnu/SM_sword_fantome.glb", "Épée fantôme"));
    expect(r).toEqual({ ok: false, reason: "sans_profil" });
  });

  it("ne MODIFIE rien — la décision est pure", () => {
    // Elle est appelée à chaque frame pour l'invite à l'écran : le moindre
    // effet de bord s'exécuterait 60 fois par seconde.
    const w = auSol(REELLE.path);
    const avant = JSON.stringify(w);
    canPickup(w); canPickup(w);
    expect(JSON.stringify(w)).toBe(avant);
  });
});

describe("pickupMessage", () => {
  it("nomme l'arme en cas de succès", () => {
    const r = canPickup(auSol(REELLE.path, "Fusil à pompe"));
    expect(pickupMessage(r)).toContain("Fusil à pompe");
  });

  it("chaque échec a son PROPRE message, jamais « erreur »", () => {
    const msgs = (["introuvable", "hors_portee", "pas_une_arme", "sans_profil"] as const)
      .map((reason) => pickupMessage({ ok: false, reason }));
    expect(new Set(msgs).size, "deux échecs partagent le même message").toBe(4);
    for (const m of msgs) expect(m.length).toBeGreaterThan(10);
  });
});

describe("slotForPickup", () => {
  it("remplit la main principale d'abord", () => {
    expect(slotForPickup({ primary: null, secondary: null })).toBe("primary");
  });

  it("puis la secondaire", () => {
    expect(slotForPickup({ primary: "a", secondary: null })).toBe("secondary");
  });

  it("les deux pleines → REMPLACE la principale", () => {
    // C'est celle que le joueur regarde : un ramassage qui ne change rien à
    // l'écran passerait pour un bug.
    expect(slotForPickup({ primary: "a", secondary: "b" })).toBe("primary");
  });
});
