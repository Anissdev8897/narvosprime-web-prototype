// ══════════════════════════════════════════════════════════════════════════════
// teleports.js — les points de téléportation (Server/Teleports.lua) : l'invite
// de passage, pour tout joueur, et le panneau d'édition, pour les administrateurs.
//
// Chargé APRÈS index.js et ateliers.js, dans le même scope global : il consomme
// `$`, `ETAT`, `RENDUS` (index.js) et `Message` (ateliers.js).
//
// ── LE CLIENT N'A AUCUNE AUTORITÉ ─────────────────────────────────────────────
// L'invite n'affiche que ce que le serveur annonce quand le joueur entre dans un
// cercle ; la TOUCHE de passage est traitée côté Lua (ACTIONS.tp_utiliser), et le
// serveur revérifie la distance. Le panneau n'applique aucune règle : chaque geste
// part au serveur sous forme d'un NOM d'opération, qui répond par la liste à jour
// et une ligne (« Refus : … » quand il refuse). Un joueur sans droit ouvre le
// panneau et n'y lit que le verrou — le serveur refuserait de toute façon.
//
// Tout texte venu du serveur (noms de points) passe par `textContent` : un nom
// choisi en jeu n'est jamais interprété comme du HTML.
//
// Événements :
//   Lua -> page   NarvosTP:Proche (info | false) · NarvosTP:Refus (raison)
//                 NarvosTP:Liste (etat = { edition, points, message })
//   page -> Lua   NarvosTP:Demander · NarvosTP:Editer (operation, a, b, c, d, e)
// ══════════════════════════════════════════════════════════════════════════════

const TP = {
	points: [],        // l'ordre du serveur
	edition: false,    // le serveur dit si ce joueur peut éditer
	selection: null,   // id du point affiché à droite
	message: "",       // réponse à la dernière action
	ton: "info",       // "fait" | "refus" | "info"
	confirmer: null,   // id du point dont la suppression attend confirmation
	minuteur: null,
	// Champs nés au RENDU : tenus par référence, jamais relus par identifiant
	// (ui-liens exige que tout `$("id")` existe dans le HTML statique).
	champNouveau: null,
	champNom: null,
	choixVers: null,
};

/** Délai pendant lequel « Confirmer la suppression » reste armé. */
const TP_CONFIRMATION_MS = 4000;

const TpEl = (balise, classe, texte) => {
	const n = document.createElement(balise);
	if (classe) n.className = classe;
	if (texte !== undefined && texte !== null) n.textContent = texte;
	return n;
};

const TpBouton = (texte, attributs, classe) => {
	const b = TpEl("button", classe ? `action ${classe}` : "action", texte);
	b.type = "button";
	for (const [k, v] of Object.entries(attributs || {})) b.setAttribute(k, v);
	return b;
};

/** Les points, toujours en tableau : une table Lua VIDE peut traverser le pont
 *  en objet plutôt qu'en tableau. */
function TpPoints() {
	return Array.isArray(TP.points) ? TP.points : [];
}

function TpPoint(id) {
	return TpPoints().find((p) => p.id === id) || null;
}

/** Centimètres -> mètres, une décimale : l'unité que le joueur a en tête. */
function TpM(v) {
	return (Number(v) / 100).toFixed(1).replace(".", ",");
}

function TpLieu(p) {
	return `${p.monde} · ${TpM(p.x)} / ${TpM(p.y)} / ${TpM(p.z)} m`;
}

function TpDestination(p) {
	if (p.vers_nom) return { texte: `→ ${p.vers_nom}`, vide: false };
	if (p.dest && typeof p.dest === "object") {
		return { texte: `→ position libre (${p.dest.monde})`, vide: false };
	}
	return { texte: "sans destination", vide: true };
}

/** Envoie une opération d'édition. La ligne dit qu'on attend : un serveur qui
 *  ne répond pas doit se VOIR, pas passer pour un clic raté. */
function TpEditer(operation, ...args) {
	TP.message = "demande envoyée au serveur…";
	TP.ton = "info";
	TP.confirmer = null;
	MajTpPied();
	if (typeof Events !== "undefined") Events.Call("NarvosTP:Editer", operation, ...args);
}

// ── La liste : colonne de gauche ──────────────────────────────────────────────

function RendreTpListe() {
	const liste = $("tp-liste");
	if (!liste) return;
	liste.replaceChildren();

	TpPoints().forEach((p, i) => {
		const b = TpEl("button", "tp-point");
		b.type = "button";
		b.dataset.tpPoint = p.id;
		if (p.id === TP.selection) b.setAttribute("aria-current", "true");

		const dest = TpDestination(p);
		b.append(TpEl("span", "tp-point-num", String(i + 1).padStart(2, "0")));
		b.append(TpEl("span", "tp-point-nom", p.nom || p.id));
		b.append(TpEl("span", "tp-point-lieu", TpLieu(p)));
		const d = TpEl("span", "tp-point-dest", dest.texte);
		if (dest.vide) d.dataset.vide = "";
		b.append(d);

		const li = TpEl("li");
		li.append(b);
		liste.append(li);
	});
}

