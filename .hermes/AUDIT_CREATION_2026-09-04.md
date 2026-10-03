# Audit du systeme de creation de personnage — 2026-09-04

Workflow `audit-narvos-creation`, 7 dimensions en parallele + refutation adversariale
a deux lentilles (code / impact reel).

## ⚠ ETAT : INTERROMPU

L'audit a ete **arrete manuellement** avant la fin (53 agents, cout de contexte).
**68 constats bruts** ont ete produits ; seuls **58 verdicts de refutation** sur les
~136 attendus ont tourne, dont **31 refutations**. 

**Consequence : aucun constat de ce fichier n'est confirme.** Chacun est une piste
a verifier, pas un defaut etabli. Plusieurs sont probablement faux — c'est la raison
d'etre de l'etape de refutation, et elle n'a pas fini de tourner.

Certains ont deja ete corriges dans la meme session (voir la derniere section).

Reprise : `Workflow({scriptPath: ".../audit-narvos-creation-wf_c394ee34-a33.js", resumeFromRunId: "wf_c394ee34-a33"})`
— les agents deja termines rendent leur resultat en cache, seuls les manquants tournent.

---

## Bloquants (9)

### 1. La garde-robe portée n'est jamais posée au spawn : le champ lu (`perso.equipement`) n'existe nulle part

`WebPortal/Server/nanos_world/packages/narvos-map-proto/Server/Index.lua:273`

**Preuve**

SpawnPersonnage fusionne l'apparence avec `perso.equipement` :

    for slot, id in pairs(perso.apparence or perso.tenue or {}) do porte[slot] = id end
    for slot, id in pairs(perso.equipement or {}) do porte[slot] = id end

`grep -rn "equipement" --include=*.lua` sur tout le dossier packages/ ne rend que DEUX occurrences : celle-ci, et `id = "mer_equipement"` dans Catalogs/Merchants.lua. Aucun endroit ne pose `perso.equipement`. Le champ réellement rempli s'appelle `gardeRobe` (Roster.lua:269, `gardeRobe = Roster.DecoderGardeRobe(l.garde_robe)`), et il existe déjà un helper prévu pour cette fusion : `Vestiaire.Tenue(apparence, garde_robe)` (Logic/Vestiaire.lua:433) — employé par Server/Vestiaire.lua:143 (`Rhabiller`) mais PAS ici.

La chaîne d'écriture est pourtant complète : Roster.Creer offre une tenue de départ (Roster.lua:363-366, `Vestiaire().Initiale(...)` qui remplit `porte` ET `possede`), l'INSERT écrit bien la colonne `garde_robe` (Roster.lua:370-374), et `Vestiaire.Envoyer` la relit correctement (Server/Vestiaire.lua:112-125).

**Consequence** — Écrit, persisté, relu, affiché à l'écran de garde-robe — et jamais appliqué au corps. Un personnage neuf apparaît en peau nue (`Modular.TenueComplete` complète les slots vides par `TenueBase`) alors que l'écran G affiche sa tenue de départ marquée « Retirer ». Idem à chaque reconnexion : tout ce que le joueur a acheté et porté disparaît visuellement au spawn et ne revient qu'au premier clic dans la garde-robe (seul chemin qui passe par `Rhabiller`).

**Correctif propose** — Remplacer la fusion manuelle par `local porte = Narvos.Vestiaire.Tenue(perso.apparence or perso.tenue, perso.gardeRobe)` — la même fonction que `Rhabiller`, pour que spawn et rhabillage n'aient qu'une seule règle.

---

### 2. Porter ou retirer un vêtement remet la morphologie du corps au neutre : `Rhabiller` appelle `Habiller` sans les morphs

`WebPortal/Server/nanos_world/packages/narvos-map-proto/Server/Vestiaire.lua:144`

**Preuve**

    local tenue = Logique.Tenue(ctx.perso.apparence or ctx.perso.tenue, garde_robe)
    local ok, raison = Builder.Habiller(ctx.character, ctx.corps, tenue)

Trois arguments : `morphs` est nil. Or `Builder.Habiller` se termine TOUJOURS par `Builder.AppliquerMorphs(character, corps, morphs)` (Logic/Character.lua:449), et `AppliquerMorphs` fait, avec `reglages = nil` :

    local poids = Morphs.Resoudre(reglages)          -- rend {} (Morphs.lua:252)
    ... Macros.Resoudre(Macros.Depuis(reglages))     -- Depuis(nil) -> Macros.Defaut()

