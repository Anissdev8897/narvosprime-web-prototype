// ══════════════════════════════════════════════════════════════════════════════
// NARVOS — l'inventaire (touche I), d'après la maquette « Inventaire NARVOS ».
//
// Maquette : onglets par catégorie, emplacements d'équipement autour du
// personnage, statistiques avec écart à l'équipé, grille filtrable (recherche,
// tri, rareté), fiche détaillée et actions, notifications. Elle simulait ses
// données ; ici tout vient du SAC RÉEL (Server/Index.lua → Logic/InventaireVue.lua)
// et chaque action repart au serveur, qui revalide :
//   page -> Lua   NarvosInventaire:Equiper(uid) · :Desequiper(slot) · :Utiliser(uid)
//                 :Jeter(uid) · :Detruire(uid) · NarvosRoue:Assigner(e, item_id)
//   Lua -> page   NarvosInventaire (vue, via index.js) · NarvosInventaireRetour(texte, ton)
//
// ⚠ ONGLET APPARENCE (2026-09-14) — « un seul menu d'équipement en jeu ». Le
// MetaHuman s'habille ici (vêtements, coiffure, visage, peau, yeux, corps), par
// l'éditeur du Meta Customization System DÉJÀ employé à la création
// (mcs-editeur.js). Aucun second éditeur, aucun panneau MetaHuman séparé.
//   page -> Lua   NarvosApparence:Ouvrir · :Quitter · :Changer(json) · :GardeRobe
//   Lua -> page   NarvosApparence(données) · NarvosInventaireOnglet(id) (touche F8)
// ══════════════════════════════════════════════════════════════════════════════

const INV = {
	onglet: "equipement",
	recherche: "",
	tri: "rarete",
	rarete: "tout",
	selection: null,      // { uid } d'un objet du sac, ou { slot } d'un objet porté
	confirmer: null,      // action destructive en attente de second clic
	quantites: null,      // quantités précédentes par id, pour les notifications de butin
	apparence: null,      // { disponible, options, apparence, message, garde_robe } du serveur
	apparenceRendue: false, // l'éditeur affiché correspond-il aux dernières données ?
};

/** L'onglet de l'éditeur d'apparence : propre à la page, pas une catégorie du sac. */
const INV_ONGLET_APPARENCE = "apparence";

/** Change d'onglet et prévient le Lua quand on entre dans l'apparence ou qu'on la
 *  quitte : il cadre la caméra de face à l'entrée et rend la vue du joueur à la
 *  sortie. Les réglages, eux, ne bougent jamais la caméra. */
function InvChoisirOnglet(id) {
	if (id === INV.onglet) return;
	const quitte = INV.onglet === INV_ONGLET_APPARENCE;
	INV.onglet = id;
	INV.selection = null;
	if (quitte) invLua("NarvosApparence:Quitter");
	if (id === INV_ONGLET_APPARENCE) {
		INV.apparence = null;
		INV.apparenceRendue = false;
		invLua("NarvosApparence:Ouvrir");
	}
	RendreInventaireNarvos();
}

/** Appelée par index.js à la fermeture des panneaux : l'inventaire rouvre sur le sac. */
function InvSurFermeture() {
	INV.onglet = "equipement";
	INV.apparence = null;
	INV.apparenceRendue = false;
}

/** Raretés : libellés et couleurs de la maquette, clés du catalogue d'objets. */
const INV_RARETES = {
	normal:    { label: "NORMAL",     couleur: "#8495a3", rang: 0 },
	common:    { label: "COMMUN",     couleur: "#38e08a", rang: 1 },
	rare:      { label: "RARE",       couleur: "#4fd8ff", rang: 2 },
	epic:      { label: "ÉPIQUE",     couleur: "#a86bff", rang: 3 },
	legendary: { label: "LÉGENDAIRE", couleur: "#ffb52e", rang: 4 },
};
const INV_RARETES_ALIAS = {
	commun: "common", uncommon: "common", epique: "epic",
	legendaire: "legendary", mythic: "legendary",
};
const invRareteCanonique = (r) => INV_RARETES[r] ? r : (INV_RARETES_ALIAS[r] || "common");
const invRarete = (r) => INV_RARETES[invRareteCanonique(r)];

