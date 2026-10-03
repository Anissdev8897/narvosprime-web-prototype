# narvos-iteration-guard

Garde-fou anti-régression. À invoquer APRÈS chaque modification de code sur NARVOS PRIME.

## Procédure post-modification

```bash
# 1. Vérifier que le projet compile sans nouvelle erreur
cd E:/narvosprime-web-prototype/WebPortal
node node_modules/typescript/bin/tsc --noEmit
# Résultat attendu : 1 erreur pré-existante dans CollisionWorld.ts (GeometryBVH)
#  ZÉRO nouvelle erreur dans src/rpg/**

# 2. Vérifier que tous les tests passent
npm test 2>&1 | tail -5
# Résultat attendu : 411 tests / 65 suites — tous verts

# 3. Vérifier les imports/exports du fichier modifié
# Si un fichier a été modifié :
grep -rn "from.*./chemin/fichier-modifié" src/ --include="*.ts" --include="*.tsx"
# Vérifier que tous les call sites existent et sont compatibles

# 4. Si un singleton/module a été modifié
# - Vérifier que la signature publique (export) n'a pas changé
# - Vérifier tous les call sites : grep des fonctions/variables exportées
# - Si le type de retour a changé, vérifier la compatibilité descendante

# 5. Si un type/interface a changé
# Grep tous les usages et vérifier la compatibilité
grep -rn "NomDuType\|NomDeLInterface" src/ --include="*.ts" --include="*.tsx"

# 6. Si une modification a généré une erreur factuelle
# -> Ajouter une entrée dans .claude/skills/narvos-error-log/SKILL.md

# 7. Si les métriques ont changé (nouveaux fichiers/tests)
# -> Mettre à jour .claude/skills/narvos-project-map/SKILL.md
```

## Vérifications par type de modification

### Modification d'un store singleton
- [ ] La persistance localStorage est-elle préservée ?
- [ ] Les appels à `notify()` sont-ils toujours présents après mutation ?
- [ ] Le hook `useSyncExternalStore` dans les composants React est-il compatible ?
- [ ] Les tests unitaires existants passent-ils ?

### Ajout d'une nouvelle quête/NPC/item/catalogue
- [ ] Le nouveau fichier suit-il le pattern « catalogue statique » (const/Map) ?
- [ ] Si c'est une quête : a-t-elle un objectif (`kill`/`reach`/`collect`) ?
- [ ] Si c'est un NPC : a-t-il des clips d'animation (sinon → T-pose L257) ?
- [ ] Si c'est une arme : a-t-elle un socket valide dans `WeaponSocket.tsx` ?

### Modification de RpgGameWorld.tsx
- [ ] Le fichier a été lu EN ENTIER avant modification (3753 lignes)
- [ ] Aucun TDZ introduit (les useCallback référencés par useEffect doivent être déclarés AVANT ou utiliser le pattern ref)
- [ ] Si ajout de imports : vérifier les dépendances circulaires

### Modification du WASM bridge
- [ ] `getEngine()` guard null présent (fallback JS silencieux)
- [ ] Aucun import « propre » de WASM (variable + `@vite-ignore` requis)
- [ ] `HEAPF32` pas caché entre frames (memory growth)
- [ ] Skill `wasm-engine` consulté AVANT la modification

## Métriques de référence (à vérifier après chaque changement)

```
Fichiers TS/TSX : 421
LOC total       : ~44k
Tests           : 411 (65 suites)
Erreurs tsc     : 1 (pré-existante CollisionWorld.ts)
RpgGameWorld    : 3753 lignes
```

Tout écart significatif doit être justifié et documenté.

---

## Côté nanos world — après TOUTE modification d'un package Lua

```bash
cd scripts/lua-harness
node syntaxe-check.mjs             # la GRAMMAIRE de chaque fichier des deux packages
node portee-check.mjs              # un nom employé AVANT son `local` — ce que load() ne voit pas
node listes-recopiees-check.mjs    # un littéral de chaînes qui EST une copie d'un catalogue
```

Les trois, jamais l'un seul. `syntaxe-check` appelle `load()`, qui valide la
grammaire et **pas la portée** : un `local function` déclaré après son appelant
compile parfaitement et lève à l'exécution, des minutes plus tard, quand le
joueur appuie sur la touche. `portee-check` a trouvé `SansBalise` (déclarée
l. 554, appelée l. 210 et 444) dès sa première exécution.

