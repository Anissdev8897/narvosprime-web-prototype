# HANDOFF LOT 8 → CLAUDE (côté Unreal / serveur / sécurité)

Date : 2026-09-08 · Auteur : Hermes · Destinataire : Claude.
> Suite du lot 7 (`docs/HANDOFF_LOT7_2026-09-08.md`). Ici : **tout le lot 8**.

## 1. Ce qui est fait (tout vert, preuves)

```
syntaxe     60 générateurs compilent          portée  Aucun emploi avant déclaration
tsc         0 erreur                           icônes 65 items, 0 problème (sur disque)
quetes 33/33   dialogue 19/19   craft 214/214 + 46   recolte 37/37
radar   252/252 + 12        audio 27/27
reputation  parité 25/25 + 22/22   competences  parité 440/440 + 16/16
```

### T1 — `SurKillJoueur` branché (les quêtes de kill avancent)
**Décision : voie n°2 — lire `instigator` depuis `Death`** (lue dans l'API, pas devinée) :
`BaseDamageable.json:204-237` → `Death(self, last_damage_taken, last_bone_damaged,
damage_type_reason, hit_from_direction, instigator: Player?, causer: Actor?)`.
- `instigator` est bien fourni → branchement dans `narvos-map-proto/Server/Index.lua`
  (`Character.Subscribe("Death", ...)` → `SurKillJoueur(instigator, nil)`).
- **Aucune table à purger** (l'instigator est un argument d'événement, pas un état) —
  donc pas de nouvelle purge de déconnexion.
- **Comportement** : chute/poison/lave → `instigator=nil` → pas de crédit (juste) ;
  le joueur au coup **fatal** est crédité (standard).
- **Limite consignée** : `folder=nil` → seules les quêtes "kill any" avancent. Les quêtes
  `enemyFolder:"space_ship"` (contexte spatial) ne matchent pas sur le hub.

### T2 — 65 icônes (fait à la source + vérifié sur disque)
- `iconFile: "tex_<famille>_01"` ajouté aux **65** items dans `itemCatalog.ts` (source de
  vérité) + `iconFile?: string` dans `ItemDefinition.ts`. `Items.lua` régénéré = **65**.
- L'émoji `icon` est **gardé** en repli (champ ajouté, pas remplacé).
- **`scripts/narvos-verifier-icones.mjs`** : `[icones] 65 items, 0 problème(s)` — chaque
  chemin `public/textures/icons/craft/tex_*.webp` existe (élément qui compte : une icône
  morte ne se voit qu'à l'écran). Fixé : 3 outils avaient `iconFile` hors de l'objet.
- Mapping par famille (ingots/gemstone/wood/herbs/reagent/tools/stone/container/cloth/leather/strings/spare_parts).

### T3 — Sons (DATA portée, plomberie = ton rôle)
- `Shared/Catalogs/Sons.lua` (26 catégories de pas + règles matériau→catégorie + boss/
  zones/série) + `Shared/Logic/Audio.lua` (sélection pure : `ClasseSurface`,
  `BossEngage` 1×, `AnnounceZone`, `SerieKill`/`SerieTick`/`SerieNiveau` fenêtre 10 s).
- **Trouvaille (confirmée + chiffrée)** : les ~930 sons du pack `Assets.toml [assets.sounds]`
  sont des **PAS**. Les **13 sons d'événement** (`entre_de_la_mapforge`, `double_kils`,
  `pentakil`, `masacre`…) sont **ABSENTS** du pack (0/13) — ce sont des **voix françaises
  `.mp3` dans `public/models/voice_characters/`** (17 fichiers, 1,6 Mo). `narvos-verifier-sons.mjs`
  (à placer dans `scripts/lua-harness/` — résolution wasmoon depuis l'emplacement du fichier)
  → **13 références mortes**.
- ⚠ **À trancher** : tous les exemples `SoundPath` de l'API sont `pack::Asset`. Rien ne
  garantit que nanos joue un `.mp3` brut → il faudra **importer + cuire** ces 17 voix,
  ou les laisser au Web Audio client.

### T4 — Réputation + Compétences (parité TS)
- `Shared/Catalogs/Reputations.lua` (7 tiers + gains) + `Shared/Logic/Reputation.lua`
  (Tier/currentTier, Suivant, ReductionMarchand, Ajouter/Retirer/Definir immuables) —
  **parité 25/25**.
- `Shared/Catalogs/Archetypes.lua` (10 templates) + `Shared/Logic/Competences.lua`
  (générateur classe × archétype) — **parité 440/440 champs (40 compétences)**.
- ⚠ **Le commentaire TS dit « 10 classes » mais il n'y en a que 4** → 40 sorts, pas 100.
- ⚠ `Classes.lua` était **déjà un catalogue généré** (je l'avais écrasé par erreur) → régénéré
  via `narvos-catalogs-to-lua.mjs --apply`, `Competences.lua` adapté à `baseStats.attackPower`
  + `Elements.ELEMENTS[element].label`. **Ne pas régénérer sans relire** les catalogues.

## 2. Ce qui reste pour toi (Claude)
1. **Getfolder de l'ennemi tué** : je n'ai pas trouvé dans l'API comment récupérer le
   `folder` de l'entité tuée (les getters `GetActorName`/`GetFolder` ne sont que sur
   `Player`/`WebUI`). Les quêtes "space_ship" ne matchent pas tant que ce folder n'est pas
   exposé/capturé au spawn.
2. **17 voix françaises** : cuire dans `Assets.toml` (ou décider Web Audio). Vérifier que
   nanos `Sound("pack::...")` accepte un asset non-cuit avant.
3. **Test `reputation_min`** de `Npc.lua` : la condition existe, le système est maintenant
   porté — à câbler (le serveur doit lire `Narvos.Reputation.TierFaction` dans les NPC).

## 3. Rubrique « ce dont je ne suis pas sûr »
- **`instigator` du `Death`** : vérifié dans l'API. Mais le **folder** d'entité n'a pas de
  getter confirmé → je passe `nil` (kill-any seulement).
- **`Competences`** : parité TS exacte (440/440) mais je n'ai **pas** porté `classes/spells/
  talents/elements` (déjà générés) — le générateur ne lit que Classes+Elements+Archetypes.
- **`verifier-sons`** : lancé par Claude (13 morts). Je confirme que c'est une donnée
  client (voix), pas un asset nanos — donc la "référence morte" est un état de fait, pas
  une erreur de portage.
- **Map `reputation_min`** : le système est pur, mais le point d'entrée serveur (qui lit le
  tier d'une faction pour une quête) n'est **pas encore branché** — condition → système.
- **`SerieNiveau`** : mon `Sons.SERIES["6+"]` est la clé du palier MASSACRE ; le TS traitait
  les kills >=6 → j'ai mis 6+. À confirmer si la limite est 6 ou un autre palier (le TS
  `KILLSTREAK_WINDOW=10` est la fenêtre, pas le palier).

## 4. Fichiers créés/modifiés
**Créés** : `Shared/Catalogs/{Reputations,Archetypes}.lua`, `Shared/Logic/{Reputation,Competences}.lua`,
`Shared/Catalogs/Sons.lua`, `Shared/Logic/Audio.lua`, `scripts/lua-harness/{reputation,competences,audio}.mjs`
+ `{-tests}.lua`, `scripts/narvos-verifier-icones.mjs`, `scripts/narvos-verifier-sons.mjs`.
**Modifiés** : `itemCatalog.ts` (+65 `iconFile`), `ItemDefinition.ts` (+`iconFile?`), `Items.lua`
(régénéré), `Server/Index.lua` (hook kill), `quetes-tests.lua` (+kill-folder), `Shared/Index.lua`
(expose Reputation/Competences/Archetypes/Reputations).