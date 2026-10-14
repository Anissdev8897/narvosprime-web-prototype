// ══════════════════════════════════════════════════════════════════════════════
// _racine.mjs — racine du dépôt, déduite de l'emplacement de CE fichier.
//
//   import { RACINE_DEPOT } from "./_racine.mjs";
//   const SHARED = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// Les harnais codaient en dur "E:/narvosprime-web-prototype" : la barrière qualité
// ne tournait que sur une seule machine, un seul disque. Un clone ailleurs (CI,
// Linux, un coéquipier, une autre lettre de lecteur) échouait en ENOENT sur CHAQUE
// lecture de fichier. La racine se déduit maintenant du chemin de ce module —
// scripts/lua-harness/ est toujours à deux niveaux sous la racine — donc la
// batterie tourne partout, sans configuration.
//
// ⚠ Ne JAMAIS réintroduire un chemin absolu en dur. Un chemin lié à une machine
// est un garde-fou qui ne garde que cette machine.
// ══════════════════════════════════════════════════════════════════════════════

import path from "node:path";
import { fileURLToPath } from "node:url";

// scripts/lua-harness/_racine.mjs -> remonter de deux crans = racine du dépôt.
//
// ⚠ EN BARRES OBLIQUES, même sous Windows. `path.resolve` y rend `E:\narvosprime-…` ;
// deux harnais (progression, reputation) ÉCRIVENT ce chemin dans un fichier TS qu'ils
// font bundler : dans une chaîne de code, `\n` de `\narvosprime` est un saut de ligne,
// et esbuild cherche un fichier qui n'existe pas (mesuré le 2026-10-04 : les deux
// rouges, « Could not resolve »). Node accepte `/` partout ; une chaîne aussi.
export const RACINE_DEPOT = path
  .resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
  .split(path.sep)
  .join("/");
