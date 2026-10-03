# NARVOS PRIME — Analyse d'orientation gameplay & rétention

**Date** : 2026-06-12 · Basée sur l'audit complet du code (13 systèmes inventoriés).

---

## 1. État des lieux — forces et faiblesses

### Forces (rares pour un prototype)
| Système | État | Pourquoi c'est fort |
|---|---|---|
| Combat | Complet | 5 archétypes × armes, 13 sorts signature, mains nues (combo/chargé/parade/esquive/K.O.), garde Guerrier, munitions. Profondeur d'inputs rare. |
| Progression | Complet | XP 1-50 (80×L^1.5), +8%/niveau, 12 talents/4 branches, caractéristiques. Squelette RPG sain. |
| Métiers | Complet | 6 métiers (3 récolte + 3 craft), 18 recettes, paliers 1-50, valeurs 2→340 cr. Boucle économique réelle. |
| Économie | Complet | Crédits, 7 marchands typés, prix×rareté, rachat, sacs, munitions consommables = vrais puits d'or. |
| Loot | Complet | 11 slots, génération procédurale (65/20/10/4/1%), stats×rareté×niveau. |
| Univers | Distinctif | **Science-fantasy** : hub orbital + planètes + vaisseaux + 10 éléments magiques + mechas. Peu de jeux mélangent les deux. |
| Concept 2 serveurs | Visionnaire | « Mort définitive » vs « Paradisiaque » = segmentation hardcore/casual moderne (cf. ladders Diablo/PoE). |

### Faiblesses (les trous qui tuent la rétention)
| Trou | Impact joueur |
|---|---|
| **Pas de respawn des monstres** | LE bug de boucle : on tue tout → map vide → plus rien à faire. Le farm est impossible. |
| **Donjon sans boss ni récompense** | La promesse d'endgame n'existe pas (portail + quête seulement). |
| **7 quêtes, non répétables** | ~1h de contenu dirigé, puis plus aucun objectif. |
| **Mort sans conséquence** | Le serveur « mort définitive » n'est pas implémenté ; aucun risque = aucune tension. |
| **Éléments inexploités côté joueur** | 10 éléments avec triangle forces/faiblesses… utilisés seulement par les PNJ. |
| **Zéro méta-jeu** | Pas de quêtes du jour, d'événements, de succès, de collections, de réputation. |
| **Zéro social** | Pas de chat/groupe/guilde (multi en pause — assumé). |
| **Pas de minimap/carte** | L'exploration n'est pas guidée ni récompensée. |
| **Craft sans débouché clair** | Les meilleures armes viennent du marchand/loot, pas du craft → boucle métiers orpheline au max. |

---

## 2. Quel gameplay principal ? — comparaison des orientations

| Orientation | Fit univers | Fit code existant | Coût | Rétention | Verdict |
|---|---|---|---|---|---|
| **Halo RP** (RP social mil-SF) | Moyen (il y a de la magie partout) | **Faible** : RP = outils sociaux (chat, émotes, factions joueurs) → tout est à faire + multi en pause | Très élevé | Dépend 100% de la communauté | ❌ Abandonner comme axe principal |
| **MMORPG classique** | Bon | Faible : serveur temps réel inexistant (audit : netcode ≈ 0) | Énorme (mois) | Bonne mais inatteignable seul | ❌ Pas maintenant |
| **Survival** (faim/soif/base) | Faible (rien dans le code) | Faible | Élevé | Bonne mais niche | ❌ |
| **Extraction** (raid → loot → extraire ou tout perdre) | **Très bon** (planètes = zones de raid, hub orbital = base, vaisseaux = extraction) | **Bon** : loot procédural + éco + mort définitive déjà conceptualisée | Moyen | **Excellente** (Tarkov, Dark and Darker, Helldivers-like) | ✅ **Comme STRUCTURE de session** |
| **ARPG d'action** (Diablo-like) | Très bon | **Excellent** : 90% des systèmes sont des systèmes d'ARPG (loot, talents, métiers, donjons, élements) | **Faible** | Excellente (boucle loot) | ✅ **Comme CŒUR** |
| **Sandbox** | Moyen | Moyen (éditeurs admin solides mais pas joueur) | Élevé | Variable | ❌ secondaire |

### Recommandation : **« Action-RPG à sessions d'expédition »** (ARPG × extraction-lite)

Le code EST déjà un ARPG à 90%. La touche distinctive : structurer les sorties en **expéditions** depuis le hub orbital :

> **Boucle cœur** : au hub orbital (sûr : marchands, craft, banque) → tu embarques (vaisseau) vers une planète (Forge/Tower = zones à niveaux croissants) → tu farmes monstres/ressources/coffres → **plus tu restes, plus c'est dangereux et rentable** → tu te fais extraire (vaisseau) pour sécuriser le butin.
> - Serveur **Paradisiaque** : mort = tu perds le butin **non sécurisé** de l'expédition (retour au hub).
> - Serveur **Mort définitive** : mort = personnage perdu (le frisson hardcore, ladder dédié).

