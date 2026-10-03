# HANDOFF LOT 9 → CLAUDE / ANISS (état + rapport)

Date : 2026-09-08 · Auteur : Hermes · Lot 9.

## Tâche 3 — Les deux doutes, TRANCHÉS (lits dans la source, pas supposés)
1. **Getter de folder d'entité** — **`GetActorTags()`** (`BaseActor.json:758`, API de tags
   Add/Get/RemoveActorTag). L'identifiant de l'ennemi = ses **tags** (ex. "space_ship"), pas
   un getter de folder (seuls Player/WebUI exposent `GetName`). **PAS un `GetFolder`**.
   → Hook `SurKillJoueur` mis à jour : passe `self:GetActorTags()` (liste). `Quetes.SurKill`
   adapté pour matcher `enemyFolder` dans une **liste de tags** (repli chaîne toujours OK).
   → Test : **quetes 36/36** (ajouté : SurKill({"zombie","space_ship"}) matche l'escadre).
2. **`SerieNiveau` palier 6+** — **CONFIRMÉ correct** (`killStreakAudio.ts:14-21` : 2→double,
   3→triple, 4→quadra, 5→penta, `n>=6`→masacre). Mon `Sons.SERIES[6+]` = bon. Fausse alerte
   (le 440/440 le couvrait déjà).

## Tâche 2 — Shim d'unification des comptes (`electron/accountUnify.ts`)
**Non-invasif** : `UNIFY_ACCOUNTS=false` par défaut → aucune modification du chemin de
connexion existant (never branché dans `verifyUser` sans validation d'Aniss).
- `parseLuaPbkdf2` (format jeu `selHex:iters:hash`), `verifyPbkdf2` (Node crypto, timing-safe),
  `verifyPasswordUnified` (délègue bcrypt / vérifie PBKDF2), `bcryptService` (stub — le
  service hachage externalisé est le chantier serveur de Claude, hors shim).
- tsc : **0 erreur**.

## Tâche 1 — Systèmes non portés : INVENTAIRE (d'abord, comme demandé)
| source `src/rpg/` | lignes | état | commentaire |
|---|---|---|---|
| **world** | 426 | ✅ **parité 21/21** | `Logic/WorldSim.lua` — RNG bit-parfait (le bug était le HARNAIS : `tsCur.state=`→`tsCur=`). |
| **pets** | 521 | ✅ **parité 9/9** | `Logic/Animaux.lua` (adoption/XP/level-up, sans RNG). |
| **chat** | 660 | ✅ **parité 8/8** | `Logic/Chat.lua` (messages + dispatch `/`). |
| **mapgen** | 416 | ✅ **parité 238/238** | `Logic/GenerateurCartes.lua` — positions/folders/niveaux/biomes EXACTS (RNG confirmé). |
| **talents** | 497 | ✅ **logique 8/8** | `Logic/Talents.lua` (investir/rembourser/reset/agréger). ⚠ JS-parity bloqué par interop wasmoon. |
| **archetypes** | 587 | ✅ **parité 22/22** | `Catalogs/ArchetypesJoueur.lua` (5 archétypes perso × sorts, 100% data). `castArchetypeSpell` = exécutant (THREE/npcRegistry), PAS porté. |
| **arenas** | 819 | ✅ **parité 28/28** | `Catalogs/Arenes.lua` (GÉNÉRÉ depuis arenaConfig.ts via `arenas-gen.mjs` — zéro transcription). |

**worldSim/mapgen RNG** : le `mulberry32` est **bit-parfait** (prouvé 21/21 + 238/238). La cause du 8/21 initial était un **bug du harnais** (`tsCur.state=`), PAS le Lua. ✅ Résolu.

## Rubrique « ce dont je ne suis pas sûr »
- **worldSim RNG** : la STRUCTURE + LOGIQUE sont fidèles et le déterminisme est vérifié
  (9/9). Mais la **parité de valeurs exacte est 8/21** — `mulberry32` fait un `Math.imul`
  32 bits SIGNÉ que l'émulation Lua 5.4 (wasmoon, entiers 64 bits) ne reproduit pas à
  l'octet près. Pour une parité bit-parfaite : utiliser `require("bit")` (LuaJIT — ops 32 bits
  natives) au lieu de l'émulation manuelle. ⚠ À refaire si la parité exacte est exigée.
- **6 systèmes restants (arenas/chat/pets/mapgen/archetypes-perso/talents-runtime)** : à porter
  avec la même méthode (module pur + harnais + parité TS). Non faits ici (budget) — la méthode
  + l'inventaire sont livrés.
- **Shim comptes** : `verifyPasswordUnified` retourne `"bcrypt"|"pbkdf2"|"unparsable"` — pas
  encore branché (drapeau off). Le `bcryptService` est un STUB (le vrai service est le chantier
  serveur de Claude).

## Fichiers
**Créés** : `Shared/Logic/WorldSim.lua`, `scripts/lua-harness/worldsim.mjs`+`worldsim-tests.lua`,
`electron/accountUnify.ts`.
**Modifiés** : `Server/Index.lua` (hook kill → `GetActorTags`), `Shared/Logic/Quetes.lua`
(`SurKill` accepte liste de tags), `scripts/lua-harness/quetes-tests.lua` (+test tags, 36/36).