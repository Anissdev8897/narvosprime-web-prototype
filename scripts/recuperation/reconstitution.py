# -*- coding: utf-8 -*-
"""
reconstitution.py — le CŒUR de la reconstruction d'un fichier à partir de ses
événements (lectures partielles, écritures complètes, modifications), sans
aucune dépendance aux sources : testable seul (voir test_reconstitution.py).

── POURQUOI CE MODULE (2026-10-01) ───────────────────────────────────────────
La première version recousait les fragments PAR NUMÉRO DE LIGNE, toutes dates
confondues. Or un fichier grandit : un bloc lu en lignes 300-350 un jour vit en
320-370 le lendemain. Résultat mesuré : 19 générateurs sur 87 et 11 harnais en
« Identifier has already been declared » — le même bloc posé deux fois — et,
face aux fichiers sains rendus par DMDE, seulement 77 % de fichiers identiques.

── LE MODÈLE ─────────────────────────────────────────────────────────────────
Une ÉPOQUE est un état du fichier dans lequel les numéros de ligne sont
cohérents. On ne mélange jamais deux époques par numéro :

  · une écriture complète ouvre une époque neuve, entièrement connue ;
  · une modification porte ses positions exactes (hunks) : on DÉCALE les lignes
    connues qui la suivent, l'époque reste cohérente ;
  · une lecture qui contredit l'époque (autre longueur, contenu décalé) prouve
    que le fichier a changé hors de notre vue : nouvelle époque.

À la fin, la dernière époque fait foi. Les époques antérieures ne comblent ses
trous que par ALIGNEMENT DE CONTENU : entre deux repères identiques dans les deux
versions, si l'écart a la même longueur, les lignes anciennes sont reprises
telles quelles ; s'il a changé de longueur et que rien de plus récent n'est
connu, l'ancien bloc est posé ENTRE DEUX MARQUES qui le disent ancien. Sinon, le
trou reste un trou. Rien n'est inventé, rien n'est posé deux fois.
"""
import collections

TROU ="[TROU — ligne jamais lue dans les transcriptions]"
ANCIEN_DEBUT = "[ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : {n} ligne(s) attendue(s) ici, {m} connue(s)]"
ANCIEN_FIN = "[ANCIENNE VERSION ↑]"
FIN_INCONNUE = "[FIN INCONNUE — la suite du fichier n'a jamais été lue dans sa dernière version]"
SURES_DEBUT = ("[DERNIÈRE VERSION ↓ — ligne(s) sûre(s) du fichier final, lue(s) dans le tronçon ci-dessus "
               "mais non replacée(s) : il a changé de longueur. Leur n° final est entre crochets]")
SURE = "[SÛRE n°{n}] {t}"
SURES_FIN = "[DERNIÈRE VERSION ↑]"
INTERMEDIAIRE = "[SÛRE dans une version intermédiaire, non replacée] {t}"
NON_REPLACEES = ("[MODIFICATIONS NON REPLACÉES — {n} modification(s) faite(s) à ce fichier n'ont pas pu y être "
                 "reportées (texte d'origine introuvable ou ambigu) : voir EDITS_NON_APPLIQUES]")
POIDS_DEPLACEE = 20          # caractères utiles minimum pour reconnaître UNE ligne déplacée
POIDS_LOCAL = 8              # idem, entre deux repères déjà posés (la fenêtre est étroite)
RICHESSE = 1                 # un bloc ancien ne supplante des lignes sûres que s'il en porte N fois plus


class Hunk:
    """Un morceau de diff unifié : positions avant/après, et lignes signées."""

    def __init__(self, avant, n_avant, apres, n_apres, lignes):
        self.avant, self.n_avant, self.apres, self.n_apres = avant, n_avant, apres, n_apres
        self.lignes = lignes      # [(signe, texte)] avec signe dans " ", "-", "+"


def propre(ligne):
    """Une ligne sans son retour chariot : les fichiers CRLF et LF se comparent."""
    return ligne[:-1] if ligne.endswith("\r") else ligne


def etaler(ligne):
    """Une ligne telle que Claude Code l'écrit dans ses diffs (`structuredPatch`) : chaque
    TABULATION y devient DEUX ESPACES. Mesuré le 02/10/2026 : 2 580 lignes à tabulations
    sur 2 588 se retrouvent ainsi dans leur diff, aucune telle quelle. Les textes cherché
    et posé (`oldString`, `newString`), eux, gardent leurs tabulations.

    Sans en tenir compte, chaque modification d'un fichier indenté par tabulations (toute
    l'interface `Client/UI/*.js`) contredisait ce qu'on tenait du fichier — une fausse
    « nouvelle version » à chaque fois — et y posait des lignes indentées par espaces.
    """
    return ligne.replace("\t", "  ")