`Macros.Depuis(nil)` retourne `Macros.Defaut()` (Logic/Macros.lua:258), c'est-à-dire gender 0.5 / age 0.25 / muscle 0.5 / weight 0.5 / height 0.5 + ethnies à 1/3, et `Macros.Resoudre` produit alors le jeu COMPLET des poids `macrodetails` du corps neutre, qui sont posés par `SetMorphTarget`. Les morphs de VISAGE, eux, ne sont pas remis à zéro (`Resoudre(nil)` rend une table vide) : seule la silhouette saute. Le comparatif est parlant — SpawnPersonnage, lui, passe bien `perso.morphs` en 4ᵉ argument (Server/Index.lua:276).

**Consequence** — Sur un corps `mpfb`, le premier clic « Porter » ou « Retirer » dans la garde-robe efface la silhouette choisie à la création (genre, âge, musculature, corpulence, taille, traits) et rend un corps neutre, avec le visage intact — le personnage change de morphologie sous les yeux du joueur, sans message ni erreur. Rien n'est perdu en base : le corps redevient correct à la reconnexion, ce qui rend le symptôme intermittent et difficile à rattacher au vestiaire.

**Correctif propose** — `Builder.Habiller(ctx.character, ctx.corps, tenue, ctx.perso.morphs)`. Accessoirement, envisager de faire de `morphs` un argument obligatoire ou de sortir `AppliquerMorphs` de `Habiller` : l'oubli est silencieux, et il s'est produit ici alors que les deux autres appels le passent.

---

### 3. Macros.Resoudre n'émet aucun zéro : les curseurs de corps ne reviennent jamais en arrière

`WebPortal/Server/nanos_world/packages/narvos/Shared/Logic/Macros.lua:121`

**Preuve**

