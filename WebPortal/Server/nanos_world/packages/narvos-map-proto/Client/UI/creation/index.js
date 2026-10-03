// ══════════════════════════════════════════════════════════════════════════════
// index.js — écrans de connexion, sélection et création de personnage.
//
//   Lua  -> JS   webui:CallEvent("Nom", args...)   reçu par Events.Subscribe
//   JS   -> Lua  Events.Call("Nom", args...)       reçu par Events.Subscribe
//
// Même pont que le HUD (../index.js) : il est déjà éprouvé, on ne le réinvente pas.
//
// ── CE QUE CE FICHIER NE FAIT PAS ─────────────────────────────────────────────
// Il ne DÉCIDE rien. Les classes, les genres, les pièces modulaires et les bornes
// du nom arrivent tous du serveur (`Narvos:Options`) ; l'écran ne peut donc
// jamais proposer un choix que le serveur refuserait ensuite.
//
// La validation affichée ici n'est qu'un confort : le serveur revalide tout, et
// c'est lui qui fait autorité. Voir Server/Session.lua.
// ══════════════════════════════════════════════════════════════════════════════

"use strict";

// ── État ──────────────────────────────────────────────────────────────────────

/** Options envoyées une fois par le serveur : classes, genres, pièces, bornes. */
let OPTIONS = null;

/** Dernier état de session reçu : { etat, pseudo, persos, erreur }. */
let SESSION = { etat: "connexion", persos: [] };

/** Personnage mis en avant dans le rail. */
let choisi = null;

/** Brouillon de création. `tenue` est rempli au choix du genre. */
let brouillon = null;

/** Curseurs de morphologie modifies, par identifiant. Un curseur absent vaut 0,
 *  qui est son etat au repos : on ne stocke donc QUE ce qui bouge.
 *
 *  ⚠ DECLARE ICI, PAS PRES DE SON RENDU. `majApercu` le lit, et `majApercu`
 *  est ecrit plus haut dans le fichier : une declaration `let` posee plus bas
 *  le laisserait dans sa ZONE MORTE, et le premier apercu leverait
 *  « Cannot access morphs before initialization ». Le meme piege a coute cinq
 *  diagnostics cote Lua sur ce projet.
 */
let morphs = {};

/** Couleurs choisies, par identifiant de cible. Meme zone morte que `morphs`
 *  ci-dessus, meme remede : declaree en tete parce que `majApercu` la lit.
 *
 *  Une cible absente prend son defaut cote serveur — on ne stocke donc QUE ce
 *  que le joueur a change, et le nuancier n'a pas a etre initialise.
 *
 *  ⚠ Les COULEURS vivent ici, la SILHOUETTE dans `morphs` sous le prefixe `#`.
 *  Ce n'est pas une incoherence : la silhouette est un curseur qui se persiste
 *  avec les autres curseurs, une couleur est une chaine qui se persiste dans sa
 *  propre colonne. Les melanger obligerait a trier a chaque ecriture. */
let couleurs = {};

/** Le parcours. L'IDENTITÉ vient EN DERNIER : on nomme un personnage qu'on a
 *  sous les yeux, pas une fiche vide.
 *
 *  ⚠ Le GENRE ne fait plus partie de l'identité — c'est lui qui filtre les
 *  pièces de tenue, il doit donc être choisi AVANT. Le laisser en fin de
 *  parcours rendrait l'étape « Tenue » impossible à afficher. */
const ETAPES = [
	{ id: "faction", label: "Faction" },
	{ id: "classe", label: "Classe" },
	{ id: "genre", label: "Corps" },
	// ⚠ N'APPARAIT QUE POUR UN CORPS MORPHABLE. `etapesVisibles()` la retire
	// des autres : une etape qu'on traverse sans rien pouvoir y regler se lit
	// comme un bug, pas comme une option.
	{ id: "visage", label: "Visage", siMorphable: true },
	// L'identifiant reste `tenue` : il voyage dans les reglages et jusqu'en base.
	// Seul le LIBELLE change — l'etape ne montre plus de vetements depuis qu'ils
	// s'achetent, mais l'apparence : visage, et bientot coiffure.
	{ id: "tenue", label: "Apparence" },
	{ id: "nom", label: "Identité" },
];

let etape = "faction";

/** Les etapes reellement parcourues.
 *
 *  L'etape « Visage » n'existe que pour un corps qui porte des morph targets.
 *  Sur les autres, ses curseurs ne feraient rien — `SetMorphTarget` sur un mesh
 *  sans morph ne leve pas — et le joueur chercherait la panne.
 */
const etapesVisibles = () => ETAPES.filter((e) => !e.siMorphable || estMorphable());

// ── Raccourcis ────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

/** Crée un élément avec ses classes et son texte. */
const el = (balise, classes, texte) => {
	const n = document.createElement(balise);
	if (classes) n.className = classes;
	if (texte !== undefined) n.textContent = texte;
	return n;
};

/** Affiche ou masque un nœud. On passe TOUJOURS par `hidden`, jamais par
 *  `style.display` : le CSS force `[hidden] { display: none !important }`, et
 *  mélanger les deux mécanismes produit des états impossibles à déboguer. */
const montrer = (noeud, oui) => {
	if (noeud) noeud.hidden = !oui;
};

/** Envoie un événement au Lua client, si le pont existe. */
const versLua = (nom, ...args) => {
	if (typeof Events !== "undefined") Events.Call(nom, ...args);
};

/** Envoie une STRUCTURE au Lua, sérialisée.
 *
 *  ── LE DÉFAUT QUE ÇA CORRIGE ────────────────────────────────────────────────
 *  Le pont WebUI → Lua ne porte PAS les objets JavaScript. Il porte les chaînes
 *  et les nombres, et rien n'indique la différence : `Events.Call` ne lève pas,
 *  et l'événement n'arrive simplement jamais côté Lua.
 *
 *  Observé en jeu le 2026-09-04. Sur les huit appels de cet écran, les six qui
 *  passent des chaînes fonctionnent (`Connexion`, `Choisir`, `Supprimer`,
 *  `Steam`, `Pret`, `Inscription`) ; les DEUX qui passaient un objet étaient
 *  morts — `Apercu`, d'où l'absence d'aperçu 3D, et `Creer`, d'où le bouton
 *  CRÉER sans effet. Aucune trace serveur, aucune erreur client.
 *
 *  ⚠ L'ASYMÉTRIE EST RÉELLE : le sens Lua → WebUI, lui, porte bien les tables.
 *  C'est ainsi que les factions, les corps et les 116 pièces arrivent ici. Ne
 *  pas en déduire que l'inverse marche.
 *
 *  Le Lua décode avec `JSON.parse`, documenté dans `file.mdx`. */
const structureVersLua = (nom, objet) => {
	versLua(nom, JSON.stringify(objet));
};

/** ── SONDE TEMPORAIRE ────────────────────────────────────────────────────────
 *
 *  Émet une CHAÎNE, jamais un objet. Son seul rôle est de répondre à une question
 *  binaire que rien d'autre ne tranche : le pont WebUI → Lua fonctionne-t-il,
 *  oui ou non ?
 *
 *  On suppose depuis deux essais qu'il porte les chaînes et pas les objets. Cette
 *  supposition n'a JAMAIS été prouvée : elle vient du fait que l'écran s'affiche,
 *  ce qui ne prouve que le sens INVERSE (Lua → WebUI).
 *
 *  Lecture du résultat, dans le log client
 *  (%LOCALAPPDATA%/NanosWorld/Saved/Logs, flushé à la fermeture) :
 *
 *    « ping cablage »  absent  -> le pont est mort dans les DEUX sens, ou le
 *                                 code de câblage de cette page ne tourne pas
 *    « ping cablage »  présent, « ping clic-creer » absent
 *                              -> le pont marche, mais le clic n'atteint pas
 *                                 le gestionnaire
 *    les deux présents         -> le pont marche pour les chaînes, et le défaut
 *                                 est bien dans le passage d'objets
 *
 *  ⚠ À RETIRER une fois la réponse obtenue. */
const sonde = (etape) => versLua("NarvosCreation:Ping", etape);

/** Demande au serveur de rhabiller le mannequin d'aperçu.
 *
 *  On envoie l'état COMPLET (genre + tenue) et non un delta : le serveur
 *  reconstruit à partir de ce seul message, donc un envoi perdu se rattrape au
 *  suivant au lieu de laisser le mannequin dans un état bâtard. */
const majApercu = (genre, tenue, corps) => {
	if (!genre) return;
	// Le corps part avec : c'est lui qui decide du mesh de base ET de la
	// morphologie. Sans lui, le serveur retomberait sur le premier corps du
	// genre, et l'apercu montrerait autre chose que ce qui sera cree.
	// Les morphs partent avec : l'apercu doit montrer le visage en cours de
	// reglage, sinon le joueur valide un personnage qu'il n'a jamais vu.
	structureVersLua("NarvosCreation:Apercu", {
		genre, corps: corps || null, tenue: tenue || {}, morphs: morphs || {},
		// Les couleurs suivent le meme principe que les morphs : l'apercu doit
		// montrer la teinte en cours de reglage, sinon le joueur valide un
		// personnage qu'il n'a jamais vu.
		couleurs: couleurs || {},
		// Apparence du Meta Customization System (corps Blueprint seulement). Le
		// serveur la NORMALISE avant de la poser sur le Blueprint d'apercu.
		metacustom: (brouillon && brouillon.metacustom) || null,
	});
};

/** L'apparence MetaHuman de depart d'un genre, COPIEE : le brouillon la modifie. */
const metacustomDefaut = (genre) => {
	const d = OPTIONS && OPTIONS.metacustom && OPTIONS.metacustom.defaut && OPTIONS.metacustom.defaut[genre];
	return d ? JSON.parse(JSON.stringify(d)) : null;
};

/** Famille du corps retenu. C'est elle qui gouverne les pieces portables.
 *  Deduite du corps, jamais stockee a part : deux sources pour une meme verite
 *  finiraient par diverger. */
