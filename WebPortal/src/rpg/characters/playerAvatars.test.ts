import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PLAYER_AVATARS, DEFAULT_AVATAR, coerceAvatarId, ownAnimPath } from "./playerAvatars";

const PUBLIC = path.resolve(__dirname, "../../../public");

describe("roster jouable", () => {
  it("chaque avatar a son GLB sur le disque", () => {
    // Le fallback SPA de Vite renvoie du text/html en 200 pour un fichier
    // absent : un chemin faux ne lève rien, le Canvas d'aperçu se contente de
    // planter au parse. Seul endroit où on peut l'attraper avant le joueur.
    const manquants = PLAYER_AVATARS
      .filter((a) => a.ownAnimPath && !fs.existsSync(path.join(PUBLIC, a.ownAnimPath.replace(/^\//, ""))))
      .map((a) => `${a.id} → ${a.ownAnimPath}`);
    expect(manquants, `avatars sans modèle :\n${manquants.join("\n")}`).toEqual([]);
  });

  it("aucun identifiant en double", () => {
    const ids = PLAYER_AVATARS.map((a) => a.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("l'avatar par défaut fait partie du roster", () => {
    expect(PLAYER_AVATARS.some((a) => a.id === DEFAULT_AVATAR)).toBe(true);
  });

  it("AUCUN avatar n'est resté sur le matériau par défaut d'Unreal", () => {
    // LE garde-fou qui manquait. Le pack Trooper a été ajouté au roster alors
    // que ses 33 GLB n'ont qu'un matériau : `WorldGridMaterial`, le damier gris
    // d'Unreal. Résultat en jeu : trois personnages entièrement gris.
    //
    // Ni `tsc` ni le rendu ne signalent ça — le GLB charge parfaitement, il est
    // juste gris. C'est le seul endroit où l'on peut l'attraper.
    const gris: string[] = [];
    for (const a of PLAYER_AVATARS) {
      if (!a.ownAnimPath) continue;
      const f = path.join(PUBLIC, a.ownAnimPath.replace(/^\//, ""));
      if (!fs.existsSync(f)) continue;   // couvert par le test précédent
      const fd = fs.openSync(f, "r");
      const h = Buffer.alloc(20); fs.readSync(fd, h, 0, 20, 0);
      const len = h.readUInt32LE(12);
      const b = Buffer.alloc(len); fs.readSync(fd, b, 0, len, 20);
      fs.closeSync(fd);
      const json = JSON.parse(b.toString("utf8")) as { materials?: { name?: string }[] };
      const noms = (json.materials ?? []).map((m) => m.name ?? "");
      if (noms.length > 0 && noms.every((n) => /WorldGrid/i.test(n))) {
        gris.push(`${a.id} → ${noms.join(", ")}`);
      }
    }
    expect(
      gris,
      `avatars sans matériau réel — ils apparaîtront GRIS en jeu : ${gris.join(" · ")}`,
    ).toEqual([]);
  });

  it("les avatars au rig UE Mannequin sont marqués", () => {
    // Sans ce drapeau, le dispatcher d'animation les envoie dans la branche
    // « anims embarquées uniquement » — or ils n'en ont AUCUNE, et le
    // personnage reste figé sans le moindre message.
    for (const id of ["samurai", "samurai_nohelm", "valkiria"]) {
      const a = PLAYER_AVATARS.find((x) => x.id === id);
      expect(a, id).toBeDefined();
      expect(a?.ueMannequinRig, `${id} : rig UE non déclaré → pas d'animation`).toBe(true);
    }
  });

  it("les nouveaux corps pointent vers des fichiers DISTINCTS", () => {
    // Une erreur de copier-coller donnerait plusieurs entrées sur le même GLB :
    // le choix existerait dans l'UI et ne changerait rien à l'écran.
    const chemins = ["samurai", "samurai_nohelm", "valkiria"]
      .map((id) => ownAnimPath(id));
    expect(chemins.every(Boolean)).toBe(true);
    expect(new Set(chemins).size).toBe(chemins.length);
  });

  it("un id retiré du roster retombe sur le défaut", () => {
    expect(coerceAvatarId("rampage_brute")).toBe(DEFAULT_AVATAR);
    expect(coerceAvatarId(undefined)).toBe(DEFAULT_AVATAR);
    expect(coerceAvatarId("samurai")).toBe("samurai");
    // Un Trooper enregistré avant son retrait doit retomber sur le défaut.
    expect(coerceAvatarId("trooper_m")).toBe(DEFAULT_AVATAR);
  });
});
