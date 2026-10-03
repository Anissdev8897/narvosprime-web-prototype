# Passe matériaux sur `halo_map` — 2026-09-06

Tout ce qui suit a été fait dans l'éditeur ouvert, par le MCP
`UnrealMCPServer`, et **mesuré avant / après**.

---

## 1. L'auto-material de terrain compile enfin

```
num_pixel_shader_instructions    0  ->  611
num_vertex_shader_instructions   0  ->  153
num_samplers                    -1  ->    4
num_pixel_texture_samples        0  ->   48
```

Deux causes empilées, la seconde cachée derrière la première.

**a. Références de package périmées.** 78 des 97 assets du pack pointaient
`/Game/MWLandscapeAutoMaterial/`, le chemin d'avant le rangement sous
`/Game/Narvos/`. Erreur affichée : `Missing Material Function`.
Réglé par `[CoreRedirects]` dans `adk/Config/DefaultEngine.ini` — une ligne,
tout le sous-arbre, aucun asset touché. Lu **au démarrage du moteur**.

**b. Type d'échantillonneur.** Le redirect a démasqué :

```
(Node TextureSampleParameter2D) Sampler type is Normal, should be Linear Color
   for TEX_MWAM_Variation_nrm
```

**8 textures étaient en `TC_Default`** alors que leur contenu impose
`TC_Normalmap` (`*_nrm`) ou `TC_Masks` (`*_msk`) — les 7 autres du même pack
étaient déjà correctes. Un seul échantillonneur mal typé fait échouer le
matériau entier.

Corrigées : `Stones_nrm`, `Snow_nrm`, `Rock_nrm`, `Grass_nrm`, `Dirt_nrm`,
`Variation_nrm` → TC_Normalmap ; `Variation_msk`, `Temp_msk` → TC_Masks.

⚠ **Portée honnête** : dans `halo_map`, **un seul acteur** utilise réellement
l'auto-material (`MTL_MWAM_Landscape_DesertExample`). La réparation compte pour
le terrain à venir, pas pour l'aspect actuel de cette carte.

---

## 2. Les surfaces blanches plates — 227 matériaux repeints

C'était ça, le vrai défaut visible.

`halo_map` porte **12 965 MaterialInstanceConstant**, une par mesh, toutes
issues de l'import glTF et parentées à `MI_Default_Opaque_DS` (12 721) ou
`MI_Default_Opaque` (244). Sur ces 12 965 :

```
12 734  ont BaseColor + Normal + MetallicRoughness   -> la carte EST texturée
   231  n'ont AUCUNE texture                          -> surfaces plates
     0  sans matériau · 0 sans parent · 0 paramètre vide
```

Les 231 n'avaient **aucune surcharge vectorielle** : leur `BaseColorFactor`
retombait sur le défaut du parent glTF, c'est-à-dire **blanc**. D'où les grands
aplats blancs.

| traité | quoi | comment |
|--:|---|---|
| 111 | `y_set_square_illum_a*` | `EmissiveFactor` froid + base sombre |
| 44 | `y_set_square_illum_a_warm*` | `EmissiveFactor` chaud + base sombre |
| 69 | `black*` / `z_black*` | `BaseColorFactor` quasi noir |
| 3 | `lamp_glass_lit*`, `antennae_light*` | émissif ambre |

Le suffixe donnait la teinte (`_warm`), il ne s'est pas inventé.

**Règle appliquée** : ne toucher QUE les instances sans aucune texture. Une
instance déjà peinte n'est pas repeinte — la repeindre effacerait un travail
existant.

État final vérifié :

```
instances avec EmissiveFactor          158
instances avec BaseColorFactor surchargé 227
matériaux encore plats                   1   (forge_halo_cave_water)
```

Le dernier est de l'eau : ça demande un matériau d'eau, pas une couleur. Laissé.

---

## 3. Ce qui n'est PAS fait, et pourquoi

**Les trous.** Sur 12 994 acteurs je ne peux pas deviner lesquels manquent. Deux
voies : une capture qui montre le trou, ou un balayage géométrique par raycast
en grille (objectif, mais long). En attente d'une décision.

**La tache magenta.** Aucun matériau nul, aucun parent nul, aucun paramètre de
texture vide dans toute la carte — ce n'est donc pas un « matériau manquant »
classique. Il faut l'acteur : le sélectionner dans l'éditeur et donner son nom.

**Les 12 965 instances, une par mesh.** C'est le coût de l'import glTF. Les
fusionner est un chantier de performance (draw calls), pas un correctif
d'aspect. Pas entrepris sans demande.

---

## Outillage

Le client MCP de Claude Code se connecte **au démarrage** : après un
redémarrage de l'éditeur il reste déconnecté pour la session. L'endpoint, lui,
répond. `scratchpad/ue.sh` parle donc au serveur en JSON-RPC 2.0 par `curl` —
plus besoin de relancer Claude Code à chaque fermeture de l'éditeur.

```bash
ue.sh py <fichier.py>       # exécute du Python dans l'éditeur
ue.sh call <outil> <json>   # n'importe lequel des 304 outils
```