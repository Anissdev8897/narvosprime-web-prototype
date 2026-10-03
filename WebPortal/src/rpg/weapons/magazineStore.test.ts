// weapons/magazineStore.test.ts — chargeur : rechargement, vérification réserve
import { describe, it, expect, beforeEach, vi } from "vitest";
import { magazineStore } from "./magazineStore";
import { ammoStore } from "../combat/ammoStore";

describe("magazineStore", () => {
  beforeEach(() => {
    // reset magazine + ammo avant chaque test
    magazineStore.setWeaponType("pistol");       // maxMag=12
    ammoStore.setCharacter("test-char");
    ammoStore.set({ arrows: 0, cells: 30 });     // 30 cellules en réserve
  });

  it("reload remplit le chargeur après le délai si réserve > 0", async () => {
    // Vider le chargeur
    for (let i = 0; i < 12; i++) magazineStore.fire();
    expect(magazineStore.get().current).toBe(0);
    expect(magazineStore.get().isReloading).toBe(false);

    // Déclencher le rechargement
    const ok = magazineStore.reload();
    expect(ok).toBe(true);
    expect(magazineStore.get().isReloading).toBe(true);

    // Attendre la fin du timer (~1800 ms)
    await new Promise((r) => setTimeout(r, 1900));

    expect(magazineStore.get().isReloading).toBe(false);
    expect(magazineStore.get().current).toBe(12);
  });

  it("reload ne fait rien et retourne false si réserve = 0 (P0 fix)", () => {
    ammoStore.set({ arrows: 0, cells: 0 }); // plus de cellules
    // Vider le chargeur
    for (let i = 0; i < 12; i++) magazineStore.fire();
    expect(magazineStore.get().current).toBe(0);

    const ok = magazineStore.reload();
    expect(ok).toBe(false);
    // Le chargeur reste vide, pas de rechargement
    expect(magazineStore.get().current).toBe(0);
    expect(magazineStore.get().isReloading).toBe(false);
  });

  it("reload ne fait rien si chargeur déjà plein", () => {
    // magazine plein (12/12 après setWeaponType)
    const ok = magazineStore.reload();
    expect(ok).toBe(false);
    expect(magazineStore.get().current).toBe(12);
    expect(magazineStore.get().isReloading).toBe(false);
  });

  it("reload ne fait rien si déjà en cours de rechargement", () => {
    for (let i = 0; i < 12; i++) magazineStore.fire();
    expect(magazineStore.get().current).toBe(0);

    // Premier reload OK
    const ok1 = magazineStore.reload();
    expect(ok1).toBe(true);
    expect(magazineStore.get().isReloading).toBe(true);

    // Second reload refusé (déjà en cours)
    const ok2 = magazineStore.reload();
    expect(ok2).toBe(false);
    expect(magazineStore.get().isReloading).toBe(true);
  });

  it("reload retourne false si réserve = 0 même avec 1 réserve (P0 edge case)", () => {
    ammoStore.set({ arrows: 0, cells: 1 }); // UNE seule cellule
    for (let i = 0; i < 12; i++) magazineStore.fire();
    expect(magazineStore.get().current).toBe(0);

    // Une cellule en réserve → reload OK
    const ok = magazineStore.reload();
    expect(ok).toBe(true);
    expect(magazineStore.get().isReloading).toBe(true);
  });

  it("canFire retourne false quand chargeur vide ou rechargement en cours", () => {
    expect(magazineStore.canFire()).toBe(true); // plein

    for (let i = 0; i < 12; i++) magazineStore.fire();
    expect(magazineStore.canFire()).toBe(false); // vide

    magazineStore.reload();
    expect(magazineStore.canFire()).toBe(false); // en rechargement
  });

  // ── Transfert réserve → chargeur ──────────────────────────────────────────
  // Ces cas n'étaient couverts par AUCUN test : `reload` posait `current = max`
  // sans jamais débiter `ammoStore`, et le tir débitait la réserve en plus du
  // chargeur. Le chargeur se remplissait donc gratuitement pendant que la
  // réserve fondait — deux systèmes qui se contredisaient sans qu'un seul test
  // ne s'en aperçoive.

  it("le rechargement DÉBITE la réserve du nombre de balles rechargées", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 12; i++) magazineStore.fire();   // chargeur vidé
    expect(magazineStore.get().current).toBe(0);
    expect(ammoStore.count("cells")).toBe(30);           // le tir ne touche pas la réserve

    magazineStore.reload();
    await vi.advanceTimersByTimeAsync(2000);

    expect(magazineStore.get().current).toBe(12);
    expect(ammoStore.count("cells")).toBe(18);           // 30 − 12
    vi.useRealTimers();
  });

  it("recharge PARTIELLEMENT quand la réserve est plus petite que le chargeur", async () => {
    vi.useFakeTimers();
    ammoStore.set({ arrows: 0, cells: 5 });
    for (let i = 0; i < 12; i++) magazineStore.fire();

    magazineStore.reload();
    await vi.advanceTimersByTimeAsync(2000);

    expect(magazineStore.get().current).toBe(5);         // pas 12
    expect(ammoStore.count("cells")).toBe(0);
    vi.useRealTimers();
  });

  it("complète un chargeur ENTAMÉ sans dépasser sa capacité", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 4; i++) magazineStore.fire();    // 12 → 8
    magazineStore.reload();
    await vi.advanceTimersByTimeAsync(2000);

    expect(magazineStore.get().current).toBe(12);
    expect(ammoStore.count("cells")).toBe(26);           // 30 − 4, pas 30 − 12
    vi.useRealTimers();
  });

  it("un rechargement ANNULÉ ne consomme aucune munition", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 12; i++) magazineStore.fire();

    magazineStore.reload();
    magazineStore.cancelReload();
    await vi.advanceTimersByTimeAsync(2000);

    expect(ammoStore.count("cells")).toBe(30);           // intacte
    expect(magazineStore.get().current).toBe(0);
    vi.useRealTimers();
  });
});