Pourquoi ça gagne : ça réutilise TOUT (hub/planètes/vaisseaux/loot/éco/2 serveurs), ça donne un **sens au retour au hub** (sécuriser = dopamine), ça crée la tension qui manque (le « one more run » de Tarkov/Hades), et ça reste 100% jouable en solo — le multi pourra s'y greffer plus tard (co-op d'expédition) sans refonte.

L'« esprit Halo RP » survit dans l'habillage : escouade de mercenaires, briefings au hub, contrats militaires, armes futuristes — sans dépendre d'une communauté RP.

---

## 3. Les boucles de gameplay (farm & progression)

### Boucle 1 — Minute (combat) ✅ existe, à pimenter
Voir ennemi → choisir l'approche (sorts/arme/mains nues/garde/parade) → tuer → XP+loot+crédits.
**Manque** : dégâts élémentaires joueur (le triangle ×1.5/×0.5 existe, inutilisé !), chiffres de dégâts flottants, coups critiques visibles, rares « élites » à modificateurs.

### Boucle 2 — Session (l'expédition) ❌ à construire — LA priorité
Préparer (acheter munitions/potions = puits d'or) → expédition → risque croissant → extraire → vendre/équiper/craft → préparer mieux.
**Préalable absolu : le respawn des monstres** (timer 30-60s par zone de spawn + tables de spawn par région/niveau, pas seulement des placements admin).

### Boucle 3 — Semaine (objectifs) ❌ manquant
Contrats journaliers (« tue 10 golems sur Forge », « extrais 5 adamantites ») + hebdo (« termine le donjon ») → monnaie spéciale → vendeur exclusif. Standard Destiny/Genshin/WoW : **la** raison de se reconnecter.

### Boucle 4 — Saison (méta) ❌ futur
Ladder sur le serveur Mort définitive (qui survit le plus longtemps / niveau max), reset saisonnier léger, récompenses cosmétiques (teintes — le système de teintes par partie existe déjà !).

---

## 4. Progression long terme — propositions motivantes

1. **Niveau de Monde** (Diablo IV) : à 50, débloquer Monde II/III/IV — monstres +50% PV/dégâts, loot +1 palier de rareté. Coût quasi nul (les multiplicateurs `enemyHpMultiplier`/`enemyDamageMultiplier` existent), gain énorme.
2. **Maîtrise élémentaire** : le joueur infuse son arme d'un des 10 éléments (consommable craftable par l'Alchimiste !) → le triangle élémentaire devient une décision de préparation d'expédition. Réutilise `ELEMENTS.strongVs/weakVs` tel quel.
3. **Parangon léger** : après 50, chaque niveau = +1 point de caractéristique (cap soft). Simple, infini.
4. **Collections/Codex** : bestiaire (tuer 10/50/100 de chaque monstre → bonus permanents minuscules), collection d'armes (acheter/looter chaque arme du catalogue → titre). Les données existent (catalogue PNJ/armes).
5. **Réputation par marchand** : dépenser/vendre chez Kael/Lyra/etc. monte un rang (Bronze→Or) → remises + stock exclusif par rang. Transforme les 7 marchands en 7 pistes de progression. (Détail §7.)

---

## 5. Mécaniques modernes à emprunter (jeux populaires)

| Mécanique | Jeu source | Application Narvos | Coût |
|---|---|---|---|
| Risque/extraction, butin non sécurisé | Tarkov, Dark and Darker | Boucle d'expédition §2 | M |
| « One more run », mort = re-tenter vite | Hades, Risk of Rain | Respawn rapide au hub + relance d'expédition en 10s | S |
| Niveaux de monde | Diablo IV | §4.1 | **S** |
| Contrats journaliers/hebdo | Destiny 2, Genshin | §3 boucle 3 | M |
| Élites à affixes (« Gelé », « Vampirique ») | Diablo, PoE | 1 monstre sur 10 spawn élite : +stats + 1 modificateur + loot garanti rare | M |
| Donjon à clé + affixes hebdo | WoW M+ | Donjon Furiste : clé craftable, affixe de la semaine, coffre de fin | M |
| Pity timer (légendaire garanti après N kills) | Diablo, gachas | Compteur invisible anti-frustration sur le loot procédural | S |
| Cosmétiques de prestige | Fortnite, WoW | Teintes par partie EXISTENT → teintes exclusives par succès/saison | S |
| Boss world events à timer | Helldivers 2, Rift | « Le Colosse se réveille sur Forge dans 5 min » → boss + coffre | M-L |
| Mort définitive en ladder | PoE/D4 Hardcore | Serveur héroïque : tableau des morts (« mort niv 43, tué par Golem ») | S |

