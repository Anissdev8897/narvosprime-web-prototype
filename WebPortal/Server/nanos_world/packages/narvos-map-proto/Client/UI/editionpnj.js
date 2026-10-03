// ══════════════════════════════════════════════════════════════════════════════
// editionpnj.js — `/editionpnj` : repères radar et diagnostic texture des PNJ
// (Server/EditionPnj.lua). Demandes B5 et B6 du 2026-09-13.
//
// Chargé APRÈS index.js et ateliers.js, dans le même scope global : il consomme
// `$`, `ETAT`, `RENDUS` (index.js).
//
// ── LE CLIENT N'A AUCUNE AUTORITÉ ─────────────────────────────────────────────
// Le panneau n'applique aucune règle : chaque réglage part au serveur (qui garde,
// borne et persiste) et revient dans l'état complet. Un joueur sans droit lit le
// diagnostic ; ses contrôles sont désactivés — le serveur refuserait de toute façon.
//
// Tout texte venu du serveur passe par `textContent`.
//
// Événements :
//   Lua -> page   NarvosEditionPnj:Etat (etat)
//   page -> Lua   NarvosEditionPnj:Demander · NarvosEditionPnj:Definir (portee, cle, r, g, b, taille, visible)
//                 NarvosEditionPnj:Reinitialiser (portee, cle)
// ══════════════════════════════════════════════════════════════════════════════

const EPNJ = {
	etat: null,
	onglet: "pnj",          // "pnj" | "types" | "animaux"
	filtre: "",
	erreursSeules: false,
	champFiltre: null,      // né au rendu, tenu par référence
};

const EpEl = (balise, classe, texte) => {
	const n = document.createElement(balise);
	if (classe) n.className = classe;
	if (texte !== undefined && texte !== null) n.textContent = texte;
	return n;
};

const EpListe = (v) => (Array.isArray(v) ? v : []);

/** [r, g, b] (0..1) -> "#rrggbb" */
function EpHex(t) {
	const c = EpListe(t);
	const h = (x) => Math.round(Math.max(0, Math.min(1, Number(x) || 0)) * 255).toString(16).padStart(2, "0");
	return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}

/** "#rrggbb" -> [r, g, b] (0..1) */
function EpRgb(hex) {
	const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ""));
	if (!m) return null;
	return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

function EpEnvoyer(nom, ...args) {
	if (typeof Events !== "undefined") Events.Call(nom, ...args);
}

// ── Une ligne de réglage ──────────────────────────────────────────────────────

/** Les trois contrôles d'un repère : couleur, taille, visible, et « Rendre ». */
function EpControles(portee, cle, style, perso, edition, avecCouleur = true) {
	const e = EPNJ.etat || {};
	const s = style || {};
	const boite = EpEl("div", "ep-controles");

	const envoyer = (couleur, taille, visible) => {
		const rgb = couleur ? EpRgb(couleur) : null;
		EpEnvoyer("NarvosEditionPnj:Definir", portee, cle,
			rgb ? rgb[0] : null, rgb ? rgb[1] : null, rgb ? rgb[2] : null,
			taille === null ? null : Number(taille), visible);
	};

	if (avecCouleur) {
		const couleur = document.createElement("input");
		couleur.type = "color";
		couleur.className = "ep-couleur";
		couleur.value = EpHex(s.teinte);
		couleur.disabled = !edition;
		couleur.title = "Couleur sur le radar";
		// « change » et non « input » : un aller-retour serveur par cran de la
		// pipette saturerait le fil et la persistance.
		couleur.addEventListener("change", () => envoyer(couleur.value, null, null));
		boite.append(couleur);
	}

	const taille = document.createElement("input");
	taille.type = "range";
	taille.className = "ep-taille";
	taille.min = String(e.taille_min ?? 1);
	taille.max = String(e.taille_max ?? 10);
	taille.step = "0.5";
	taille.value = String(s.taille ?? 3);
	taille.disabled = !edition;
	taille.title = "Taille du repère";
	const valeur = EpEl("span", "ep-taille-valeur", String(s.taille ?? 3));
	taille.addEventListener("input", () => { valeur.textContent = taille.value; });
	taille.addEventListener("change", () => envoyer(null, taille.value, null));
	boite.append(taille, valeur);

	const visible = document.createElement("button");
	visible.type = "button";
	visible.className = "ep-visible";
	visible.setAttribute("aria-pressed", s.visible === false ? "false" : "true");
	visible.textContent = s.visible === false ? "masqué" : "visible";
	visible.disabled = !edition;
	visible.addEventListener("click", () => envoyer(null, null, s.visible === false));
	boite.append(visible);

	if (perso) {
		const rendre = document.createElement("button");
		rendre.type = "button";
		rendre.className = "ep-rendre";
		rendre.textContent = "Rendre";
		rendre.disabled = !edition;
		rendre.title = "Retirer ce réglage (retour au défaut)";
		rendre.addEventListener("click", () => EpEnvoyer("NarvosEditionPnj:Reinitialiser", portee, cle));
		boite.append(rendre);
	}
	return boite;
}