const familleDe = (genre, corpsId) => {
	const liste = (OPTIONS && OPTIONS.corps && OPTIONS.corps[genre]) || [];
	const c = liste.find((x) => x.id === corpsId);
	return c ? c.famille : null;
};

/** L'entree de catalogue du corps retenu, ou null. */
const corpsDe = (genre, corpsId) => {
	const liste = (OPTIONS && OPTIONS.corps && OPTIONS.corps[genre]) || [];
	return liste.find((x) => x.id === corpsId) || null;
};

/** Le corps retenu est-il un BLUEPRINT ?
 *
 *  Les corps du Meta Customization System ne sont pas des meshes : ce sont des
 *  Blueprints Unreal qui portent leur propre logique — corps, visage, cheveux,
 *  peau, tatouages, vetements — et qui s'habillent EUX-MEMES. Aucune piece
 *  modulaire ne s'y attache, et leurs reglages passent par le systeme achete,
 *  pas par nos curseurs.
 *
 *  Le serveur envoie le champ `blueprint` avec chaque corps (Modular.CORPS,
 *  genere) : on le lit, on ne le devine pas par le nom de la famille. */
const estBlueprint = () => {
	const c = corpsDe(brouillon.genre, brouillon.corps);
	return Boolean(c && c.blueprint);
};

/** Affiche un message d'erreur, ou le masque si le message est vide. */
const alerte = (noeud, message) => {
	if (!noeud) return;
	noeud.textContent = message || "";
	montrer(noeud, Boolean(message));
};

// ── Accent de faction ─────────────────────────────────────────────────────────

/** Reteinte l'écran entier. Une seule affectation suffit : toute couleur vive de
 *  la page descend de ces trois variables (voir style.css). */
const appliquerAccent = (faction) => {
	const r = document.documentElement.style;
	if (!faction) {
		r.removeProperty("--accent");
		r.removeProperty("--accent-clair");
		r.removeProperty("--lueur");
		return;
	}
	r.setProperty("--accent", faction.accent);
	r.setProperty("--accent-clair", faction.accent_clair);
	r.setProperty("--lueur", faction.lueur);
};

const factionDe = (id) =>
	(OPTIONS && OPTIONS.factions ? OPTIONS.factions : []).find((f) => f.id === id) || null;

const classeLoreDe = (id) => {
	for (const f of (OPTIONS && OPTIONS.factions) || []) {
		const c = f.classes.find((x) => x.id === id);
		if (c) return c;
	}
	return null;
};

// ── Navigation entre écrans ───────────────────────────────────────────────────

const ECRANS = ["connexion", "selection", "depart", "creation"];

const afficherEcran = (nom) => {
	for (const e of ECRANS) montrer($(`ecran-${e}`), e === nom);
};

// ── Écran 1 — connexion ───────────────────────────────────────────────────────

const rendreConnexion = () => {
	afficherEcran("connexion");
	alerte($("connexion-erreur"), SESSION.erreur);

	// Steam : le bloc n'apparaît que si nanos nous a réellement donné une
	// identité. Sinon le joueur ne voit que le formulaire — pas de bouton mort.
	const steam = Boolean(SESSION.steam_pseudo);
	montrer($("bloc-steam"), steam);
	if (steam) $("steam-pseudo").textContent = SESSION.steam_pseudo;

	$("connexion-serveur").textContent = SESSION.serveur || "SERVEUR LOCAL";
};

// ── Écran 2 — sélection ───────────────────────────────────────────────────────

const rendreFiche = () => {
	const f = $("fiche-perso");
	if (!choisi) {
		montrer(f, false);
		return;
	}

	montrer(f, true);
	$("fiche-nom").textContent = choisi.name;

	const lore = classeLoreDe(choisi.loreId);
	$("fiche-classe").textContent = lore ? lore.label : choisi.classId;
	$("fiche-niveau").textContent = choisi.level;
	$("fiche-genre").textContent = choisi.gender === "F" ? "Féminin" : "Masculin";

	const fac = factionDe(lore && lore.faction);
	$("fiche-faction").textContent = fac ? fac.label : "—";
	appliquerAccent(fac);

	// L'écran de sélection montre le personnage réellement enregistré, pas une
	// vignette : c'est le même mannequin d'aperçu, rhabillé.
	majApercu(choisi.gender, choisi.tenue, choisi.corps);
};

const rendreSelection = () => {
	afficherEcran("selection");
	alerte($("selection-erreur"), SESSION.erreur);

	$("selection-pseudo").textContent = SESSION.pseudo || "—";

	const persos = SESSION.persos || [];
	const max = (OPTIONS && OPTIONS.max_persos) || 5;

	$("selection-compte").textContent = `${persos.length} / ${max} EMPLACEMENTS`;

	// Aucun personnage : le joueur DOIT en créer un. On masque le rail entier
	// plutôt que d'afficher une rangée d'emplacements vides sans contexte.
	montrer($("selection-vide"), persos.length === 0);
	montrer($("rail-persos"), persos.length > 0);

	if (persos.length === 0) {
		choisi = null;
		rendreFiche();
		return;
	}

	// Si le personnage mis en avant a disparu (suppression), on retombe sur le
	// premier — sans ça la fiche montrerait un fantôme.
	if (!choisi || !persos.some((p) => p.id === choisi.id)) choisi = persos[0];

	const rail = $("rail-persos");
	rail.textContent = "";

	for (const p of persos) {
		const b = el("button", "slot");
		b.type = "button";
		b.setAttribute("aria-selected", String(p.id === choisi.id));

		const lore = classeLoreDe(p.loreId);
		b.appendChild(el("p", "slot-nom", p.name));
		b.appendChild(el("p", "slot-classe", lore ? lore.label : p.classId));
		b.appendChild(el("span", "slot-niveau", `NIV ${p.level}`));

		b.addEventListener("click", () => {
			choisi = p;
			rendreSelection();
		});
		rail.appendChild(b);
	}

	// Emplacements libres, matérialisés : un roster qui montre sa place restante
	// se lit d'un coup d'œil, et le « + » est le chemin de création évident.
	for (let i = persos.length; i < max; i++) {
		const b = el("button", "slot slot--vide");
		b.type = "button";
		b.appendChild(el("span", "slot-plus", "+"));
		b.appendChild(el("span", "option-mono", "Emplacement libre"));
		b.addEventListener("click", ouvrirCreation);
		rail.appendChild(b);
	}

	rendreFiche();
};

// ── Écran 3 — point de départ ─────────────────────────────────────────────────
//
// Le joueur a pris son personnage ; il choisit maintenant où il apparaît.
//
// ── LA CARTE EST DESSINÉE DEPUIS LES VRAIES COORDONNÉES ──────────────────────
// `departs[].position` porte le point d'arrivée mesuré de chaque monde. On
// projette, on ne compose pas : les cinq mondes de surface partagent le même X
// et s'échelonnent en Y, l'orbital est ailleurs. Le dessin montre donc une
// enfilade et un point à part — ce qui EST la géographie. Inventer une jolie
// disposition en étoile ferait mentir la carte sur ce que le joueur va parcourir.
//
// L'axe long (Y monde) devient l'axe horizontal parce qu'il porte la variation
// utile ; le X monde, quasi constant, devient l'écart vertical, et c'est lui qui
// détache l'orbital.

const SVG_NS = "http://www.w3.org/2000/svg";

/** Monde mis en avant sur la carte. `null` = celui marqué par défaut. */
let departChoisi = null;

const svgEl = (nom, attrs) => {
	const n = document.createElementNS(SVG_NS, nom);
	for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
	return n;
};

/** Les mondes proposés, tels que le serveur les a envoyés. */
const departsDispo = () => (SESSION && Array.isArray(SESSION.departs)) ? SESSION.departs : [];

/** L'entrée retenue : le choix du joueur, sinon celle marquée par défaut. */
const departCourant = () => {
	const liste = departsDispo();
	if (liste.length === 0) return null;
	return liste.find((o) => o.id === departChoisi)
		|| liste.find((o) => o.defaut)
		|| liste[0];
};

/** Projette les positions monde vers le repère du SVG.
 *
 *  ⚠ UNE SEULE VALEUR SUR UN AXE DONNE UNE ÉTENDUE NULLE, donc une division par
 *  zéro qui produit `NaN` et un SVG vide sans la moindre erreur. On borne
 *  l'étendue à 1 : tout se retrouve alors au centre de l'axe, ce qui est le
 *  rendu juste pour des mondes qui partagent la même coordonnée.
 */
const projeter = (liste, largeur, hauteur, marge) => {
	const xs = liste.map((o) => (o.position && o.position.y) || 0);
	const ys = liste.map((o) => (o.position && o.position.x) || 0);
	const etendue = (v) => Math.max(Math.max(...v) - Math.min(...v), 1);
	const ex = etendue(xs), ey = etendue(ys);
	const minx = Math.min(...xs), miny = Math.min(...ys);

	return liste.map((o, i) => ({
		monde: o,
		cx: marge + ((xs[i] - minx) / ex) * (largeur - marge * 2),
		cy: marge + ((ys[i] - miny) / ey) * (hauteur - marge * 2),
	}));
};

