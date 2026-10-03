# Enquête armes de mêlée — synthèse (15/09/2026, agent en lecture seule)

## Verdict
La mêlée armée est écrite et câblée mais **jamais vue en jeu** (0 trace `Melee` dans 102 journaux serveur et 71 client). Aucune épée, aucun bâton, rien de Hyper ni d'ISP ne pouvait arriver en main : seuls 6 outils du pack de base (`CombatServeur.ARMES`), et toutes les lames du sac donnaient une batte. Les bonnes animations existent, cuites sur SKEL_Mannequin.

## Existant (avant correctifs du 15/09 soir)
- `CombatServeur.ARMES` : pied_de_biche (`nanos-world::SM_Crowbar_01`), batte (`SM_BaseballBat_01`), hache (`SM_Axe_01`), masse (`SM_Hammer`), cle (`SM_PipeWrench_01`, orienté selon X), pelle (`SM_Shovel_01`).
- `Roue.ARME_PAR_ITEM` : 7 lames NARVOS → batte, hache_raffinee → hache ; aucun objet Hyper/ISP.
- Objets de mêlée cuits (Assets.toml) : épées `SM_Sword_Iron/Steel/Light_Epic/Light_Legend`, `SM_HeroBlade`, `SM_NatheSword`, `SM_Katana` (hors catalogue) ; lourdes `SM_LongSword_Iron/Steel`, `SM_Sword_Heavy`, `SM_Blade_Legend` (292 cm selon X) ; dagues `SM_Dagger_Iron/Steel/Legend`, `SM_Knife` ; haches `SM_Hatchet_Stone/Iron/Steel/Legend` ; contondants `SM_Hammer`, `SM_Crowbar`, `SM_Pipe_5` (0 collision, clé de rang) ; lances `SM_Spear`, `SM_Spear_Stone` (selon X, pivot au centre) ; bâtons `SM_Staff_Epic` (selon X), `SM_Staff_Legend` (Magic, pas mêlée) ; boucliers (pas de logique main gauche). À proscrire : `SM_Weapon_Baseball_01` (569 522 triangles), tous les `SK_*` (Melee attend un StaticMesh).
- Chaîne : `Narvos:Inventaire:Equiper`/roue → `ExecuterPlanObjet("equiper_melee")` → `CombatServeur.Equiper` → `Melee(...)`, `SetBaseDamage`, `SetDamageSettings(0.3, 0.5)`, `SetCooldown`, animation ACB_Attack (arbalète) posée coup après coup, `PickUp`. Jamais posés : `SetAttachmentSettings`, `SetImpactSound`, `SetSoundUse`, `SetScale`, marques de projection.
- Défauts de synchronisation (déduits du code) : animation décalée d'un coup ; enchaînement jamais au-delà de l'étape 1 (fenêtre 740×cadence ms < recharge 1000×cadence ms, horloge à pas fixe) ; contre : action `Counter_<dir>` alors que les clés cuites sont `AS_CounterFront_A` → rien joué, pas de riposte ; HUD affiche les dégâts avant le toucher ; arme tenue par le porteur invisible (~8 cm de la main MetaHuman).

## Animations compatibles SKEL_Mannequin
- Pack de base (DefaultAssetPack.toml:1333-1337) : `AM_Mannequin_Melee_Slash_Attack` (Crowbar/Bat officiels, fenêtre 0,3/0,5, recharge 1,0), `…_Slash_Outward_Attack` (corps entier ≈ 2,03 s), `…_Stab_Attack` (Knife, 0,3/0,3, recharge 1,5), `…_Bayonet_Stab_Attack`, `AM_Mannequin_Torch_Attack` (0,5/0,25). Pas de root motion.
- Pack narvos : `PrimaryAttack_C_Slow` 1,267 s / `_D_Slow` 1,467 s (RM), `AS_LongRangeClubFront1/2/3` 2,0 s (RM), `AS_CounterFront_A/B` 1,58/1,71 s (RM), `ACB_Attack_0x_IP` 1,0-1,37 s, `block_in/loop/out_Anim`, `attack_jab_fast_Rhand_01_Anim` 0,667 s, `Pick_Swing_*` ~2,9 s. À exclure : `AM_LongRangeClub*`, `AM_Counter*` (imports Freeflow absents), `AS_FightAttack/Defend_*` (duos).
- Non cuites (ADK, retarget UE5→UE4 + cook) : Hyper Sword/Dagger/Spear/Staff/Blade, AdvancedARPGCombat 1H/2H.

## Sons
`nanos-world::A_Punch_Cue` (chair, officiel), `A_MetalHeavy_Impact_MS`, `A_WoodHeavy_Impact_MS`, `A_Whoosh`.

## Plan (proposé par l'enquête)
1. `Logic/Melee.lua` pur : familles (prise, gestes, fenêtre, recharge, portée, attache, échelle), classement des objets, `Reglages(item)`, `Integrer(ITEM_DB, Roue)` sans écraser les armes à feu. **FAIT le 15/09 soir (voir rapport d'état).**
2. `Server/Combat.lua` : `SetAttachmentSettings` avant `PickUp`, `SetScale`, `SetImpactSound`/`SetSoundUse`, fenêtre et recharge par famille ; horloge `Server.GetTime()` ; contre `AS_Counter<Dir>_A` + riposte ; témoins `[MELEE]`. **Partiellement FAIT (réglages par objet) ; horloge et contre NON faits.**
3. Générateurs : lire `adk/_datatables/DT_Equipment.json` (Hyper : socket, décalage, montages) ; transporter les mêlées officielles perdues par `narvos-armes-base-to-lua.mjs:70`. NON fait.
4. Inventaire : filtres par famille (épées, bâtons, distance, autres). NON fait.
5. Phase B (cook) : retarget des animations Hyper/ARPG vers UE4, mesure des impacts dans l'ADK.
6. Harnais `melee.mjs` (familles, clés d'animation dans les manifestes, interdits, cohérence fenêtre/recharge, idempotence) + corrections de `combat-tests.lua`. NON fait.

## Essais en jeu à faire
Démarrage `[MELEE] N arme(s)…` ; équiper `hyper_basic_iron_sword` (lame dans le poing en 1ʳᵉ/3ᵉ personne, `/diag`) ; trois clics (gestes de la famille, dégâts au bon moment, sur Character puis CharacterSimple) ; une arme par famille (pointe de lance, tranchant de hache vers l'avant) ; root motion des clips RM ; T / mort / reconnexion ; contre ; sons d'impact.