# À VÉRIFIER EN JEU — session du 02/08/2026

Mesures à l'instant de la rédaction (à re-mesurer, ne jamais recopier) :

```
npm test         → 1758 / 1758, 171 fichiers, 0 échec, aucune suite « (0 test) »
npx tsc --noEmit → 0 erreur
```

`tsc` était à **109 erreurs** au début de la session. C'est la première fois qu'il
passe. La porte qualité du projet (`CLAUDE.md` : « zéro erreur dans `src/rpg/**` »)
est franchie.

---

## 1. Ce qui a changé et se voit en jeu

### A1 — Marche accroupie en diagonale
**Avant** : accroupi + W+D (ou toute diagonale) → le personnage glisse en pose
figée, comme une statue qui se déplace.
**Après** : les deux clips accroupis avancent normalement.

**Comment vérifier** : `/give none` puis Ctrl + W + D. Regarder les jambes, pas la
direction — c'est le mouvement des jambes qui était bloqué, pas le cap.
Tester les 4 diagonales.

### A3 — Recul de caméra / SFX d'attaque
**Avant** : le recul partait au rythme du cycle de marche — parfois dès le clic,
parfois jamais. Le plus visible à l'arrêt (l'idle dure 10 s : le seuil de 30 %
n'était jamais atteint pendant l'attaque, le recul était simplement perdu).
**Après** : il part quand l'attaque atteint 30 % de son clip.

**Comment vérifier** : attaquer **à l'arrêt** (cas où le recul était perdu), puis
**en marchant** (cas où il partait trop tôt). Le ressenti doit être identique
dans les deux cas.

### M1 — Placement d'objets dans la Forge (le plus important à tester)
**Avant** : sur la Forge (sol ≈ −51), tout objet posé flottait ~50 m au-dessus du
terrain. Et hors d'un carré de 500 m centré sur l'origine — soit l'essentiel de la
carte — cliquer ne faisait **rien du tout**.
**Après** : l'objet se pose sur la géométrie cliquée, partout.

**Comment vérifier** : éditer une scène avec la Forge en map de base, puis poser un
objet **loin du centre** (c'est le cas qui ne marchait pas). Il doit se coller au
terrain.

**Trois risques que j'ai introduits et qu'il faut regarder** :
1. **Sélection** — les gestionnaires de clic sont désormais sur un `<group>` qui
   enveloppe le décor. Cliquer un objet déjà placé doit le SÉLECTIONNER, pas en
   poser un nouveau ni désélectionner.
2. **Désélection** — sur une map de base, le plan de secours n'existe plus :
   cliquer « le ciel » ne désélectionne plus. Cliquer le sol, si.
3. **Objets sous le sol** — le plancher `y ≥ 0` a disparu. Au gizmo, un objet peut
   maintenant descendre sous le terrain. C'était le seul effet utile du clamp.

### M2 — Annulation (Ctrl+Z) dans la Forge
**Avant** : seuls les objets et les eaux étaient annulables. Créer une route,
sculpter un terrain, **déplacer un objet au gizmo** → aucune trace.
**Après** : tout le contenu de la scène est couvert, déplacements compris.

**Comment vérifier** :
* déplacer un objet au gizmo → Ctrl+Z doit le remettre à sa position d'avant ;
* créer une route → Ctrl+Z doit la faire disparaître ;
* un glisser-déposer = **un** pas d'annulation, pas cinquante (le commit se fait
  au relâchement de la souris, pas à chaque image).

⚠️ Non couvert : les **calques** et les **préfabs** vivent encore dans un `useState`
et non dans la scène (constat M3) — ils restent hors historique.

### M4 + M6 — Ambiance de la map publiée
**Avant** : l'angle solaire, le preset météo et la brume ne vivaient que dans
l'éditeur. Une map publiée s'affichait sous l'éclairage par défaut — l'ambiance
composée par l'auteur disparaissait à la publication. Et le bouton « ombres »
pilotait le Canvas mais pas le rig d'éclairage.

**Comment vérifier** : régler une ambiance marquée (preset `night` ou `sunset`,
brume à fond), publier la scène, puis y **entrer en jeu**. On doit retrouver la
même ambiance. Rouvrir ensuite la scène dans l'éditeur : les curseurs doivent
être là où on les avait laissés. Basculer « ombres » doit faire apparaître et
disparaître les ombres portées.