const rendreCarteDepart = () => {
	const svg = $("depart-carte");
	if (!svg) return;
	svg.textContent = "";

	const liste = departsDispo();
	if (liste.length === 0) return;

	const noeuds = projeter(liste, 1000, 320, 60);
	const parId = new Map(noeuds.map((n) => [n.monde.id, n]));
	const courant = departCourant();

	// 1. Les routes d'abord : un trait passe SOUS les pastilles, jamais dessus.
	//    `via` dit par où l'on rejoint ce monde — c'est la topologie, et elle ne
	//    se devine pas des coordonnées.
	for (const n of noeuds) {
		const depuis = n.monde.via && parId.get(n.monde.via);
		if (!depuis) continue;
		svg.appendChild(svgEl("line", {
			x1: depuis.cx, y1: depuis.cy, x2: n.cx, y2: n.cy, class: "carte-route",
		}));
	}

	// 2. Les mondes.
	for (const n of noeuds) {
		const actif = courant && courant.id === n.monde.id;

		const g = svgEl("g", {
			class: "carte-monde" + (actif ? " carte-monde--actif" : ""),
			tabindex: "0", role: "button",
			"aria-label": n.monde.label,
			"aria-pressed": actif ? "true" : "false",
		});

		g.appendChild(svgEl("circle", { cx: n.cx, cy: n.cy, r: 14, class: "carte-pastille" }));

		const mots = (n.monde.label || n.monde.id).split(/\s+/);
		const lignes = [""];
		for (const mot of mots) {
			const dernier = lignes.length - 1;
			if (lignes[dernier] && lignes[dernier].length + mot.length + 1 > 18) lignes.push(mot);
			else lignes[dernier] += (lignes[dernier] ? " " : "") + mot;
		}
		const t = svgEl("text", { x: n.cx, y: n.cy - 26 - (lignes.length - 1) * 15, class: "carte-nom" });
		for (let i = 0; i < lignes.length; i++) {
			const ligne = svgEl("tspan", { x: n.cx, dy: i ? 15 : 0 });
			ligne.textContent = lignes[i]; t.appendChild(ligne);
		}
		g.appendChild(t);

		// Le monde par défaut est signalé SUR la carte : sans ça, le joueur qui
		// valide sans rien toucher ne sait pas où il part.
		if (n.monde.defaut) {
			const d = svgEl("text", { x: n.cx, y: n.cy + 34, class: "carte-defaut" });
			d.textContent = "par défaut";
			g.appendChild(d);
		}

		const prendre = () => { departChoisi = n.monde.id; rendreDepart(); };
		g.addEventListener("click", prendre);
		g.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") { e.preventDefault(); prendre(); }
		});

		svg.appendChild(g);
	}
};

const rendreDepart = () => {
	afficherEcran("depart");
	alerte($("depart-erreur"), SESSION.erreur);

	$("depart-perso").textContent = SESSION.perso_choisi || "—";

	const liste = departsDispo();
	$("depart-compte").textContent = liste.length > 0
		? `${liste.length} MONDES ACCESSIBLES`
		: "AUCUN MONDE ACCESSIBLE";

	rendreCarteDepart();

	const o = departCourant();
	// Un serveur sans monde praticable est un état réel (pack cassé) : on le dit
	// et on retire le bouton, au lieu de laisser cliquer dans le vide.
	montrer($("btn-depart-valider"), Boolean(o));
	if (!o) {
		$("depart-nom").textContent = "—";
		$("depart-via").textContent = "—";
		$("depart-description").textContent =
			"Aucun monde n'est dans le pack cuit. Prévenez l'administrateur du serveur.";
		return;
	}

	$("depart-nom").textContent = o.label || o.id;
	// `via` est l'accès réel. L'orbital n'en a pas : c'est le hub, on n'y « passe »
	// pas, on en part.
	$("depart-via").textContent = o.via
		? `accès par ${(liste.find((m) => m.id === o.via) || {}).label || o.via}`
		: "point d'entrée du système";
	$("depart-description").textContent = o.description || "";
};

// ── Écran 4 — création ────────────────────────────────────────────────────────

const ouvrirCreation = () => {
	brouillon = { faction: null, loreId: null, genre: null, corps: null, nom: "", tenue: {} };
	// ⚠ REMISE A PLAT EXPLICITE. `morphs` et `couleurs` vivent HORS du brouillon
	// — ce sont des tables de module. Recreer le brouillon ne les touche pas :
	// sans ces deux lignes, un second personnage naissait avec le visage et les
	// teintes du premier, et le joueur ne comprenait pas d'ou ca venait.
	morphs = {};
	couleurs = {};
	etape = "faction";
	appliquerAccent(null);

	// Un mannequin est demandé DÈS L'OUVERTURE, avant tout choix. Sans ça la
	// scène reste vide jusqu'à l'étape 3, et le joueur croit que l'aperçu ne
	// marche pas. Le genre par défaut est remplacé dès qu'il en choisit un.
	// Premier corps masculin par defaut, pour que la scene ne soit pas vide avant
	// tout choix. Remplace des que le joueur en retient un.
	const premier = ((OPTIONS && OPTIONS.corps && OPTIONS.corps.M) || [])[0];
	if (premier) {
		brouillon.corps = premier.id;
		brouillon.genre = "M";
		brouillon.tenue = tenueDefaut("M", premier.famille);
		majApercu("M", brouillon.tenue, premier.id);
	}

	rendreCreation();
};

const etapeAtteignable = (id) => {
	if (!brouillon) return false;
	if (id === "faction") return true;
	if (id === "classe") return Boolean(brouillon.faction);
	if (id === "genre") return Boolean(brouillon.loreId);
	// Tenue et nom s'ouvrent ensemble dès que le genre est posé : le joueur peut
	// nommer son personnage avant de finir de l'habiller, ou l'inverse.
	// Visage, tenue et nom s'ouvrent ensemble des que le corps est pose : le
	// joueur peut nommer son personnage avant de finir son visage, ou l'inverse.
	if (id === "visage" || id === "tenue" || id === "nom") {
		return Boolean(brouillon.genre && brouillon.corps);
	}
	return false;
};

const rendreEtapes = () => {
	const nav = $("etapes");
	nav.textContent = "";

	etapesVisibles().forEach((e, i) => {
		const b = el("button", "etape");
		b.type = "button";
		if (e.id === etape) b.setAttribute("aria-current", "true");
		// « Faite » ne veut pas dire « avant » : une étape est faite quand son
		// choix est posé, ce qui permet de revenir en arrière sans tout perdre.
		if (etapeAtteignable(e.id) && e.id !== etape) b.classList.add("etape--faite");

		b.appendChild(el("span", "etape-num", String(i + 1).padStart(2, "0")));
		b.appendChild(el("span", null, e.label));

		b.addEventListener("click", () => {
			if (!etapeAtteignable(e.id)) return;
			etape = e.id;
			rendreCreation();
		});
		nav.appendChild(b);
	});
};

/** Fabrique une option cliquable. */
const option = (classes, selectionne, contenu, onClick) => {
	const b = el("button", `option ${classes || ""}`.trim());
	b.type = "button";
	b.setAttribute("aria-selected", String(Boolean(selectionne)));
	contenu(b);
	b.addEventListener("click", onClick);
	return b;
};

/** Panneau de faction survolé ou choisi. Le survol ouvre, le clic valide : on
 *  voit ce qu'on choisit AVANT de le choisir. */
let factionVisee = null;

const rendreChoixFaction = (hote) => {
	$("creation-titre").textContent = "Choisissez une faction";
	hote.classList.add("choix--faction");

	const factions = (OPTIONS && OPTIONS.factions) || [];
	// Rien de visé : on ouvre celle déjà choisie, sinon la première. Un sélecteur
	// dont tous les panneaux sont fermés n'aurait rien à montrer.
	const actif = factionVisee || brouillon.faction || (factions[0] && factions[0].id);

	const sel = el("div", "selecteur");

	for (const f of factions) {
		const b = el("button", "panneau" + (f.id === actif ? " panneau--actif" : ""));
		b.type = "button";
		b.setAttribute("aria-selected", String(brouillon.faction === f.id));
		// Chaque panneau porte SA teinte, indépendante de l'accent courant : les
		// trois restent distinguables avant tout choix.
		b.style.color = f.accent;

		b.appendChild(el("span", "panneau-dos", f.label));

		const face = el("div", "panneau-face");
		face.appendChild(el("div", "panneau-barre"));
		face.appendChild(el("h3", "panneau-nom", f.label));
		face.appendChild(el("p", "panneau-sous", f.sous_titre));

		// Le lore viendra ici. Tant qu'il est vide, on n'affiche RIEN — un
		// paragraphe d'attente inventé serait pire que son absence.
		if (f.description) face.appendChild(el("p", "panneau-texte", f.description));

		// Les classes de la faction, listées avant le choix : c'est ce qui rend le
		// panneau décidable au lieu d'être une affiche.
		const ul = el("ul", "panneau-classes");
		f.classes.forEach((c, i) => {
			const li = el("li");
			li.appendChild(el("span", null, String(i + 1).padStart(2, "0")));
			li.appendChild(el("span", null, c.label));
			ul.appendChild(li);
		});
		face.appendChild(ul);

		const pied = el("div", "panneau-pied");
		const n = el("b", null, String(f.classes.length).padStart(2, "0"));
		pied.appendChild(n);
		pied.appendChild(el("span", null, "classes"));
		pied.appendChild(el("span", null, `· ${f.id}`));
		face.appendChild(pied);

		b.appendChild(face);

		// Survol : ouvre sans choisir. C'est ce qui rend le sélecteur explorable.
		b.addEventListener("mouseenter", () => {
			if (factionVisee === f.id) return;
			factionVisee = f.id;
			appliquerAccent(f);
			rendreCreation();
		});

		b.addEventListener("click", () => {
			brouillon.faction = f.id;
			brouillon.loreId = null;
			appliquerAccent(f);
			factionVisee = null;
			etape = "classe";
			rendreCreation();
		});

		sel.appendChild(b);
	}

	hote.appendChild(sel);
};

const rendreChoixClasse = (hote) => {
	const f = factionDe(brouillon.faction);
	$("creation-titre").textContent = f ? f.label : "Choisissez une classe";

	// Une LISTE numérotée à filets, pas une grille de cartes : le numéro ancre
	// l'œil à gauche et le filet fait le rythme. Quatre cartes identiques en
	// grille ne diraient rien de plus qu'un tableau.
	const liste = el("div", "liste-choix");

	((f && f.classes) || []).forEach((c, i) => {
		const b = el("button", "entree");
		b.type = "button";
		b.setAttribute("aria-selected", String(brouillon.loreId === c.id));

		b.appendChild(el("span", "entree-num", String(i + 1).padStart(2, "0")));

		const bloc = el("div");
		bloc.appendChild(el("div", "entree-nom", c.label));
		if (c.description) bloc.appendChild(el("p", "entree-texte", c.description));
		b.appendChild(bloc);

		b.appendChild(el("span", "entree-code", c.id.replace(/_/g, " ")));

		b.addEventListener("click", () => {
			brouillon.loreId = c.id;
			brouillon.class_id = c.class_id;
			etape = "genre";
			rendreCreation();
		});
		liste.appendChild(b);
	});

	hote.appendChild(liste);
};