/** Statistiques affichées : clé de la vue du personnage, clé des stats d'objet. */
const INV_STATS = [
	{ cle: "vie_max",   objet: "maxHp",     label: "SANTÉ",     max: 1200, barre: "linear-gradient(90deg, #8a0a1c, #ff2d3f)" },
	{ cle: "mana_max",  objet: "maxMana",   label: "MANA",      max: 900,  barre: "linear-gradient(90deg, #14638f, #4fd8ff)" },
	{ cle: "puissance", objet: "puissance", label: "PUISSANCE", max: 400,  barre: "linear-gradient(90deg, #8a2a12, #ff8e5c)" },
	{ cle: "defense",   objet: "defense",   label: "DÉFENSE",   max: 300,  barre: "linear-gradient(90deg, #0b3f9e, #2f8dff)" },
	{ cle: "critique",  objet: "critique",  label: "CRITIQUE",  max: 100,  barre: "linear-gradient(90deg, #8a6a12, #ffd23f)" },
	{ cle: "vitesse",   objet: "vitesse",   label: "VITESSE",   max: 2,    barre: "linear-gradient(90deg, #0d6b4a, #38e08a)" },
];

const INV_LIBELLES_STATS = {
	attackPower: "ATTAQUE", puissance: "PUISSANCE", defense: "DÉFENSE", maxHp: "SANTÉ",
	critique: "CRITIQUE", vitesse: "VITESSE", maxMana: "MANA",
};

/** Place de chaque emplacement du modèle autour du personnage (colonne, rang). */
const INV_PLACES = {
	helmet: ["G", 0], armor: ["G", 1], legs: ["G", 2],
	accessory: ["D", 0],
	weapon: ["B", 0], offhand: ["B", 1],
};

const invEl = (tag, classe, texte) => {
	const n = document.createElement(tag);
	if (classe) n.className = classe;
	if (texte !== undefined && texte !== null) n.textContent = texte;
	return n;
};
const invLua = (nom, ...args) => { if (typeof Events !== "undefined") Events.Call(nom, ...args); };
const invNombre = (v) => (typeof v === "number" ? v.toLocaleString("fr-FR") : "—");

// ── Vignettes 3D (2026-09-15) ────────────────────────────────────────────────
// « Une impression 3D en 2D pour chaque arme ou consommable » (Hanibes). Chaque
// objet qui porte un mesh (`o.mesh`) est PHOTOGRAPHIÉ par le client
// (Client/VignettesObjets.lua) : PNG à fond transparent, que la page détoure et
// recadre sur l'objet (InvDetourer). En attendant la photo, la vignette pulse ;
// si la photo est impossible, repli sur le rendu livré par nanos (`o.vignette`,
// une photo sur fond de route), puis l'icône du catalogue, puis le code texte.
const INV_VIGNETTES = new Map();   // mesh -> URL data: détourée | "" (photo impossible)
const INV_DEMANDEES = new Set();   // meshes demandés au Lua, réponse attendue
let INV_A_DEMANDER = [];
let INV_ENVOI_PREVU = false;
/** Côté de la vignette détourée, en pixels (la plus grande affichée : la fiche). */
const INV_COTE_VIGNETTE = 256;
/** Délai de secours d'une photo, par rang dans la file (le Lua photographie un
 *  objet toutes les ~0,6 s) : sans réponse, la vignette passe au repli. */
const INV_DELAI_PHOTO_MS = 20000;
const INV_DELAI_PAR_RANG_MS = 1200;

/** Une chaîne base64 du moteur -> URL data: (le type se lit à la signature). */
function invUrlImage(image) {
	if (typeof image !== "string" || image === "") return "";
	if (image.startsWith("data:")) return image;
	const type = image.startsWith("iVBOR") ? "png" : image.startsWith("Qk") ? "bmp" : "jpeg";
	return `data:image/${type};base64,${image}`;
}

function invChargerImage(url) {
	return new Promise((ok, ko) => {
		const img = new Image();
		img.onload = () => ok(img);
		img.onerror = ko;
		img.src = url;
	});
}

/**
 * Forme de la couche alpha d'une photo, lue sur ses coins :
 *   "normal"  coins transparents — l'alpha est l'opacité (rendu « acteurs seuls ») ;
 *   "inverse" coins opaques mais pixels transparents ailleurs — 255 - alpha
 *             (convention Unreal « Inv Opacity in A ») ;
 *   "aucun"   tout opaque (JPEG) — l'objet se lit à l'écart de couleur aux coins.
 */
function invModeAlpha(d, w, h) {
	const coins = [0, w - 1, (h - 1) * w, h * w - 1].map((p) => d[p * 4 + 3]);
	if (coins.every((a) => a < 16)) return "normal";
	for (let i = 3; i < d.length; i += 28) if (d[i] < 240) return "inverse";
	return "aucun";
}

