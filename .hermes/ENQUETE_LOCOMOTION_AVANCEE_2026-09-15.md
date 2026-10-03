# Enquête déplacement avancé (escalade, esquive, roulade, glissade) — synthèse (15/09/2026, agent en lecture seule)

## Verdict
Côté nanos, **aucun système NARVOS** d'escalade, d'esquive, de roulade, de glissade ou de dash : zéro ligne Lua, zéro action dans `Commandes.ACTIONS`, zéro trace de journal. Ce qui tourne est la locomotion NATIVE nanos (attente, marche, course, sprint, saut, accroupi, couché, nage, plongeon) + une escalade/franchissement native non documentée (`FallingMode.Climbing = 2`, `Vaulting = 3` ; `BP_WorldCharacter` cite `AM_Mannequin_Climb`, Vault_Start/Land). Astra n'a rien livré sur ce sujet. Les clips existent et sont sains (160 mesurés, tous SKEL_Mannequin, tous au catalogue) mais rien ne les joue.

## Existant
- Locomotion : `Builder.LOCOMOTION = nil` (`Logic/Character.lua:250`) → `PoserLocomotion` ne pose rien ; blend spaces natifs. La mémoire « locomotion branchée / BS_EnemyWalk » est périmée.
- Sprint lu par `Client/Pas.lua` (GetGaitMode) ; saut : son d'atterrissage ; esquive = seulement le SORT `dps_evasion` (touche 3) — ni déplacement ni immunité (« immunité 3 s » n'est qu'un texte). Le contre (C, 320 ms) est une parade.
- Réseau : mouvement natif piloté par le client propriétaire ; événements `FallingModeChange`, `GaitModeChange`, `StanceModeChange`, `SwimmingModeChange` écoutables des deux côtés ; `Trace` client seulement.
- Touches : aucune action de déplacement ; liste blanche sans Espace/Maj/Ctrl/Alt ; toutes les lettres prises ; libres : 5-0, F1, F2, F11, F12, SOURIS_4, SOURIS_5. Joueur en AZERTY (`[DIAG] clavier : 2`). Défauts Z (véhicules) et Q (menotter) tombent sur l'avance et la gauche AZERTY.
- ABP : le joueur est `BP_WorldCharacter`/`ABP_WorldCharacter` natifs ; slots FullBody, UpperBody, Head, UpperBodySight ; aucun pilotage de variables d'ABP depuis Lua sur `Character` ; `PlayAnimation` sans temps de départ ni section ; notifies utilisables : `Footstep_Sound`, `Movement_Disable`, `Movement_Enable`.

## Clips (mesurés dans le pack cuit)
| Famille | Durée | Root motion |
|---|---|---|
| Mantle 1,0 m `M_Neutral_Traversal_Mantle_1_0_{stand,walk,run}_F_{L,R}foot` | 2,0-3,8 s | oui + verrou |
| Grimper 2,5 m (début) `M_Neutral_Traversal_Climb_Start_2_5_*` | 3,3-4,2 s | oui + verrou (pas de boucle ni de sortie) |
| Vault 1,0 m, Hurdle 1,0 m, Catch_* | 1,7-5,0 s | oui + verrou |
| Glissade `M_Neutral_Slide_{KneesOut,FootOut}_{Into,Loop,Out_*}` | Into 6,1 · Loop 10 · Out 2,9 s | oui + verrou |
| **Esquive `AS_Dodge_Forward1` 2,70 · `Backwards1` 2,20 · `Backwards2` 2,17 · `Left1` 2,50 · `Right1` 2,53** | | oui, sans verrou |
| `AM_Dodge_*` | idem | imports morts (ANS_InvincibilityFrames absents) : utiliser les AS_ |
| Roulade `M_Neutral_Jump_F_Land_Roll_{L,R}foot` | 3,3 s | non |
| Dash `ACB_Dash_*_{IP,RM}_Anim` 0,5 s, `MM_Dash_Anim` 0,97 s | | non (même les _RM) |
Aucun notify de Motion Warping.

## Risques
1. Root motion d'un montage appliqué par nanos : NON VÉRIFIÉ (verticale probablement ignorée en marche).
2. Les animations ne bloquent pas l'entrée (emote FullBody : « le corps glissait ») → `SetInputEnabled` ou `Movement_Disable` nécessaires.
3. Clips longs (2-12,5 s) joués en entier ; `Slide_Loop` ne s'arrête pas seul (StopAnimation).
4. Slots concurrents sans arbitre (réactions UpperBody, sorts UpperBody, coups de pied FullBody 1,57 s, emotes FullBody stop_all).
5. Multijoueur : serveur rejoue l'animation alors que le client a l'autorité du mouvement → rubber-band possible.
6. Mort/respawn/voyage ne remettent rien à zéro : tout `SetInputEnabled`/`SetFlyingMode` futur doit être défait sur Death, Respawn, Destroy, EnterVehicle, Voyage.
7. `Animations.ModePour` rend "RM" par défaut alors que les clips `_RM` n'ont pas de root motion.

## Plan
1. Mesurer d'abord (root motion de `AS_Dodge_Left1`, `ACB_Dash_Left_RM_Anim` témoin négatif, Mantle face à un bloc de 1 m, Land_Roll, Slide Into) — déplacement mesuré par GetLocation avant/après.
2. `Logic/Mouvements.lua` pur + harnais : états libre/esquive/roulade/glissade/franchissement ; priorités mort > véhicule > menottes > mouvement > sort/frappe > emote ; recharges, i-frames ; direction tirée de l'intention de déplacement (vue iso).
3. Serveur : valider, jouer `AS_Dodge_*`, `SetInputEnabled(false)` temporisé, i-frames par retour 0 de `TakeDamage`, `StopAnimation` à la fin et sur Death/Respawn/Destroy/EnterVehicle/Voyage.
4. Client : `Trace` pour le franchissement si l'escalade native ne suffit pas ; glissade = passage en accroupi pendant un sprint au-dessus d'un seuil de vitesse.
5. ADK : montages recadrés (sections, blend-out, Movement_Disable/Enable) pour Slide, Land_Roll, Mantle, puis cook/livraison.
6. Touches : esquive et roulade dans `Commandes.ACTIONS` + ACTIONS client (ex. SOURIS_4 / SOURIS_5) ; corriger les défauts AZERTY avec `Input.GetKeyboardLayout`.

## Essais en jeu (matrice)
Natif : saut (`chute 0→1→0`), sprint (`allure 1→2`), accroupi (`posture 1→2`), rebords 0,5/1/2 m (`→2` ou `→3` ?), enchaînements sprint→saut→rebord, arme en main, emote puis rebord, sort pendant l'escalade, chute haute (`→5`), eau. Une fois implémenté : course→glissade→saut ; saut→escalade→chute ; esquive pendant une attaque ennemie (i-frames) ; esquive pendant son coup de pied ; roulade arme en main ; sort pendant une esquive (refusé, jamais superposé) ; mort pendant l'action puis revive ; véhicule/voyage pendant l'action ; menotté ; AZERTY.