// ── Le point choisi et les gestes : colonne de droite ─────────────────────────

function TpBlocCreer() {
	const bloc = TpEl("div", "tp-bloc");
	bloc.append(TpEl("p", "tp-bloc-titre", "Nouveau point, là où vous vous tenez"));
	const champ = TpEl("input", "tp-champ");
	champ.maxLength = 48;
	champ.placeholder = "Nom du point (ex. Entrée de la tour)";
	champ.setAttribute("aria-label", "Nom du nouveau point");
	TP.champNouveau = champ;
	bloc.append(champ, TpBouton("Créer ici", { "data-tp-creer": "" }));
	return bloc;
}

function TpBlocPoint(p) {
	const frag = document.createDocumentFragment();

	frag.append(TpEl("h2", "tp-titre", p.nom || p.id));
	frag.append(TpEl("p", "tp-meta", `${TpLieu(p)} · rayon ${TpM(p.rayon)} m · ${p.id}`));
	const dest = TpDestination(p);
	const ligne = TpEl("p", "tp-dest", dest.texte);
	if (dest.vide) ligne.dataset.vide = "";
	frag.append(ligne);

	const nommer = TpEl("div", "tp-bloc");
	nommer.append(TpEl("p", "tp-bloc-titre", "Nom"));
	const champ = TpEl("input", "tp-champ");
	champ.maxLength = 48;
	champ.value = p.nom || "";
	champ.setAttribute("aria-label", "Nom du point");
	TP.champNom = champ;
	nommer.append(champ, TpBouton("Renommer", { "data-tp-op": "Renommer" }));
	frag.append(nommer);

	const placer = TpEl("div", "tp-bloc");
	placer.append(TpEl("p", "tp-bloc-titre", "Position et destination"));
	placer.append(
		TpBouton("Déplacer ici", { "data-tp-op": "DeplacerIci" }),
		TpBouton("Destination : ma position", { "data-tp-op": "DestinationIci" }),
		TpBouton("Aller voir", { "data-tp-op": "Aller" }),
	);
	frag.append(placer);

	const autres = TpPoints().filter((x) => x.id !== p.id);
	const relier = TpEl("div", "tp-bloc");
	relier.append(TpEl("p", "tp-bloc-titre", "Relier à un autre point"));
	if (autres.length > 0) {
		const choix = TpEl("select", "tp-champ");
		choix.setAttribute("aria-label", "Point d'arrivée");
		TP.choixVers = choix;
		for (const x of autres) {
			const o = TpEl("option", null, x.nom || x.id);
			o.value = x.id;
			if (x.id === p.vers) o.selected = true;
			choix.append(o);
		}
		relier.append(choix, TpBouton("Mener vers ce point", { "data-tp-op": "DestinationVers" }));
	} else {
		TP.choixVers = null;
		relier.append(TpEl("span", "tp-meta", "aucun autre point pour l'instant"));
	}
	// « Créer le retour » n'a de sens qu'avec une destination : sans elle le
	// serveur refuserait, autant le dire dans le bouton.
	relier.append(TpBouton("Créer le retour", { "data-tp-op": "Lier" }));
	frag.append(relier);

	const armer = TP.confirmer === p.id;
	const suppr = TpEl("div", "tp-bloc");
	const b = TpBouton(armer ? "Confirmer la suppression" : "Supprimer", { "data-tp-op": "Supprimer" }, "tp-danger");
	if (armer) b.dataset.confirmer = "";
	suppr.append(b);
	frag.append(suppr);

	return frag;
}

function RendreTpCote() {
	const cote = $("tp-cote");
	if (!cote) return;
	cote.replaceChildren();
	TP.champNom = null;
	TP.choixVers = null;
	cote.append(TpBlocCreer());

	const p = TpPoint(TP.selection);
	if (p) {
		cote.append(TpBlocPoint(p));
	} else {
		cote.append(TpEl("p", "tp-vide", TpPoints().length === 0
			? "Aucun point sur ce serveur. Placez-vous devant une porte et créez le premier."
			: "Choisissez un point dans la liste."));
	}
}

function MajTpPied() {
	const ligne = $("tp-message");
	if (!ligne) return;
	ligne.textContent = TP.message || "";
	ligne.dataset.ton = TP.ton;
}

function RendreTeleports() {
	const verrou = $("tp-verrou");
	const corps = $("tp-corps");
	const compte = $("tp-compte");
	if (compte) {
		const n = TpPoints().length;
		compte.textContent = TP.edition ? `${n} ${n > 1 ? "points" : "point"}` : "—";
	}
	if (verrou) verrou.hidden = TP.edition;
	if (corps) corps.hidden = !TP.edition;
	if (TP.edition) {
		RendreTpListe();
		RendreTpCote();
	}
	MajTpPied();
}

// ── Les gestes ────────────────────────────────────────────────────────────────

function TpChoisir(id) {
	TP.selection = id;
	TP.confirmer = null;
	RendreTeleports();
	const b = document.querySelector(`#tp-liste [data-tp-point="${CSS.escape(id)}"]`);
	if (b) b.focus();
}