const rendreChoixGenre = (hote) => {
	$("creation-titre").textContent = "Corps";

	// ── Genre ─────────────────────────────────────────────────────────────────
	const blocGenre = el("div", "bloc");
	blocGenre.appendChild(el("p", "bloc-titre", "Genre"));

	// `segments` et non `grille` : deux options exclusives et symetriques sont un
	// selecteur, pas une liste de cartes.
	const gg = el("div", "segments");
	for (const g of (OPTIONS && OPTIONS.genres) || ["M", "F"]) {
		gg.appendChild(
			option(null, brouillon.genre === g, (b) => {
				b.appendChild(el("div", "option-titre", g === "F" ? "Feminin" : "Masculin"));
			}, () => {
				brouillon.genre = g;

				// Changer de genre change les corps disponibles : on retient le
				// premier, et la tenue suit sa famille. Garder l'ancien corps
				// donnerait un personnage du mauvais genre, que le serveur refuse.
				const dispo = (OPTIONS && OPTIONS.corps && OPTIONS.corps[g]) || [];
				brouillon.corps = dispo.length ? dispo[0].id : null;
				brouillon.tenue = tenueDefaut(g, familleDe(g, brouillon.corps));
				// L'apparence MetaHuman depend du GENRE (identites, vetements) : on
				// repart de celle du nouveau genre plutot que d'en garder une refusee.
				brouillon.metacustom = metacustomDefaut(g);

				majApercu(g, brouillon.tenue, brouillon.corps);
				rendreCreation();
			}),
		);
	}
	blocGenre.appendChild(gg);
	hote.appendChild(blocGenre);

	// ── Morphologie ───────────────────────────────────────────────────────────
	//
	// Le corps n'est pas un detail d'apparence : il decide de la MORPHOLOGIE,
	// donc des vetements portables. Un corps MetaHuman ne porte que des
	// vetements MetaHuman — les os concordent, les volumes non.
	const dispo = (OPTIONS && OPTIONS.corps && OPTIONS.corps[brouillon.genre]) || [];
	if (!brouillon.genre) return;

	const blocCorps = el("div", "bloc");
	const titre = el("p", "bloc-titre", "Morphologie");
	titre.appendChild(el("span", "bloc-compte", `${dispo.length} corps`));
	blocCorps.appendChild(titre);

	const gc = el("div", "grille grille--serree");
	for (const c of dispo) {
		gc.appendChild(
			option(null, brouillon.corps === c.id, (b) => {
				b.appendChild(el("div", "option-titre", c.label));
				b.appendChild(el("div", "option-mono", c.famille));
			}, () => {
				brouillon.corps = c.id;
				// La famille change avec le corps : les pieces deja retenues
				// appartiennent peut-etre a l'autre morphologie. On repart d'une
				// tenue par defaut plutot que de laisser une tenue que le serveur
				// refuserait a la validation.
				brouillon.tenue = tenueDefaut(brouillon.genre, c.famille);
				// ⚠ LES MORPHS SONT PROPRES AU CORPS. Les garder en changeant de
				// morphologie appliquerait des reglages a un mesh qui ne les porte
				// pas : ils ne feraient rien, mais partiraient quand meme en base.
				//
				// La SILHOUETTE, elle, survit. Ce n'est pas un morph : c'est une
				// echelle, qui a le meme sens sur n'importe quel mesh. La jeter
				// obligerait le joueur a re-regler sa taille chaque fois qu'il
				// compare deux corps — exactement ce qu'on veut comparer.
				const silhouette = {};
				for (const [id, v] of Object.entries(morphs)) {
					if (id.startsWith(prefixeApparence())) silhouette[id] = v;
				}
				morphs = silhouette;
				dissociees.clear();
				majApercu(brouillon.genre, brouillon.tenue, c.id);
				etape = "tenue";
				rendreCreation();
			}),
		);
	}
	blocCorps.appendChild(gc);
	hote.appendChild(blocCorps);
};

const rendreChoixNom = (hote) => {
	$("creation-titre").textContent = "Identité";

	const bloc = el("div", "bloc");
	bloc.appendChild(el("p", "bloc-titre", "Nom du personnage"));

	const champ = el("label", "champ");
	const saisie = el("input", "champ-saisie");
	saisie.type = "text";
	saisie.maxLength = (OPTIONS && OPTIONS.nom_max) || 16;
	saisie.spellcheck = false;
	saisie.value = brouillon.nom;
	saisie.placeholder = `${(OPTIONS && OPTIONS.nom_min) || 2} à ${saisie.maxLength} caractères`;

	// `input` et pas `change` : la synthèse doit suivre la frappe, sinon le champ
	// paraît mort tant qu'on n'en sort pas.
	saisie.addEventListener("input", () => {
		brouillon.nom = saisie.value;
		majSynthese();
		rendreEtapes();
	});

	champ.appendChild(saisie);
	bloc.appendChild(champ);
	hote.appendChild(bloc);

	// Dernière étape : le personnage est fini, il ne reste qu'à le nommer. Le
	// focus part donc directement dans le champ — mais seulement à l'arrivée, le
	// reprendre à chaque rendu déplacerait le curseur en cours de frappe.
	if (document.activeElement !== saisie && !brouillon.nom) saisie.focus();
};

/** Tenue par défaut d'un genre.
 *
 *  ⚠ DOIT RESTER ALIGNÉ SUR `Modular.TenueDefaut` (Lua). Le serveur revalide et
 *  poserait sa propre tenue si le client n'en envoyait pas ; deux règles
 *  différentes donneraient un aperçu qui ment sur le résultat.
 *
 *  Civil d'abord — un personnage neuf arrive habillé. `base` en repli, parce que
 *  le slot `visage` n'a aucune pièce civile. Un slot sans l'un ni l'autre reste
 *  VIDE : `tete` ne contient que du matériel de guerre, et on ne coiffe pas
 *  d'office un civil d'un casque de combat. */
const PREFERENCE_DEFAUT = ["civil", "base"];

const tenueDefaut = (genre, famille) => {
	const tenue = {};
	const par = OPTIONS && OPTIONS.pieces && OPTIONS.pieces[genre]
		&& OPTIONS.pieces[genre][famille];
	if (!par) return tenue;

	for (const slot of OPTIONS.slots) {
		const liste = par[slot] || [];
		for (const registre of PREFERENCE_DEFAUT) {
			const trouve = liste.find((p) => p.registre === registre);
			if (trouve) {
				tenue[slot] = trouve.id;
				break;
			}
		}
	}
	return tenue;
};

// ══════════════════════════════════════════════════════════════════════════════
// ÉTAPE « VISAGE » — les curseurs de morphologie
// ══════════════════════════════════════════════════════════════════════════════
//
// ── ELLE N'EXISTE QUE POUR UN CORPS ───────────────────────────────────────────
// Seul `base_morphable` porte des morph targets. Sur tout autre corps, un
// curseur ne ferait rien — `SetMorphTarget` sur un mesh sans morph ne lève pas.
// L'étape est donc RETIRÉE du fil plutôt que grisée : une étape qu'on traverse
// sans rien pouvoir y faire se lit comme un bug.
//
// ── SYMÉTRIE ──────────────────────────────────────────────────────────────────
// 74 curseurs sur 138 vont par paires gauche/droite. Les afficher séparément
// obligerait à régler deux fois chaque trait pour un visage symétrique, ce qui
// est le cas courant. On les LIE par défaut, avec un bouton pour dissocier —
// l'asymétrie reste possible, elle n'est simplement pas le chemin par défaut.

/** Zones dépliées. Tout replié à l'ouverture : onze zones grandes ouvertes
 *  donneraient trois écrans de défilement avant le premier réglage. */
const zonesOuvertes = new Set();

/** Paires dissociées (symétrie rompue), par racine sans préfixe de côté. */
const dissociees = new Set();

/** Le corps courant porte-t-il des morphs ? */
const estMorphable = () => familleDe(brouillon.genre, brouillon.corps) === "mpfb";

/** Racine d'un curseur, côté retiré. `l-eye-bag` et `r-eye-bag` partagent
 *  `eye-bag` — c'est cette clé qui les apparie. */
const sansCote = (id) => id.replace(/^[lr]-/, "");

/** Nom lisible d'un réglage. Les identifiants MakeHuman sont techniques
 *  (`nose-nostrils-angle-vert`) : on retire la zone, déjà portée par le titre du
 *  bloc, et on rend les tirets à l'espace. */
const libelleEntree = (entree) => {
	const brut = entree.type === "paire" ? entree.cle : sansCote(entree.curseur.id);
	const zone = entree.type === "paire" ? entree.gauche.zone : entree.curseur.zone;
	const sans = brut.startsWith(zone + "-") ? brut.slice(zone.length + 1) : brut;
	return sans.replace(/-/g, " ");
};

/** Curseurs d'une zone, appariés gauche/droite quand la symétrie tient.
 *  Rend des ENTRÉES : soit un curseur seul, soit une paire. */