/** Opacité de chaque pixel selon le mode, dans un tableau à part. */
function invOpacites(d, w, h, mode) {
	const op = new Uint8ClampedArray(w * h);
	const fond = [d[0], d[1], d[2]];
	for (let p = 0, i = 0; p < op.length; p++, i += 4) {
		if (mode === "normal") op[p] = d[i + 3];
		else if (mode === "inverse") op[p] = 255 - d[i + 3];
		else {
			const e = Math.max(Math.abs(d[i] - fond[0]), Math.abs(d[i + 1] - fond[1]), Math.abs(d[i + 2] - fond[2]));
			op[p] = e <= 6 ? 0 : e >= 24 ? 255 : Math.round((e - 6) * 255 / 18);
		}
	}
	return op;
}

/**
 * Détoure une photo d'objet et la recadre au carré, objet centré avec une marge.
 * Rend "" si rien n'est visible (photo ratée : mesh vide, hors cadre).
 */
async function InvDetourer(url, cote) {
	const img = await invChargerImage(url);
	const w = img.naturalWidth, h = img.naturalHeight;
	if (!w || !h) return "";
	const source = document.createElement("canvas");
	source.width = w; source.height = h;
	const g = source.getContext("2d", { willReadFrequently: true });
	g.drawImage(img, 0, 0);
	const pixels = g.getImageData(0, 0, w, h);
	const d = pixels.data;
	let mode = invModeAlpha(d, w, h);
	let op = invOpacites(d, w, h, mode);
	let boite = invBoiteOpaque(op, w, h);
	// Alpha présent mais vide partout : le moteur n'a pas écrit l'opacité.
	if (!boite && mode !== "aucun") { mode = "aucun"; op = invOpacites(d, w, h, mode); boite = invBoiteOpaque(op, w, h); }
	if (!boite) return "";
	for (let p = 0; p < op.length; p++) d[p * 4 + 3] = op[p];
	g.putImageData(pixels, 0, 0);
	const larg = boite.x1 - boite.x0 + 1, haut = boite.y1 - boite.y0 + 1;
	const cadre = Math.max(larg, haut) * 1.14;
	const sortie = document.createElement("canvas");
	sortie.width = sortie.height = cote;
	const s = sortie.getContext("2d");
	s.imageSmoothingQuality = "high";
	const echelle = cote / cadre;
	s.drawImage(source, boite.x0, boite.y0, larg, haut,
		(cote - larg * echelle) / 2, (cote - haut * echelle) / 2, larg * echelle, haut * echelle);
	return sortie.toDataURL("image/png");
}

/** Plus petit rectangle contenant les pixels nettement opaques, ou null. */
function invBoiteOpaque(op, w, h) {
	let x0 = w, y0 = h, x1 = -1, y1 = -1;
	for (let y = 0; y < h; y++) {
		const ligne = y * w;
		for (let x = 0; x < w; x++) {
			if (op[ligne + x] <= 24) continue;
			if (x < x0) x0 = x;
			if (x > x1) x1 = x;
			if (y < y0) y0 = y;
			y1 = y;
		}
	}
	return x1 < 0 ? null : { x0, y0, x1, y1 };
}

function InvDemanderVignettes() {
	INV_ENVOI_PREVU = false;
	const liste = [...new Set(INV_A_DEMANDER)].filter((m) => !INV_VIGNETTES.has(m) && !INV_DEMANDEES.has(m));
	INV_A_DEMANDER = [];
	if (liste.length === 0) return;
	const rang = INV_DEMANDEES.size;
	liste.forEach((m, i) => {
		INV_DEMANDEES.add(m);
		setTimeout(() => {
			if (INV_DEMANDEES.has(m) && !INV_VIGNETTES.has(m)) InvConclureVignette(m, "");
		}, INV_DELAI_PHOTO_MS + (rang + i) * INV_DELAI_PAR_RANG_MS);
	});
	invLua("NarvosVignettes:Demander", JSON.stringify(liste));
}

/** Range le résultat d'une photo et met à jour les vignettes affichées de ce mesh. */
function InvConclureVignette(mesh, url) {
	INV_DEMANDEES.delete(mesh);
	INV_VIGNETTES.set(mesh, url);
	document.querySelectorAll(".inv-vignette[data-mesh]").forEach((boite) => {
		if (boite.dataset.mesh === mesh) InvRemplirVignette(boite);
	});
}

/** Image d'une vignette ; si elle ne charge pas, le code texte revient. */
function invImageVignette(src, classe, repli) {
	const img = invEl("img", classe);
	img.alt = "";
	img.draggable = false;
	repli.hidden = true;
	img.addEventListener("error", () => { img.remove(); repli.hidden = false; });
	img.src = src;
	return img;
}