class Reconstitution:
    def __init__(self):
        self.carte = {}          # époque courante : numéro -> texte
        self.total = None        # longueur de l'époque courante, si connue
        self.anciennes = []      # époques closes, de la plus récente à la plus ancienne :
        #                          (carte, total, modifications restées en attente pendant l'époque)
        self.attente = []        # modifications sans position de l'époque courante, pas encore placées :
        #                          (ancien, neuf, tout, entieres)
        self.non_appliquees = []
        self.epoques = 1
        self.lectures = self.ecritures = self.modifications = 0
        # (longueur annoncée, numéro) d'une dernière ligne SANS retour final, vue une
        # fois au-delà de la longueur annoncée. Vaut tant que le fichier ne change pas.
        self.preuve_fin = None
        # numéro -> texte des lignes dont l'INDENTATION est perdue (première ligne d'une
        # sortie de shell, rognée par l'outil). Elles ne remplacent jamais une ligne
        # certaine : elles comblent un trou, faute de mieux, et sont comptées.
        self.incertaines = {}
        self.supprime = False    # le dernier événement connu est une suppression du fichier

    def _ailleurs(self, texte, numero):
        """Cette ligne existe-t-elle, UNE fois, à un autre numéro de l'époque courante ?"""
        places = [n for n, l in self.carte.items() if l == texte]
        return len(places) == 1 and places[0] != numero

    def _caler(self, fragment, a, marge):
        """Le décalage (0..marge) d'une lecture FLOTTANTE, ou None s'il n'est pas certain.

        Mesuré le 03/10/2026 : 429 `sed -n 'A,Bp'` seuls rendaient moins de lignes que leur
        plage (lignes vides rognées en tête ou en queue, ou fin de fichier) et étaient
        écartés — dont des lectures de `Server\\Index.lua`. Un décalage est retenu si :
          · les lignes qu'il suppose rognées (a .. a+d−1) sont vides là où on les connaît ;
          · aucune ligne connue ne contredit la lecture ainsi placée ;
          · au moins TROIS lignes reconnaissables s'accordent ;
          · et il est le SEUL dans ce cas.
        La lecture ne fait alors que combler des trous autour de ce qu'on tenait déjà.
        """
        retenus = []
        for d in range(marge + 1):
            if any((self.carte.get(a + j) or "").strip() for j in range(d)):
                continue                                 # une ligne non vide ne se rogne pas
            if self.total and fragment and fragment[-1][0] + d > self.total + 1:
                continue
            lourdes = contraires = 0
            for n, l in fragment:
                v = self.carte.get(n + d)
                if v is None:
                    continue
                # La première ligne de la sortie a perdu son indentation.
                meme = v.strip() == l.strip() if n == a else (v == l or v.rstrip() == l.rstrip())
                if not meme:
                    contraires += 1
                    break
                if _poids(l) >= POIDS_DEPLACEE:
                    lourdes += 1
            if not contraires and lourdes >= 3:
                retenus.append(d)
        return retenus[0] if len(retenus) == 1 else None

    # ── époques ──────────────────────────────────────────────────────────────
    def _nouvelle_epoque(self):
        if self.carte or self.incertaines:
            # Les lignes à l'indentation perdue restent connues de l'époque close : faute
            # de mieux, elles valent mieux qu'un trou pour la version suivante.
            # Les modifications restées en attente partent avec l'époque où elles ont eu lieu.
            self.anciennes.insert(0, ({**self.incertaines, **self.carte}, self.total, self.attente))
            self.attente = []
            self.epoques += 1
        self.carte, self.total = {}, None
        self.preuve_fin = None
        self.incertaines = {}

    # ── événements ───────────────────────────────────────────────────────────
    def ecrire(self, contenu):
        """Écriture complète : tout le fichier, à cet instant."""
        self.ecritures += 1
        self.supprime = False
        # Le fichier ENTIER est connu à cet instant : les modifications antérieures qu'on
        # n'avait pas su placer y sont forcément déjà — les retenter serait les refaire.
        self.attente = []
        lignes = [propre(l) for l in contenu.split("\n")]
        # FORME CANONIQUE : un fichier terminé par un retour à la ligne ne compte pas
        # de ligne vide finale. Les outils ne s'accordent pas là-dessus (Claude compte
        # 205, Hermes 204 pour le même fichier) : sans canon, chaque lecture croisée
        # passait pour un changement de version.
        if len(lignes) > 1 and lignes[-1] == "":
            lignes.pop()
        # Le même contenu que l'époque courante, déjà entièrement connue : pas d'époque
        # neuve (un Edit rend le fichier d'avant à chaque fois).
        if self.total == len(lignes) and all(self.carte.get(i) == l for i, l in enumerate(lignes, 1)):
            return
        self.preuve_fin = None
        self._nouvelle_epoque()
        self.carte = dict(enumerate(lignes, 1))
        self.total = len(lignes)

    def lire(self, fragment, total=0, rogne=None):
        """Lecture partielle : [(numéro, texte)], et la longueur du fichier si connue.

        `rogne` est le numéro d'une ligne dont les blancs de tête sont PERDUS (première
        ligne d'une sortie de shell) : son texte est juste, son indentation inconnue.

        `rogne = ("flottant", a, marge)` : une lecture dont la POSITION flotte. La plage
        demandée commençait en `a`, mais la sortie, rognée, a pu perdre ses premières
        lignes si elles étaient vides : les numéros du fragment (comptés depuis `a`) sont
        justes à un décalage près, de 0 à `marge`. Elle n'est prise que si ce qu'on tient
        du fichier la CALE sans ambiguïté (`_caler`) ; sinon elle est ignorée — elle ne
        prouve jamais, à elle seule, que le fichier a changé.
        """
        if isinstance(rogne, tuple):
            fragment = sorted((n, propre(l)) for n, l in fragment)
            decalage = self._caler(fragment, rogne[1], rogne[2])
            if decalage is None:
                return
            fragment = [(n + decalage, l) for n, l in fragment]
            rogne = rogne[1] + decalage
        self.lectures += 1
        self.supprime = False                        # on ne lit pas un fichier supprimé : il est revenu
        fragment = sorted((n, propre(l)) for n, l in fragment)
        incertaine = None
        if rogne is not None:
            incertaine = next(((n, l) for n, l in fragment if n == rogne), None)
            fragment = [(n, l) for n, l in fragment if n != rogne]
        # Même canon qu'à l'écriture : la « ligne » vide après le dernier retour n'en est pas une.
        if total and fragment and fragment[-1] == (total, ""):
            fragment.pop()
            total -= 1
        hors_compte = False
        if total:
            # Au-delà de la longueur annoncée : une amorce vide est un artefact ; une ligne
            # NON vide en total+1 est la dernière ligne d'un fichier sans retour final
            # (Hermes compte les retours à la ligne, pas les lignes).
            fragment = [(n, l) for n, l in fragment if n <= total or (n == total + 1 and l != "")]
            hors_compte = any(n == total + 1 for n, _ in fragment)
        if not fragment and incertaine is None:
            return
        plus_haut = max((n for n, _ in fragment), default=incertaine[0] if incertaine else 0)
        rupture = False
        # Un écart d'UNE ligne entre deux longueurs annoncées est l'ambiguïté de la ligne
        # finale (lecture partielle : on ne voit pas la fin), pas un changement de version.
        if total and self.total and abs(total - self.total) > 1:
            rupture = True
        elif not total and self.total and plus_haut > self.total + 1:
            rupture = True
        else:
            egales = differentes = deplacees = 0
            for n, l in fragment:
                v = self.carte.get(n)
                if v is not None:
                    # Aux blancs de FIN près : certains outils les retirent (recherches),
                    # d'autres non — ce n'est pas un changement du fichier.
                    if v == l or v.rstrip() == l.rstrip():
                        egales += 1
                    else:
                        differentes += 1
                        if _poids(l) >= POIDS_DEPLACEE and self._ailleurs(l, n):
                            deplacees += 1
            # Quelques lignes changées sur place : le fichier a été retouché sans
            # bouger. Une majorité de désaccords : il a été DÉCALÉ.
            if differentes >= 2 and differentes > egales:
                rupture = True
            # Une seule ligne suffit si elle est RECONNAISSABLE et que nous la connaissons
            # à un autre numéro : ce n'est pas une retouche, c'est notre numérotation qui
            # est périmée. La poser là créerait un doublon (mesuré : `PropPlacer.tsx`, un
            # `grep -n` rend `class PropErrorBoundary` en 17 quand nous la tenons en 18 —
            # une ligne avait disparu plus haut, hors de notre vue).
            elif deplacees:
                rupture = True
        if rupture:
            self._nouvelle_epoque()
        for n, l in fragment:
            v = self.carte.get(n)
            # Même ligne aux blancs de fin près : la plus longue est la plus fidèle (un
            # outil retire des blancs, il n'en ajoute pas).
            if v is None or v.rstrip() != l.rstrip() or len(l) > len(v):
                self.carte[n] = l
            self.incertaines.pop(n, None)
        if incertaine is not None:
            n, l = incertaine
            connue = self.carte.get(n)
            if connue is None:
                self.incertaines[n] = l
            elif connue.strip() != l.strip():
                # La ligne a changé sur place : le texte neuf fait foi, et il reprend
                # l'indentation de l'ancienne — une retouche garde presque toujours son retrait.
                del self.carte[n]
                self.incertaines[n] = connue[:len(connue) - len(connue.lstrip())] + l.lstrip()
        if hors_compte:
            self.preuve_fin = (total, total + 1)
        if total:
            # À une ligne près, on garde la plus COURTE longueur annoncée (le canon),
            # sauf si une ligne non vide prouve que le fichier va plus loin.
            self.total = total if (not self.total or abs(total - self.total) > 1) else min(total, self.total)
        if self.total:
            preuve = max((n for n, l in fragment if l != ""), default=0)
            if preuve > self.total:
                self.total = preuve
            # Une preuve ANTÉRIEURE vaut encore, tant que la MÊME longueur est annoncée.
            # Hermes relit les 500 premières lignes en annonçant 597 : la ligne 598, vue
            # juste avant au-delà du compte, existe toujours (mesuré : `types.ts` perdait
            # son `}` final à chaque relecture du début). ⚠ Mais pas « toute ligne connue
            # en total+1 » : un fichier raccourci d'une ligne garderait sa vieille fin.
            elif (total and self.preuve_fin and self.preuve_fin[0] == total
                  and self.total + 1 == self.preuve_fin[1] and self.carte.get(self.preuve_fin[1])):
                self.total = self.preuve_fin[1]

    def modifier(self, hunks, ancien=None, neuf=None, etale=False):
        """Modification avec positions exactes (diff unifié).

        `etale` : les lignes du diff ont PERDU LEURS TABULATIONS (voir `etaler`) — c'est le
        cas de tous les diffs de Claude Code. `ancien` et `neuf` sont alors les textes
        exacts, cherché et posé, d'où l'on rétablit les lignes ; à défaut, la ligne que
        l'on tenait à cette place ; à défaut encore, l'indentation du fichier.
        """
        self.modifications += 1
        hunks = [h for h in hunks if h.lignes]
        if not hunks:
            return
        self.preuve_fin = None
        self.supprime = False

        def meme(v, texte):
            return v.rstrip() == texte.rstrip() or (etale and etaler(v).rstrip() == texte.rstrip())

        accords = conflits = 0
        for h in hunks:
            n = h.avant if h.n_avant else h.avant + 1
            for signe, texte in h.lignes:
                if signe in " -":
                    v = self.carte.get(n)
                    if v is not None:
                        if meme(v, texte):
                            accords += 1
                        else:
                            conflits += 1
                    n += 1

        ancien_p = "\n".join(propre(l) for l in ancien.split("\n")) if ancien is not None else None
        neuf_p = "\n".join(propre(l) for l in neuf.split("\n")) if neuf is not None else None
        exactes = {}                 # forme étalée -> lignes ENTIÈRES exactes qui la donnent
        if etale:
            for texte in (neuf_p, ancien_p):
                for l in (texte or "").split("\n"):
                    exactes.setdefault(etaler(l).rstrip(), set()).add(l)
        tabule = etale and (any(l.startswith("\t") for l in self.carte.values())
                            or any(l.startswith("\t") for s in exactes.values() for l in s))

        def retablir(texte, connue=None):
            """Le texte exact d'une ligne de diff étalée."""
            if not etale:
                return texte
            if connue is not None and etaler(connue).rstrip() == texte.rstrip():
                return connue
            candidates = exactes.get(texte.rstrip())
            if candidates and len(candidates) == 1:
                return next(iter(candidates))
            if tabule:
                # Fichier indenté par tabulations : deux espaces de tête valent une tabulation.
                k = len(texte) - len(texte.lstrip(" "))
                return "\t" * (k // 2) + " " * (k % 2) + texte[k:]
            return texte

        if conflits >= 2 and conflits > accords:
            # Notre époque est périmée : on ne connaît plus que ce que le diff montre.
            self._nouvelle_epoque()
            for h in hunks:
                n = h.apres if h.n_apres else h.apres + 1
                for signe, texte in h.lignes:
                    if signe in " +":
                        self.carte[n] = retablir(texte)
                        n += 1
            return
        for h in sorted(hunks, key=lambda x: -x.avant):
            debut = h.avant if h.n_avant else h.avant + 1
            fin = debut + h.n_avant - 1
            delta = h.n_apres - h.n_avant
            cote_neuf = [t for s, t in h.lignes if s in " +"]
            exact = None
            if etale and ancien_p:
                # Le plus sûr : si l'on tient TOUT l'ancien côté, on y refait le remplacement
                # sur le texte exact, et on vérifie qu'étalé il redonne bien le diff.
                vieux = [self.carte.get(n) for n in range(debut, fin + 1)]
                if vieux and all(v is not None for v in vieux):
                    region = "\n".join(vieux)
                    for combien in (1, -1):
                        essai = region.replace(ancien_p, neuf_p or "", combien).split("\n")
                        if (ancien_p in region and len(essai) == len(cote_neuf)
                                and all(etaler(x).rstrip() == y.rstrip() for x, y in zip(essai, cote_neuf))):
                            exact = essai
                            break
            if exact is None:
                exact, n_vieux = [], debut
                for signe, texte in h.lignes:
                    if signe == " ":
                        exact.append(retablir(texte, self.carte.get(n_vieux)))
                    elif signe == "+":
                        exact.append(retablir(texte))
                    if signe in " -":
                        n_vieux += 1
            neuve = {}
            for n, l in self.carte.items():
                if n < debut:
                    neuve[n] = l
                elif n > fin:
                    neuve[n + delta] = l
            neuve.update(enumerate(exact, debut))
            self.carte = neuve
            self.incertaines = {(n if n < debut else n + delta): l for n, l in self.incertaines.items()
                                if (n < debut or n > fin) and (n if n < debut else n + delta) not in neuve}
            if self.total is not None:
                self.total += delta

    def remplacer(self, ancien, neuf, tout=False, entieres=False):
        """Modification SANS position : un texte cherché, un texte posé.

        Elle s'applique dès que le texte cherché se RECONNAÎT dans ce qu'on tient du
        fichier — une suite de lignes connues qui le porte, une seule fois (ou partout,
        si l'outil a remplacé partout) — et les lignes qui suivent sont décalées
        d'autant : l'époque reste cohérente, même trouée ailleurs. L'outil qui a fait
        la modification exigeait lui-même un texte unique dans le fichier ; le trouver
        dans ce qu'on connaît, c'est donc trouver le bon endroit.

        Sinon elle ATTEND, attachée à l'époque où elle a eu lieu : à l'assemblage, elle
        sera appliquée à cette époque une fois complétée par les précédentes — là où le
        texte cherché a toutes les chances de se trouver (voir `assembler`).

        `entieres` : le texte cherché est fait de lignes ENTIÈRES (patch à contexte) ;
        le retirer retire les lignes, sans laisser une ligne vide à leur place.
        """
        self.modifications += 1
        self.supprime = False
        ancien_p = "\n".join(propre(l) for l in ancien.split("\n"))
        neuf_p = "\n".join(propre(l) for l in neuf.split("\n"))
        fait = _substituer(self.carte, self.total, ancien_p, neuf_p, tout, entieres)
        if fait is None:
            self.attente.append((ancien, neuf, tout, entieres))
            # ⚠ Une modification qu'on ne sait pas placer et qui change le NOMBRE de lignes
            # décale tout ce qui la suit — on ne sait pas quoi. Garder l'époque, ce serait
            # mêler sous les mêmes numéros des lignes d'avant et d'après (mesuré le
            # 02/10/2026 : `ateliers.js`, lectures du 15/09 et du 19/09 fondues à quatre
            # lignes d'écart, de part et d'autre de modifications d'Astra restées en
            # attente). L'époque est close — la modification part avec elle — et ses
            # lignes seront replacées par leur contenu.
            if _lignes(neuf_p, entieres) != _lignes(ancien_p, entieres) and (self.carte or self.incertaines):
                self._nouvelle_epoque()
            return
        self.carte, self.total, decalages = fait
        for debut, fin, delta in decalages:
            self.incertaines = {(n if n < debut else n + delta): l for n, l in self.incertaines.items()
                                if n < debut or n > fin}
        self.preuve_fin = None

    def poser(self, lignes, fin_connue=True):
        """État PARTIEL mais CERTAIN du fichier après une transformation rejouée (bac.py) :
        `lignes` est la suite de ses lignes, None pour une ligne inconnue. La
        transformation a porté sur ce qu'on tenait : l'époque continue, renumérotée
        exactement comme le fichier l'a été."""
        self.modifications += 1
        self.supprime = False
        if fin_connue and all(l is not None for l in lignes):
            self.ecrire("\n".join(lignes))
            self.ecritures -= 1                  # compté comme une modification, pas comme une écriture
            return
        self.carte = {i: l for i, l in enumerate(lignes, 1) if l is not None}
        self.total = len(lignes) if fin_connue else None
        self.incertaines = {}
        self.preuve_fin = None

    def douter(self):
        """Le fichier a été modifié sans qu'on sache comment (un script qu'on ne sait pas
        rejouer) : ses numéros de ligne ne sont plus sûrs. L'époque est close ; ce
        qu'on en savait sera replacé par son contenu."""
        self.modifications += 1
        self._nouvelle_epoque()

    def supprimer(self):
        """Le fichier a été supprimé (ou déplacé). Ce qu'on en savait devient une ancienne
        époque : s'il renaît, c'est une autre version ; sinon, il n'est pas rendu."""
        self._nouvelle_epoque()
        self.supprime = True

    # ── assemblage ───────────────────────────────────────────────────────────
    def assembler(self, marque=lambda s: s):
        """Rend (texte, bilan). `marque(s)` habille un marqueur en commentaire du langage."""
        if self.supprime or (not self.carte and not self.incertaines and not self.anciennes):
            return None, {"lignes": 0, "trous": 0, "anciennes": 0, "exactes": 0, "supprime": int(self.supprime)}
        # Composite : la dernière version, élément par élément (voir `combler`).
        composite, rognees = _composite(self.carte, self.incertaines, self.total)
        exactes = sum(1 for e in composite if e[0] == "L")
        reprises, placees, restantes = 0, 0, []
        if self.anciennes and any(e[0] in ("T", "O") for e in composite):
            # ⚠ LE REPORT SE FAIT EN CHAÎNE, de la plus ancienne époque à la dernière :
            # chaque version est d'abord complétée par celle qui la précède, puis sert
            # d'ancienne version à la suivante. Combler la dernière directement avec la
            # plus vieille version ENTIÈRE sautait tout ce qu'on avait appris entre-temps
            # (mesuré : `Comptes.lua`, blocs repris de l'écriture du 03/09 alors que 573
            # lignes de la version du 07/09 étaient connues).
            # Inutile de remonter au-delà de la plus récente époque sans trou.
            #
            # ⚠ LES MODIFICATIONS EN ATTENTE S'APPLIQUENT EN CHEMIN, à l'époque où elles ont
            # eu lieu, une fois celle-ci complétée : c'est là que le texte cherché se trouve.
            # Une version vue par vingt lignes de `grep` ne porte pas le bloc qu'Astra a
            # modifié ; complétée par les versions d'avant, si (mesuré le 02/10/2026 :
            # `Server/Index.lua`, quatorze modifications d'Astra jamais placées).
            chaine = []
            for carte, total, attente in self.anciennes:
                ancien, _ = _composite(carte, {}, total)
                chaine.append((ancien, attente))
                if not any(e[0] in ("T", "O") for e in ancien):
                    break
            modele = None
            for ancien, attente in reversed(chaine):
                if modele is not None:
                    ancien, _ = combler(ancien, modele[0], modele[1])
                plat, longueur = _aplatir(ancien, marque)
                for edit in attente:
                    fait = _substituer(plat, longueur, _net(edit[0]), _net(edit[1]), edit[2], edit[3])
                    if fait is None:
                        restantes.append(edit)
                    else:
                        plat, longueur = fait[0], fait[1]
                        placees += 1
                modele = (plat, longueur)
            composite, reprises = combler(composite, modele[0], modele[1])

        sortie, trous, anciennes, fin_inconnue, non_replacees = [], 0, 0, 0, 0
        for rang, e in enumerate(composite):
            genre = e[0]
            if genre == "L":
                sortie.append(e[1])
            elif genre == "T":
                sortie.extend([marque(TROU)] * e[1])
                trous += e[1]
            elif genre == "O":
                sortie.append(marque(FIN_INCONNUE))
                fin_inconnue = 1
            elif genre == "A":
                connues = sum(1 for l in e[1] if l is not None)
                sortie.append(marque(ANCIEN_DEBUT.format(n="?" if e[2] is None else e[2], m=connues)))
                for l in e[1]:
                    if l is None:
                        sortie.append(marque(TROU))      # inconnue même de l'ancienne version
                        trous += 1
                    else:
                        sortie.append(l)
                sortie.append(marque(ANCIEN_FIN))
                anciennes += connues
            elif genre == "C":
                # Lignes SÛRES de la dernière version, lues dans un tronçon dont on ne tient
                # que l'ancienne forme : posées en commentaire, pour ne pas casser le bloc
                # ancien par un doublon ou une ligne orpheline.
                if rang == 0 or composite[rang - 1][0] != "C":
                    sortie.append(marque(SURES_DEBUT))
                sortie.append(marque(SURE.format(n=e[1], t=e[2])))
                non_replacees += 1
                if rang + 1 == len(composite) or composite[rang + 1][0] != "C":
                    sortie.append(marque(SURES_FIN))
        texte = "\n".join(sortie)

        # Ce qui attend encore — de la dernière époque, ou d'une plus ancienne où le texte
        # cherché n'a pas été trouvé — est tenté une dernière fois sur le texte final.
        refletees = 0
        self.non_appliquees = []
        complet = not (trous or anciennes or fin_inconnue or non_replacees)
        for ancien, neuf, tout, entieres in restantes + self.attente:
            ancien_p, neuf_p = _net(ancien), _net(neuf)
            abri = _abri(ancien_p, neuf_p)
            occurrences = _libres(texte, ancien_p, abri) if ancien_p else 0
            # Sans position, on n'applique que si l'ancre est UNIQUE : deux occurrences,
            # c'est une chance sur deux de modifier le mauvais endroit. Sauf si l'outil a
            # remplacé PARTOUT (`replace_all`) : alors toutes les occurrences encore
            # visibles sont celles que nous n'avons pas relues depuis.
            if occurrences == 1 or (tout and occurrences > 1):
                if entieres and neuf_p == "" and (ancien_p + "\n") in texte:
                    texte = texte.replace(ancien_p + "\n", "")
                else:
                    texte = _remplacer_libres(texte, ancien_p, neuf_p, abri, -1)
                placees += 1
            elif len(neuf_p.strip()) >= POIDS_LOCAL and neuf_p in texte:
                refletees += 1               # une lecture postérieure la montre déjà faite
            elif complet and _disparue(texte, ancien_p, neuf_p):
                # Le fichier est ENTIER et ce que la modification retirait n'y est plus :
                # elle a eu lieu, puis son résultat a encore changé. La dire « non
                # replacée » marquerait un fichier complet et juste.
                refletees += 1
            else:
                self.non_appliquees.append((ancien, neuf, tout))
        if self.non_appliquees and marque("x") != "x":
            texte += "\n" + marque(NON_REPLACEES.format(n=len(self.non_appliquees)))
        return texte, {"lignes": texte.count("\n") + 1, "trous": trous, "anciennes": anciennes,
                       "exactes": exactes, "reprises": reprises, "fin_inconnue": fin_inconnue,
                       "indentation_perdue": rognees, "non_replacees": non_replacees,
                       "modifs_perdues": len(self.non_appliquees), "modifs_refletees": refletees,
                       "modifs_placees": placees}


def _net(texte):
    """Un texte cherché ou posé, sans retours chariot."""
    return "\n".join(propre(l) for l in texte.split("\n"))


def _lignes(texte, entieres):
    """Nombre de lignes que tient un texte cherché ou posé."""
    return 0 if (entieres and texte == "") else texte.count("\n") + 1


# ⚠ UNE MODIFICATION DÉJÀ FAITE PEUT PORTER ENCORE SON ANCRE. Une insertion la garde
# (« local x = 1 » devient « local x = 1 / local y = 2 »), une retouche qui allonge aussi
# (« = 1 » devient « = 10 »). Là où le texte neuf est déjà posé, l'ancre qu'on y lit n'est
# pas une ancre : la remplacer insérait deux fois, ou écrivait « = 100 ». Les occurrences
# du texte neuf sont donc mises À L'ABRI, et seules les ancres LIBRES comptent.
def _abri(ancien_p, neuf_p):
    """Le texte neuf, s'il contient l'ancre (ses occurrences sont à protéger) ; None sinon."""
    return neuf_p if (ancien_p and neuf_p and ancien_p != neuf_p and ancien_p in neuf_p) else None


def _disparue(texte, ancien_p, neuf_p):
    """Ce que la modification RETIRAIT a-t-il quitté le texte ? Vrai si elle retirait au
    moins une ligne reconnaissable et qu'aucune de celles-là ne s'y lit plus."""
    retirees = [l.strip() for l in ancien_p.split("\n") if _poids(l) >= POIDS_LOCAL and l.strip() not in neuf_p]
    return bool(retirees) and not any(l in texte for l in retirees)


def _libres(texte, ancien_p, abri):
    """Nombre d'occurrences de l'ancre hors de celles du texte déjà posé."""
    if abri is None:
        return texte.count(ancien_p)
    return sum(m.count(ancien_p) for m in texte.split(abri))


def _remplacer_libres(texte, ancien_p, neuf_p, abri, combien):
    """`texte.replace(ancien_p, neuf_p, combien)`, sans toucher aux occurrences à l'abri."""
    if abri is None:
        return texte.replace(ancien_p, neuf_p, combien)
    morceaux = []
    for m in texte.split(abri):
        if combien != 0 and ancien_p in m:
            n = m.count(ancien_p) if combien < 0 else min(combien, m.count(ancien_p))
            m = m.replace(ancien_p, neuf_p, n)
            if combien > 0:
                combien -= n
        morceaux.append(m)
    return abri.join(morceaux)


def _substituer(carte, total, ancien_p, neuf_p, tout, entieres):
    """Remplace `ancien_p` par `neuf_p` dans une carte {numéro: texte}, là où une suite de
    lignes connues le porte — une seule fois, ou partout si `tout` — et décale ce qui suit.

    Rend (carte, total, [(début, fin, décalage)]), ou None si le texte cherché est
    introuvable ou ambigu.
    """
    suites = []                                   # (premier numéro, [lignes connues consécutives])
    for n in sorted(carte):
        if suites and n == suites[-1][0] + len(suites[-1][1]):
            suites[-1][1].append(carte[n])
        else:
            suites.append((n, [carte[n]]))
    porteuses = [(debut, lignes, "\n".join(lignes)) for debut, lignes in suites]
    abri = _abri(ancien_p, neuf_p)
    occurrences = sum(_libres(t, ancien_p, abri) for _, _, t in porteuses) if ancien_p else 0
    if occurrences == 0 or (occurrences > 1 and not tout):
        return None

    def substituer(texte):
        combien = -1 if tout else 1
        if entieres and neuf_p == "":
            if texte == ancien_p:
                return None                       # la suite entière disparaît
            for forme in (ancien_p + "\n", "\n" + ancien_p):
                if forme in texte:
                    return texte.replace(forme, "", combien)
        return _remplacer_libres(texte, ancien_p, neuf_p, abri, combien)

    decalages = []
    for debut, lignes, texte in reversed(porteuses):      # de la fin vers le début : les décalages
        if not _libres(texte, ancien_p, abri):             # ne touchent que ce qui est déjà traité
            continue
        rendu = substituer(texte)
        nouvelles = [] if rendu is None else rendu.split("\n")
        fin, delta = debut + len(lignes) - 1, len(nouvelles) - len(lignes)
        neuve = {n: l for n, l in carte.items() if n < debut}
        neuve.update({n + delta: l for n, l in carte.items() if n > fin})
        neuve.update(enumerate(nouvelles, debut))
        carte = neuve
        if total is not None:
            total += delta
        decalages.append((debut, fin, delta))
        if not tout:
            break
    return carte, total, decalages


def _composite(carte, incertaines, total):
    """Une époque, élément par élément : lignes sûres, trous, et fin ouverte si sa
    longueur est inconnue. Rend (composite, nombre de lignes à l'indentation perdue)."""
    fin = total or max(list(carte) + list(incertaines), default=0)
    composite, rognees, i = [], 0, 1
    while i <= fin:
        if i in carte:
            composite.append(("L", carte[i]))
            i += 1
        elif i in incertaines:
            composite.append(("L", incertaines[i]))      # texte juste, indentation inconnue
            rognees += 1
            i += 1
        else:
            j = i
            while j <= fin and j not in carte and j not in incertaines:
                j += 1
            composite.append(("T", j - i))
            i = j
    # ⚠ SANS LONGUEUR CONNUE, LA FIN EST OUVERTE. Une version n'a parfois été vue que par
    # morceaux (sed, diffs) : on sait jusqu'où on a lu, pas où le fichier s'arrête.
    # S'arrêter là sans le dire rendait un fichier « complet » amputé (mesuré :
    # HumanCharacter.tsx, 219 lignes posées sur 509).
    if total is None:
        composite.append(("O", 0))
    return composite, rognees


def _aplatir(composite, marque):
    """Un composite mis à plat : ({numéro: texte}, longueur ou None si la fin est ouverte)
    — de quoi servir d'ANCIENNE VERSION à l'époque suivante. Un bloc ancien y compte
    pour ses lignes ; une ligne sûre non replacée y reste, en commentaire."""
    plat, p, ouvert = {}, 1, False
    for e in composite:
        if e[0] == "L":
            plat[p] = e[1]
            p += 1
        elif e[0] == "T":
            p += e[1]
        elif e[0] == "A":
            for l in e[1]:
                if l is not None:
                    plat[p] = l
                p += 1
        elif e[0] == "C":
            plat[p] = marque(INTERMEDIAIRE.format(t=e[2]))
            p += 1
        elif e[0] == "O":
            ouvert = True
    return plat, (None if ouvert else p - 1)


def _poids(texte):
    return len(texte.strip())


def _portee(e):
    """Nombre de lignes du fichier FINAL que tient un élément du composite."""
    if e[0] in ("L", "C"):
        return 1
    if e[0] == "T":
        return e[1]
    if e[0] == "A":
        return e[2] or 0
    return 0


def _reperes(c_lignes, v_lignes, seuil):
    """Repères entre des lignes sûres [(position, texte)] et une version antérieure
    [(numéro, texte)], toutes deux croissantes. Rend [(position, numéro, longueur)].

    ⚠ UN REPÈRE PART TOUJOURS D'UNE LIGNE UNIQUE DES DEUX CÔTÉS (et reconnaissable :
    `seuil` caractères utiles). Une suite « lourde » de lignes répétées — `}`, une
    ligne vide, un filet `// ════` — existe à vingt endroits du fichier : la prendre
    pour repère l'accrochait au mauvais, et tout ce qui se trouvait entre deux faux
    repères était écrasé (mesuré le 02/10/2026 : `ateliers.js`, 808 lignes perdues pour
    trois lignes décoratives appariées 825 lignes trop haut).

    Méthode (celle du « patience diff ») : les lignes uniques des deux côtés donnent
    des couples (position, numéro) ; on garde la plus longue suite CROISSANTE de ces
    couples — du code déplacé n'y entre pas — puis chaque repère s'étend aux lignes
    voisines tant qu'elles sont égales et adjacentes des deux côtés.
    """
    if not c_lignes or not v_lignes:
        return []
    c_carte, v_carte = dict(c_lignes), dict(v_lignes)
    c_compte = collections.Counter(c_carte.values())
    v_compte = collections.Counter(v_carte.values())
    v_ou = {t: n for n, t in v_lignes if v_compte[t] == 1}
    couples = [(p, v_ou[t]) for p, t in c_lignes
               if c_compte[t] == 1 and t in v_ou and _poids(t) >= seuil]
    if not couples:
        return []
    # Plus longue suite croissante en numéros anciens (les positions le sont déjà).
    queues, liens = [], []          # queues[k] = indice du dernier couple d'une suite de longueur k+1
    for i, (_, v) in enumerate(couples):
        bas, haut = 0, len(queues)
        while bas < haut:
            m = (bas + haut) // 2
            if couples[queues[m]][1] < v:
                bas = m + 1
            else:
                haut = m
        liens.append(queues[bas - 1] if bas else None)
        if bas == len(queues):
            queues.append(i)
        else:
            queues[bas] = i
    suite, i = [], queues[-1]
    while i is not None:
        suite.append(couples[i])
        i = liens[i]
    suite.reverse()

    out = []                         # (position, numéro, longueur), sans chevauchement
    for p, v in suite:
        if out and p < out[-1][0] + out[-1][2]:
            continue                 # déjà couvert par l'extension du repère précédent
        debut_p, debut_v = p, v
        plancher_p = out[-1][0] + out[-1][2] if out else 1
        plancher_v = out[-1][1] + out[-1][2] if out else 1
        while (debut_p - 1 >= plancher_p and debut_v - 1 >= plancher_v
               and c_carte.get(debut_p - 1) is not None and c_carte.get(debut_p - 1) == v_carte.get(debut_v - 1)):
            debut_p, debut_v = debut_p - 1, debut_v - 1
        fin_p, fin_v = p, v
        while c_carte.get(fin_p + 1) is not None and c_carte.get(fin_p + 1) == v_carte.get(fin_v + 1):
            fin_p, fin_v = fin_p + 1, fin_v + 1
        out.append((debut_p, debut_v, fin_p - debut_p + 1))
    # L'extension vers l'avant d'un repère ne doit pas mordre sur le suivant.
    for k in range(len(out) - 1):
        p, v, l = out[k]
        l = min(l, out[k + 1][0] - p, out[k + 1][1] - v)
        out[k] = (p, v, l)
    return [r for r in out if r[2] > 0]


def _decouper(elements, c_deb, bornes):
    """Répartit des éléments (à partir de la position c_deb) entre les intervalles que
    délimitent des bornes [(position, numéro, longueur)]. Rend, dans l'ordre, des
    couples ("repere", [éléments]) et ("intervalle", [éléments], c_deb, v_deb, v_fin)."""
    morceaux, k, p = [], 0, c_deb
    for (pa, va, la), (pb, vb, _) in zip(bornes, bornes[1:]):
        repere = []
        while k < len(elements) and p < pa + la:
            repere.append(elements[k])
            p += _portee(elements[k])
            k += 1
        if repere:
            morceaux.append(("repere", repere))
        dedans, debut = [], p
        while k < len(elements) and p < pb:
            dedans.append(elements[k])
            p += _portee(elements[k])
            k += 1
        morceaux.append(("intervalle", dedans, debut, va + la, vb - 1))
    reste = elements[k:]
    return morceaux, reste, p


def _un_pour_un(elements, v_deb, vieille, etat):
    """Même longueur des deux côtés : chaque trou reprend la ligne ancienne de même rang."""
    out, n_vieux = [], v_deb
    for e in elements:
        if e[0] != "T":
            out.append(e)
            n_vieux += _portee(e)
            continue
        debut_trou = None
        for d in range(e[1]):
            l = vieille.get(n_vieux + d)
            if l is None:
                if debut_trou is None:
                    debut_trou = d
            else:
                if debut_trou is not None:
                    out.append(("T", d - debut_trou))
                    debut_trou = None
                out.append(("L", l))
                etat["reprises"] += 1
        if debut_trou is not None:
            out.append(("T", e[1] - debut_trou))
        n_vieux += e[1]
    return out


def _bloc_ancien(elements, c_deb, anciennes, portee):
    """Tronçon irréductible : le bloc ancien prend la place des trous, les lignes sûres
    qu'on ne sait pas y replacer deviennent des témoins numérotés (voir `assembler`)."""
    out, pose, p = [], False, c_deb
    for e in elements:
        if e[0] == "T":
            if not pose:
                out.append(("A", anciennes, portee))
                pose = True
        elif e[0] == "L":
            out.append(("C", p, e[1]))
        else:
            out.append(e)
        p += _portee(e)
    if not pose:
        out.append(("A", anciennes, portee))
    return out


def _intervalle(elements, c_deb, v_deb, v_fin, vieille, etat, niveau, ancre):
    """Comble un intervalle FERMÉ : positions c_deb… côté dernière version, numéros
    v_deb..v_fin côté version antérieure. `ancre` : il est tenu par un vrai repère."""
    if not any(e[0] == "T" for e in elements) or any(e[0] in ("A", "C") for e in elements):
        return elements
    n_c = sum(_portee(e) for e in elements)
    n_v = v_fin - v_deb + 1
    if n_c == n_v and ancre:
        return _un_pour_un(elements, v_deb, vieille, etat)
    if n_v <= 0:
        return elements              # rien d'ancien ici : des lignes ajoutées, jamais lues
    # La longueur a changé : on cherche des repères PLUS FINS à l'intérieur — la fenêtre
    # est étroite, une ligne unique dans la fenêtre suffit.
    if niveau == 0:
        connues, p = [], c_deb
        for e in elements:
            if e[0] == "L":
                connues.append((p, e[1]))
            p += _portee(e)
        v_loc = [(n, vieille[n]) for n in range(v_deb, v_fin + 1) if n in vieille]
        sous = _reperes(connues, v_loc, POIDS_LOCAL)
        if sous:
            bornes = [(c_deb, v_deb, 0)] + sous + [(c_deb + n_c, v_fin + 1, 0)]
            morceaux, reste, _ = _decouper(elements, c_deb, bornes)
            out = []
            for m in morceaux:
                if m[0] == "repere":
                    out.extend(m[1])
                else:
                    out.extend(_intervalle(m[1], m[2], m[3], m[4], vieille, etat, 1, True))
            return out + reste
    # Irréductible. L'ancien bloc est posé avec ses propres trous (ce qu'on en sait vaut
    # mieux que rien), pourvu qu'il pèse nettement plus que ce qu'on sait de neuf ici :
    # on ne noie pas des lignes sûres sous du vieux.
    bloc = [vieille.get(n) for n in range(v_deb, v_fin + 1)]
    connues = sum(1 for l in bloc if l is not None)
    sures = sum(1 for e in elements if e[0] == "L")
    if not connues or (sures and connues < RICHESSE * sures):
        return elements
    return _bloc_ancien(elements, c_deb, bloc, sum(e[1] for e in elements if e[0] == "T"))


def _queue(elements, c_deb, v_deb, vieille, vieux_total, etat):
    """Ce qui suit le dernier repère quand la fin n'est pas alignable : fin OUVERTE de la
    dernière version (dernier élément "O"), ou longueur inconnue de l'ancienne."""
    ouvert = bool(elements) and elements[-1][0] == "O"
    corps = elements[:-1] if ouvert else elements
    if any(e[0] in ("A", "C") for e in corps):
        return elements
    v_max = vieux_total or max(vieille)
    connues, p = [], c_deb
    for e in corps:
        if e[0] == "L":
            connues.append((p, e[1]))
        p += _portee(e)
    v_loc = [(n, vieille[n]) for n in range(v_deb, v_max + 1) if n in vieille]
    sous = _reperes(connues, v_loc, POIDS_LOCAL)
    out = []
    if sous:
        bornes = [(c_deb, v_deb, 0)] + sous
        morceaux, corps, c_deb = _decouper(corps, c_deb, bornes)
        for m in morceaux:
            if m[0] == "repere":
                out.extend(m[1])
            else:
                out.extend(_intervalle(m[1], m[2], m[3], m[4], vieille, etat, 1, True))
        # `_decouper` s'arrête AVANT le dernier repère : il ouvre ce qui reste.
        pa, va, la = sous[-1]
        k = 0
        while k < len(corps) and c_deb < pa + la:
            out.append(corps[k])
            c_deb += _portee(corps[k])
            k += 1
        corps, v_deb = corps[k:], va + la
    # Après le dernier repère : la SUITE de l'ancienne version prolonge le fichier, posée
    # étiquetée — rien ne dit qu'elle n'a pas changé depuis.
    bloc = [vieille.get(n) for n in range(v_deb, v_max + 1)]
    connues = sum(1 for l in bloc if l is not None)
    sures = sum(1 for e in corps if e[0] == "L")
    if ouvert and connues and (not sures or connues >= RICHESSE * sures):
        # Si l'ancienne version elle-même n'a pas de fin connue, la fin reste ouverte.
        return out + _bloc_ancien(corps, c_deb, bloc, None) + ([] if vieux_total else [("O", 0)])
    return out + corps + ([("O", 0)] if ouvert else [])


def combler(composite, vieille, vieux_total):
    """Comble les trous du composite avec une époque antérieure, par alignement de contenu.

    Le composite est la dernière version, élément par élément :
      ("L", texte)             une ligne sûre ;
      ("T", n)                 n lignes jamais lues ;
      ("A", [lignes], n)       un bloc d'ANCIENNE version tenant lieu de n lignes (None :
                               on ne sait pas — c'est la fin du fichier) ;
      ("C", n°, texte)         une ligne sûre, de n° connu, qu'on n'a pas su replacer dans
                               le bloc ancien qui la précède ;
      ("O", 0)                 fin ouverte : on ignore où le fichier s'arrête.

    Entre deux repères, si l'écart a la MÊME longueur des deux côtés, les lignes anciennes
    comblent les trous une à une. S'il a changé de longueur, on cherche des repères plus
    fins ; ce qui reste irréductible reçoit l'ancien bloc entier, étiqueté. Un bloc ancien
    ou un témoin déjà posés par une époque plus récente ne sont jamais retouchés.

    Rend (composite neuf, nombre de lignes reprises exactement).
    """
    if not vieille or not composite:
        return composite, 0
    pos, p = [], 1
    for e in composite:
        pos.append(p)
        p += _portee(e)
    fin_composite = p - 1
    fin_ouverte = composite[-1][0] == "O"
    fin_ancienne = composite[-1][0] == "A" and composite[-1][2] is None
    c_lignes = [(pos[k], e[1]) for k, e in enumerate(composite) if e[0] == "L"]
    v_lignes = [(n, vieille[n]) for n in sorted(vieille)]
    reperes = _reperes(c_lignes, v_lignes, POIDS_DEPLACEE)
    ferme = bool(vieux_total) and not fin_ouverte and not fin_ancienne
    etat = {"reprises": 0}

    bornes = [(1, 1, 0)] + reperes + ([(fin_composite + 1, vieux_total + 1, 0)] if ferme else [])
    morceaux, reste, c_suite = _decouper(composite, 1, bornes)
    resultat = []
    for m in morceaux:
        if m[0] == "repere":
            resultat.extend(m[1])
        else:
            resultat.extend(_intervalle(m[1], m[2], m[3], m[4], vieille, etat, 0, bool(reperes)))
    if ferme or fin_ancienne:
        resultat.extend(reste)
    else:
        # Le dernier repère lui-même, puis ce qui le suit jusqu'à la fin.
        pa, va, la = bornes[-1]
        k = 0
        while k < len(reste) and c_suite < pa + la:
            resultat.append(reste[k])
            c_suite += _portee(reste[k])
            k += 1
        resultat.extend(_queue(reste[k:], c_suite, va + la, vieille, vieux_total, etat))

    # Fusion des trous voisins (lisibilité du bilan).
    fusion = []
    for e in resultat:
        if e[0] == "T" and fusion and fusion[-1][0] == "T":
            fusion[-1] = ("T", fusion[-1][1] + e[1])
        elif not (e[0] == "T" and e[1] == 0):
            fusion.append(e)
    return fusion, etat["reprises"]


def hunks_depuis_structure(patch):
    """Hunks d'un `structuredPatch` de Claude Code."""
    out = []
    for h in patch or []:
        try:
            lignes = [(l[:1], propre(l[1:])) for l in h.get("lines") or [] if l and l[0] in " -+"]
            out.append(Hunk(int(h["oldStart"]), int(h["oldLines"]), int(h["newStart"]), int(h["newLines"]), lignes))
        except Exception:
            continue
    return out


def hunks_depuis_diff(diff):
    """Hunks d'un diff unifié textuel (résultat `patch` d'Hermes)."""
    import re
    entete = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")
    out, courant = [], None
    for l in (diff or "").split("\n"):
        m = entete.match(l)
        if m:
            courant = Hunk(int(m.group(1)), int(m.group(2) if m.group(2) is not None else 1),
                           int(m.group(3)), int(m.group(4) if m.group(4) is not None else 1), [])
            out.append(courant)
            continue
        if courant is None:
            continue                       # en-têtes de fichier (`--- a/x`, `+++ b/x`) : avant tout hunk
        avant = sum(1 for s, _ in courant.lignes if s in " -")
        apres = sum(1 for s, _ in courant.lignes if s in " +")
        plein = avant >= courant.n_avant and apres >= courant.n_apres
        # ⚠ Dans un hunk, `--- texte` N'EST PAS un en-tête : c'est la suppression d'une
        # ligne `-- texte` — un commentaire Lua. Les sauter amputait le hunk, qui ne
        # s'accordait plus avec le fichier connu, et chaque modification d'un fichier
        # Lua commenté passait pour une rupture de version (mesuré : `Character.lua`,
        # 831 lignes connues une heure avant la perte, rendu en 258). Un en-tête ne
        # peut venir qu'une fois le hunk COMPLET (diff de plusieurs fichiers).
        if plein and l.startswith(("--- ", "+++ ", "diff ", "index ")):
            courant = None
            continue
        if l and l[0] in " -+":
            if not plein:
                courant.lignes.append((l[0], propre(l[1:])))
        elif l == "":
            # Une ligne de contexte VIDE perd parfois son espace de tête dans les diffs.
            if avant < courant.n_avant or apres < courant.n_apres:
                courant.lignes.append((" ", ""))
    return out