const entreesDeZone = (zone) => {
	const liste = (OPTIONS.morphs && OPTIONS.morphs.curseurs || [])
		.filter((c) => c.zone === zone);

	const paires = new Map();
	const seuls = [];

	for (const c of liste) {
		if (!c.cote) { seuls.push({ type: "seul", curseur: c }); continue; }
		const cle = sansCote(c.id);
		if (!paires.has(cle)) paires.set(cle, { type: "paire", cle, gauche: null, droit: null });
		paires.get(cle)[c.cote === "gauche" ? "gauche" : "droit"] = c;
	}

	// Une paire incomplète n'en est pas une : on la rend à sa moitié plutôt que
	// d'afficher un curseur qui n'en piloterait qu'un côté sans le dire.
	const entrees = [...seuls];
	for (const p of paires.values()) {
		if (p.gauche && p.droit) entrees.push(p);
		else entrees.push({ type: "seul", curseur: p.gauche || p.droit });
	}

	entrees.sort((a, b) => libelleEntree(a).localeCompare(libelleEntree(b)));
	return entrees;
};

/** Identifiants pilotés par une entrée. Liée ou non, une paire pilote ses deux
 *  côtés — c'est la LECTURE qui diffère : dissociée, chaque côté a sa propre
 *  ligne, donc sa propre entrée. */
const idsDeEntree = (entree) => {
	if (entree.type === "seul") return [entree.curseur.id];
	return [entree.gauche.id, entree.droit.id];
};

/** Combien de réglages d'une zone ont quitté zéro. */
const comptePourZone = (zone) => {
	let n = 0;
	for (const c of (OPTIONS.morphs && OPTIONS.morphs.curseurs || [])) {
		if (c.zone === zone && (morphs[c.id] || 0) !== 0) n++;
	}
	return n;
};

// ── Envoi à l'aperçu, sans noyer le serveur ──────────────────────────────────
//
// Un curseur produit des dizaines d'événements `input` par seconde. Les relayer
// tous saturerait le réseau pour un résultat identique : on n'envoie que le
// dernier état, une fois le geste retombé.

let minuteurApercu = null;

const apercuMorphs = () => {
	if (minuteurApercu) clearTimeout(minuteurApercu);
	minuteurApercu = setTimeout(() => {
		majApercu(brouillon.genre, brouillon.tenue, brouillon.corps);
	}, 120);
};

/** Pose une valeur sur tous les identifiants d'une entrée. */
const poserEntree = (entree, valeur) => {
	for (const id of idsDeEntree(entree)) {
		if (valeur === 0) delete morphs[id];
		else morphs[id] = valeur;
	}
	apercuMorphs();
};

// ── Rendu ─────────────────────────────────────────────────────────────────────

/** Une ligne de réglage : libellé, glissière, valeur. */
const ligneCurseur = (entree) => {
	const ids = idsDeEntree(entree);
	const valeur = morphs[ids[0]] || 0;
	const bipolaire = entree.type === "paire"
		? Boolean(entree.gauche.negatif)
		: Boolean(entree.curseur.negatif);

	const ligne = el("div", "morph-ligne");
	if (valeur !== 0) ligne.classList.add("morph-ligne--active");

	ligne.appendChild(el("span", "morph-nom", libelleEntree(entree)));

	// Le bouton de symétrie ne s'affiche que sur une paire : ailleurs il
	// occuperait une place pour rien.
	if (entree.type === "paire") {
		const b = el("button", "morph-symetrie", "⇄");
		b.type = "button";
		b.title = "Lié — cliquer pour régler chaque côté séparément";
		b.setAttribute("aria-pressed", "true");
		b.addEventListener("click", () => {
			dissociees.add(entree.cle);
			rendreCreation();
		});
		ligne.appendChild(b);
	}

	const glissiere = document.createElement("input");
	glissiere.type = "range";
	glissiere.className = "morph-glissiere";
	glissiere.min = bipolaire ? "-1" : "0";
	glissiere.max = "1";
	glissiere.step = "0.05";
	glissiere.value = String(valeur);
	glissiere.setAttribute("aria-label", libelleEntree(entree));

	const lecture = el("span", "morph-valeur", valeur.toFixed(2));

	glissiere.addEventListener("input", () => {
		const v = Number(glissiere.value);
		lecture.textContent = v.toFixed(2);
		ligne.classList.toggle("morph-ligne--active", v !== 0);
		// On pose sans redessiner : reconstruire la liste à chaque pixel du
		// glissement ferait perdre le focus et hacherait le geste.
		poserEntree(entree, v);
	});

	// Double-clic : retour au neutre. Plus rapide que de viser le milieu.
	glissiere.addEventListener("dblclick", () => {
		glissiere.value = "0";
		lecture.textContent = "0.00";
		ligne.classList.remove("morph-ligne--active");
		poserEntree(entree, 0);
	});

	ligne.appendChild(glissiere);
	ligne.appendChild(lecture);
	return ligne;
};

/** Une paire dissociée : deux lignes, plus un bouton pour la relier. */
const lignesDissociees = (entree) => {
	const sortie = [];
	for (const cote of ["gauche", "droit"]) {
		const c = entree[cote];
		const sous = ligneCurseur({ type: "seul", curseur: c });
		const nom = sous.querySelector(".morph-nom");
		if (nom) nom.textContent = libelleEntree(entree) + " · " + cote;
		sortie.push(sous);
	}

	const relier = el("button", "lien lien--discret", "Relier les deux côtés");
	relier.type = "button";
	relier.addEventListener("click", () => {
		dissociees.delete(entree.cle);
		// En reliant, on aligne le droit sur le gauche : garder deux valeurs
		// différentes sous un seul curseur mentirait sur ce qui est appliqué.
		const v = morphs[entree.gauche.id] || 0;
		if (v === 0) delete morphs[entree.droit.id];
		else morphs[entree.droit.id] = v;
		apercuMorphs();
		rendreCreation();
	});
	sortie.push(relier);
	return sortie;
};

/** Zone « Corps » : six curseurs qui pilotent 340 ancres.
 *
 *  ── ELLE VIENT EN PREMIER, ET C'EST VOULU ───────────────────────────────────
 *  Le genre, l'âge et la corpulence changent la silhouette entière ; le nez ne
 *  change qu'un nez. Régler le visage avant le corps obligerait à tout reprendre
 *  après coup, parce que la tête bouge avec les macros.
 *
 *  ── PAS DE COMPTEUR « RÉGLÉS » ICI ──────────────────────────────────────────
 *  Contrairement aux zones du visage, un curseur de corps à sa valeur par défaut
 *  n'est PAS au repos : le corps neutre est déjà un mélange d'ancres. Compter
 *  « 0 réglé » sur un corps qui existe bel et bien serait faux. */
const rendreCorps = (hote) => {
	const conf = OPTIONS.morphs || {};
	const curseurs = conf.corps || [];
	const ethnies = conf.ethnies || [];
	const prefixe = conf.prefixe || "@";

	if (curseurs.length === 0) return;

	const bloc = el("div", "bloc bloc--repliable");
	const ouverte = zonesOuvertes.has("@corps");

	const titre = el("button", "bloc-titre bloc-titre--bouton");
	titre.type = "button";
	titre.setAttribute("aria-expanded", String(ouverte));
	titre.appendChild(el("span", null, "Corps"));
	titre.appendChild(el("span", "bloc-compte", String(curseurs.length + 1)));
	titre.addEventListener("click", () => {
		if (ouverte) zonesOuvertes.delete("@corps");
		else zonesOuvertes.add("@corps");
		rendreCreation();
	});
	bloc.appendChild(titre);

	if (!ouverte) { hote.appendChild(bloc); return; }

	const corps = el("div", "morph-corps");

	for (const c of curseurs) {
		const id = prefixe + c.id;
		// Le défaut vient du SERVEUR : c'est lui qui connaît le point neutre de
		// chaque axe, et la taille n'a pas le même que le genre.
		const valeur = morphs[id] !== undefined ? morphs[id] : c.defaut;

		const ligne = el("div", "morph-ligne");
		ligne.appendChild(el("span", "morph-nom", c.label));

		const glissiere = document.createElement("input");
		glissiere.type = "range";
		glissiere.className = "morph-glissiere";
		glissiere.min = "0";
		glissiere.max = "1";
		glissiere.step = "0.02";
		glissiere.value = String(valeur);
		// Les deux extrémités sont nommées : « 0,7 » ne dit pas si l'on va vers
		// le masculin ou vers le féminin.
		glissiere.setAttribute("aria-label", `${c.label}, de ${c.gauche} à ${c.droit}`);
		glissiere.title = `${c.gauche} ← → ${c.droit}`;

		const lecture = el("span", "morph-valeur", valeur.toFixed(2));

		glissiere.addEventListener("input", () => {
			const v = Number(glissiere.value);
			lecture.textContent = v.toFixed(2);
			// ⚠ ON GARDE MÊME LA VALEUR PAR DÉFAUT. Pour le visage, un curseur à
			// zéro est retiré de la table — il ne fait rien. Ici le défaut fait
			// bien quelque chose : le retirer rendrait un corps neutre alors que
			// le joueur a peut-être délibérément remis le curseur au milieu.
			morphs[id] = v;
			apercuMorphs();
		});

		ligne.appendChild(glissiere);
		ligne.appendChild(lecture);
		corps.appendChild(ligne);
	}

	// ── Ethnies ────────────────────────────────────────────────────────────────
	//
	// Trois curseurs qui se MÉLANGENT plutôt qu'un choix unique : un visage
	// n'appartient pas à une case, et le serveur normalise la somme de toute
	// façon. Forcer un choix appauvrirait la création sans rien simplifier.
	if (ethnies.length > 0) {
		corps.appendChild(el("p", "morph-sous-titre", "Traits"));

		for (const e of ethnies) {
			const id = prefixe + "eth-" + e.id;
			const valeur = morphs[id] !== undefined ? morphs[id] : 1 / 3;

			const ligne = el("div", "morph-ligne");
			ligne.appendChild(el("span", "morph-nom", e.label));

			const glissiere = document.createElement("input");
			glissiere.type = "range";
			glissiere.className = "morph-glissiere";
			glissiere.min = "0";
			glissiere.max = "1";
			glissiere.step = "0.02";
			glissiere.value = String(valeur);
			glissiere.setAttribute("aria-label", e.label);

			const lecture = el("span", "morph-valeur", valeur.toFixed(2));

			glissiere.addEventListener("input", () => {
				const v = Number(glissiere.value);
				lecture.textContent = v.toFixed(2);
				morphs[id] = v;
				apercuMorphs();
			});

			ligne.appendChild(glissiere);
			ligne.appendChild(lecture);
			corps.appendChild(ligne);
		}
	}

	const reset = el("button", "lien lien--discret", "Réinitialiser le corps");
	reset.type = "button";
	reset.addEventListener("click", () => {
		for (const c of curseurs) delete morphs[prefixe + c.id];
		for (const e of ethnies) delete morphs[prefixe + "eth-" + e.id];
		apercuMorphs();
		rendreCreation();
	});
	corps.appendChild(reset);

	bloc.appendChild(corps);
	hote.appendChild(bloc);
};

