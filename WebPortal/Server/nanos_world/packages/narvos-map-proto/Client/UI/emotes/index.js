// ══════════════════════════════════════════════════════════════════════════════
// index.js — menu d'animations (touche B).
//
//   Lua  -> JS   webui:CallEvent("Nom", args...)   reçu par Events.Subscribe
//   JS   -> Lua  Events.Call("Nom", args...)       reçu par Events.Subscribe
//
// ── CE QUE CE FICHIER NE DÉCIDE PAS ───────────────────────────────────────────
// Ni le catalogue, ni les touches réservées, ni le plafond : tout arrive du
// serveur (`Narvos:Emotes`). Le menu ne peut donc jamais proposer une animation
// absente du pack, ni présenter comme libre une touche que le serveur refuserait.
//
// La validation faite ici est un CONFORT — elle évite un aller-retour pour un
// refus prévisible. Le serveur revalide tout, et c'est lui qui fait autorité.
// ══════════════════════════════════════════════════════════════════════════════

"use strict";

// ── État ──────────────────────────────────────────────────────────────────────

/** Envoyé par le serveur : { categories, raccourcis, touches_reservees, max }. */
let DONNEES = null;

let categorie = null;
let retenue = null;     // animation affichée dans le volet de détail
let filtre = "";
let capture = false;    // on attend une frappe pour assigner

// ── Raccourcis ────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const el = (balise, classes, texte) => {
	const n = document.createElement(balise);
	if (classes) n.className = classes;
	if (texte !== undefined) n.textContent = texte;
	return n;
};

/** On passe TOUJOURS par `hidden`, jamais par `style.display` : le CSS force
 *  `[hidden] { display: none !important }`, et mélanger les deux produit des
 *  états impossibles à déboguer. */
const montrer = (n, oui) => { if (n) n.hidden = !oui; };

const versLua = (nom, ...args) => {
	if (typeof Events !== "undefined") Events.Call(nom, ...args);
};

const alerte = (message) => {
	const n = $("erreur");
	n.textContent = message || "";
	montrer(n, Boolean(message));
};

/** Touche assignée à une animation, ou null. */
const toucheDe = (id) => {
	const r = (DONNEES && DONNEES.raccourcis) || {};
	for (const t of Object.keys(r)) if (r[t] === id) return t;
	return null;
};

/** Animation par identifiant, toutes catégories confondues. */
const animDe = (id) => {
	for (const c of (DONNEES && DONNEES.categories) || []) {
		const a = c.animations.find((x) => x.id === id);
		if (a) return a;
	}
	return null;
};

// ── Validation locale (confort, pas autorité) ─────────────────────────────────

const TOUCHE_VALIDE = /^([A-Z]|[0-9]|F[1-9]|F1[0-2])$/;

/** Rend un message d'erreur, ou null si la touche est acceptable. */
const verifierTouche = (touche) => {
	const t = String(touche || "").toUpperCase();
	if (!t) return "Touche requise";
	if (!TOUCHE_VALIDE.test(t)) return "Lettre, chiffre ou F1-F12 uniquement";

	// La liste vient du serveur : la coder en dur ici la ferait diverger le jour
	// où le jeu réserve une touche de plus.
	const reservees = (DONNEES && DONNEES.touches_reservees) || [];
	if (reservees.includes(t)) return `La touche ${t} est réservée par le jeu`;

	return null;
};

// ── Rendu ─────────────────────────────────────────────────────────────────────

const rendreCategories = () => {
	const hote = $("categories");
	hote.textContent = "";

	for (const c of (DONNEES && DONNEES.categories) || []) {
		const b = el("button", "categorie");
		b.type = "button";
		if (c.id === categorie) b.setAttribute("aria-current", "true");
		b.appendChild(el("span", null, c.label));
		b.appendChild(el("span", "categorie-n", String(c.animations.length)));
		b.addEventListener("click", () => {
			categorie = c.id;
			retenue = null;
			rendre();
		});
		hote.appendChild(b);
	}
};