/** (Re)construit le contenu d'une vignette selon l'état de la photo de son mesh. */
function InvRemplirVignette(boite) {
	const o = boite._objet || {};
	const repli = invEl("span", "inv-vignette-repli", o.icone || (o.nom || "?").slice(0, 3).toUpperCase());
	boite.replaceChildren(repli);
	const photo = o.mesh ? INV_VIGNETTES.get(o.mesh) : "";
	boite.classList.toggle("inv-vignette--attente", photo === undefined);
	boite.classList.toggle("inv-vignette--photo", !!photo);
	if (photo) {
		boite.append(invImageVignette(photo, "inv-vignette-3d", repli));
		return;
	}
	if (photo === undefined) {
		boite.dataset.mesh = o.mesh;
		INV_A_DEMANDER.push(o.mesh);
		if (!INV_ENVOI_PREVU) { INV_ENVOI_PREVU = true; queueMicrotask(InvDemanderVignettes); }
		return;
	}
	if (o.vignette) {
		boite.append(invImageVignette(o.vignette, "inv-vignette-livree", repli));
	} else if (o.iconFile) {
		boite.append(invImageVignette(`img/items/${o.iconFile}.webp`, "", repli));
	}
}

function InvVignette(o, classe) {
	const boite = invEl("span", `inv-vignette ${classe || ""}`);
	boite._objet = o;
	if (o.mesh) boite.dataset.mesh = o.mesh;
	InvRemplirVignette(boite);
	return boite;
}

function InvVue() {
	return (typeof ETAT !== "undefined" && ETAT.inventaire) || {};
}

function InvSelectionne() {
	const v = InvVue();
	if (!INV.selection) return null;
	if (INV.selection.slot) {
		const e = (v.emplacements || []).find((x) => x.slot === INV.selection.slot);
		return e && e.porte ? { ...e.porte, porte: true, slot_porte: e.slot } : null;
	}
	return (v.objets || []).find((o) => o.uid === INV.selection.uid) || null;
}

// ── Barre du haut ────────────────────────────────────────────────────────────

function InvRendreBarre() {
	const v = InvVue();
	const nav = $("inv-onglets");
	if (!nav) return;
	nav.replaceChildren();
	for (const o of v.onglets || []) {
		const b = invEl("button", "inv-onglet");
		b.type = "button";
		b.setAttribute("aria-selected", o.id === INV.onglet ? "true" : "false");
		b.append(invEl("span", null, o.label), invEl("b", null, String(o.compte ?? 0)));
		b.addEventListener("click", () => InvChoisirOnglet(o.id));
		nav.append(b);
	}
	const app = invEl("button", "inv-onglet inv-onglet--apparence");
	app.type = "button";
	app.setAttribute("aria-selected", INV.onglet === INV_ONGLET_APPARENCE ? "true" : "false");
	app.append(invEl("span", null, "APPARENCE"));
	app.addEventListener("click", () => InvChoisirOnglet(INV_ONGLET_APPARENCE));
	nav.append(app);
	$("inv-credits").textContent = invNombre(v.credits ?? 0);
}

// ── Personnage : emplacements et statistiques ────────────────────────────────

function InvRendrePerso() {
	const v = InvVue();
	const st = v.statistiques || null;
	const niveau = (typeof PROGRESSION !== "undefined" && PROGRESSION.vue && PROGRESSION.vue.fiche) ? PROGRESSION.vue.fiche.niveau : null;
	$("inv-niveau").textContent = niveau ? `NIV. ${niveau}` : "";

	const slots = $("inv-slots");
	slots.replaceChildren();
	for (const e of v.emplacements || []) {
		const [col, rang] = INV_PLACES[e.slot] || ["D", 1];
		const li = invEl("li", "inv-slot");
		li.dataset.col = col;
		li.style.setProperty("--rang", rang);
		const choisi = INV.selection && INV.selection.slot === e.slot;
		li.setAttribute("aria-selected", choisi ? "true" : "false");
		if (e.porte) {
			li.style.setProperty("--rarete", invRarete(e.porte.rarete).couleur);
			li.append(InvVignette(e.porte, "inv-slot-vignette"));
		} else {
			li.append(invEl("span", "inv-slot-vide"));
		}
		const texte = invEl("span", "inv-slot-texte");
		texte.append(invEl("small", null, (e.label || e.slot).toUpperCase()), invEl("b", null, e.porte ? e.porte.nom : "Vide"));
		li.append(texte);
		li.addEventListener("click", () => {
			INV.selection = e.porte ? { slot: e.slot } : null;
			INV.confirmer = null;
			RendreInventaireNarvos();
		});
		slots.append(li);
	}

	// Statistiques, avec l'écart qu'apporterait l'objet sélectionné à son emplacement.
	const sel = InvSelectionne();
	const porteMeme = sel && sel.slot && !sel.porte
		? ((v.emplacements || []).find((x) => x.slot === sel.slot) || {}).porte : null;
	const grille = $("inv-stats");
	grille.replaceChildren();
	for (const s of INV_STATS) {
		const valeur = st ? Number(st[s.cle] || 0) : 0;
		const bloc = invEl("div", "inv-stat");
		const ligne = invEl("div", "inv-stat-ligne");
		ligne.append(invEl("span", null, s.label));
		const val = invEl("span", "inv-stat-valeur", st ? (s.cle === "vitesse" ? `×${(Math.round(valeur * 100) / 100)}` : invNombre(valeur)) : "—");
		if (sel && sel.slot && !sel.porte) {
			const d = Number((sel.stats || {})[s.objet] || 0) - Number(((porteMeme && porteMeme.stats) || {})[s.objet] || 0);
			if (d !== 0) {
				const delta = invEl("em", d > 0 ? "plus" : "moins", `${d > 0 ? "+" : ""}${d}`);
				val.append(delta);
			}
		}
		ligne.append(val);
		const barre = invEl("div", "inv-stat-barre");
		const plein = invEl("span");
		plein.style.width = `${Math.max(2, Math.min(100, (valeur / s.max) * 100))}%`;
		plein.style.background = s.barre;
		barre.append(plein);
		bloc.append(ligne, barre);
		grille.append(bloc);
	}
	$("inv-charge").textContent = `CHARGE ${String(v.poids ?? 0).replace(".", ",")} KG`;
}