**`listes-recopiees-check`** ferme la troisième famille, celle qui ne lève
jamais : une liste de clés recopiée à la main. Le 2026-09-10,
`ipairs({ "orbital", "tower", "alien" })` déclarait les mondes chargés au
démarrage — écrite quand il y en avait quatre. La capitale et la forêt, ajoutées
la veille, n'y étaient pas : **7 portails posés sur 10**, et rien ne l'a dit
(zéro refus de `MondePraticable`, diagnostic « ouvert » pour les quatre passages,
zéro erreur Lua — la boucle n'était pas atteinte). Le contrôle refuse tout
littéral dont **tous** les éléments sont des clés d'un catalogue surveillé ; il a
trouvé une seconde occurrence dans le même fichier que la lecture manuelle avait
manquée.

⚠ Il ne vérifie pas qu'une copie est *complète* — une copie complète aujourd'hui
est périmée demain, c'est le mode d'échec lui-même. Il refuse la copie. Le
remplacement est toujours : itérer le catalogue et filtrer sur une **propriété**
(`m.decor_persistant`, `m.niveau`…), jamais sur un nom.

### Après tout cook, réimport, ou mise à jour Steam du client

```bash
node scripts/narvos-verifier-catalogues.mjs
```

nanos **n'échoue pas** sur un asset manquant : `Character` affiche la capsule de
collision (un cylindre blanc), `Particle` ne joue rien, `Prop` ne pose rien. Le
joueur en conclut que la touche n'a pas répondu. Ce contrôle croise les six
catalogues avec les deux inventaires — le nôtre (`Assets.toml`) et celui du pack
de base (contenu Steam installé).

Attendu : **2 356 références, 0 morte**.

### Après avoir touché aux touches

Trois listes doivent rester alignées, sans quoi une touche existe d'un côté et
pas de l'autre — sans erreur :

| Où | Quoi |
|---|---|
| `Shared/Logic/Commandes.lua` | `ACTIONS` — la liste fermée, avec les défauts |
| `Client/Index.lua` | `ACTIONS.<id> = function() … end` — ce que la touche fait |
| `Client/Index.lua` | `TouchesAssignables()` — les touches enregistrées |

Une action présente côté serveur et absente côté client donne une touche inerte ;
l'inverse donne une action qui n'aura jamais de touche.

```bash
node scripts/lua-harness/commandes.mjs   # 101 tests, dont l'unicité des défauts
```

## Métriques de référence nanos (2026-09-10)

⚠ Le bloc précédent datait du 2026-09-03 et annonçait 43 fichiers Lua, 17 042
lignes, 98 111 fichiers cuits. **Tout avait environ doublé sans que personne le
rouvre** — c'est le défaut que ce skill est censé empêcher, commis sur ce skill
même. D'où la commande à côté de chaque chiffre : un compteur sans sa commande
est un compteur qu'on recopiera.

```
Batterie                : 51 harnais · 3 086 assertions · 0 rouge
                                     node scripts/lua-harness/tout.mjs
Fichiers Lua (packages) :      91    find …/packages -name '*.lua' | wc -l
Lignes Lua              :  36 983    find …/packages -name '*.lua' -exec cat {} + | wc -l
Harnais (fichiers .mjs) :      57    ls scripts/lua-harness/*.mjs | wc -l   (51 jugent, 6 génèrent)
Générateurs narvos-*    :      32    ls scripts/narvos-*.mjs | wc -l
Pack cuit               : 212 858    find WebPortal/Server/Assets/narvos/Narvos -type f | wc -l
Portails posés au boot  :      10    grep -c "Portail pose" .hermes/serveur_*.log
```

**`node scripts/lua-harness/tout.mjs` est la commande qui manquait.** La règle
« lancer TOUTE la batterie » existait sans commande pour l'appliquer : on lançait
donc les harnais qu'on avait en tête, et le 2026-09-09 quatre étaient rouges
pendant qu'on annonçait « 9 verts ». Une règle sans commande est un souhait.

⚠ Son compteur d'assertions a lui-même sous-compté à sa première écriture : le
motif exigeait `reussis` au pluriel nu et ratait les harnais qui impriment
`%d reussi(s)`. **2 523 annoncées au lieu de 3 086**, sans un mot. C'est pourquoi
`tout.mjs` sort en ROUGE si le total tombe à zéro : un compteur faux rassure, il
n'alerte pas.

Le compte de portails, lui, se compare à `#Mondes.LIAISONS`, jamais à un nombre
écrit — c'est ce qui a fait voir les trois manquants du 2026-09-10.

Le compte de portails se compare à `#Mondes.LIAISONS`, jamais à un nombre écrit :
c'est ce qui a fait voir les trois manquants du 2026-09-10.