`local function ajouter(sortie, nom, poids) if (poids <= 0) then return end` — Resoudre ne rend QUE les ancres de poids non nul. Character.lua:333 fusionne ce résultat dans `poids` puis pose `SetMorphTarget` : une ancre absente de la nouvelle table n'est jamais remise à 0. L'aperçu réutilise le MÊME Character (Session.lua:329 ne le détruit que si le genre ou l'asset change). Exécuté dans le harnais wasmoon sur le vrai Macros.lua : Resoudre(defaut)=12 morphs, Resoudre(weight=1,height=1)=20 morphs, Resoudre(defaut) après reset=12 morphs — 8 morphs posés à l'étape 2 sont ABSENTS de l'étape 3 donc restent à pleine valeur : universal-{female,male}-{young,old}-averagemuscle-maxweight et height/{female,male}-{young,old}-averagemuscle-maxweight-maxheight. C'est exactement le défaut que l'en-tête de Morphs.lua interdit (« REMETTRE L'AUTRE A ZERO N'EST PAS FACULTATIF ») et que Character.lua:328-330 affirme à tort ne pas exister pour les macros.

**Consequence** — Corpulence, taille, genre et âge ne se règlent que dans un sens. Le bouton « Réinitialiser le corps » (creation/index.js:948) supprime les valeurs côté client mais l'aperçu ne bouge pas. Les réglages s'accumulent d'un aperçu à l'autre : le joueur voit un corps qui ne correspond plus à ses glissières, et le personnage sauvegardé est correct alors que l'aperçu ment. Aucun test ne le couvre (macros 45 verts, morphs 35 verts).

**Correctif propose** — Faire émettre à Macros.Resoudre l'ensemble COMPLET du domaine d'ancres avec 0 pour celles non retenues (symétrique de Morphs.Resoudre), ou exposer `Macros.TousLesNoms()` et pré-remplir `poids[nom] = 0` dans Builder.AppliquerMorphs avant la fusion. Ajouter le test « régler puis remettre au défaut rend le même jeu de poids que le défaut ».

---

### 4. La suite n'est plus verte : 3 harnais sur 14 sont rouges depuis le branchement d'Apparence

`WebPortal/Server/nanos_world/packages/narvos/Shared/Logic/Roster.lua:32`

**Preuve**

A 14h55 la suite donnait bien 927/0. Apres les editions de 15h14-15h16 (Apparence enregistre dans Index.lua:65 puis appele par Roster.lua:109, 139, 250), trois harnais tombent :
  roster    : ERREUR LUA: attempt to index a nil value (global 'Package')  -- traceback: in field 'EncoderMorphs'
  parcours  : ERREUR LUA: attempt to index a nil value (global 'Package')
  creation  : ECHEC  les couleurs heritees sont presentes   (creation-tests.lua:107 exige perso.colors.skin, or Apparence.CIBLES ne contient plus que tenue/tenue2/yeux/cheveux -- l'en-tete d'Apparence.lua dit explicitement que la peau n'est pas recolorable)
Mecanique : `local function requis(nom, fichier) return (Narvos and Narvos[nom]) or Package.Require(fichier) end`. Aucun harnais ne pose `Narvos.Apparence` ; le repli `Package.Require` n'existe pas hors moteur. Total reel : 834 verts + 3 harnais rouges, pas 927/0.

**Consequence** — L'etat annonce (927 verts, 0 echec) est faux au moment de l'audit. Le module qui vient d'etre branche a casse le seul harnais qui couvre le chemin creation -> base -> moteur, et personne ne le verra tant que la suite n'est pas relancee.

**Correctif propose** — Ajouter `Narvos.Apparence = (function() ... end)()` dans roster.mjs (apres Narvos.Modular, ligne ~42) et dans parcours.mjs (meme endroit) ; mettre creation-tests.lua:107 en accord avec les nouvelles cibles (`perso.colors.tenue` / `.cheveux`) ou retirer l'assertion sur `skin`.

---

### 5. La regle 5 (compte_id dans chaque WHERE) n'est verrouillee par aucun test : la fausse base la reimplemente au lieu de la verifier

`scripts/lua-harness/roster.mjs:82`

**Preuve**

Mutation testing, code casse puis restaure :
  Roster.MajTenue  : "UPDATE personnages SET tenue = :0 WHERE id = :1 AND compte_id = :2" -> "... WHERE id = :1"        -> roster=PASSE (71/0)
  Commandes.lua:274: "DELETE FROM commandes WHERE compte_id = :0 AND action_id = :1" -> "... WHERE action_id = :1"     -> commandes=PASSE (104/0)
  Raccourcis.lua:215:"DELETE FROM raccourcis WHERE compte_id = :0 AND touche = :1" -> "... WHERE touche = :1"        -> raccourcis=PASSE (52/0)
  Roster.Supprimer : "DELETE ... WHERE id = :0 AND compte_id = :1" -> "... WHERE id = :0" (arguments inchanges)       -> roster=PASSE, parcours=PASSE
Cause : la fausse base filtre sur les POSITIONS d'arguments (`if (l.id == a[1] and l.compte_id == a[2])`), jamais sur le texte SQL. Les commentaires de roster.mjs:83-84 et parcours.mjs affirment le contraire ("Ignorer le second rendrait le test de suppression croisee vert a tort") : c'est l'inverse, c'est de reproduire le WHERE dans le mock qui rend le test vert quoi qu'il arrive au SQL.
Seule la mutation qui retire AUSSI l'argument est vue (roster=ECHOUE) -- or un developpeur qui simplifie une requete garde la liste d'arguments.

**Consequence** — La regle declaree inviolable du projet peut disparaitre de trois requetes sur cinq sans qu'un seul des 927 tests bronche. En jeu : n'importe quel joueur retire un raccourci, une commande, ou rhabille un personnage qui ne lui appartient pas en envoyant l'identifiant d'un autre.

**Correctif propose** — Un controle STATIQUE, sur le modele de schema-check.mjs : parcourir chaque `DELETE FROM`/`UPDATE` des Shared/Logic/*.lua et exiger la sous-chaine `compte_id` dans le WHERE (liste blanche explicite pour comptes.id). Cela verifie le texte, seul endroit ou la regle vit. En complement, faire la fausse base emettre un echec si le SQL recu ne contient pas `compte_id` la ou l'appelant en passe un.

---

### 6. Modular.TENUE_BASE reference 15 pieces qui n'existent pas, et les 3 familles trooper sont declarees PorteurCachable = true
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
**Consequence** — PorteurCachable=true fait cacher le mesh de base (Character.lua:SetMeshSettings(..., false)) alors qu'aucune des pieces censees le remplacer ne se resout : le personnage est integralement invisible, sans aucune erreur en Lua ni en moteur. Le jour ou un corps trooper entre dans Modular.CORPS, le defaut est immediat et muet.
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
**Consequence** — Le test qui porte le commentaire "LE TEST QUI EVITE UN PERSONNAGE DECAPITE" benit deja les trois entrees trooper cassees, et laisserait passer la regression precise qu'il documente. Un `egal(..., aTete)` dont l'oracle vient du code teste ne peut jamais dire si la regle est la bonne, seulement si le code est d'accord avec lui-meme.
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
### 2. L'aperçu d'un personnage enregistré ignore ses morphs et sa garde-robe : il réutilise le brouillon de création
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
`rendreFiche` affiche le personnage sélectionné avec :
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
**Consequence** — L'écran de sélection montre chaque personnage enregistré avec le visage et le corps du DERNIER brouillon (ou neutre après une reconnexion), et en peau nue au lieu de sa tenue. Le joueur ne reconnaît pas son propre personnage sur le rail, et pire : deux personnages différents s'affichent identiques.
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
**Correctif propose** — Faire de `morphs` un paramètre de `majApercu` au lieu d'une capture de variable globale, et appeler `majApercu(choisi.gender, fusion(choisi.tenue, choisi.gardeRobe), choisi.corps, choisi.morphs)`. La fusion existe déjà côté serveur (`Vestiaire.Tenue`) — la faire faire au serveur dans `MajApercu` quand la charge porte un id de personnage serait plus sûr que de la dupliquer en JS.
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
    db:Execute("UPDATE personnages SET tenue = :0 WHERE id = :1 AND compte_id = :2",
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
**Correctif propose** — Capturer `local touchees = db:Execute(...)` et rendre `false, "Personnage introuvable"` sous 1 ligne touchée, comme les quatre autres. Ajouter un test de harnais qui vérifie que TOUTE fonction d'écriture de Roster.lua teste son retour — c'est la deuxième fois que la règle est oubliée sur ce fichier.
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
**Consequence** — PorteurCachable("trooper_m","M") rend TRUE (il voit une pièce `tete`) alors qu'aucune des 5 pièces n'existe : réactiver un corps trooper via CORPS_RETENUS sans relancer les deux étapes cacherait le porteur et laisserait un personnage entièrement invisible, sans erreur. Le catalogue annonce 3 familles habillables de plus qu'il n'en a.
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
La premiere est le piege que le fichier documente lui-meme lignes 72-74 : "LA HAUTEUR EST EN Z, LA LARGEUR EN X ET Y. Intervertir ne leve rien : le personnage s'aplatit au sol."
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
**Consequence** — Toute la logique qui transforme une composition validee en personnage visible -- y compris le repli qui evite de rendre le joueur invisible -- n'a aucun filet. Les regressions y sont muettes par construction (regle 7 : un asset absent ou du mauvais type ne leve rien).
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
  Modular.TENUE_BASE = {}  (toute la peau decoupee disparait, chaque personnage sortirait nu ou invisible)
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
La branche `UPDATE personnages SET morphs` de la fausse base (roster.mjs:94, parcours.mjs) n'est donc jamais atteinte non plus.
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
**Consequence** — Le chemin par defaut — le joueur ne touche jamais l'etape Corps — cree un personnage sur le corps qui n'a aucun vetement affichable. Cumule avec le defaut precedent, c'est le cas nominal, pas un cas limite. Le garde serveur ne rattrape plus rien non plus : `for _, p in pairs(Modular.PIECES) do habillable[p.famille] = true end` marque desormais mpfb comme habillable, puisque la famille a recu 4 pieces aujourd'hui.
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
### 31. L'apercu de l'ecran de selection montre le visage et les teintes du BROUILLON, pas ceux du personnage
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
### 1. `ouvrirCreation` ne remet pas `morphs` à zéro : le visage d'un personnage fuit vers le suivant
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
**Consequence** — Créer un second personnage sans repasser par l'étape Corps lui donne le visage et la silhouette du premier. Visible dans l'aperçu, donc pas invisible — mais c'est une valeur d'un personnage qui se retrouve en base sur un autre, sans que rien ne l'ait demandé.
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
**Correctif propose** — Appliquer la cadence du vestiaire au dispatcher de chat, ou au minimum aux commandes qui persistent. Reformuler aussi le commentaire de DEV_COMMANDES : le critère n'est pas « agit sur son propre personnage » mais « n'écrit pas et ne coûte pas ».
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
### 7. Le nom de personnage n'a aucune contrainte de jeu de caractères et part non filtré dans du rich text
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
db:Execute("UPDATE personnages SET tenue = :0 WHERE id = :1 AND compte_id = :2", ...)
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
**Correctif propose** — Aligner MajTenue sur ses freres : recuperer `touchees` et rendre false + "Personnage introuvable" en dessous de 1. Ajouter le test correspondant en faisant rendre 0 a la fausse base.
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
---

## Deja corriges dans la session du 2026-09-04

Ces constats sont ANTERIEURS aux correctifs de la meme session. Ne pas les rouvrir
sans relire le code :

- `EncoderMorphs` jetait les zeros — les reglages prefixes `#` sont desormais conserves
- `Rhabiller` (Server/Vestiaire.lua) sans morphs ni couleurs — les deux sont passes maintenant
- `ouvrirCreation` ne remettait pas `morphs` a plat — `morphs` ET `couleurs` le sont
- L'ecran de creation distribuait le catalogue de la boutique — filtre `EstIdentite` retabli, 3 tests le verrouillent
- `Apparence.lua` sans test — 81 assertions dans `apparence-tests.lua`
- 3 harnais rouges — les 15 harnais sont verts, 881 assertions
- Colonne `couleurs` ecrite avec les defauts Dofus — `EncoderCouleurs` itere le catalogue