// ── Le sac : filtres et grille ───────────────────────────────────────────────

function InvListe() {
	const v = InvVue();
	const q = INV.recherche.trim().toLowerCase();
	const liste = (v.objets || []).filter((o) => {
		if (o.onglet !== INV.onglet) return false;
		if (INV.rarete !== "tout" && invRareteCanonique(o.rarete) !== INV.rarete) return false;
		if (q && !`${o.nom} ${o.type || ""} ${o.description || ""}`.toLowerCase().includes(q)) return false;
		return true;
	});
	const tris = {
		rarete: (a, b) => invRarete(b.rarete).rang - invRarete(a.rarete).rang || a.nom.localeCompare(b.nom),
		type: (a, b) => String(a.type || "").localeCompare(String(b.type || "")) || a.nom.localeCompare(b.nom),
		niveau: (a, b) => (b.niveau || 0) - (a.niveau || 0),
		poids: (a, b) => (b.poids || 0) * (b.quantite || 1) - (a.poids || 0) * (a.quantite || 1),
	};
	return liste.sort(tris[INV.tri] || tris.rarete);
}

function InvRendreFiltres() {
	const tris = $("inv-tris");
	tris.replaceChildren();
	for (const [id, label] of [["rarete", "RARETÉ"], ["type", "TYPE"], ["niveau", "NIVEAU"], ["poids", "POIDS"]]) {
		const b = invEl("button", "inv-puce", label);
		b.type = "button";
		b.setAttribute("aria-pressed", INV.tri === id ? "true" : "false");
		b.addEventListener("click", () => { INV.tri = id; InvRendreGrille(); InvRendreFiltres(); });
		tris.append(b);
	}
	const raretes = $("inv-raretes");
	raretes.replaceChildren(invEl("span", "inv-etiquette", "RARETÉ"));
	for (const id of ["tout", ...Object.keys(INV_RARETES)]) {
		const r = id === "tout" ? { label: "TOUT", couleur: "#4fd8ff" } : INV_RARETES[id];
		const b = invEl("button", "inv-puce inv-puce--rarete", r.label);
		b.type = "button";
		b.style.setProperty("--rarete", r.couleur);
		b.setAttribute("aria-pressed", INV.rarete === id ? "true" : "false");
		b.addEventListener("click", () => { INV.rarete = id; InvRendreGrille(); InvRendreFiltres(); });
		raretes.append(b);
	}
}