### M5 — Points de route (spline)
**Avant** : en déplaçant un point de contrôle, il partait n'importe où dès que le
curseur effleurait le bord de la bille — on lisait l'intersection avec la poignée
elle-même, pas avec le sol.
**Après** : le point suit la souris à plat, en gardant son altitude.

**Comment vérifier** : outil route, poser 3 points, en attraper un et le traîner
lentement puis vite. Il doit rester sous le curseur, sans saut.

### M8 — Sauvegarde
Rien de visible ne doit changer. Ce qui change est invisible : l'éditeur ne
réécrit plus toutes les scènes à chaque cran de curseur.

**Ce qu'il faut surtout vérifier — la perte de données** : modifier quelque chose
puis **fermer l'onglet dans la seconde**. Au retour, la modification doit être là
(un filet vide l'écriture sur `pagehide`). C'est le risque que le nouvel
anti-rebond introduit ; s'il échoue, dis-le, on repasse en écriture immédiate.

### M10 — Bouton « Aligner »
**Avant** : il forçait tous les objets à l'altitude zéro. Sur la Forge (sol ≈ −51),
un clic propulsait la carte entière 51 m en l'air.
**Après** : il aligne sur l'objet le plus bas — la scène reste où elle est.

⚠️ L'action porte toujours sur **tous** les objets, pas sur la sélection. C'est le
comportement d'origine, non modifié : à confirmer que c'est bien voulu.

### M3 — Calques
**Avant** : les calques vivaient en mémoire de composant. Après un rechargement,
ils disparaissaient — alors que chaque objet garde un `layerId` qui les
référence. Les objets pointaient donc vers des calques inexistants, et le
masquage comme le verrouillage étaient annulés **sans rien dire**.
**Après** : les calques appartiennent à la scène.

**Comment vérifier** : créer 2 calques, masquer l'un, verrouiller l'autre, y
répartir des objets. Quitter l'éditeur, revenir. Les calques doivent être là,
avec leurs noms, couleurs, masquages et verrous — et les objets sur le bon.

### M11 — Co-édition (Forge Live)
**Avant** : la sync ne diffusait que `{objects, waters, terrain, baseMap}`. Deux
co-éditeurs divergeaient en silence dès que l'un traçait une route, sculptait une
seconde tuile de terrain ou changeait l'ambiance.
**Après** : le snapshot diffusé est le même que celui de l'historique — tout le
contenu de la scène.

**Comment vérifier** (demande deux clients) : ouvrir la même scène à deux, activer
Forge Live, puis chez l'un tracer une **route** et changer le **preset météo**.
Les deux doivent apparaître chez l'autre.

### M11-v2 — Sync par OPÉRATION (remplace « dernier enregistrement gagne »)
**Avant** : chaque modification diffusait la scène ENTIÈRE, appliquée telle quelle
chez le pair. Deux personnes déplaçant des objets **différents** dans la même
seconde : le travail du plus lent disparaissait, sans conflit visible.
**Après** : seul ce qui a changé est diffusé, et le récepteur le **fusionne**. Le
dernier écrivain ne l'emporte plus que sur l'élément qu'il a réellement touché.

**Comment vérifier** (deux clients, Forge Live actif sur la même scène) :
1. **Le cas qui échouait** — chacun déplace un objet **différent**, en même temps.
   Les deux déplacements doivent survivre, des deux côtés.
2. **Conflit réel** — les deux déplacent le **même** objet. Le dernier gagne
   (c'est attendu), mais rien d'autre ne doit bouger.
3. **Arrivée en cours de route** — un troisième client rejoint : il doit recevoir
   la scène complète (le snapshot est conservé pour ce cas précis).
4. **Pas de boucle** — laisser les deux clients ouverts et inactifs une minute :
   aucun trafic ne doit circuler (le diff est vide, donc rien n'est émis).

Le point 4 est le risque que j'ai introduit : si la base de comparaison se
désynchronise, deux clients peuvent se renvoyer des opérations en boucle. Si tu
vois du trafic sans que personne n'édite, dis-le.

### A4 — Aucun effet visible attendu
Argument sémantiquement faux corrigé (`timeScale` passé à la place d'un
framerate). Neutralisé aujourd'hui par `referenceFrame = 0`. **Si la pose
accroupie capturée change d'aspect, c'est une régression** — signale-le.

---

## 2. Ce que j'ai VOLONTAIREMENT laissé en place

### A2 — « le bassin ne descend jamais » : constat exact, conclusion fausse
J'avais écrit le correctif, avec ses tests, et ils passaient. Je l'ai **retiré**.

L'abaissement existe déjà, appliqué au groupe :
`og.position.y -= CROUCH_PELVIS_DROP × échelle` (`OwnAnimPlayerCharacter:327`).
Et il est exact — mesuré sur `Anim_Crouch_Idle_Hip`, bassin / genou / cheville /
pointe descendent **tous de 0,373** : la pose se translate en bloc, un offset de
groupe la reproduit donc exactement.

Mon correctif aurait ajouté ~0,21 par-dessus → **+57 % de descente**, personnage
enfoncé dans le sol.

`AnimationController.crouch.test.ts` échoue désormais si quelqu'un refait cette
« correction ». L'audit ressortira A2 — c'est le filet.

### A5 — `quantizeDirection` : le raisonnement de l'audit ne tient pas
L'audit dit que cette hystérésis « aurait évité A1 ». Deux fois faux :
* `blendWeightsForAngle` est **déjà continu** — à 44° puis 46°, le clip dominant
  ne change pas, seul un troisième clip à poids ~0,02 permute. Il n'y a pas de
  clignotement, et ajouter une hystérésis créerait une discontinuité ;
* `quantizeDirection` puise dans `ORDER`, qui **contient les diagonales** : elle
  aurait rendu `forwardRight`, exactement la clé absente en accroupi.

Reste une question d'hygiène (code exporté et testé, jamais appelé), pas un bug.

### A6 — réfuté par le calcul
`MM_Jump.glb` dure **0,867 s** (mesuré dans le GLB). Le seuil `velocity.y < -1`
est atteint à **0,327 s**. Quand le clip finit, le joueur chute depuis 0,54 s.
De plus `busy = cur === "jump"` empêche tout repilotage pendant le saut.
Facteur 2,6 d'écart — aucune interprétation ne le rattrape.

### A7 — inatteignable en pratique
`useCrouchAdditive` exige `!(crouching && hasCrouchwalkLocomotion)`. Avec le pack
UTA chargé, l'additif est désactivé quelle que soit la vitesse. La zone grise
0,2–0,3 m/s ne concerne que les personnages sans clips crouchwalk — des PNJ, qui
ne s'accroupissent pas.

---

## 3. Point de blocage suivant (ni Claude ni Hermes ne l'ont traité)

**`npm run build` reste inexécutable en pratique**, pour une raison qui n'a plus
rien à voir avec TypeScript.

`vite.config.ts` n'a ni `publicDir: false` ni `build.copyPublicDir: false`, et
porte `emptyOutDir: true`. Vite viderait donc `dist/` puis y recopierait tout
`public/` — mesuré : **34 583 fichiers, 240,8 Go**.

Je ne l'ai pas lancé : ce n'est pas un correctif, c'est une décision d'architecture
d'assets. Trois pistes, à arbitrer :
1. `build.copyPublicDir: false` + servir `public/models/` depuis un CDN ou un
   dossier statique hors bundle ;
2. sortir de `public/` tout ce que le runtime ne charge pas — d'après `CLAUDE.md`
   il n'en utilise que ~4,7 Go sur ~120 Go de `public/models/` ;
3. déplacer d'abord `public/models/export/` (6,2 Go de sources C++ de plugins
   Unreal **payants**, actuellement téléchargeables par n'importe quel client —
   cf. `docs/BRIEF_RECUPERATION_SOURCES_CPP.md` §0.1).

Le point 3 est indépendant des deux autres et se règle en un déplacement de
dossier plus deux références de chemin.

---

## 4. Répartition Claude ⟷ Hermes

`REPARTITION_2026-08-02.md` · `DEMANDES_CROISEES.md` — une demande y est en
attente pour Hermes (M1, le sol de pose de la Forge doit venir de
`CollisionWorld`, fichier que je possède).