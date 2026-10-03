# Carnet de route — demandes de Hanibes, 2026-09-13 soir

Ordre voulu : terminer d'abord le MetaHuman (A), puis les chantiers B1-B6.

## A — MetaHuman : visible, puis TOUT le Meta Customization System + menus

Etat 18:0x : plus de crash (visage sans LiveLink cuit et prouve), foret texturee (OK joueur).
Reste : a l'apercu de creation, seules les TONGS s'affichent (corps, tete, cheveux absents).
Mesure : grooms lies a Face_Archetype, exclu des liens durs -> cheveux/sourcils. Corps/tete :
cause NON trouvee (API : SetMaterial "" = mesh principal seulement).

Cible (captures du pack, Fab a03c6e77-a35b-436a-b300-61295671481e, V1.1 UE 5.4) :
- BODY CUSTOMIZATION : Head, Upper Body, Chest, Upper/Middle/Lower Waist, Thigh Spacing,
  Lower Hip, Buttocks, Thigh, Shin, Foot, Height, Arm Length, Arm Size, Hand Size.
- FACIAL CUSTOMIZATION : Face Type, Brow Shape, Eyebrows, Eye Position V/H, Eye Shape (+ Intensity),
  Upper/Lower Lip Size, Lip Shape (+ Intensity), Mouth Width, Nose Shape (+ Intensity), Jaw Shape
  (+ Intensity), Ear Shape.
- Tint & Tattoo, Eye Color, Skin <>, Hair <>, Prop <>, Clothing, Costumes <>, Female/Male,
  Toggle Customization / Physics / Animation, Slots 1-18 (presets).
- Evenements du BP releves en jeu : Change_Top, Change_Bottoms, Change_Shoes, Change_Outfit,
  Change_Prop, Change_Hair, Change_Hair_Colour, Change_Eyes, Change_Skin, Change_Skin_Mat,
  Change_Skin_Tint, Change_Skin_Color_Value, Change_Tattoo, Change_face.
- Menus : dans le style NARVOS (WebUI creation), valeurs persistees en base, appliquees au spawn.

### Mesures du 13/09 19h (fichiers du pack, sans editeur)
- Invisibilite corps/tete : cause = reglages 16 bits / influences illimitees de l'ADK absents du
  client ; recook `.hermes/session-skinning-client.sh` lance 18:47 (A VOIR EN JEU).
- `BP_Meta_Styler` (6 Mo) = chef d'orchestre : Change_Top/Bottoms/Shoes/Outfit/Prop/Hair/
  Hair_Colour/Eyes/Skin/Skin_Tint/Skin_Color_Value/Tattoo, Change_to_slot, Save/LoadGameFromSlot,
  Load_Male/Female_Character. Cite 102 assets : vetements F 11/11 cuits, H 5/6, Metawadrobe 4/5,
  PEAUX par identite MetaHuman (FCS0-8, MCS2-8) : 0 cuite hors MCSGavin/FCSBase.
- `BP_MH_Male/Female` (originaux) appliquent : SetSkeletalMeshAsset, SetGroomAsset/SetBindingAsset,
  SetMorphTarget, parametres de materiaux, FaceTypeSlider (visages MCS2/3/4, Natalia, Anime),
  BP_Meta_Face_Tool, AnimBP_RTG_metahuman_base_skel (outil Corps). Copies ADK = refs NULLES.
- Emplacements 1-18 : AnimBP_Body_Tool_Slot_N / AnimBP_Face_Tool_Slot_N + BP_Save_Game_Data.

### Plan A (apres le recook)
1. Liens durs passe 2 de Metahuman_Ref (toutes identites FCS/MCS, sans AnimSequence).
2. Restaurer BP_MH_Male/Female ORIGINAUX (refs) + copies BP_NarvosMCS_M/F : Body racine +
   retarget depuis le porteur (en gardant l'outil Corps : dupliquer AnimBP_RTG_metahuman_base_skel
   et y poser RTG_NanosVersMetaHumanCorps), visage sans LiveLink (redirect deja pose).