function TpOperation(op) {
	const p = TpPoint(TP.selection);
	if (!p) return;
	if (op === "Renommer") {
		const nom = TP.champNom ? TP.champNom.value.trim() : "";
		if (nom !== "") TpEditer("Renommer", p.id, nom);
	} else if (op === "DestinationVers") {
		if (TP.choixVers && TP.choixVers.value) TpEditer("DestinationVers", p.id, TP.choixVers.value);
	} else if (op === "Supprimer") {
		if (TP.confirmer !== p.id) {
			TP.confirmer = p.id;
			if (TP.minuteur) clearTimeout(TP.minuteur);
			TP.minuteur = setTimeout(() => { TP.confirmer = null; RendreTeleports(); }, TP_CONFIRMATION_MS);
			RendreTeleports();
			return;
		}
		TpEditer("Supprimer", p.id);
	} else {
		TpEditer(op, p.id);
	}
}

function TpCreer() {
	const nom = TP.champNouveau ? TP.champNouveau.value.trim() : "";
	if (nom === "") {
		TP.message = "Donnez d'abord un nom au point.";
		TP.ton = "refus";
		MajTpPied();
		return;
	}
	TpEditer("Creer", nom);
}

document.addEventListener("click", (e) => {
	if (ETAT.ouvert !== "teleports" || !e.target || !e.target.closest) return;
	const point = e.target.closest("[data-tp-point]");
	if (point) { TpChoisir(point.dataset.tpPoint); return; }
	if (e.target.closest("[data-tp-creer]")) { TpCreer(); return; }
	const op = e.target.closest("[data-tp-op]");
	if (op) TpOperation(op.getAttribute("data-tp-op"));
});

// Flèches haut/bas dans la liste ; Entrée valide le champ où l'on tape. Échap
// n'est PAS traité ici : index.js ferme le panneau en passant par le Lua.
document.addEventListener("keydown", (e) => {
	if (ETAT.ouvert !== "teleports" || !e.target || !e.target.closest) return;
	if (e.key === "Enter" && e.target === TP.champNouveau) { e.preventDefault(); TpCreer(); return; }
	if (e.key === "Enter" && e.target === TP.champNom) { e.preventDefault(); TpOperation("Renommer"); return; }
	const surPoint = e.target.closest("[data-tp-point]");
	const pas = e.key === "ArrowDown" ? 1 : (e.key === "ArrowUp" ? -1 : 0);
	if (surPoint && pas !== 0) {
		e.preventDefault();
		const points = TpPoints();
		const i = points.findIndex((p) => p.id === surPoint.dataset.tpPoint);
		const suivant = points[i + pas];
		if (suivant) TpChoisir(suivant.id);
	}
});

// ── L'invite de passage ───────────────────────────────────────────────────────

function MajTpInvite(info) {
	const boite = $("tp-invite");
	if (!boite) return;
	if (!info || typeof info !== "object") {
		boite.hidden = true;
		return;
	}
	boite.replaceChildren();
	const pret = info.pret === true;
	boite.dataset.pret = pret ? "true" : "false";
	if (pret && info.touche) boite.append(TpEl("span", "tp-invite-touche", info.touche));
	boite.append(TpEl("span", "tp-invite-nom", info.nom || info.id || "Point de passage"));
	boite.append(TpEl("span", "tp-invite-vers",
		pret ? (info.vers ? `→ ${info.vers}` : "→ passage") : "pas encore de destination"));
	boite.hidden = false;
}

// ── Pont Lua ──────────────────────────────────────────────────────────────────

// Rendu À L'OUVERTURE (F6 comme /tp) : la ligne repart vide et la liste FRAÎCHE
// est demandée au serveur — le patron de la garde-robe et du panneau MetaHuman.
RENDUS.teleports = () => {
	TP.message = "";
	TP.confirmer = null;
	if (typeof Events !== "undefined") Events.Call("NarvosTP:Demander");
	RendreTeleports();
};

if (typeof Events !== "undefined") {
	Events.Subscribe("NarvosTP:Liste", (etat) => {
		if (!etat || typeof etat !== "object") return;
		TP.points = Array.isArray(etat.points) ? etat.points : [];
		TP.edition = etat.edition === true;
		if (typeof etat.message === "string" && etat.message !== "") {
			TP.message = etat.message;
			// Le serveur préfixe ses refus : c'est SON contrat, pas une devinette.
			TP.ton = etat.message.startsWith("Refus") ? "refus" : "fait";
		}
		if (!TpPoint(TP.selection)) TP.selection = TpPoints().length > 0 ? TpPoints()[0].id : null;
		if (ETAT.ouvert === "teleports") RendreTeleports();
	});

	Events.Subscribe("NarvosTP:Proche", (info) => MajTpInvite(info));

	Events.Subscribe("NarvosTP:Refus", (raison) => {
		if (typeof Message === "function") Message(String(raison || "Passage refusé"), "erreur");
	});
}