const rendreListe = () => {
	const hote = $("liste");
	hote.textContent = "";

	const cat = ((DONNEES && DONNEES.categories) || []).find((c) => c.id === categorie);
	let anims = cat ? cat.animations : [];

	if (filtre) {
		const f = filtre.toLowerCase();
		anims = anims.filter((a) => a.label.toLowerCase().includes(f));
	}

	montrer($("liste-vide"), anims.length === 0);

	anims.forEach((a, i) => {
		const b = el("button", "entree");
		b.type = "button";
		b.setAttribute("aria-selected", String(retenue === a.id));

		b.appendChild(el("span", "entree-num", String(i + 1).padStart(2, "0")));
		b.appendChild(el("span", "entree-nom", a.label));

		const t = toucheDe(a.id);
		b.appendChild(el("span", t ? "touche" : "touche touche--vide", t || "—"));

		b.addEventListener("click", () => {
			retenue = a.id;
			capture = false;
			alerte(null);
			rendre();
		});
		hote.appendChild(b);
	});
};

const rendreDetail = () => {
	const a = retenue && animDe(retenue);
	montrer($("detail"), Boolean(a));
	if (!a) return;

	const cat = ((DONNEES && DONNEES.categories) || []).find((c) => c.id === categorie);
	$("detail-categorie").textContent = cat ? cat.label : "";
	$("detail-nom").textContent = a.label;
	$("detail-type").textContent = a.boucle ? "Boucle" : "Action";

	const t = toucheDe(a.id);
	$("detail-touche").textContent = t || "aucune";
	montrer($("btn-liberer"), Boolean(t));

	// Le champ pré-rempli avec la touche courante : le joueur voit ce qu'il
	// remplace au lieu de deviner.
	if (!capture) $("in-touche").value = t || "";

	const bc = $("btn-capturer");
	bc.classList.toggle("cta--capture", capture);
	bc.textContent = capture ? "Appuyez…" : "Appuyer";
};

const rendreAssignes = () => {
	const ul = $("assignes");
	ul.textContent = "";

	const r = (DONNEES && DONNEES.raccourcis) || {};
	const touches = Object.keys(r).sort();

	$("compte-raccourcis").textContent =
		`${touches.length} / ${(DONNEES && DONNEES.max) || 24} RACCOURCIS`;

	if (touches.length === 0) {
		ul.appendChild(el("li", "assignes-vide", "Aucun raccourci assigné."));
		return;
	}

	for (const t of touches) {
		const a = animDe(r[t]);
		const li = el("li");
		li.appendChild(el("span", "touche", t));
		li.appendChild(el("span", null, a ? a.label : r[t]));

		// Cliquer un raccourci amène à son animation : c'est le chemin naturel
		// quand on veut le changer.
		li.addEventListener("click", () => {
			const anim = a;
			if (!anim) return;
			for (const c of DONNEES.categories) {
				if (c.animations.some((x) => x.id === anim.id)) categorie = c.id;
			}
			retenue = anim.id;
			rendre();
		});
		ul.appendChild(li);
	}
};

const rendre = () => {
	rendreCategories();
	rendreListe();
	rendreDetail();
	rendreAssignes();
};

// ── Actions ───────────────────────────────────────────────────────────────────

const assigner = (touche) => {
	if (!retenue) return;

	const message = verifierTouche(touche);
	if (message) {
		alerte(message);
		return;
	}
	alerte(null);
	versLua("NarvosEmotes:Assigner", String(touche).toUpperCase(), retenue);
};

