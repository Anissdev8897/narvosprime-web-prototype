# REPRISE — Session 2026-09-22 → prochaine session

## À attaquer (priorité utilisateur)
**AnimBP locomotion** (todo `anim-animbp`, in_progress) — puis Dodge (roadmap 5), puis roadmap dans l'ordre.

## État du jour (fait & vérifié)
- ✅ Escalade/Franchissement v2 : normale mur, snap SetRotation, capsule NoCollision→Normal
  avant gravité, arc 2 phases mantle/climb + arc sin vault. Harnais wasmoon 25/25 verts
  (`scripts/lua-harness/traversee-harness.mjs`). Backups :
  `scripts/lua-harness/backups/traversee-20260922/`.
- ✅ SORTS & ANIMS : 5/8 tâches fermées (système 12 sorts complet, VFX 12/12, 74 gestes
  100% SKEL_Mannequin). Rapports : `.hermes/AUDIT_CASTS_2026-09-22.md` +
  `.hermes/AUDIT_VFX_CASTS_2026-09-22.md`.
- ❌ retarget-cast annulé (pack MagicCombatSystem absent du disque) ; anim-cast-montages
  abandonné (décision user : on garde les gestes empruntés).

## Point de départ AnimBP (déjà audité — audit_nanos_loco.txt du 20/09, Saved/)
- Locomotion NATIVE nanos déjà active (marche/course/sprint/accroupi/saut) — volontaire
  (`Shared/Logic/Character.lua:250` `LOCOMOTION = nil`).
- À FABRIQUER dans l'éditeur : blend spaces NARVOS (marche/course/accroupi) via MCP
  `create_blend_space` ; puis poser `LOCOMOTION` dans Character.lua:246-249.
  Seul blend space existant : `BS_EnemyWalk` (lié SKEL_Mannequin).
- Esquive/Dash : anims CUITES non câblées `ACB_Dash_Forward/Backward/Left/Right` (IP+RM,
  `Catalogs/Animations.lua:154-169`) + `MM_Dash_Anim` (:1605). 0 référence gameplay.
- Roulade (roll) : ABSENTE (aucune anim câblée) → chercher dans le pack une anim roll,
  sinon décider avec le user (réutiliser une anim du pack ou importer).
- Prérequis : relancer l'éditeur Unreal (projet `D:/steam/steamapps/common/nanos-world-
  playtest/NanosWorld/NanosWorld.uproject`) → MCP port 13579 (bridge
  `C:/Users/aniss/AppData/Local/hermes/scripts/unreal_bridge.py`). L'éditeur ne tournait
  pas le 22/09 au soir.
- VFX FlameExplosion (Blender) : introuvable dans le projet, à réimporter si voulu
  (`D:/mes_projet/NARVOS_VFX/FlameExplosion/FlameExplosion.fbx`).

## Pièges/leçons du jour (enregistrés dans skill lua-harness-verification)
- `math.atan2` n'existe pas en Lua 5.4 → `math.atan(y, x)`.
- Stubs wasmoon de méthodes `:` → toujours `function(self, ...)`.
- Nombres Lua → tostring « 140.0 » → parseFloat côté JS.
- Avancer l'horloge mockée entre 2 appels réussis du même harnais (cooldown).
- Hit-result Trace nanos : pas de normale → 2 traces latérales (tangente → normale).