// ── Les onglets ───────────────────────────────────────────────────────────────

function EpLignePnj(p, edition) {
	const li = EpEl("li", "ep-ligne");
	li.dataset.texture = p.texture;

	const pastille = EpEl("span", "ep-pastille");
	pastille.style.background = EpHex(p.style && p.style.teinte);
	li.append(pastille);

	const ident = EpEl("div", "ep-ident");
	ident.append(EpEl("span", "ep-nom", p.label || p.id));
	ident.append(EpEl("span", "ep-id", `${p.id} · ${p.role || "—"}${p.famille ? " · " + p.famille : ""}`));
	li.append(ident);

	const diag = EpEl("div", "ep-diag");
	const ok = p.texture === "ok";
	diag.append(EpEl("span", `ep-badge ep-badge--${ok ? "ok" : p.texture === "erreur" ? "erreur" : "inconnu"}`,
		ok ? "OK" : p.texture === "erreur" ? "ERREUR" : "?"));
	if (p.translucide) diag.append(EpEl("span", "ep-badge ep-badge--translucide", "translucide"));
	if (!ok && p.texture_raison) diag.append(EpEl("span", "ep-raison", p.texture_raison));
	li.append(diag);

	li.append(EpControles("pnj", p.id, p.style, p.perso, edition));
	return li;
}