const rendreChoixVisage = (hote) => {
	$("creation-titre").textContent = "Visage";

	if (!estMorphable()) {
		// Ne devrait pas arriver : l'étape est retirée du fil pour les autres
		// corps. On le dit quand même plutôt que d'afficher un panneau vide.
		hote.appendChild(el("p", "option-sous",
			"Ce corps n'a pas de réglages de visage. Choisir « Corps morphable » à l'étape Corps."));
		return;
	}

	const zones = (OPTIONS.morphs && OPTIONS.morphs.zones) || [];
	if (zones.length === 0) {
		hote.appendChild(el("p", "option-sous", "Aucun réglage disponible."));
		return;
	}

	// Le corps AVANT le visage : genre, age et corpulence changent la silhouette
	// entiere, et la tete bouge avec eux. Regler un nez avant un corps obligerait
	// a tout reprendre.
	rendreCorps(hote);

	const actifs = Object.keys(morphs).length;
	hote.appendChild(el("p", "option-sous",
		actifs === 0
			? "Déplier une zone pour régler un trait. Double-clic sur une glissière pour revenir au neutre."
			: `${actifs} réglage${actifs > 1 ? "s" : ""} en cours.`));

	for (const zone of zones) {
		const entrees = entreesDeZone(zone.id);
		if (entrees.length === 0) continue;

		const bloc = el("div", "bloc bloc--repliable");
		const modifies = comptePourZone(zone.id);
		const ouverte = zonesOuvertes.has(zone.id);

		const titre = el("button", "bloc-titre bloc-titre--bouton");
		titre.type = "button";
		titre.setAttribute("aria-expanded", String(ouverte));
		titre.appendChild(el("span", null, zone.label));

		// Le compteur montre ce qui est MODIFIÉ, pas ce qui est disponible : c'est
		// la seule des deux informations qui change quand on travaille.
		const compte = el("span", "bloc-compte",
			modifies > 0 ? `${modifies} réglé${modifies > 1 ? "s" : ""}` : String(entrees.length));
		if (modifies > 0) compte.classList.add("bloc-compte--actif");
		titre.appendChild(compte);

		titre.addEventListener("click", () => {
			if (ouverte) zonesOuvertes.delete(zone.id);
			else zonesOuvertes.add(zone.id);
			rendreCreation();
		});
		bloc.appendChild(titre);

		if (ouverte) {
			const corps = el("div", "morph-corps");
			for (const entree of entrees) {
				if (entree.type === "paire" && dissociees.has(entree.cle)) {
					for (const n of lignesDissociees(entree)) corps.appendChild(n);
				} else {
					corps.appendChild(ligneCurseur(entree));
				}
			}

			if (modifies > 0) {
				const reset = el("button", "lien lien--discret",
					"Réinitialiser " + zone.label.toLowerCase());
				reset.type = "button";
				reset.addEventListener("click", () => {
					for (const c of OPTIONS.morphs.curseurs) {
						if (c.zone === zone.id) delete morphs[c.id];
					}
					apercuMorphs();
					rendreCreation();
				});
				corps.appendChild(reset);
			}

			bloc.appendChild(corps);
		}

		hote.appendChild(bloc);
	}
};

/** Tire une composition au hasard parmi ce que l'écran propose.
 *
 *  ── POURQUOI IL TIRE DANS LA LISTE AFFICHÉE ─────────────────────────────────
 *  Et non dans le catalogue complet. La liste est déjà filtrée par genre et par
 *  morphologie ; y puiser garantit que le tirage produit une composition VALIDE,
 *  celle que le serveur acceptera. Tirer dans le catalogue obligerait à
 *  réimplémenter ces filtres ici, et les deux finiraient par diverger.
 *
 *  ── UN SLOT PEUT RESTER VIDE ────────────────────────────────────────────────
 *  Sauf ceux de la tenue nue. Un tirage qui remplirait tout donnerait toujours
 *  un personnage entièrement équipé, alors qu'un torse nu est une option
 *  légitime — et la seule façon de voir sa propre morphologie. */
const tirerApparence = () => {
	const famille = familleDe(brouillon.genre, brouillon.corps);
	const par = OPTIONS && OPTIONS.pieces && OPTIONS.pieces[brouillon.genre]
		&& OPTIONS.pieces[brouillon.genre][famille];
	if (!par) return;

	// Les slots que la tenue nue couvre : ils doivent rester remplis, sinon le
	// personnage sort amputé de son torse ou de ses mains.
	const OBLIGATOIRES = new Set(["visage", "torse", "mains", "jambes"]);

	brouillon.tenue = {};

	for (const slot of OPTIONS.slots) {
		const liste = par[slot] || [];
		if (liste.length === 0) continue;

		if (!OBLIGATOIRES.has(slot) && Math.random() < 0.35) continue;

		const choix = liste[Math.floor(Math.random() * liste.length)];
		if (choix) brouillon.tenue[slot] = choix.id;
	}

	// ── Couleurs et silhouette ────────────────────────────────────────────────
	//
	// Un tirage qui ne toucherait QUE les pieces donnerait dix compositions de
	// la meme teinte : le bouton s'appelle « composition aleatoire », pas
	// « pieces aleatoires ». Sur le corps morphable, qui n'a qu'une piece par
	// slot, ce sont meme les seules choses que le tirage peut changer.
	//
	// ⚠ `OPTIONS.apparence` lu directement, sans passer par `prefixeApparence()`
	// declaree plus bas. Un `const` de module se resout au moment de l'APPEL, pas
	// de la lecture, donc l'appel serait legal — mais ce fichier a deja paye une
	// zone morte, et lire la donnee est aussi court que d'appeler la fonction.
	const conf = (OPTIONS && OPTIONS.apparence) || {};
	const palette = conf.palette || [];
	if (palette.length > 0) {
		couleurs = {};
		for (const cible of conf.cibles || []) {
			couleurs[cible.id] = palette[Math.floor(Math.random() * palette.length)];
		}
	}

	const prefixe = conf.prefixe || "#";
	for (const c of conf.curseurs || []) {
		// Autour du neutre, pas sur toute la course : les bornes du curseur sont
		// deja les extremes acceptables, et un tirage uniforme sortirait un
		// personnage sur deux a une extremite. On vise le plausible.
		morphs[prefixe + c.id] = 0.3 + Math.random() * 0.4;
	}

	majApercu(brouillon.genre, brouillon.tenue, brouillon.corps);
	rendreCreation();
};

/** Prefixe des reglages de silhouette. Vient du serveur, `#` en repli : si
 *  l'ecran et le serveur ne s'accordent pas dessus, les curseurs partent sous
 *  une cle que `Apparence.Echelle` ne lit pas, et rien ne bouge. */
const prefixeApparence = () => (OPTIONS.apparence && OPTIONS.apparence.prefixe) || "#";

/** Silhouette : deux curseurs d'echelle.
 *
 *  ── POURQUOI ILS SONT ICI ET PAS DANS « VISAGE » ────────────────────────────
 *  L'etape Visage n'existe QUE pour le corps morphable. Or les deux corps
 *  Stylized — ceux que le joueur choisit en pratique — n'ont aucun morph
 *  target : `SetMorphTarget` ne peut rien pour eux. `SetScale` si. Mettre ces
 *  curseurs dans Visage les aurait rendus invisibles pour les corps qui en ont
 *  le plus besoin. */
const rendreSilhouette = (hote) => {
	const conf = (OPTIONS && OPTIONS.apparence) || {};
	const curseurs = conf.curseurs || [];
	if (curseurs.length === 0) return;

	const prefixe = prefixeApparence();
	const bloc = el("div", "bloc");
	const titre = el("p", "bloc-titre", "Silhouette");
	titre.appendChild(el("span", "bloc-compte", String(curseurs.length)));
	bloc.appendChild(titre);

	const corps = el("div", "morph-corps");
	for (const c of curseurs) {
		const id = prefixe + c.id;
		const valeur = morphs[id] !== undefined ? morphs[id] : c.defaut;

		const ligne = el("div", "morph-ligne");
		ligne.appendChild(el("span", "morph-nom", c.label));

		const glissiere = document.createElement("input");
		glissiere.type = "range";
		glissiere.className = "morph-glissiere";
		glissiere.min = "0";
		glissiere.max = "1";
		glissiere.step = "0.02";
		glissiere.value = String(valeur);
		glissiere.setAttribute("aria-label", `${c.label}, de ${c.gauche} à ${c.droit}`);
		glissiere.title = `${c.gauche} ← → ${c.droit}`;

		const lecture = el("span", "morph-valeur", Number(valeur).toFixed(2));

		glissiere.addEventListener("input", () => {
			const v = Number(glissiere.value);
			lecture.textContent = v.toFixed(2);
			// Le neutre est GARDE, comme pour les curseurs de corps : remettre
			// au milieu est une decision, pas une absence de decision.
			morphs[id] = v;
			apercuMorphs();
		});

		ligne.appendChild(glissiere);
		ligne.appendChild(lecture);
		corps.appendChild(ligne);
	}

	bloc.appendChild(corps);
	hote.appendChild(bloc);
};