3. Lire les graphes au serveur MCP (evenements, parametres, tableaux d'options, variables des
   AnimBP d'outils) -> generateur `narvos-mcs-to-lua.mjs` -> `Catalogs/MetaCustom.lua`.
4. Lua serveur : validation + CallBlueprintEvent + persistance (colonne JSON personnage) +
   application au spawn ; menus WebUI NARVOS (Corps, Visage, Teinte & tatouage, Yeux, Peau,
   Cheveux, Accessoires, Vetements, Costumes, H/F, emplacements), vignettes exportees du pack.
5. Cook, puis test en jeu de chaque menu.

## B1 — Interface personnalisable (Echap > Parametres > nouvel onglet UI)
- deplacer librement chaque element HUD/UI, dont la carte ; position persistee (sortie de menu,
  relance du jeu) ; bouton « disposition par defaut ».
- boussole directionnelle : N, NE, E, SE, S, SO, O, NO.

## B2 — Carte sur la touche H, depuis les VRAIES Level Maps
- recuperer toutes les Level Maps utilisees en jeu ; pour chacune une vue aerienne complete
  (photographie du dessus) ; integrer au systeme de carte du monde ; zones separees ;
  verifier la correspondance avec les niveaux reellement charges. PAS de carte generique.

## B3 — PNJ de Narvos Web trop grands, rendu « on voit a travers »
- chercher l'origine ; suspect : l'outil d'optimisation/reduction des assets (anti-freezes).
- verifier modeles, echelle reelle, meshes, materiaux, textures, normales, transparence/masque,
  LOD, parametres d'optimisation, modifications de l'outil. Corriger SANS perdre les gains perf.

## B4 — PNJ sans texture
- inventaire complet : textures OK / manquantes / mauvaise texture / vides-invalides /
  references cassees / mal converties-cuites. Corriger automatiquement quand possible,
  conserver les textures originales si elles existent.

## B5 — Radar/HUD : PNJ vivants, animaux, ressources, autres detectables
- commande admin `/editionpnj` : couleur et taille radar d'un PNJ, parametres par type de PNJ,
  sans toucher chaque Blueprint.

## B6 — Diagnostic visuel dans `/editionpnj` (message complete a 18h25)
- pour chaque PNJ, determiner automatiquement :
  Texture valide -> OK ; Texture absente -> ERREUR ; Texture vide -> ERREUR ;
  Materiau manquant -> ERREUR ; Reference de texture cassee -> ERREUR.
- afficher clairement le resultat pour reperer vite les PNJ a corriger.

## Consignes transverses (18h25)
- AVANT de modifier quoi que ce soit : verifier l'architecture existante et REUTILISER nos
  systemes deja presents (skill narvos-lua, catalogues generes, WebUI existantes).

## B7 — Menu vehicule (ne pas l'oublier)
- a preciser a l'examen de l'existant (garagiste, cles consommables, vehicleCatalog web).

## B8 — Telephone : visuel de vrai smartphone + animation d'ouverture
- panneau WebUI `telephone` (F7) : rendu facon smartphone ; le personnage sort son telephone
  (animation) a l'ouverture.

## C — Demandes de 19h (apres A et B)
- C1 Vehicules BLOQUES : ils apparaissent, le joueur est « au volant » (fullsize_suv, hatchback1,
  station_wagon, luxury_car, moto_custom, family_hatchback, moto_enduro, sporty_compact_hatchback
  vus dans le chat), mais ils ne roulent pas -> les rendre reellement pilotables.
- C2 Menu VAISSEAU dedie.
- C3 Touches configurables : chaque raccourci de menu modifiable dans Parametres > Touches
  (l'ecran existe deja : MENUS B, P, N, O, I, Z, G, F10, H, U, F6... + « Tout reinitialiser »).
  ⚠ PRECISION DE HANIBES (19h10) : l'ecran PROPOSE de modifier, mais on NE PEUT PAS — la
  nouvelle touche n'est pas prise en compte. Corriger le rebinding lui-meme. Aucun raccourci en dur.

## Consigne de 19h10
« Finis tant que ce n'est pas fini, et fais-moi un rapport » : travailler en autonomie sur tout
le carnet, rapport complet a la fin.
- C4 Inventaire : UI non branchee -> integrer Hyper Inventory, Crafting, Hotbar, Lootchest &
  Vendor System V2 et la connecter a notre logique (inventaire reellement utilisable).
- C5 Menu personnage / competences : relie au systeme de competences, touche configurable.
- C6 Hyper Skill Level Manager v2 : integre au personnage, aux niveaux, au menu competences ;
  verifier la progression EN JEU.
- Apres integration : tester chaque systeme en jeu (menus, raccourcis, modifiables).

## Notes
- Capture 19h : un PNJ « rocher » avec une emission jaune qui deborde (B3 rendu PNJ).
- Chat vu en jeu : « cet objet ne se range pas (base_deserteagle) » x3 (inventaire) — a regarder.

## Resultats 19h30
### B3/B4 — enquete PNJ (rapport complet : .hermes/RAPPORT_PNJ_2026-09-13.md, lecture seule)
- TAILLE : GLB Meshy a `Armature` 0,01 -> squelette importe racine s=0.0001 mais ANIMATION racine x100 ;
  Lua pose echelle=100 (mesure du 05/09 au repos) -> 29 entrees font 150-175 m des qu'ANIM_REPOS joue.
- TRANSPARENCE : 11 entrees en BLEND_Translucent (GLB « Merged_Animations » alphaMode BLEND) ; 3 d'entre
  elles (general, soldat_humain, mercenaire_alien) parce qu'Interchange a refuse le Character_output KTX2.
- TEXTURES : 45 OK ; 8 « Default Material » (Defender : copie promue sans ses MF_*) ; 5 refs cassees
  (TrainingSoldiers -> M_TrainingSoldier hors pack) ; 10 « Infectes » = mannequins de demo ; 15 mannequins
  de test ; dans les mondes 18 PNJ gris sur 33 (les Defender du peuplement).
- Outil d'optimisation : KTX2 (textures seules) + WebP 512/Draco -> 12 monstres en 512 px ; ni la taille
  ni les gris n'en viennent. Garder les gains web ; l'import Unreal doit partir des originaux 2048.
### C1 — vehicules
- Physique cuite mesuree : carrosserie simulee (convexe), roues cinematiques SANS volume, contraintes
  roue<->carrosserie presentes ; os X avant/Z haut, racine identite -> conforme au doc nanos.
- Corrige (Lua) : menu vehicule ferme au spawn (souris rendue) ; au volant, une touche liee au jeu
  n'ouvre plus nos menus (AZERTY : Z ouvrait le menu vehicule) ; SetAerodynamicsSetup comme le gabarit.
- Instrument : diagnostic de conduite automatique a l'entree au volant -> .data/diag_vehicule.txt
  (regime, rapport, vitesse, en l'air, souris/entree, touches, liaisons de jeu).
- A trancher en jeu : si regime monte et vitesse nulle -> neutraliser les contraintes des roues (editeur).

## Retours de test de Hanibes — 20h20-20h40
- MetaHuman VISIBLE a la creation (corps, tete, cheveux) : correctif rendu 16 bits CONFIRME en jeu.
- « il manque la personnalisation liee au pack » + MetaWardrobe (Fab 75579f63) a ajouter au menu vetements
  + « lie les packs » + « tu n'as pas consulte tous les fichiers » -> inventaire complet
  .hermes/INVENTAIRE_MCS_2026-09-13.md (4 445 fichiers, 357 assets de logique).
- PNJ : taille normale (correctif echelle animee CONFIRME) ; mais certains TRANSPARENTS et IMPOSSIBLES A TUER,
  d'autres SANS TEXTURES -> verifier et corriger sur l'ensemble des personnages et PNJ.
- ANIMATIONS : en marchant, posture de combat permanente ; manque marche / course / deplacement normal et
  transitions synchronisees. Corriger proprement SANS supprimer visee et combat. Verifier tout : locomotion,
  combat, visee, transitions, synchro, changements d'etat.
- CORPS A CORPS : clic gauche = coup de poing ; clic droit = poing de l'autre cote / attaque secondaire ;
  G et K = coups de pied. Touches modifiables dans Commandes.
- VEHICULES : roues bloquees au sol, ne roulent pas. diag_vehicule.txt 20:33 : air=true 15 s, regime 1200,
  rapport 0 -> aucune roue ne touche le sol. Cause : spawn Immediate avant SetWheel (binaire serveur :
  RecreatePhysics deprecie -> FinishSpawn). Corrige : SpawnMode.AfterConstructor (A VOIR EN JEU).

## Resultats 21h-22h30 (Claude, autonomie)
### PNJ « impossibles a tuer » — CAUSE MESUREE, CORRIGE (source + cuit)
- PhysicsAssets des PNJ Meshy : capsules au PLANCHER du generateur (rayon 0,505 / longueur 0,505 unite d'os ≈ 0,005 cm
  en jeu) sur 50 fichiers (pnj/, pnj_monstre/, + HumanMage) -> les balles traversent.
- `scripts/narvos-pnj-physique.mjs` (--apply / --verifier) : rayon et longueur recalcules depuis le squelette
  (tronc 7,5 % de la taille, cou 4, tete 6, membres 22 % du segment), centre/orientation du generateur gardes,
  ecriture float sur place (paquets ETIQUETES, cuit compris). 50/50 repares, 100 sauvegardes
  (adk/_sauvegardes/pnj-physique), garde verte. Libs : scripts/lib/uasset-physique.mjs, uasset-squelette.mjs.
### Corps-a-corps (demande 20h40) — ECRIT
- Logic/Frappes.lua (port de src/rpg/combat/unarmedStrikes.ts) : jab/crochet/uppercut G/D + pieds, serie de 5,
  finisher x2, impacts MESURES dans les clips (jab 133 ms, crochet 367, uppercut 433, pied 533). Harnais 100/0.
- Server/Frappes.lua : cone serveur (pas de collision -> touche aussi les Meshy), orientation vers la cible,
  degats Combat.Degats a l'impact, emote en boucle arretee. Poing natif coupe (Builder.POINGS_NATIFS, Menottes).
- Commandes : frappe_principale = CLIC_GAUCHE, frappe_secondaire = CLIC_DROIT, coup_pied_droit = G,
  coup_pied_gauche = K ; boutons souris assignables (Lua MouseDown + page mousedown) ; garde-robe -> F8,
  gizmo precedent -> F9 (aucune lettre libre). Mains VIDES seulement (armes : tir/visee natifs intacts).
- Pied gauche : aucun clip (un seul coup de pied, droit) -> repli sur le droit ; candidat attack_special_kick_L_Anim
  prevu pour un miroir a importer.
### Animations
- Emotes en boucle arretees des que le perso marche (Server/Emotes.lua, 80 cm/s) + StopAnimation.
- Locomotion native (BS_EnemyWalk retire, fait a 20h45).
### Vehicules
- Rayon de roue PAR MODELE mesure (os Wheel_* : 28,7 a 40 cm ; origine au sol verifiee) : avec 30+7, Crossover,
  Pickup et SUV n'avaient aucun contact. catalogs-to-lua mesure `rayon_roue`, Voitures.ReglageRoues l'applique.
- + SpawnMode.AfterConstructor (20h45). Harnais 66 + 127 JS verts. A VOIR EN JEU.
### Textures / transparence
- 12 materiaux Meshy BLEND_Translucent -> Opaque (editeur complet, scripts/adk-pnj-opaques.py), verifies sur disque.
- Defender : 195 materiaux/instances/fonctions remis depuis l'original (narvos-refs-perdues-promotion +
  adk-restaurer-originaux, manifeste _manifests/defender-refs-perdues-materiaux.json) + redirect /Game/Defender/
  -> /Game/Narvos/Defender/ ; M_TrainingSoldier + T_RoomTiles + PhysicMats promus. 13 materiaux charges dans
  l'editeur : 0 « Failed to compile », MF citees (4 au lieu de 0).
- Spawnables : Infectes = vrais corps SM_ZombieSoldier*_UE4 (plus les mannequins de demo gris), mannequins de test
  hors menu (NARVOS_MANNEQUINS_TEST=1), diagnostic `texture`/`texture_raison`/`translucide` par entree
  (scripts/lib/uasset-materiaux.mjs) : avant cook 52 OK / 13 ERREUR / 12 translucides.
### MetaHuman (MCS)
- scripts/adk-mcs-fonctions.mjs : 8 fonctions Narvos* ecrites par MCP dans BP_NarvosMH_M et _F (compilation
  Success), + composant Prop sous Body avec EnableMasterPose. Corps = AnimBP_Body_Tool1 en post-traitement.
### Cook
- Chaine lancee 22:17 (.hermes/cook_2026-09-13_soir.log) : cook -> pack -> generateurs -> verifications.

## Resultats 2026-09-14 (reprise apres extinction du PC)
### Cook / pack
- Cook du 13/09 FINI (90 228 paquets, Packages Remain 0) ; copie du pack coupee par l'extinction (destination
  videe). Reprise : `bash scripts/narvos-chaine-cook.sh --depuis-pack` (nouvelle option, refuse sans preuve de
  cook fini + inventaire plus recent). Pack reecrit 231 052 fichiers / 88 Go, 9 generateurs, verificateur :
  aucune reference morte. Spawnables : 65/65 texture ok, 1 translucide restant (SK_MurdockExecutionerV2).
- ⚠ 3 ABP en erreur de compilation desormais VUS (cook complet force par le changement d'ini) :
  f_tal_nrw_animbp, m_tal_nrw_animbp (corps MetaHuman FCS/MCS), AnimBP_Face_Tool — leurs Control Rigs
  (metahuman_proc_ControlRig, HeadMovementIK_Proc_CtrlRig, Neck_CtrlRig) n'existent pas sous
  Narvos/MetaCustom (seulement sous Narvos/MetaHumans, NeverCook). Si crash client au choix d'un corps/visage
  MetaHuman : c'est ici (copie des rigs + redirect + recook).
### C5/C6 — Competences, talents, niveau (BRANCHE, a voir en jeu)
- Logic/Progression.lua (port PlayerStats/npcLeveling/talentEffects, 1 637 assertions contre le TS execute),
  Catalogs/NiveauxPnj.lua (GENERE), Server/Progression.lua, colonnes xp + talents.
- XP : victoire (Death Character ET CharacterSimple, instigateur joueur ; niveau PNJ = bas de plage de la zone),
  quete (corrigee : ajoutait l'XP au champ `niveau`), /xp <n> (admin). Niveau : PV max, mana, puissance,
  defense ; talents : PV, mana, cout/regen des sorts, degats, critique, defense, vitesse.
- Panneau Personnage a onglets Competences / Talents / Classe / Metiers ; F10 ; F5 = menu_competences
  (modifiable) ; HUD : NIV + barre d'XP ; touches reelles des pouvoirs affichees.
- Sorts : cibles CharacterSimple incluses (PNJ intouchables au pouvoir), lanceur transmis en instigator
  (victoire et quete creditees), cout/regen/degats modules.
### Bugs critiques trouves en chemin
- Sac, compagnons, metiers JAMAIS sauvegardes : Roster.Base() inexistant + pcall booleen. Corrige, tests base
  branchee, garde pcall-retour-perdu-check.mjs. Credits de quete non persistes : corriges (MajCredits).
### Verifications
- Batterie : 89 harnais, 10 387 assertions, 0 rouge. Serveur demarre (--playtest) : 0 erreur, temoin
  `[PROGRESSION] niveaux et talents prets`.

## Resultats 2026-09-14 soir — 7 anomalies de jeu (detail : RAPPORT_2026-09-14_anomalies.md)

- [x] Effets 3D : billboards retires, icones seules ; Sorts.EFFETS_3D (particules du pack) ; Vfx.lua sur les CLES du manifeste (95/173 fausses avant).
- [x] Camera FPS / arme : porteur MetaHuman -> nanos-world::SK_Mannequin ; tete locale videe en FPS.
- [x] Menus MetaHuman : pont U supprime ; APPARENCE dans l'inventaire (I, F8) ; defaut sans vetement ; accessoire de role hors MetaHuman ; orphelins detruits.
- [x] Equipements : MetaCustom 148/148 cuits ; grooms par genre de liaison.
- [x] Camera de personnalisation stable ; cercle gris retire.
- [ ] A VOIR EN JEU (tout ce qui precede).
- [ ] Vetements MCS : leader pose + materiaux dans NarvosMaillage (editeur + cook) si T-pose/gris.
- [ ] Porter la maquette HUD System (hotbar 1-6 + radial TAB + module arme + viseurs).
- [ ] Familles Zombie UE4 / CyberpunkSamurai, grooms ExternalAssets (liaisons), iris, curseurs visage.
- [ ] Recap ASTRA : .hermes/RECAP_ASTRA_2026-09-14.md + .hermes/ASTRA_skills_NARVOS_2026-09-14.zip