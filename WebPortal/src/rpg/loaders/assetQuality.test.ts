import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ════════════════════════════════════════════════════════════════════════════
// Test 1: refreshQualityCache preserves entry on network error
//
// Vérifie que `refreshQualityCache` distingue "not_found" (fichier absent →
// fallback HIGH) de "error" (réseau coupé → préserver l'ancienne résolution).
// Ce fix est déjà appliqué — le test sert de garde-fou contre la régression.
// ════════════════════════════════════════════════════════════════════════════

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

import {
  isFetchablePath,
  assetExists,
  refreshQualityCache,
  qualityVariant,
  precomputeQualityCache,
  clearQualityCache,
  degradeVariant,
  getQualityStats,
} from "./assetQuality";
import type { AssetStatus } from "./assetQuality";
import { gameSettings } from "../settings/gameSettings";

const TEST_PATH = "/models/test_asset.glb";
const LOW_VARIANT = "/models/test_asset.low.glb";

describe("refreshQualityCache", () => {
  beforeEach(async () => {
    clearQualityCache();
    gameSettings.video.quality = "low";

    // Le variant .low.glb existe → precompute le résout
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/octet-stream" }),
    });

    await precomputeQualityCache([TEST_PATH]);
    expect(qualityVariant(TEST_PATH)).toBe(LOW_VARIANT);
  });

  it("preserves the low variant on network error instead of falling back to HIGH", async () => {
    // ═════════════════════════════════════════════════════════════════════
    //  Scénario : changement de qualité en cours de partie → re-vérification
    //  des variantes. Le réseau est coupé : le cache NE DOIT PAS oublier
    //  la résolution précédente (.low.glb) pour retomber sur HIGH.
    //
    //  Sans le fix (else branch), le code traitait "error" comme "not_found"
    //  et écrivait `path → path` (HIGH), perdant la variante.
    // ═════════════════════════════════════════════════════════════════════

    mockFetch.mockRejectedValue(new Error("Network failure"));
    await refreshQualityCache();

    expect(qualityVariant(TEST_PATH)).toBe(LOW_VARIANT);
  });

  it("falls back to HIGH when the variant no longer exists (404)", async () => {
    // Cas distinct : le fichier .low.glb a vraiment disparu du serveur.
    // Le fallback sur HIGH est le comportement correct.
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "text/html" }),
    });

    await refreshQualityCache();
    expect(qualityVariant(TEST_PATH)).toBe(TEST_PATH);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Tests for isFetchablePath
// ════════════════════════════════════════════════════════════════════════════
describe("isFetchablePath", () => {
  it("returns true for server-relative paths", () => {
    expect(isFetchablePath("/models/x.glb")).toBe(true);
  });

  it("returns true for http URLs", () => {
    expect(isFetchablePath("http://cdn/x.glb")).toBe(true);
  });

  it("returns true for https URLs", () => {
    expect(isFetchablePath("https://cdn/x.glb")).toBe(true);
  });

  it("returns true for blob URLs", () => {
    expect(isFetchablePath("blob:http://localhost/abc-123")).toBe(true);
  });

  it("returns true for data URLs", () => {
    expect(isFetchablePath("data:application/octet-stream;base64,AAAA")).toBe(true);
  });

  it("returns false for editor:// virtual paths (Forge)", () => {
    expect(isFetchablePath("editor://scene-123")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isFetchablePath("")).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Tests for assetExists — including the Vite SPA trap
// ════════════════════════════════════════════════════════════════════════════
describe("assetExists", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns found for 200 + application/octet-stream", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/octet-stream" }),
    });
    const result = await assetExists("/models/test.glb");
    expect(result).toEqual({ status: "found" });
  });

  it("returns not_found for 404", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/octet-stream" }),
    });
    const result = await assetExists("/models/missing.glb");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for 200 + text/html — the Vite SPA trap", async () => {
    // Vite dev server returns index.html (text/html) for unknown paths.
    // Without this check, assetExists would wrongly report "found".
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
    });
    const result = await assetExists("/models/not-real.glb");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for editor:// virtual paths (not fetchable)", async () => {
    const result = await assetExists("editor://scene-123");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns error on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));
    const result = await assetExists("/models/test.glb");
    expect(result).toEqual({ status: "error", reason: "Network failure" });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Tests for degradeVariant
// ════════════════════════════════════════════════════════════════════════════
describe("degradeVariant", () => {
  it("degrades .glb to .med.glb", () => {
    expect(degradeVariant("foo.glb")).toBe("foo.med.glb");
  });

  it("degrades .med.glb to .low.glb", () => {
    expect(degradeVariant("foo.med.glb")).toBe("foo.low.glb");
  });

  it("returns null for .low.glb (already at lowest quality)", () => {
    expect(degradeVariant("foo.low.glb")).toBeNull();
  });

  it("returns null for non-.glb files", () => {
    expect(degradeVariant("foo.fbx")).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Tests for precomputeQualityCache + qualityVariant
// ════════════════════════════════════════════════════════════════════════════
describe("precomputeQualityCache + qualityVariant", () => {
  beforeEach(async () => {
    clearQualityCache();
    mockFetch.mockReset();
  });

  it("resolves to .low.glb when variant exists", async () => {
    gameSettings.video.quality = "low";
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/octet-stream" }),
    });

    await precomputeQualityCache([TEST_PATH]);
    expect(qualityVariant(TEST_PATH)).toBe(LOW_VARIANT);
  });

  it("falls back to original when variant not found (404)", async () => {
    gameSettings.video.quality = "low";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "text/html" }),
    });

    await precomputeQualityCache([TEST_PATH]);
    expect(qualityVariant(TEST_PATH)).toBe(TEST_PATH);
  });

  it("falls back to original on network error (not cached, retry later)", async () => {
    gameSettings.video.quality = "low";
    mockFetch.mockRejectedValue(new Error("Network failure"));

    await precomputeQualityCache([TEST_PATH]);
    // Entry is NOT cached on error → qualityVariant returns original as fallback
    expect(qualityVariant(TEST_PATH)).toBe(TEST_PATH);
    // Proof: nothing was cached (otherwise the test would pass even if cache.set was called)
    expect(getQualityStats().total).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Tests for clearQualityCache + getQualityStats
// ════════════════════════════════════════════════════════════════════════════
describe("clearQualityCache + getQualityStats", () => {
  beforeEach(async () => {
    clearQualityCache();
    mockFetch.mockReset();
    gameSettings.video.quality = "low";
  });

  it("stats reflect cache state after precompute", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/octet-stream" }),
    });

    const paths = ["/models/a.glb", "/models/b.glb"];
    await precomputeQualityCache(paths);

    const stats = getQualityStats();
    expect(stats.total).toBe(2);
    expect(stats.variants).toBe(2);
    expect(stats.fallbacks).toBe(0);
  });

  it("cache is empty after clear", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/octet-stream" }),
    });

    await precomputeQualityCache([TEST_PATH]);
    expect(getQualityStats().total).toBe(1);

    clearQualityCache();
    const stats = getQualityStats();
    expect(stats.total).toBe(0);
    expect(stats.variants).toBe(0);
    expect(stats.fallbacks).toBe(0);
  });
});