function InvRendreGrille() {
	const v = InvVue();
	const grille = $("inv-grille");
	grille.replaceChildren();
	const liste = InvListe();
	for (const o of liste) {
		const carte = invEl("button", "inv-carte");
		carte.type = "button";
		carte.style.setProperty("--rarete", invRarete(o.rarete).couleur);
		const choisi = INV.selection && INV.selection.uid === o.uid;
		carte.setAttribute("aria-selected", choisi ? "true" : "false");
		if ((o.quantite || 1) > 1) carte.append(invEl("span", "inv-carte-qte", `×${o.quantite}`));
		carte.append(InvVignette(o, "inv-carte-vignette"), invEl("span", "inv-carte-nom", o.nom),
			invEl("span", "inv-carte-meta", o.slot || o.arme ? `NIV ${o.niveau ?? 1}` : (o.type || o.categorie || "").toString().toUpperCase()));
		carte.addEventListener("click", () => {
			INV.selection = { uid: o.uid };
			INV.confirmer = null;
			RendreInventaireNarvos();
		});
		grille.append(carte);
	}
	// Cases vides jusqu'à 7 rangées, comme la maquette : la grille garde sa forme.
	const total = Math.max(42, Math.ceil(liste.length / 6) * 6);
	for (let i = liste.length; i < total; i++) grille.append(invEl("span", "inv-case-vide"));
	if (liste.length === 0) {
		const vide = invEl("p", "inv-grille-vide", (v.objets || []).length === 0
			? "Sac vide. Récolte, butin et marchands remplissent l'inventaire."
			: "Aucun objet dans cet onglet avec ces filtres.");
		grille.prepend(vide);
	}
	$("inv-capacite").textContent = `${v.cellules ?? 0} / ${v.max ?? 0} EMPLACEMENTS`;
	$("inv-jauge").style.width = `${v.max ? Math.min(100, ((v.cellules || 0) / v.max) * 100) : 0}%`;
}

// ── Fiche et actions ─────────────────────────────────────────────────────────

function InvAction(label, classe, geste, confirmation) {
	const b = invEl("button", `inv-action ${classe || ""}`, INV.confirmer === label ? "CONFIRMER ?" : label);
	b.type = "button";
	b.addEventListener("click", () => {
		if (confirmation && INV.confirmer !== label) { INV.confirmer = label; InvRendreDetail(); return; }
		INV.confirmer = null;
		geste();
	});
	return b;
}

function InvRendreDetail() {
	const zone = $("inv-detail");
	zone.replaceChildren();
	const o = InvSelectionne();
	if (!o) {
		const vide = invEl("div", "inv-detail-vide");
		vide.append(invEl("i", "inv-losange"), invEl("b", null, "SÉLECTIONNEZ UN OBJET"),
			invEl("p", null, "Clic pour inspecter · les emplacements du personnage montrent ce qui est porté."));
		zone.append(vide);
		return;
	}
	const r = invRarete(o.rarete);
	zone.style.setProperty("--rarete", r.couleur);

	const tete = invEl("header", "inv-detail-tete");
	const titre = invEl("div", "inv-detail-titre");
	titre.append(invEl("b", null, o.nom));
	const sous = invEl("span");
	sous.append(invEl("em", null, r.label), document.createTextNode(` · ${String(o.type || o.categorie || "objet").toUpperCase()}`));
	titre.append(sous);
	tete.append(InvVignette(o, "inv-detail-vignette"), titre);

	const badges = invEl("div", "inv-badges");
	for (const [k, val] of [["NIV. OBJ", o.niveau ?? 1], ["QUANTITÉ", o.porte ? 1 : (o.quantite ?? 1)],
		["POIDS", `${o.poids ?? 0} kg`], ["VALEUR", invNombre(o.valeur ?? 0)]]) {
		const b = invEl("div", "inv-badge");
		b.append(invEl("small", null, k), invEl("b", null, String(val)));
		badges.append(b);
	}

	const corps = invEl("div", "inv-detail-corps");
	corps.append(invEl("p", "inv-description", o.description || "—"));

	const cles = Object.keys(o.stats || {});
	if (cles.length > 0) {
		const v = InvVue();
		const porte = o.slot && !o.porte ? ((v.emplacements || []).find((x) => x.slot === o.slot) || {}).porte : null;
		corps.append(invEl("h4", null, porte ? "STATISTIQUES · COMPARÉ À L'ÉQUIPÉ" : "STATISTIQUES"));
		for (const k of cles) {
			const ligne = invEl("div", "inv-detail-stat");
			ligne.append(invEl("span", null, INV_LIBELLES_STATS[k] || k.toUpperCase()), invEl("b", null, String(o.stats[k])));
			if (porte) {
				const d = Number(o.stats[k] || 0) - Number((porte.stats || {})[k] || 0);
				if (d !== 0) ligne.append(invEl("em", d > 0 ? "plus" : "moins", `${d > 0 ? "+" : ""}${d}`));
			}
			corps.append(ligne);
		}
		if (porte) {
			const actuel = invEl("div", "inv-actuel");
			actuel.append(invEl("small", null, "ACTUELLEMENT ÉQUIPÉ"), invEl("b", null, porte.nom));
			corps.append(actuel);
		}
	}

	const compat = invEl("div", "inv-compat");
	const lib = o.slot
		? `Emplacement : ${(((InvVue().emplacements || []).find((x) => x.slot === o.slot) || {}).label || o.slot)}`
		: (o.arme ? "Arme : se prend en main" : (o.utilisable ? "Consommable" : "Ne s'équipe pas"));
	compat.append(invEl("small", null, "COMPATIBILITÉ"), invEl("b", null, lib));
	corps.append(compat);

	const actions = invEl("div", "inv-actions");
	if (o.porte) {
		actions.append(InvAction("DÉSÉQUIPER", "primaire", () => invLua("NarvosInventaire:Desequiper", o.slot_porte)));
	} else {
		if (o.equipable) actions.append(InvAction("ÉQUIPER", "primaire", () => invLua("NarvosInventaire:Equiper", o.uid)));
		if (o.arme) actions.append(InvAction("PRENDRE EN MAIN", o.equipable ? "" : "primaire", () => invLua("NarvosInventaire:Utiliser", o.uid)));
		if (o.utilisable) actions.append(InvAction("UTILISER", "primaire", () => invLua("NarvosInventaire:Utiliser", o.uid)));
		if (o.arme || o.utilisable) {
			const roue = invEl("div", "inv-roue");
			roue.append(invEl("small", null, "ROUE (TAB)"));
			for (let e = 1; e <= 5; e++) {
				const b = invEl("button", "inv-roue-case", String(e));
				b.type = "button";
				b.title = `Assigner à l'emplacement ${e} de la roue`;
				b.addEventListener("click", () => invLua("NarvosRoue:Assigner", e, o.id));
				roue.append(b);
			}
			actions.append(roue);
		}
		actions.append(InvAction("JETER", "danger", () => invLua("NarvosInventaire:Jeter", o.uid), true));
		if ((o.quantite || 1) > 1) actions.append(InvAction("DÉTRUIRE LA PILE", "danger", () => invLua("NarvosInventaire:Detruire", o.uid), true));
	}

	zone.append(tete, badges, corps, actions);
}