---

## 6. Systèmes détaillés — recommandations concrètes

### Combat
- **Activer les éléments joueur** (infusion §4.2) — le plus gros gain stratégique pour 0 nouveau contenu.
- Dégâts flottants + critiques visibles (le critChance existe, invisible).
- Réactions de coup généralisées : les monstres font déjà hit/bighit aux poings — étendre aux armes/sorts.
- 1-2 sorts de plus par archétype au fil des niveaux (13 sorts → ~25) : sentiment de « débloquer » en montant.

### Loot
- **Affixes procéduraux** (préfixe/suffixe : « du Vampire » +vol de vie, « du Vide » +dégâts void) → multiplie la variété perçue sans nouveaux assets.
- Le craft (Forgeron/Joaillier) doit produire le **meilleur loot ciblé** (choisir SA stat) tandis que le drop reste aléatoire → les deux boucles coexistent (modèle New World/Albion).
- Coffres de zone à réouverture quotidienne (raison de revisiter chaque région).

### Artisanat
- **Stations au hub** (forge/alambic/établi) : raison physique de revenir au hub + le hub devient « chez soi ».
- Recettes RARES en drop de donjon/boss → lie le craft à l'endgame.
- Ordres de craft journaliers (« le Forgemaître veut 3 épées d'acier ») = XP métier + réputation.

### Économie
- Puits d'or supplémentaires : réparation d'équipement (usure légère), taxes de banque/coffre, infusions élémentaires consommables, clés de donjon.
- Sources contrôlées : l'or des kills (10+5×lvl) est sain ; éviter l'inflation en plafonnant la revente (buyFactor ≤0.5 déjà bien).

### Réputation (nouveau système, fort ROI)
- 7 marchands = 7 factions mineures + 2 majeures (l'Ordre de la Tour / les Forgerons du Vide — à thématiser sur tes maps).
- Gagner : contrats journaliers, ventes, quêtes de zone. Paliers : Neutre→Honoré→Exalté.
- Récompenses : remises (-5/-10%), stock exclusif (recettes, cosmétiques, montures/vaisseaux), titres.

---

## 7. Endgame (à 50)

1. **Donjon Furiste complet** : boss réel (le squelette boss/AoE télégraphiées EXISTE dans Npc.tsx !) + coffre de fin + clé consommable + affixe hebdo. **C'est l'endgame le moins cher à finir.**
2. **Niveaux de Monde II-IV** (§4.1).
3. **Boss de monde à timer** sur chaque planète (1/h) — événement social même en solo.
4. **Ladder Mort Définitive** : classement de survie, badge/teinte exclusive par saison.
5. **Expéditions « profondes »** : plus tu t'éloignes du point d'extraction, plus le niveau monte (le `levelFromDistance` EXISTE déjà !) → le « deep dive » risqué est presque gratuit à activer.

---

## 8. Feuille de route priorisée

### Phase 1 — Réparer la boucle (le jeu devient « jouable en boucle »)
1. **Respawn des monstres** (timer + zones de spawn) — sans ça, rien d'autre ne compte.
2. **Donjon Furiste : boss + récompense + repeatable.**
3. **Mort avec enjeu** : Paradisiaque = perte du butin non sécurisé · Héroïque = mort définitive réelle + ladder local.
4. Dégâts flottants + crits visibles + minimap simple.

### Phase 2 — Rétention quotidienne
5. Contrats journaliers/hebdo (3/jour + 1/semaine) + monnaie de contrat.
6. Niveaux de Monde I-IV.
7. Infusions élémentaires (active le triangle des 10 éléments).
8. Élites à affixes + pity timer légendaire.

### Phase 3 — Profondeur
9. Réputation marchands/factions (paliers + stocks exclusifs).
10. Affixes de loot procéduraux + recettes rares en drop.
11. Stations de craft au hub + ordres de craft.
12. Bestiaire/collections + succès.

### Phase 4 — Ambition
13. Boss de monde à timer + événements de zone.
14. Saisons (ladder, cosmétiques de teinte).
15. Co-op d'expédition (réveil du multi — le serveur turn-based existant ne convient pas, prévoir du sync temps réel léger 2-4 joueurs).

---

## TL;DR

Le code est un **ARPG à 90%** — pas un Halo RP (qui exigerait le social/multi absent). L'identité gagnante : **ARPG science-fantasy à expéditions** — hub orbital sûr → expéditions planétaires à risque croissant → extraction du butin — avec les deux serveurs comme axe casual/hardcore. La faille n°1 n'est pas un manque de features mais **une boucle cassée : les monstres ne respawnent pas**. Réparer la boucle (Phase 1) avant d'ajouter quoi que ce soit.