function RendreEditionPnj() {
	const e = EPNJ.etat;
	const corps = $("ep-corps");
	const bilan = $("ep-bilan");
	const verrou = $("ep-verrou");
	const message = $("ep-message");
	if (!corps) return;
	corps.replaceChildren();
	if (!e) {
		corps.append(EpEl("p", "vide", "Chargement…"));
		return;
	}
	const edition = e.edition === true;
	if (verrou) verrou.hidden = edition;
	if (message) {
		message.textContent = e.message || "";
		message.dataset.ton = String(e.message || "").startsWith("Refus") ? "refus" : "fait";
	}
	if (bilan && e.bilan) {
		bilan.textContent = `${e.bilan.total} PNJ · ${e.bilan.erreurs} en erreur · ${e.bilan.translucides} translucide(s)`;
	}

	// Onglets : trois boutons, l'actif se lit par son trait.
	const onglets = EpEl("nav", "ep-onglets");
	for (const [id, libelle] of [["pnj", "PNJ"], ["types", "Rôles et sortes"], ["animaux", "Animaux"]]) {
		const b = EpEl("button", "ep-onglet", libelle);
		b.type = "button";
		b.setAttribute("aria-selected", EPNJ.onglet === id ? "true" : "false");
		b.addEventListener("click", () => { EPNJ.onglet = id; RendreEditionPnj(); });
		onglets.append(b);
	}
	corps.append(onglets);

	if (EPNJ.onglet === "pnj") {
		const outils = EpEl("div", "ep-outils");
		const filtre = document.createElement("input");
		filtre.type = "search";
		filtre.className = "ep-filtre";
		filtre.placeholder = "Filtrer (nom, id, rôle, famille)";
		filtre.value = EPNJ.filtre;
		filtre.addEventListener("input", () => { EPNJ.filtre = filtre.value; RendreListePnj(); });
		EPNJ.champFiltre = filtre;
		const seules = EpEl("button", "ep-bascule", "Erreurs seulement");
		seules.type = "button";
		seules.setAttribute("aria-pressed", EPNJ.erreursSeules ? "true" : "false");
		seules.addEventListener("click", () => { EPNJ.erreursSeules = !EPNJ.erreursSeules; RendreEditionPnj(); });
		outils.append(filtre, seules);
		corps.append(outils);
		const liste = EpEl("ol", "ep-liste");
		liste.dataset.liste = "pnj";
		corps.append(liste);
		RendreListePnj();
		// Le rendu recrée le champ : le curseur y revient, sinon taper une lettre
		// ferait perdre le focus à chaque frappe.
		if (EPNJ.filtre) { filtre.focus(); filtre.setSelectionRange(filtre.value.length, filtre.value.length); }
		return;
	}

	const liste = EpEl("ol", "ep-liste");
	if (EPNJ.onglet === "types") {
		liste.append(EpEl("li", "ep-intertitre", "Sortes de repères"));
		for (const s of EpListe(e.sortes)) liste.append(EpLigneType("sorte", s, edition, s.id !== "portail"));
		liste.append(EpEl("li", "ep-intertitre", "Rôles de PNJ"));
		for (const r of EpListe(e.roles)) liste.append(EpLigneType("role", r, edition, true));
	} else {
		for (const a of EpListe(e.animaux)) liste.append(EpLigneType("animal", a, edition, true));
	}
	corps.append(liste);
}

function EpLigneType(portee, t, edition, avecCouleur) {
	const li = EpEl("li", "ep-ligne ep-ligne--type");
	const pastille = EpEl("span", "ep-pastille");
	pastille.style.background = EpHex(t.style && t.style.teinte);
	li.append(pastille);
	const ident = EpEl("div", "ep-ident");
	ident.append(EpEl("span", "ep-nom", t.label || t.id));
	ident.append(EpEl("span", "ep-id", t.id));
	li.append(ident);
	li.append(EpEl("div", "ep-diag"));
	li.append(EpControles(portee, t.id, t.style, t.perso, edition, avecCouleur));
	return li;
}

function RendreListePnj() {
	const e = EPNJ.etat;
	const liste = document.querySelector("#ep-corps [data-liste='pnj']");
	if (!e || !liste) return;
	liste.replaceChildren();
	const f = EPNJ.filtre.trim().toLowerCase();
	let n = 0;
	for (const p of EpListe(e.entrees)) {
		if (EPNJ.erreursSeules && p.texture === "ok" && !p.translucide) continue;
		if (f) {
			const texte = `${p.label} ${p.id} ${p.role} ${p.famille || ""}`.toLowerCase();
			if (!texte.includes(f)) continue;
		}
		liste.append(EpLignePnj(p, e.edition === true));
		n += 1;
	}
	if (n === 0) liste.append(EpEl("li", "vide", "Aucun PNJ ne correspond."));
}

// ── Pont Lua ──────────────────────────────────────────────────────────────────

RENDUS.editionpnj = () => {
	EpEnvoyer("NarvosEditionPnj:Demander");
	RendreEditionPnj();
};

if (typeof Events !== "undefined") {
	Events.Subscribe("NarvosEditionPnj:Etat", (etat) => {
		if (!etat || typeof etat !== "object") return;
		EPNJ.etat = etat;
		if (ETAT.ouvert === "editionpnj") RendreEditionPnj();
	});
}