// ── Notifications ────────────────────────────────────────────────────────────

function InvToast(genre, texte, couleur) {
	const pile = $("inv-toasts");
	if (!pile) return;
	const t = invEl("div", "inv-toast");
	t.style.setProperty("--rarete", couleur || "#4fd8ff");
	t.append(invEl("small", null, genre), invEl("b", null, texte));
	pile.append(t);
	setTimeout(() => t.remove(), 3600);
}

/** Butin : compare les quantités par objet à l'envoi précédent. */
function InvDetecterButin() {
	const v = InvVue();
	const actuelles = new Map();
	for (const o of v.objets || []) actuelles.set(o.id, (actuelles.get(o.id) || 0) + (o.quantite || 1));
	if (INV.quantites) {
		for (const [id, q] of actuelles) {
			const avant = INV.quantites.get(id) || 0;
			if (q > avant) {
				const o = (v.objets || []).find((x) => x.id === id);
				InvToast("OBJET RÉCUPÉRÉ", `${o ? o.nom : id} +${q - avant}`, o ? invRarete(o.rarete).couleur : null);
			}
		}
	}
	INV.quantites = actuelles;
}

// ── Apparence : l'éditeur du Meta Customization System ──────────────────────

function InvRendreApparence() {
	const hote = $("inv-apparence");
	if (!hote || INV.apparenceRendue) return;
	INV.apparenceRendue = true;
	hote.replaceChildren();
	const d = INV.apparence;

	const tete = invEl("header", "inv-apparence-tete");
	tete.append(invEl("b", null, "APPARENCE"), invEl("span", null, "Vêtements · coiffure · visage · corps"));
	hote.append(tete);

	if (!d) {
		hote.append(invEl("p", "inv-apparence-note", "Chargement de l'apparence…"));
		return;
	}
	if (!d.disponible) {
		const note = invEl("div", "inv-apparence-note");
		note.append(invEl("p", null, d.message || "Apparence indisponible."));
		if (d.garde_robe) {
			const b = invEl("button", "inv-action", "OUVRIR LA GARDE-ROBE");
			b.type = "button";
			b.addEventListener("click", () => invLua("NarvosApparence:GardeRobe"));
			note.append(b);
		}
		hote.append(note);
		return;
	}
	if (typeof EditeurMCS === "undefined") {
		hote.append(invEl("p", "inv-apparence-note", "Éditeur d'apparence non chargé (mcs-editeur.js)."));
		return;
	}
	const zone = invEl("div", "inv-apparence-editeur");
	hote.append(zone);
	const ctx = {
		options: d.options,
		apparence: d.apparence,
		// Chaque geste part au serveur, qui normalise, montre et enregistre. La
		// page garde sa copie : elle ne se re-rend que sur un clic, jamais pendant
		// qu'une glissière est tirée (mcs-editeur.js, `emettre`).
		surChangement: (a, info) => {
			ctx.apparence = a;
			d.apparence = a;
			invLua("NarvosApparence:Changer", JSON.stringify(a));
			if (info && info.rerendre) EditeurMCS.rendre(zone, ctx);
		},
	};
	EditeurMCS.rendre(zone, ctx);
}