/** Nuancier, une ligne par cible recolorable.
 *
 *  ── LE TEINT DE PEAU, AJOUTE LE 2026-09-05 ──────────────────────────────────
 *  Il manquait, et pour une raison mesuree : sondes les 27 materiaux du pack,
 *  `MI_Body` et `MI_Female_Body` n'exposaient AUCUN parametre vectoriel — leur
 *  teinte est cuite dans la texture. Proposer un curseur muet aurait ete pire
 *  que de n'en proposer aucun : le joueur l'aurait pris pour une panne.
 *
 *  `scripts/adk-creer-materiau-peau.py` a donc fabrique `M_NarvosPeau` (texture
 *  x parametre `Teinte`) et deux instances qui reprennent les textures
 *  d'origine. Le neutre est le BLANC : au defaut, le Lua n'echange meme pas le
 *  materiau, et les corps de base gardent exactement leur apparence.
 *
 *  ⚠ Cette liste n'est PAS ecrite ici : elle vient de `Apparence.CIBLES` via
 *  `Session.Options()`. Une cible ajoutee au catalogue apparait seule. */
const rendreCouleurs = (hote) => {
	const conf = (OPTIONS && OPTIONS.apparence) || {};
	const cibles = conf.cibles || [];
	const palette = conf.palette || [];
	if (cibles.length === 0 || palette.length === 0) return;

	// Les cibles qui visent un slot vide ne peignent rien : les masquer evite
	// d'offrir un nuancier « Cheveux » a un corps sans piece de tete.
	const famille = familleDe(brouillon.genre, brouillon.corps);
	const par = OPTIONS && OPTIONS.pieces && OPTIONS.pieces[brouillon.genre]
		&& OPTIONS.pieces[brouillon.genre][famille];
	const atteignable = (cible) => (cible.slots || []).some((s) => {
		if (brouillon.tenue[s]) return true;
		// Un slot qu'aucune piece ne peut occuper ne le sera jamais.
		return par ? (par[s] || []).length > 0 : false;
	});

	const utiles = cibles.filter(atteignable);
	if (utiles.length === 0) return;

	const bloc = el("div", "bloc");
	const titre = el("p", "bloc-titre", "Couleurs");
	titre.appendChild(el("span", "bloc-compte", String(utiles.length)));
	bloc.appendChild(titre);

	for (const cible of utiles) {
		const courante = couleurs[cible.id] || cible.defaut;

		const ligne = el("div", "morph-ligne morph-ligne--teintes");
		ligne.appendChild(el("span", "morph-nom", cible.label));

		const nuancier = el("div", "nuancier");
		for (const teinte of palette) {
			const pastille = document.createElement("button");
			pastille.type = "button";
			pastille.className = "teinte" + (teinte === courante ? " teinte--active" : "");
			pastille.style.background = teinte;
			pastille.setAttribute("aria-label", `${cible.label} : ${teinte}`);
			pastille.setAttribute("aria-pressed", String(teinte === courante));
			pastille.title = teinte;
			pastille.addEventListener("click", () => {
				couleurs[cible.id] = teinte;
				majApercu(brouillon.genre, brouillon.tenue, brouillon.corps);
				rendreCreation();
			});
			nuancier.appendChild(pastille);
		}

		ligne.appendChild(nuancier);
		bloc.appendChild(ligne);
	}

	hote.appendChild(bloc);
};

const rendreChoixTenue = (hote) => {
	$("creation-titre").textContent = "Apparence";

	// ── UN CORPS BLUEPRINT NE SE REGLE PAS ICI ───────────────────────────────
	//
	// Ni silhouette, ni couleurs, ni pieces : sur un corps du Meta Customization
	// System, le mesh que nos curseurs viseraient est MASQUE — ce qui se voit
	// est le Blueprint, et il a ses propres reglages. Afficher des curseurs
	// inertes serait pire que de n'en afficher aucun : le joueur les bougerait
	// et conclurait a une panne.
	if (estBlueprint()) {
		// ── LE META CUSTOMIZATION SYSTEM, BRANCHE (2026-09-13 soir) ─────────────
		// Modele, corps (16 curseurs du pack), visage, peau et tatouage, yeux,
		// cheveux, vetements (MCS + MetaWardrobe), accessoires. L'editeur est
		// partage avec le menu en jeu (../mcs-editeur.js) ; chaque geste renvoie
		// l'apparence ENTIERE a l'apercu, que le serveur normalise.
		const options = OPTIONS && OPTIONS.metacustom && OPTIONS.metacustom[brouillon.genre];
		if (!options || typeof EditeurMCS === "undefined") {
			hote.appendChild(el("p", "option-sous", "Personnalisation MetaHuman indisponible : catalogue non recu du serveur."));
			return;
		}
		if (!brouillon.metacustom) brouillon.metacustom = metacustomDefaut(brouillon.genre);
		const zone = el("div", "creation-mcs");
		hote.appendChild(zone);
		const ctx = {
			options,
			apparence: brouillon.metacustom,
			surChangement: (a, info) => {
				brouillon.metacustom = a;
				ctx.apparence = a;
				majApercu(brouillon.genre, brouillon.tenue, brouillon.corps);
				if (info && info.rerendre) EditeurMCS.rendre(zone, ctx);
			},
		};
		EditeurMCS.rendre(zone, ctx);
		return;
	}

	// Le tirage AVANT la liste : c'est un point de depart, pas une conclusion.
	// Beaucoup de joueurs partent d'un hasard puis ajustent — le mettre en bas
	// obligerait a parcourir sept blocs pour le trouver.
	// ⚠ APRES le cas Blueprint (2026-09-14) : il tire tenue, couleurs et
	// silhouette du systeme MODULAIRE, sans effet sur un MetaHuman — affiche
	// au-dessus de l'editeur MCS, c'etait un bouton qui ne fait rien.
	const barre = el("div", "bloc-actions");
	const des = el("button", "lien", "Composition aleatoire");
	des.type = "button";
	des.addEventListener("click", tirerApparence);
	barre.appendChild(des);
	hote.appendChild(barre);

	// ⚠ SILHOUETTE ET COULEURS EN PREMIER, ET SURTOUT : AVANT TOUT `return`.
	//
	// Cette etape sortait tot quand aucun slot n'avait plusieurs pieces — le cas
	// du corps morphable. Les deux blocs ci-dessous auraient donc ete les seuls
	// reglages disponibles sur ce corps, et ils n'auraient jamais ete atteints.
	// Les placer ici les rend inconditionnels : ils valent pour TOUS les corps,
	// c'est meme la raison d'etre du module Apparence.
	rendreSilhouette(hote);
	rendreCouleurs(hote);

	// Les pieces sont indexees par genre PUIS par famille : on ne propose que ce
	// qui va avec le corps retenu.
	const famille = familleDe(brouillon.genre, brouillon.corps);
	const par = OPTIONS && OPTIONS.pieces && OPTIONS.pieces[brouillon.genre]
		&& OPTIONS.pieces[brouillon.genre][famille];

	if (!par) {
		hote.appendChild(el("p", "option-sous", "Aucune pièce pour cette morphologie."));
		return;
	}

	// ⚠ UNE ETAPE VIDE SE LIT COMME UNE PANNE.
	//
	// Chaque slot n'affiche ses pieces que s'il en a PLUSIEURS — un choix unique
	// n'en est pas un. Sur le corps morphable, chaque slot n'a qu'une piece :
	// la section des pieces ne montre donc rien, et le joueur aurait cru l'ecran
	// casse alors que sa morphologie se regle ailleurs.
	const aQuelqueChose = OPTIONS.slots.some((s) => (par[s] || []).length > 1);
	if (!aQuelqueChose) {
		hote.appendChild(el("p", "option-sous",
			estMorphable()
				? "Ce corps se règle aux curseurs ci-dessus et à l'étape Visage : il n'a qu'une pièce par emplacement."
				: "Cette morphologie n'a qu'une pièce par emplacement — rien à interchanger."));
		return;
	}

	for (const slot of OPTIONS.slots) {
		const liste = par[slot] || [];
		if (liste.length === 0) continue;

		const bloc = el("div", "bloc");
		const titre = el("p", "bloc-titre", slot);
		titre.appendChild(el("span", "bloc-compte", `${liste.length} pièce(s)`));
		bloc.appendChild(titre);

		const g = el("div", "grille grille--serree");
		for (const piece of liste) {
			g.appendChild(
				option(null, brouillon.tenue[slot] === piece.id, (b) => {
					b.appendChild(el("div", "option-titre", piece.label));
					b.appendChild(el("div", "option-mono", piece.registre));
				}, () => {
					brouillon.tenue[slot] = piece.id;
					majApercu(brouillon.genre, brouillon.tenue, brouillon.corps);
					rendreCreation();
				}),
			);
		}
		bloc.appendChild(g);
		hote.appendChild(bloc);
	}
};

const majSynthese = () => {
	const f = factionDe(brouillon.faction);
	const c = classeLoreDe(brouillon.loreId);

	$("syn-faction").textContent = f ? f.label : "—";
	$("syn-classe").textContent = c ? c.label : "—";
	$("syn-genre").textContent = brouillon.genre
		? (brouillon.genre === "F" ? "Féminin" : "Masculin")
		: "—";
	$("syn-nom").textContent = brouillon.nom.trim() || "—";

	// Tenue
	const ul = $("syn-tenue");
	ul.textContent = "";
	const par = OPTIONS && OPTIONS.pieces && OPTIONS.pieces[brouillon.genre]
		&& OPTIONS.pieces[brouillon.genre][familleDe(brouillon.genre, brouillon.corps)];

	for (const slot of (OPTIONS && OPTIONS.slots) || []) {
		const id = brouillon.tenue[slot];
		if (!id || !par) continue;
		const piece = (par[slot] || []).find((p) => p.id === id);
		const li = el("li");
		li.appendChild(el("span", null, slot));
		li.appendChild(el("span", null, piece ? piece.label : id));
		ul.appendChild(li);
	}

	// Le bouton ne s'active que quand tout est là. Un CTA cliquable qui répond
	// par une erreur est pire qu'un CTA éteint.
	const nom = brouillon.nom.trim();
	const min = (OPTIONS && OPTIONS.nom_min) || 2;
	// Le corps fait partie du minimum : sans lui, le serveur en choisirait un
	// autre que celui montre a l'ecran.
	const complet = Boolean(brouillon.faction && brouillon.loreId && brouillon.genre
		&& brouillon.corps) && nom.length >= min;

	$("btn-valider").disabled = !complet;
};