const brancher = () => {
	$("btn-fermer").addEventListener("click", () => versLua("NarvosEmotes:Fermer"));

	$("in-recherche").addEventListener("input", (e) => {
		filtre = e.target.value;
		rendreListe();
	});

	// « Jouer » respecte le type de l'animation : une boucle boucle, une action
	// se joue une fois. « Prévisualiser » ne boucle JAMAIS — sinon le joueur
	// resterait figé dans la pose sans comprendre comment en sortir.
	$("btn-jouer").addEventListener("click", () => {
		if (retenue) versLua("NarvosEmotes:Jouer", retenue, null);
	});

	$("btn-apercu").addEventListener("click", () => {
		if (retenue) versLua("NarvosEmotes:Jouer", retenue, false);
	});

	// Sortie explicite. Une animation en boucle — s'asseoir, s'appuyer — laissait
	// sinon le joueur figé : aucun contrôle n'émettait `Arreter`.
	$("btn-arreter").addEventListener("click", () => versLua("NarvosEmotes:Arreter"));

	$("btn-assigner").addEventListener("click", () => assigner($("in-touche").value));

	$("btn-liberer").addEventListener("click", () => {
		const t = toucheDe(retenue);
		if (t) versLua("NarvosEmotes:Liberer", t);
	});

	$("btn-capturer").addEventListener("click", () => {
		capture = !capture;
		alerte(null);
		rendreDetail();
	});

	// ── Clavier ───────────────────────────────────────────────────────────────
	document.addEventListener("keydown", (e) => {
		// En capture, la frappe SUIVANTE devient la touche. On l'intercepte avant
		// tout le reste, sinon Échap fermerait le menu au lieu d'annuler.
		if (capture) {
			e.preventDefault();
			capture = false;

			if (e.key === "Escape") {
				rendreDetail();
				return;
			}

			// `e.key` rend « a » ou « A » selon la majuscule ; `e.code` rend
			// « KeyA » / « Digit1 » / « F5 », stable quelle que soit la disposition
			// du clavier. C'est lui qu'on lit, sinon un clavier AZERTY assignerait
			// une touche que le joueur n'a pas pressée.
			const code = e.code || "";
			let touche = null;
			if (/^Key[A-Z]$/.test(code)) touche = code.slice(3);
			else if (/^Digit[0-9]$/.test(code)) touche = code.slice(5);
			else if (/^F([1-9]|1[0-2])$/.test(code)) touche = code;

			if (!touche) {
				alerte("Touche non assignable");
				rendreDetail();
				return;
			}

			$("in-touche").value = touche;
			assigner(touche);
			rendreDetail();
			return;
		}

		// Entrée dans le champ de touche : assigner sans passer par le bouton.
		if (e.key === "Enter" && document.activeElement === $("in-touche")) {
			e.preventDefault();
			assigner($("in-touche").value);
			return;
		}

		if (e.key === "Escape") {
			e.preventDefault();
			versLua("NarvosEmotes:Fermer");
		}
	});
};

// ── Pont Lua ──────────────────────────────────────────────────────────────────

const abonner = () => {
	if (typeof Events === "undefined") return;

	Events.Subscribe("NarvosEmotes:Donnees", (donnees) => {
		DONNEES = donnees || null;

		// Première catégorie par défaut : un menu qui s'ouvre sur une colonne
		// vide n'apprend rien au joueur.
		if (!categorie && DONNEES && DONNEES.categories && DONNEES.categories.length) {
			categorie = DONNEES.categories[0].id;
		}
		rendre();
	});

	Events.Subscribe("NarvosEmotes:Ouvrir", () => {
		montrer($("menu"), true);
		alerte(null);
		capture = false;
		$("in-recherche").value = "";
		filtre = "";
		rendre();
	});

	Events.Subscribe("NarvosEmotes:Fermer", () => {
		montrer($("menu"), false);
		capture = false;
	});

	Events.Subscribe("NarvosEmotes:Erreur", (raison) => alerte(raison));
};

document.addEventListener("DOMContentLoaded", () => {
	brancher();
	abonner();

	// Même course qu'à l'écran de création : on réclame nos données au lieu
	// d'espérer que le premier CallEvent du Lua soit arrivé après nos abonnements.
	versLua("NarvosEmotes:Pret");
});