// ── Rendu ────────────────────────────────────────────────────────────────────

function RendreInventaireNarvos() {
	if (!$("inv-grille")) return;
	const racine = $("inventaire");
	const enApparence = INV.onglet === INV_ONGLET_APPARENCE;
	if (racine) racine.classList.toggle("inv--apparence", enApparence);
	const hoteApparence = $("inv-apparence");
	if (hoteApparence) hoteApparence.hidden = !enApparence;
	if (enApparence) {
		InvRendreBarre();
		InvRendreApparence();
		return;
	}
	// Une sélection qui a quitté le sac (utilisée, jetée, équipée) n'est plus montrée.
	if (INV.selection && !InvSelectionne()) INV.selection = null;
	InvRendreBarre();
	InvRendrePerso();
	InvRendreFiltres();
	InvRendreGrille();
	InvRendreDetail();
}

document.addEventListener("DOMContentLoaded", () => {
	const champ = $("inv-recherche");
	if (champ) champ.addEventListener("input", () => { INV.recherche = champ.value; InvRendreGrille(); });
});

if (typeof Events !== "undefined") {
	Events.Subscribe("NarvosApparence", (donnees) => {
		if (!donnees) return;
		// Un retour d'enregistrement (échec) ne porte que son message.
		if (donnees.enregistre === false) {
			InvToast("APPARENCE", donnees.message || "Non enregistrée", "#ff5a68");
			return;
		}
		INV.apparence = donnees;
		INV.apparenceRendue = false;
		if (INV.onglet === INV_ONGLET_APPARENCE) RendreInventaireNarvos();
	});
	// Le personnage filmé par Client/ApercuInventaire.lua : un PNG base64 à fond
	// transparent. On ne remplace que la source de l'image — jamais le DOM du cadre,
	// que la vue de l'inventaire re-rend à chaque mise à jour du sac. La forme de
	// l'alpha est lue sur la PREMIÈRE image : sans alpha exploitable (JPEG, alpha
	// vide), le noir du fond s'efface par fusion « lighten », pas « screen » qui
	// rendait le personnage translucide.
	let apercuMode = null;
	Events.Subscribe("NarvosInventaireApercu", (image) => {
		const img = $("inv-apercu");
		const url = invUrlImage(image);
		if (!img || !url) return;
		const afficher = () => {
			img.src = url;
			if (img.hidden) {
				img.hidden = false;
				const attente = $("inv-apercu-attente");
				if (attente) attente.hidden = true;
			}
		};
		if (apercuMode !== null) { afficher(); return; }
		invChargerImage(url).then((charge) => {
			const c = document.createElement("canvas");
			c.width = charge.naturalWidth; c.height = charge.naturalHeight;
			const g = c.getContext("2d", { willReadFrequently: true });
			g.drawImage(charge, 0, 0);
			const d = g.getImageData(0, 0, c.width, c.height).data;
			apercuMode = invModeAlpha(d, c.width, c.height);
			// ⚠ Coins transparents ne veut pas dire alpha utilisable (vu en jeu le
			// 2026-09-15, EyeAdaptation coupé) : l'image entière peut porter alpha 0,
			// personnage compris — le cadre restait VIDE. Sans pixel opaque, on
			// traite l'image comme sans alpha.
			if (apercuMode === "normal" && !invBoiteOpaque(invOpacites(d, c.width, c.height, "normal"), c.width, c.height)) {
				apercuMode = "aucun";
			}
			img.classList.toggle("inv-apercu--sans-alpha", apercuMode !== "normal");
			afficher();
		}, () => {});
	});
	// Une vignette photographiée par Client/VignettesObjets.lua (image vide = photo impossible).
	Events.Subscribe("NarvosVignette", (mesh, image) => {
		if (typeof mesh !== "string") return;
		const url = invUrlImage(image);
		if (!url) { InvConclureVignette(mesh, ""); return; }
		InvDetourer(url, INV_COTE_VIGNETTE).then((detouree) => InvConclureVignette(mesh, detouree),
			() => InvConclureVignette(mesh, ""));
	});
	Events.Subscribe("NarvosInventaireOnglet", (id) => {
		if (typeof id === "string") InvChoisirOnglet(id);
	});
	Events.Subscribe("NarvosInventaireRetour", (texte, ton) => {
		if (ton === "erreur") { if (typeof Message === "function") Message(texte, "erreur"); }
		InvToast(ton === "erreur" ? "REFUSÉ" : "INVENTAIRE", texte, ton === "erreur" ? "#ff5a68" : null);
	});
}