const rendreCreation = () => {
	afficherEcran("creation");
	alerte($("creation-erreur"), SESSION.erreur);
	rendreEtapes();

	// L'étape faction déborde sur la colonne de scène : voir
	// `.creation-corps--large`. Les autres gardent les trois colonnes.
	document.querySelector(".creation-corps")
		.classList.toggle("creation-corps--large", etape === "faction");

	const hote = $("creation-choix");
	hote.textContent = "";
	// La classe est posée par `rendreChoixFaction` seule : sans ce retrait, la
	// mise en page pleine hauteur resterait sur les étapes suivantes.
	hote.classList.remove("choix--faction");

	// ⚠ En quittant l'étape faction, l'accent doit revenir à la faction CHOISIE.
	// Sans ça il restait sur la dernière SURVOLÉE : on pouvait voir une fiche
	// « AKARLYS » avec un écran entièrement ambre (MEZALAYIS). Vu en jeu.
	if (etape !== "faction") {
		factionVisee = null;
		appliquerAccent(factionDe(brouillon && brouillon.faction));
	}

	if (etape === "faction") rendreChoixFaction(hote);
	else if (etape === "classe") rendreChoixClasse(hote);
	else if (etape === "genre") rendreChoixGenre(hote);
	else if (etape === "visage") rendreChoixVisage(hote);
	else if (etape === "tenue") rendreChoixTenue(hote);
	else if (etape === "nom") rendreChoixNom(hote);

	majSynthese();
};

// ── Rendu principal ───────────────────────────────────────────────────────────

const rendre = () => {
	if (SESSION.etat === "connexion") {
		brouillon = null;
		rendreConnexion();
		return;
	}

	if (SESSION.etat === "selection") {
		// Une création en cours survit à un rafraîchissement d'état : sans ça, une
		// erreur de nom renverrait le joueur au rail et lui ferait tout ressaisir.
		if (brouillon) rendreCreation();
		else rendreSelection();
		return;
	}

	if (SESSION.etat === "depart") {
		// ⚠ ON REMET LE CHOIX À ZÉRO EN ARRIVANT. `departChoisi` survit d'un
		// personnage à l'autre, et il désignerait un monde retenu pour le
		// précédent — voire un monde qui n'est plus proposé. `departCourant`
		// retombe alors sur le défaut, qui est ce qu'on veut montrer d'entrée.
		if (!departsDispo().some((o) => o.id === departChoisi)) departChoisi = null;
		rendreDepart();
		return;
	}

	// `en_jeu` : le Lua détruit ce WebUI. On masque tout pour éviter un dernier
	// rendu visible pendant la destruction.
	for (const e of ECRANS) montrer($(`ecran-${e}`), false);
};

// ── Événements ────────────────────────────────────────────────────────────────

const brancher = () => {
	// ── Connexion ─────────────────────────────────────────────────────────────
	$("form-connexion").addEventListener("submit", (e) => {
		e.preventDefault();
		versLua("NarvosCreation:Connexion", $("in-identifiant").value, $("in-motdepasse").value);
	});

	$("btn-inscription").addEventListener("click", () => {
		versLua("NarvosCreation:Inscription", $("in-identifiant").value, $("in-motdepasse").value);
	});

	$("btn-steam").addEventListener("click", () => {
		versLua("NarvosCreation:Steam");
	});

	// ── Sélection ─────────────────────────────────────────────────────────────
	$("btn-entrer").addEventListener("click", () => {
		if (choisi) versLua("NarvosCreation:Choisir", choisi.id);
	});

	// ── Point de départ ───────────────────────────────────────────────────────
	// On envoie l'identifiant du monde, jamais sa position : le serveur relit le
	// point dans le catalogue. Transmettre des coordonnées depuis la page
	// laisserait un client modifié se poser où il veut.
	$("btn-depart-valider").addEventListener("click", () => {
		const o = departCourant();
		if (o) versLua("NarvosCreation:ChoisirDepart", o.id);
	});

	// La suppression est irréversible : elle demande confirmation. Un double clic
	// accidentel sur un rail dense effacerait sinon un personnage de niveau élevé.
	$("btn-supprimer").addEventListener("click", () => {
		if (!choisi) return;
		const b = $("btn-supprimer");
		if (b.dataset.confirme === choisi.id) {
			versLua("NarvosCreation:Supprimer", choisi.id);
			delete b.dataset.confirme;
			b.textContent = "Supprimer";
			return;
		}
		b.dataset.confirme = choisi.id;
		b.textContent = "Confirmer la suppression";
	});

	$("btn-creer-premier").addEventListener("click", ouvrirCreation);

	// ── Création ──────────────────────────────────────────────────────────────
	$("btn-retour").addEventListener("click", () => {
		// Retour au rail seulement s'il y a un personnage : un compte neuf DOIT
		// en créer un, il n'y a nulle part où revenir.
		if ((SESSION.persos || []).length === 0) return;
		brouillon = null;
		SESSION.erreur = null;
		rendreSelection();
	});

	$("btn-valider").addEventListener("click", () => {
		// Sonde AVANT toute condition : un `return` silencieux plus bas ne se
		// distingue pas d'un clic qui n'arrive jamais au gestionnaire.
		sonde("clic-creer");
		if (!brouillon) {
			sonde("clic-creer-SANS-BROUILLON");
			return;
		}
		structureVersLua("NarvosCreation:Creer", {
			nom: brouillon.nom.trim(),
			corps: brouillon.corps,
			class_id: brouillon.class_id,
			lore_id: brouillon.loreId,
			genre: brouillon.genre,
			tenue: brouillon.tenue,
			// Le visage regle. Le serveur borne et filtre a l'application : un
			// identifiant inconnu y est simplement ignore.
			morphs,
			// Idem : `Apparence.Couleurs` normalise, une teinte mal formee
			// retombe sur son defaut au lieu de passer en base.
			couleurs,
			// Apparence du Meta Customization System : normalisee puis encodee par
			// le serveur dans la colonne `metacustom`.
			metacustom: brouillon.metacustom || null,
		});
	});

	// Échap : reculer d'un cran plutôt que fermer. Il n'y a rien à fermer — cet
	// écran est le seul chemin vers le jeu.
	document.addEventListener("keydown", (e) => {
		if (e.key !== "Escape" || !brouillon) return;
		// La MEME liste que le fil : reculer vers une etape masquee laisserait
		// l'ecran sur un panneau que rien ne permet de quitter.
		const visibles = etapesVisibles();
		const i = visibles.findIndex((x) => x.id === etape);
		if (i > 0) {
			etape = visibles[i - 1].id;
			rendreCreation();
		} else if ((SESSION.persos || []).length > 0) {
			brouillon = null;
			rendreSelection();
		}
	});
};

// ── Pont Lua ──────────────────────────────────────────────────────────────────

const abonner = () => {
	if (typeof Events === "undefined") return;

	Events.Subscribe("NarvosCreation:Options", (options) => {
		OPTIONS = options;
		rendre();
	});

	Events.Subscribe("NarvosCreation:Session", (session) => {
		SESSION = session || { etat: "connexion", persos: [] };

		// Une création qui aboutit doit ramener au rail. On le détecte au fait que
		// le roster a grandi — le serveur ne renvoie pas d'accusé dédié.
		if (brouillon && !SESSION.erreur && (SESSION.persos || []).length > 0) {
			const cree = SESSION.persos.find((p) => p.name === brouillon.nom.trim());
			if (cree) {
				brouillon = null;
				choisi = cree;
			}
		}
		rendre();
	});
};

// ── La molette sur un panneau fait défiler le panneau, pas la caméra ─────────
// Le Lua zoome l'aperçu à la molette (`Input.Subscribe("MouseScroll")`) et ne
// sait pas où est la souris : parcourir la liste des vêtements éloignait la
// caméra de 28 cm par cran (retour de jeu du 2026-09-14). La page, elle, le sait.
// Tout élément visible hors de la scène compte comme panneau ; la scène est en
// `pointer-events: none`, la souris y « tombe » sur le conteneur de la grille.
const HORS_PANNEAU = new Set(["HTML", "BODY"]);
const estPanneau = (cible) => {
	if (!cible || HORS_PANNEAU.has(cible.tagName)) return false;
	if (cible.closest && cible.closest(".scene")) return false;
	if (cible.classList && (cible.classList.contains("creation-corps") || cible.classList.contains("ecran"))) return false;
	return true;
};
let survolPanneau = false;
const suivreSurvol = (e) => {
	const sur = estPanneau(e.target);
	if (sur === survolPanneau) return;
	survolPanneau = sur;
	versLua("NarvosCreation:Survol", sur);
};

document.addEventListener("DOMContentLoaded", () => {
	brancher();
	abonner();
	rendre();
	document.addEventListener("mousemove", suivreSurvol, { passive: true });
	document.addEventListener("wheel", suivreSurvol, { passive: true });

	// ⚠ RÉCLAMER l'état, ne pas l'attendre. Le Lua crée ce WebUI et lui parle
	// dans le MÊME tick, alors que nos `Events.Subscribe` viennent seulement
	// d'être posés : son premier message tombe dans le vide et l'écran reste
	// noir, sans erreur. On signale donc qu'on est prêt, et le Lua renvoie ce
	// qu'il a tamponné. Trouvé par audit le 2026-09-03.
	versLua("NarvosCreation:Pret");

	// Sonde : le câblage a-t-il tourné jusqu'au bout ? Un `addEventListener` sur
	// un élément absent LÈVE et abandonne tout le reste en silence — cette ligne
	// prouve qu'on est arrivé après `brancher()`.
	sonde("cablage");
});
