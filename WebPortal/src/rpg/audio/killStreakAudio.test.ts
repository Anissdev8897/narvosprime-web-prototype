import { describe, it, expect } from "vitest";
import { KillStreakAudioSystem, killStreakClip, KILLSTREAK_WINDOW } from "./killStreakAudio";

describe("killStreakClip", () => {
  it("mappe chaque palier au bon fichier", () => {
    expect(killStreakClip(1)).toBeNull();
    expect(killStreakClip(2)).toBe("double_kils.mp3");
    expect(killStreakClip(3)).toBe("triple_frague.mp3");
    expect(killStreakClip(4)).toBe("quadra_kils.mp3");
    expect(killStreakClip(5)).toBe("pentakil.mp3");
    expect(killStreakClip(6)).toBe("masacre.mp3");
    expect(killStreakClip(12)).toBe("masacre.mp3");
  });
});

describe("KillStreakAudioSystem", () => {
  it("escalade tant que les kills restent dans la fenêtre", () => {
    const played: string[] = [];
    const ks = new KillStreakAudioSystem((f) => played.push(f));
    expect(ks.onKill()).toBe(1);              // 1er kill : pas d'annonce
    ks.tick(2);                                // 2 s plus tard (< fenêtre)
    expect(ks.onKill()).toBe(2);
    ks.tick(2);
    expect(ks.onKill()).toBe(3);
    expect(played).toEqual(["double_kils.mp3", "triple_frague.mp3"]);
  });

  it("réinitialise la série si la fenêtre est dépassée", () => {
    const ks = new KillStreakAudioSystem(() => {});
    ks.onKill(); ks.onKill();                  // série = 2
    ks.tick(KILLSTREAK_WINDOW + 1);            // fenêtre dépassée → reset au prochain tick
    expect(ks.streak).toBe(0);
    expect(ks.onKill()).toBe(1);               // repart de zéro
  });
});
