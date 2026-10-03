// ══════════════════════════════════════════════════════════════════════════════
// ateliers.js — props, invocations, réglages des commandes, barre de pouvoirs.
//
// Chargé APRÈS index.js, dans le même scope global : il consomme `$`, `ETAT`,
// `PANNEAUX` et `RENDUS` que celui-ci déclare. Séparé pour une raison simple :
// index.js porte l'inventaire, la fiche et le HUD vital ; ces trois panneaux-ci
// sont des outils, et les mêler ferait un fichier qu'on ne relit plus.
//
// ── LE CLIENT N'A AUCUNE AUTORITÉ ─────────────────────────────────────────────
// Rien n'est décidé ici. Un clic émet une INTENTION vers le Lua, qui la relaie
// au serveur, qui valide et renvoie l'état. C'est pour ça que les compteurs ne
// s'incrémentent pas au clic : ils attendent la réponse. Un compteur optimiste
// mentirait dès le premier refus (plafond atteint, cadence trop rapide).
// ══════════════════════════════════════════════════════════════════════════════

const ATELIER = {
	props: { categories: [], pieces: [], categorie: null, filtre: "", choisi: null, angle: 0 },
	spawn: { roles: [], entrees: [], role: null, filtre: "" },
	// Menu de TEST des armes (O) — retire quand le butin les distribuera.
	armes: { categories: [], armes: [], categorie: null, filtre: "", test: false },
	vehicules: { liste: [], vaisseaux: [], filtre: "tous", test: false },
	commandes: { actions: [], categories: [], ecoute: null },
	sorts: { barre: [], mana: 0, mana_max: 0 },
	garderobe: {
		slots: [], stock: {}, possede: [], porte: {}, credits: 0,
		slot: null, filtre: "",
	},
};

const Lua = (nom, ...args) => {
	if (typeof Events !== "undefined") Events.Call(nom, ...args);
};

// ── Messages courts ───────────────────────────────────────────────────────────

let minuteurMessage = null;

/** Affiche un message bref au-dessus du viseur.
 *
 *  Les refus du serveur (recharge, plafond, touche prise) DOIVENT se voir :
 *  sans ça, appuyer sur une touche qui ne répond pas se lit comme un bug du jeu
 *  et non comme une règle. */
function Message(texte, ton) {
	const boite = $("hud-message");
	if (!boite || !texte) return;

	boite.textContent = texte;
	boite.dataset.ton = ton || "info";
	boite.hidden = false;

	if (minuteurMessage) clearTimeout(minuteurMessage);
	minuteurMessage = setTimeout(() => { boite.hidden = true; }, 2600);
}

// ── Rail et listes ────────────────────────────────────────────────────────────

/** Construit un rail de catégories.
 *  @param {string} idRail
 *  @param {Array<{id:string,label:string}>} entrees
 *  @param {string|null} actif
 *  @param {(id:string)=>number} compter
 *  @param {(id:string)=>void} surClic
 */
function RendreRail(idRail, entrees, actif, compter, surClic) {
	const rail = $(idRail);
	if (!rail) return;
	rail.replaceChildren();

	// « Tout » n'est pas une catégorie du catalogue : c'est l'état de départ,
	// et il faut pouvoir y revenir sans recharger le menu.
	const toutes = [{ id: null, label: "Tout" }, ...entrees];

	for (const c of toutes) {
		const b = document.createElement("button");
		b.type = "button";
		b.textContent = c.label;
		if (c.id === actif) b.setAttribute("aria-current", "true");

		const n = compter(c.id);
		if (n > 0) {
			const compte = document.createElement("span");
			compte.className = "rail-compte";
			compte.textContent = String(n);
			b.append(compte);
		}

		b.addEventListener("click", () => surClic(c.id));
		rail.append(b);
	}
}

/** Vrai si l'entrée passe le filtre texte. Insensible à la casse, cherche dans
 *  le libellé ET dans l'identifiant : les joueurs se partagent les identifiants. */
function Correspond(entree, filtre) {
	if (!filtre) return true;
	const q = filtre.toLowerCase();
	return (entree.label || "").toLowerCase().includes(q)
		|| (entree.id || "").toLowerCase().includes(q);
}

/** Une ligne de liste dense. */
function Ligne(entree, extra) {
	const li = document.createElement("li");

	const nom = document.createElement("span");
	nom.className = "nom";
	nom.textContent = entree.label || entree.id;
	li.append(nom);

	if (extra && extra.marque) {
		const m = document.createElement("span");
		m.className = "marque";
		m.textContent = extra.marque;
		li.append(m);
	}

	const ref = document.createElement("span");
	ref.className = "ref";
	ref.textContent = entree.id;
	li.append(ref);

	return li;
}

function ListeVide(idListe, texte) {
	const liste = $(idListe);
	if (!liste) return;
	liste.replaceChildren();
	const li = document.createElement("li");
	li.className = "vide-liste";
	li.textContent = texte;
	liste.append(li);
}

// ══════════════════════════════════════════════════════════════════════════════
// PROPS
// ══════════════════════════════════════════════════════════════════════════════

// Au-delà, la liste devient plus longue à parcourir qu'à filtrer. Le compteur du
// rail dit combien existent réellement, donc la troncature ne se cache pas.
const MAX_LIGNES = 140;

function RendreProps() {
	const E = ATELIER.props;
	const liste = $("props-liste");
	if (!liste) return;

	const visibles = E.pieces
		.filter((p) => (E.categorie === null || p.categorie === E.categorie))
		.filter((p) => Correspond(p, E.filtre));

	RendreRail("props-rail", E.categories, E.categorie,
		(id) => (id === null ? E.pieces.length : E.pieces.filter((p) => p.categorie === id).length),
		(id) => { E.categorie = id; RendreProps(); });

	if (visibles.length === 0) {
		ListeVide("props-liste", E.filtre
			? `Aucun prop ne correspond à « ${E.filtre} ».`
			: "Aucun prop dans cette catégorie.");
		MajIndiceProps(0, 0);
		return;
	}

	liste.replaceChildren();
	for (const p of visibles.slice(0, MAX_LIGNES)) {
		const li = Ligne(p, p.entite
			? { marque: p.cuit === false ? "cube (repli)" : (p.kind === "gisement" ? "gisement" : "atelier") }
			: null);
		if (E.choisi === p.id) li.setAttribute("aria-selected", "true");
		li.addEventListener("click", () => {
			E.choisi = p.id;
			// Poser DIRECTEMENT au clic : demander de cliquer puis d'appuyer sur
			// une touche pour un seul objet serait un pas de trop. La touche
			// `prop_poser` sert à REPOSER le même prop sans rouvrir le menu.
			Lua("NarvosProps:Poser", p.id, E.angle);
			RendreProps();
		});
		liste.append(li);
	}

	MajIndiceProps(visibles.length, Math.min(visibles.length, MAX_LIGNES));
	MajSelectionProps();
}

function MajIndiceProps(total, montres) {
	const indice = $("props-indice");
	if (!indice) return;
	indice.textContent = total > montres
		? `${montres} / ${total} affichés — affiner le filtre`
		: "";
}

function MajSelectionProps() {
	const E = ATELIER.props;
	const cible = $("props-selection");
	if (!cible) return;

	if (!E.choisi) {
		cible.textContent = "Aucun prop sélectionné";
		return;
	}
	const p = E.pieces.find((x) => x.id === E.choisi);
	cible.replaceChildren();
	cible.append(document.createTextNode("Sélection : "));
	const b = document.createElement("b");
	b.textContent = (p && p.label) || E.choisi;
	cible.append(b, document.createTextNode(`  ·  rotation ${E.angle}°`));
}

// ══════════════════════════════════════════════════════════════════════════════
// PNJ ET MONSTRES
// ══════════════════════════════════════════════════════════════════════════════

function RendreSpawn() {
	const E = ATELIER.spawn;
	const liste = $("spawn-liste");
	if (!liste) return;

	const visibles = E.entrees
		.filter((e) => (E.role === null || e.role === E.role))
		.filter((e) => Correspond(e, E.filtre));

	RendreRail("spawn-rail", E.roles, E.role,
		(id) => (id === null ? E.entrees.length : E.entrees.filter((e) => e.role === id).length),
		(id) => { E.role = id; RendreSpawn(); });

	if (visibles.length === 0) {
		ListeVide("spawn-liste", E.filtre
			? `Aucune entrée ne correspond à « ${E.filtre} ».`
			: "Aucune entrée pour ce rôle.");
		return;
	}

	liste.replaceChildren();
	for (const e of visibles.slice(0, MAX_LIGNES)) {
		const li = Ligne(e, { marque: e.famille });
		li.dataset.role = e.role;
		li.addEventListener("click", () => {
			const champ = $("spawn-niveau");
			const niveau = Number(champ ? champ.value : 1);
			Lua("NarvosSpawn:Invoquer", e.id, niveau);
		});
		liste.append(li);
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// ARMES — menu de test
//
// Meme forme que le menu de PNJ. Un clic emet un identifiant ; le serveur
// revalide le droit (commandes_dev ou administrateur) et donne l'arme. La page
// ne decide rien — si le droit manque, le serveur repond une erreur et c'est
// elle qui s'affiche, pas un bouton grise a deviner.
// ══════════════════════════════════════════════════════════════════════════════

function RendreArmes() {
	const E = ATELIER.armes;
	const liste = $("armes-liste");
	if (!liste) return;

	const visibles = E.armes
		.filter((a) => (E.categorie === null || a.categorie === E.categorie))
		.filter((a) => Correspond(a, E.filtre));

	RendreRail("armes-rail", E.categories, E.categorie,
		(id) => (id === null ? E.armes.length : E.armes.filter((a) => a.categorie === id).length),
		(id) => { E.categorie = id; RendreArmes(); });

	const sel = $("armes-selection");
	if (sel) {
		sel.textContent = E.test
			? "Cliquer pour ajouter au sac · I pour équiper"
			: "Menu de test ferme : commandes_dev ou administrateur requis";
	}

	if (visibles.length === 0) {
		ListeVide("armes-liste", E.filtre
			? `Aucune arme ne correspond à « ${E.filtre} ».`
			: "Aucune arme dans cette categorie.");
		return;
	}

	liste.replaceChildren();
	for (const a of visibles.slice(0, MAX_LIGNES)) {
		const li = Ligne(a, { marque: a.categorie });
		li.addEventListener("click", () => Lua("NarvosArmes:Donner", a.id));
		liste.append(li);
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// VEHICULES
// ══════════════════════════════════════════════════════════════════════════════
//
// Une liste commune : véhicules roulants et assemblages de vaisseaux. Ces
// derniers restent sans action tant que leur pilotage nanos n'est pas validé.
//
// La page AFFICHE, le serveur DECIDE. Le libelle de bas de panneau dit
// pourquoi un clic resterait sans effet, plutot que de laisser cliquer dans le
// vide : c'est la meme garde que pour les armes.

function RendreVehicules() {
	const E = ATELIER.vehicules;
	const liste = $("vehicules-liste");
	if (!liste) return;
	const visibles = E.filtre === "vaisseaux" ? E.vaisseaux
		: E.filtre === "route" ? E.liste : [...E.liste, ...E.vaisseaux];
	const compteur = $("vehicules-compteur");
	if (compteur) compteur.textContent = `${visibles.length} modèles`;
	const filtre = $("vehicules-filtre");
	if (filtre) filtre.value = E.filtre;

	const sel = $("vehicules-selection");
	if (sel) {
		sel.textContent = E.filtre === "vaisseaux" ? "Sélection des vaisseaux — pilotage indisponible"
			: E.test
			? "Cliquer un modèle pour le faire apparaître"
			: "Menu de test fermé : commandes_dev ou administrateur requis";
	}

	if (visibles.length === 0) {
		ListeVide("vehicules-liste", "Aucun véhicule cuit dans le pack.");
		return;
	}

	liste.replaceChildren();
	for (const v of visibles.slice(0, MAX_LIGNES)) {
		const li = Ligne(v, { marque: v.categorie || "voiture" });
		if (v.disponible === false) {
			li.setAttribute("aria-disabled", "true");
			const statut = document.createElement("span");
			statut.textContent = v.statut || "Indisponible";
			li.append(statut);
		} else if (E.test) {
			li.addEventListener("click", () => Lua("NarvosVehicules:Spawner", v.id));
		}
		liste.append(li);
	}
}

$("vehicules-filtre")?.addEventListener("change", (event) => {
	ATELIER.vehicules.filtre = event.target.value;
	RendreVehicules();
});

// ══════════════════════════════════════════════════════════════════════════════
// COMMANDES
// ══════════════════════════════════════════════════════════════════════════════

// ⚠ LA NOUVELLE TOUCHE N'EST PAS CAPTUREE ICI. Un WebUI nanos ne reçoit le clavier
// que s'il a le focus (`WebUI:SetFocus`), que le client ne donne jamais : panneau
// souris libre, clavier au jeu — c'est ce qui laisse Échap fermer les menus. Un
// écouteur `keydown` posé ici ne se déclenchait donc JAMAIS, et l'écran
// « Cliquer une touche puis appuyer sur la nouvelle » ne pouvait rien changer
// (retour de jeu du 2026-09-13). La page SIGNALE l'écoute
// (`NarvosCommandes:Ecouter`) ; Client/Index.lua capture la frappe par
// `Input.Subscribe("KeyPress")` et l'envoie au serveur, qui valide et renvoie
// l'état (`NarvosCommandes`). Refus de touche : `NarvosCommandesEcoute`.

function RendreCommandes() {
	const E = ATELIER.commandes;
	const corps = $("commandes-corps");
	if (!corps) return;

	corps.replaceChildren();

	// On parcourt les catégories dans l'ordre donné par le serveur, et les
	// actions dans l'ordre du catalogue. Grouper ici avec un `Object.keys` sur
	// une table intermédiaire perdrait l'ordre voulu.
	for (const categorie of E.categories) {
		const dedans = E.actions.filter((a) => a.categorie === categorie);
		if (dedans.length === 0) continue;

		const titre = document.createElement("h2");
		titre.textContent = categorie;
		corps.append(titre);

		for (const a of dedans) corps.append(LigneCommande(a));
	}
}

function LigneCommande(action) {
	const E = ATELIER.commandes;

	const ligne = document.createElement("div");
	ligne.className = "reglage";

	const libelle = document.createElement("span");
	libelle.className = "libelle";
	libelle.textContent = action.label;
	ligne.append(libelle);

	if (action.modifiee) {
		const defaut = document.createElement("span");
		defaut.className = "defaut";
		defaut.textContent = `défaut ${action.defaut}`;
		ligne.append(defaut);

		const rendre = document.createElement("button");
		rendre.type = "button";
		rendre.className = "rendre";
		rendre.textContent = "Rendre";
		rendre.addEventListener("click", (ev) => {
			ev.stopPropagation();
			Lua("NarvosCommandes:Reinitialiser", action.id);
		});
		ligne.append(rendre);
	}

	const bouton = document.createElement("button");
	bouton.type = "button";
	bouton.className = "touche";

	const enEcoute = E.ecoute === action.id;
	if (enEcoute) {
		bouton.textContent = "…";
		bouton.dataset.ecoute = "true";
	} else if (!action.touche) {
		bouton.textContent = "aucune";
		bouton.dataset.vide = "true";
	} else {
		bouton.textContent = NomTouche(action.touche);
	}

	bouton.addEventListener("click", () => {
		E.ecoute = enEcoute ? null : action.id;
		EtatCommandes(E.ecoute
			? "Appuyer sur la nouvelle touche.  Échap annule."
			: "");
		// Le Lua capture la frappe : sans ce signal, il ne sait pas qu'on attend.
		Lua("NarvosCommandes:Ecouter", E.ecoute || "");
		RendreCommandes();
	});

	ligne.append(bouton);
	return ligne;
}

function EtatCommandes(texte) {
	const cible = $("commandes-etat");
	if (cible) cible.textContent = texte || "";
}

// Boutons de souris : le serveur stocke un nom en majuscules (Logic/Commandes.lua,
// TOUCHES_VALIDES), l'écran l'écrit en clair. Les touches du clavier restent
// affichées telles quelles.
const NOMS_SOURIS = {
	CLIC_GAUCHE: "Clic gauche",
	CLIC_DROIT: "Clic droit",
	CLIC_MILIEU: "Clic milieu",
	SOURIS_4: "Souris 4",
	SOURIS_5: "Souris 5",
};

function NomTouche(touche) {
	return NOMS_SOURIS[touche] || touche;
}

// `MouseEvent.button` → nom serveur. 0 gauche, 1 milieu, 2 droit, 3-4 pouces.
const BOUTON_VERS_TOUCHE = ["CLIC_GAUCHE", "CLIC_MILIEU", "CLIC_DROIT", "SOURIS_4", "SOURIS_5"];

// ⚠ ASSIGNER UN BOUTON DE SOURIS. Le clavier est capturé par le Lua
// (`KeyPress`), la souris AUSSI (`MouseDown`) — mais un clic posé sur la page
// peut ne jamais atteindre le jeu. Pendant l'écoute, la page prend donc le
// PREMIER bouton enfoncé, en phase de capture, et le consomme : sans ça le clic
// d'assignation déclencherait le bouton qu'il survole. Le clic qui a lancé
// l'écoute est déjà passé (événement `click`, après le relâchement).
document.addEventListener("mousedown", (ev) => {
	const E = ATELIER.commandes;
	if (!E || !E.ecoute || ETAT.ouvert !== "commandes") return;
	const touche = BOUTON_VERS_TOUCHE[ev.button];
	if (!touche) return;
	ev.preventDefault();
	ev.stopPropagation();
	const actionId = E.ecoute;
	E.ecoute = null;
	EtatCommandes("");
	// Le `click` qui suit ce `mousedown` ne doit rien déclencher non plus.
	document.addEventListener("click", (c) => { c.preventDefault(); c.stopPropagation(); }, { capture: true, once: true });
	Lua("NarvosCommandes:Definir", actionId, touche);
}, true);

// Refus d'une frappe pendant l'écoute, ou écoute annulée (Échap) — envoyés par
// Client/Index.lua, qui capture la touche (voir l'en-tête de RendreCommandes).
// Un succès, lui, arrive par l'état complet `NarvosCommandes`.
Events.Subscribe("NarvosCommandesEcoute", (actionId, raison) => {
	const E = ATELIER.commandes;
	if (raison === "invalide") {
		EtatCommandes("Touche non assignable : lettre, chiffre, F1–F12, Tab ou bouton de souris.  Échap annule.");
		return;
	}
	E.ecoute = actionId || null;
	EtatCommandes("");
	if (ETAT.ouvert === "commandes") RendreCommandes();
});

// ══════════════════════════════════════════════════════════════════════════════
// BARRE DE POUVOIRS
// ══════════════════════════════════════════════════════════════════════════════

// ── Recharges animées (2026-09-15) ───────────────────────────────────────────
// Demande de Hanibes : « un indicateur de recharge clair dans l'UI ». Avant, la
// barre était RECONSTRUITE à chaque message du serveur (toutes les 500 ms) avec
// un voile plein et un chiffre : aucune proportion, aucune fluidité, et le manque
// de mana se confondait avec la recharge. Maintenant :
//   · les cases sont gardées tant que la barre ne change pas de sorts ;
//   · chaque recharge a son ÉCHÉANCE locale (`restant` du serveur), et un balayage
//     circulaire se retire à chaque image (`--p` = part restante) ;
//   · chiffre entier au-dessus de 3 s, une décimale en dessous ;
//   · la case s'illumine au moment où le sort redevient prêt ;
//   · manque de mana : trait bleu sous la case, sans voile de recharge.
// Le serveur reste seul juge : un appui trop tôt est refusé là-bas.
const RECHARGES = { cle: "", fins: new Map(), totales: new Map(), signales: new Set(), image: 0 };

function CleBarreSorts(barre) {
	return barre.map((s) => (s.vide ? "_" : `${s.id}:${s.icone || ""}:${s.touche || s.emplacement}`)).join("|");
}

function ConstruireCaseSort(s) {
	const li = document.createElement("li");
	li.dataset.emplacement = String(s.emplacement);

	// La vignette : l'image du sort à son plein (générateur des VFX), sous
	// la touche. Posée AVANT la touche et le nom, qui se lisent par-dessus.
	if (!s.vide && s.icone) {
		const img = document.createElement("img");
		img.className = "vignette-sort";
		img.src = s.icone;
		img.alt = "";
		img.draggable = false;
		li.append(img);
		li.dataset.vignette = "true";
	}

	const touche = document.createElement("span");
	touche.className = "touche-sort";
	// La touche RÉELLE (ajoutée par le client Lua), le numéro à défaut.
	touche.textContent = s.touche || String(s.emplacement);
	li.append(touche);

	if (s.vide) {
		li.dataset.vide = "true";
		return li;
	}

	const nom = document.createElement("span");
	nom.className = "nom-sort";
	nom.textContent = s.label;
	const voile = document.createElement("span");
	voile.className = "recharge";
	voile.hidden = true;
	li.append(nom, voile);
	li.addEventListener("click", () => Lua("NarvosSorts:Lancer", s.emplacement));
	return li;
}

/** La case redevient prête : un éclat bref, une seule fois par recharge. */
function SignalerSortPret(li, emplacement) {
	if (RECHARGES.signales.has(emplacement)) return;
	RECHARGES.signales.add(emplacement);
	li.classList.remove("sort-pret-eclat");
	void li.offsetWidth; // relance l'animation CSS
	li.classList.add("sort-pret-eclat");
}

function AnimerRecharges() {
	if (RECHARGES.image) return;
	const pas = () => {
		RECHARGES.image = 0;
		const liste = $("sorts-liste");
		if (!liste) return;
		const maintenant = performance.now();
		let actives = 0;
		for (const li of liste.children) {
			const emplacement = Number(li.dataset.emplacement);
			const voile = li.querySelector(".recharge");
			if (!voile) continue;
			const fin = RECHARGES.fins.get(emplacement) || 0;
			const reste = fin - maintenant;
			if (reste > 0) {
				actives += 1;
				const total = Math.max(1, (RECHARGES.totales.get(emplacement) || 0) * 1000);
				li.style.setProperty("--p", Math.max(0, Math.min(1, reste / total)).toFixed(4));
				voile.textContent = reste > 3000 ? String(Math.ceil(reste / 1000)) : (reste / 1000).toFixed(1);
				voile.hidden = false;
			} else if (!voile.hidden) {
				voile.hidden = true;
				li.style.removeProperty("--p");
				RECHARGES.fins.delete(emplacement);
				SignalerSortPret(li, emplacement);
			}
		}
		if (actives > 0) RECHARGES.image = requestAnimationFrame(pas);
	};
	RECHARGES.image = requestAnimationFrame(pas);
}

function RendreSorts() {
	const E = ATELIER.sorts;
	const boite = $("hud-sorts");
	const liste = $("sorts-liste");
	if (!boite || !liste) return;

	if (!E.barre || E.barre.length === 0) {
		boite.hidden = true;
		return;
	}
	boite.hidden = false;

	const cle = CleBarreSorts(E.barre);
	if (cle !== RECHARGES.cle || liste.children.length !== E.barre.length) {
		liste.replaceChildren(...E.barre.map(ConstruireCaseSort));
		RECHARGES.cle = cle;
		RECHARGES.fins.clear();
		RECHARGES.totales.clear();
	}

	const maintenant = performance.now();
	E.barre.forEach((s, i) => {
		const li = liste.children[i];
		if (!li || s.vide) return;
		const enRecharge = (s.restant || 0) > 0.05;
		if (enRecharge) {
			RECHARGES.fins.set(s.emplacement, maintenant + s.restant * 1000);
			RECHARGES.totales.set(s.emplacement, Math.max(s.recharge || 0, s.restant));
			RECHARGES.signales.delete(s.emplacement);
		} else if (RECHARGES.fins.has(s.emplacement)) {
			// Le serveur dit prêt avant la fin locale (écart d'horloge) : on s'aligne.
			RECHARGES.fins.set(s.emplacement, maintenant);
		}
		li.dataset.pret = s.pret ? "true" : "false";
		li.dataset.manque = (!s.pret && !enRecharge) ? "true" : "false";
		li.title = `${s.label}${s.emplacement === 3 ? " · ULTIME" : ""} — ${s.cout ?? 0} mana · recharge ${s.recharge ?? 0} s`;
	});
	AnimerRecharges();

	const barre = $("mana-barre");
	if (barre) {
		const pct = E.mana_max > 0 ? Math.max(0, Math.min(100, (E.mana / E.mana_max) * 100)) : 0;
		barre.style.width = pct + "%";
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// CÂBLAGE
// ══════════════════════════════════════════════════════════════════════════════

// Les panneaux se redessinent À L'OUVERTURE. `RENDUS` est déclarée dans
// index.js : on l'étend au lieu de dupliquer la cascade de `if`.
RENDUS.props = () => RendreProps();
RENDUS.spawn = () => RendreSpawn();
RENDUS.armes = () => RendreArmes();
RENDUS.vehicules = () => RendreVehicules();
RENDUS.commandes = () => RendreCommandes();
// Crochets, et non `RENDUS.garde-robe` : le nom du panneau porte un tiret, qui
// n'est pas un identifiant JS valide. Il vient du `id` de la section HTML, et
// c'est lui qui doit rester lisible.
RENDUS["garde-robe"] = () => {
	// Le stock depend du personnage : on le redemande a chaque ouverture plutot
	// que de le pousser en continu, ce qui enverrait a tout le monde un catalogue
	// que presque personne ne regarde.
	Lua("NarvosVestiaire:Ouvrir");
	RendreGardeRobe();
};

document.addEventListener("input", (e) => {
	if (e.target.id === "props-recherche") {
		ATELIER.props.filtre = e.target.value.trim();
		RendreProps();
	} else if (e.target.id === "spawn-recherche") {
		ATELIER.spawn.filtre = e.target.value.trim();
		RendreSpawn();
	} else if (e.target.id === "armes-recherche") {
		ATELIER.armes.filtre = e.target.value.trim();
		RendreArmes();
	}
});

// ══════════════════════════════════════════════════════════════════════════════
// GARDE-ROBE
// ══════════════════════════════════════════════════════════════════════════════
//
// ── TROIS ÉTATS, PAS DEUX ─────────────────────────────────────────────────────
// Une pièce est : à vendre, possédée, ou portée. Les confondre rendrait l'écran
// illisible — « acheter » et « porter » sont le même clic au même endroit, seul
// l'état dit lequel se produira.
//
// L'étiquette de droite porte donc l'action à venir, jamais l'état actuel :
// « 108 » quand il faut payer, « Porter » quand c'est acquis, « Retirer » quand
// c'est déjà sur soi. Le joueur lit ce qu'il obtient, pas ce qu'il a.
//
// ── AUCUN ÉTAT LOCAL ──────────────────────────────────────────────────────────
// Rien n'est décidé ici, pas même le solde affiché. Un achat envoie l'intention
// et attend `NarvosVestiaire` : décrémenter les crédits au clic mentirait au
// premier refus (solde insuffisant calculé côté serveur, cadence trop rapide).

/** Libellé lisible d'un slot. Le serveur envoie des identifiants techniques ;
 *  les traduire côté page évite de faire voyager des libellés à chaque envoi. */
const GR_LIBELLE = {
	visage: "Visage",
	barbe: "Barbe",
	tete: "Tête",
	torse: "Torse",
	epaules: "Épaules",
	bras: "Bras",
	mains: "Mains",
	jambes: "Jambes",
	pieds: "Pieds",
};

function RendreGardeRobe() {
	const E = ATELIER.garderobe;
	const liste = $("gr-liste");
	if (!liste) return;

	const credits = $("gr-credits");
	if (credits) credits.textContent = `${E.credits} crédits`;

	// Un slot sans stock ne figure PAS au rail. L'afficher vide donnerait
	// l'impression d'un contenu qui n'a pas chargé.
	const slots = (E.slots || []).filter((s) => (E.stock[s] || []).length > 0);
	const rail = slots.map((s) => ({ id: s, label: GR_LIBELLE[s] || s }));

	if (E.slot !== null && !slots.includes(E.slot)) E.slot = null;

	RendreRail("gr-rail", rail, E.slot,
		(id) => (id === null
			? slots.reduce((n, s) => n + E.stock[s].length, 0)
			: (E.stock[id] || []).length),
		(id) => { E.slot = id; RendreGardeRobe(); });

	const visibles = [];
	for (const s of slots) {
		if (E.slot !== null && s !== E.slot) continue;
		for (const p of E.stock[s]) {
			if (Correspond(p, E.filtre)) visibles.push({ ...p, slot: s });
		}
	}

	if (visibles.length === 0) {
		ListeVide("gr-liste", E.filtre
			? `Aucune pièce ne correspond à « ${E.filtre} ».`
			: "Rien à proposer pour cet emplacement.");
		return;
	}

	liste.replaceChildren();
	for (const p of visibles.slice(0, MAX_LIGNES)) {
		const possede = E.possede.includes(p.id);
		const portee = E.porte[p.slot] === p.id;

		const li = Ligne(p, { marque: p.ensemble });
		li.dataset.etat = portee ? "portee" : (possede ? "possedee" : "vendue");

		const action = document.createElement("span");
		action.className = "gr-action";
		action.textContent = portee ? "Retirer" : (possede ? "Porter" : `${p.prix}`);
		li.append(action);

		li.addEventListener("click", () => {
			if (portee) {
				// Chaîne vide et non null : le pont WebUI → Lua ne porte pas nil,
				// et le serveur retraduit "" en « slot vide ».
				Lua("NarvosVestiaire:Porter", p.slot, "");
			} else if (possede) {
				Lua("NarvosVestiaire:Porter", p.slot, p.id);
			} else {
				Lua("NarvosVestiaire:Acheter", p.id);
			}
		});

		liste.append(li);
	}
}

/** Message du serveur, ou rappel de l'usage quand il n'y a rien à dire. */
function EtatGardeRobe(texte) {
	const boite = $("gr-etat");
	if (boite) {
		boite.textContent = texte || "Cliquer une pièce pour l'acheter ou la porter";
	}
}

document.addEventListener("click", (e) => {
	if (e.target.closest("[data-props-vider]")) Lua("NarvosProps:Vider");
	else if (e.target.closest("[data-spawn-enregistrer]")) Lua("NarvosSpawn:Enregistrer");
	else if (e.target.closest("[data-spawn-retirer]")) Lua("NarvosSpawn:Retirer");
	else if (e.target.closest("[data-spawn-vider]")) Lua("NarvosSpawn:Vider");
	else if (e.target.closest("[data-armes-lacher]")) Lua("NarvosArmes:Lacher");
	else if (e.target.closest("[data-commandes-reset]")) Lua("NarvosCommandes:Reinitialiser", "");
	else if (e.target.closest("[data-gr-devetir]")) {
		// Un envoi par slot occupé, et non un événement « tout retirer » : le
		// serveur ne valide qu'un slot à la fois, et un chemin de plus serait un
		// chemin de plus à sécuriser pour un geste rare.
		for (const slot of Object.keys(ATELIER.garderobe.porte)) {
			Lua("NarvosVestiaire:Porter", slot, "");
		}
	}
});

document.addEventListener("input", (e) => {
	if (e.target && e.target.id === "gr-recherche") {
		ATELIER.garderobe.filtre = e.target.value || "";
		RendreGardeRobe();
	}
});

if (typeof Events !== "undefined") {
	Events.Subscribe("NarvosVestiaire", (donnees) => {
		const E = ATELIER.garderobe;
		if (!donnees) return;

		// Une erreur du serveur laisse l'écran tel quel et se contente du bandeau :
		// vider le stock ferait croire que le tailleur n'a rien, alors que c'est la
		// session qui n'est pas prête.
		if (donnees.erreur) {
			EtatGardeRobe(donnees.erreur);
			return;
		}

		E.slots = donnees.slots || [];
		E.stock = donnees.stock || {};
		E.possede = donnees.possede || [];
		E.porte = donnees.porte || {};
		E.credits = donnees.credits || 0;

		EtatGardeRobe(donnees.message);
		if (ETAT.ouvert === "garde-robe") RendreGardeRobe();
	});

	Events.Subscribe("NarvosProps", (donnees) => {
		const E = ATELIER.props;
		E.categories = (donnees && donnees.categories) || [];
		const pieces = (donnees && donnees.pieces) || [];
		// Les ENTITÉS de jeu (gisements, ateliers) : section dédiée du même menu.
		// Une ligne de décor pose un mesh inerte ; une entité pose aussi le
		// déclencheur, l'état et la persistance (serveur). Le clic part par le
		// MÊME chemin `NarvosProps:Poser`.
		const entites = (donnees && donnees.entites) || [];
		E.pieces = pieces.concat(entites.map((e) => ({
			id: e.id,
			label: e.label,
			categorie: "entites",
			entite: true,
			kind: e.kind,
			cuit: e.cuit !== false,
		})));
		if (entites.length > 0) {
			E.categories.push({ id: "entites", label: "Entités de jeu" });
		}
		MajCompteur("props-compteur", donnees, "poses", "posés");
		if (ETAT.ouvert === "props") RendreProps();
	});

	Events.Subscribe("NarvosPropCompte", (poses, plafond) => {
		const c = $("props-compteur");
		if (c) c.textContent = `${poses} / ${plafond} posés`;
	});

	Events.Subscribe("NarvosSpawnables", (donnees) => {
		const E = ATELIER.spawn;
		E.roles = (donnees && donnees.roles) || [];
		E.entrees = (donnees && donnees.entrees) || [];
		const niveau = $("spawn-niveau");
		if (niveau && donnees && Number(donnees.niveau_max) > 0) {
			niveau.max = String(Math.floor(Number(donnees.niveau_max)));
		}
		MajCompteur("spawn-compteur", donnees, "invoques", "invoqués");
		if (ETAT.ouvert === "spawn") RendreSpawn();
	});

	Events.Subscribe("NarvosArmes", (donnees) => {
		const E = ATELIER.armes;
		E.categories = (donnees && donnees.categories) || [];
		E.armes = (donnees && donnees.armes) || [];
		E.test = !!(donnees && donnees.test);
		const c = $("armes-compteur");
		if (c) c.textContent = `${E.armes.length} armes`;
		if (ETAT.ouvert === "armes") RendreArmes();
	});

	Events.Subscribe("NarvosVehicules", (donnees) => {
		const E = ATELIER.vehicules;
		E.liste = (donnees && donnees.vehicules) || [];
		E.vaisseaux = (donnees && donnees.vaisseaux) || [];
		E.test = !!(donnees && donnees.test);
		const c = $("vehicules-compteur");
		if (c) c.textContent = `${E.liste.length} modèles`;
		if (ETAT.ouvert === "vehicules") RendreVehicules();
	});
	Events.Subscribe("NarvosVehiculesFiltre", (filtre) => {
		ATELIER.vehicules.filtre = ["tous", "route", "vaisseaux"].includes(filtre) ? filtre : "tous";
		if (ETAT.ouvert === "vehicules") RendreVehicules();
	});

	Events.Subscribe("NarvosSpawnCompte", (invoques, plafond) => {
		const c = $("spawn-compteur");
		if (c) c.textContent = `${invoques} / ${plafond} invoqués`;
	});

	Events.Subscribe("NarvosCommandes", (donnees) => {
		const E = ATELIER.commandes;
		E.actions = (donnees && donnees.actions) || [];
		E.categories = (donnees && donnees.categories) || [];
		// L'écoute est ABANDONNÉE à chaque état neuf : si le serveur a répondu,
		// la question est close ; la garder afficherait une case en attente
		// alors que plus rien ne l'attend.
		E.ecoute = null;
		if (ETAT.ouvert === "commandes") RendreCommandes();
	});

	Events.Subscribe("NarvosSorts", (donnees) => {
		ATELIER.sorts.barre = (donnees && donnees.barre) || [];
		ATELIER.sorts.mana = (donnees && donnees.mana) || 0;
		ATELIER.sorts.mana_max = (donnees && donnees.mana_max) || 0;
		RendreSorts();
	});

	Events.Subscribe("NarvosMessage", Message);

	// Arrivée dans un monde. Le message est plus long que les autres et tient
	// plus longtemps : le décor du monde d'arrivée se pose encore par lots
	// derrière, et voir son nom écrit évite de prendre un monde à moitié chargé
	// pour un monde cassé.
	Events.Subscribe("NarvosMonde", (label, description) => {
		if (!label) return;
		Message(description ? `${label} — ${description}` : label, "info");
	});

	// Le Lua demande de reposer le prop choisi, sans rouvrir le menu.
	Events.Subscribe("NarvosProps:PoserSelection", (angle) => {
		const E = ATELIER.props;
		E.angle = typeof angle === "number" ? angle : E.angle;
		if (!E.choisi) {
			Message("Aucun prop selectionne — ouvrir le menu Props", "erreur");
			return;
		}
		Lua("NarvosProps:Poser", E.choisi, E.angle);
	});

	Events.Subscribe("NarvosProps:Angle", (angle) => {
		ATELIER.props.angle = angle;
		MajSelectionProps();
		Message(`Rotation du prop : ${angle}°`, "info");
	});

	// ⚠ LA POIGNÉE DE MAIN. `WebUI(...)` rend l'objet immédiatement côté Lua,
	// mais la page n'a pas chargé : tout `CallEvent` émis dans le même tick tombe
	// dans le vide, sans erreur. C'est la page qui signale qu'elle est prête, et
	// le Lua réclame alors les touches — sans quoi AUCUNE touche ne répondrait.
	Events.Call("NarvosHud:Pret");
}

function MajCompteur(id, donnees, champ, mot) {
	const c = $(id);
	if (!c || !donnees) return;
	c.textContent = `${donnees[champ] || 0} / ${donnees.plafond || 0} ${mot}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ATELIER — craft dans le monde
// ══════════════════════════════════════════════════════════════════════════════
// Le serveur envoie `NarvosAtelier` quand le joueur entre dans une station ; le
// client affiche les recettes et émet une INTENTION au clic. Aucune décision ici :
// le serveur valide (entrées, palier, station) et renvoie l'état (Narvos:Inventaire).
const ATELIER_CRAFT = { station: null, recettes: [] };

function RendreAtelier(label, recettes) {
	const boite = $("atelier");
	const liste = $("atelier-liste");
	if (!boite || !liste) return;
	$("atelier-titre").textContent = "Atelier — " + label;
	liste.replaceChildren();
	for (const r of recettes || []) {
		const li = document.createElement("li");
		li.textContent = `${r.label}  →  ${r.sortie} ×${r.sortie_quantite}`;
		const detail = document.createElement("span");
		detail.className = "ref";
		detail.textContent = `${(r.entrees || []).map((e) => `${e.possede}/${e.quantite} ${e.item_id}`).join(" + ")}  [palier ${r.palier}]`;
		li.append(detail);
		// Intention : le serveur tranche (entrées réelles, palier, station).
		li.addEventListener("click", () => Lua("Narvos:Crafter", ATELIER_CRAFT.station, r.id));
		liste.append(li);
	}
	boite.hidden = !(recettes && recettes.length > 0);
}

Events.Subscribe("NarvosAtelier", (station, label, recettes) => {
	ATELIER_CRAFT.station = station;
	ATELIER_CRAFT.recettes = recettes || [];
	RendreAtelier(label || station || "Atelier", ATELIER_CRAFT.recettes);
});
Events.Subscribe("NarvosAtelierFait", (recetteId, itemId) => {
	Message(`${itemId || recetteId} fabriqué`, "ok");
});
Events.Subscribe("NarvosAtelierErreur", (raison) => {
	Message(raison || "Craft impossible", "erreur");
});

// ══════════════════════════════════════════════════════════════════════════════
// RADAR (mini-carte) — dessine les portails + gisements autour du joueur.
// Les points arrivent du serveur (`Narvos:Radar`), projetés en XZ autour du joueur.
// ══════════════════════════════════════════════════════════════════════════════
// ⚠ LA PORTÉE VIENT DU SERVEUR, elle n'est plus écrite ici.
//
// Elle valait `600` en dur, avec le commentaire « zone affichée (m) ». Le
// serveur envoyait des CENTIMÈTRES : le seuil valait donc 6 mètres, et
// l'étiquette annonçait « rayon 600 m » au joueur. Sept repères sur huit
// tombaient en chevron de bord. Mesuré le 2026-09-09.
//
// La valeur de repli n'existe que pour un message malformé : si elle sert, la
// donnée est déjà fausse en amont.
const RAYON_RADAR_DEFAUT_M = 600;
/** Dessine les données du radar dans UN canvas et son étiquette.
 *  Deux vues les consomment : le panneau Radar et l'application Carte du
 *  téléphone (communications.js). Un seul dessin, deux cadres — pas deux radars. */
function DessinerRadarDans(c, info, d) {
	if (!c || !d) return;
	const ctx = c.getContext("2d");
	const RAYON_RADAR_M = d.rayon_m || RAYON_RADAR_DEFAUT_M;
	const S = c.width, centre = S / 2, echelle = centre / RAYON_RADAR_M;
	const j = d.joueur || { x: 0, z: 0 };

	ctx.clearRect(0, 0, S, S);
	ctx.fillStyle = "rgba(5,7,12,0.85)"; ctx.fillRect(0, 0, S, S);
	// cercle de portée
	ctx.strokeStyle = "rgba(91,214,255,0.45)"; ctx.lineWidth = 1;
	ctx.beginPath(); ctx.arc(centre, centre, centre - 2, 0, Math.PI * 2); ctx.stroke();
	// cardinaux (N/S/O/E — convention XZ monde)
	ctx.fillStyle = "rgba(91,214,255,0.7)"; ctx.font = "8px monospace"; ctx.textAlign = "center";
	ctx.fillText("N", centre, 9); ctx.fillText("S", centre, S - 4);
	ctx.fillText("E", S - 8, centre); ctx.fillText("O", 8, centre);

	// points (portails + gisements) — hors rayon = marqueur de bord directionnel
	for (const p of d.points || []) {
		const dx = p.x - j.x, dz = p.z - j.z;
		const dist = Math.hypot(dx, dz);
		const t = p.teinte || [1, 1, 1];
		const couleur = `rgb(${Math.round(t[0]*255)},${Math.round(t[1]*255)},${Math.round(t[2]*255)})`;
		if (dist > RAYON_RADAR_M) {
			// trop loin (portails à l'échelle solaire) → chevron au bord, orienté
			const ang = Math.atan2(dz, dx);
			const bx = centre + Math.cos(ang) * (centre - 7);
			const by = centre + Math.sin(ang) * (centre - 7);
			ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
			ctx.fillStyle = couleur; ctx.beginPath();
			ctx.moveTo(6, 0); ctx.lineTo(-3, -3); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill();
			ctx.restore();
			continue;
		}
		// Taille réglée par /editionpnj (Server/EditionPnj.lua), bornée côté serveur ;
		// 3 px pour un repère qui n'en porte pas (message d'avant le réglage).
		const rayonPoint = Number(p.taille) > 0 ? Number(p.taille) : 3;
		ctx.fillStyle = couleur;
		ctx.beginPath(); ctx.arc(centre + dx * echelle, centre + dz * echelle, rayonPoint, 0, Math.PI * 2); ctx.fill();
	}
	// joueur (⊕)
	ctx.strokeStyle = "#ffb050"; ctx.lineWidth = 2;
	ctx.beginPath(); ctx.arc(centre, centre, 4, 0, Math.PI * 2); ctx.stroke();
	ctx.beginPath(); ctx.moveTo(centre - 6, centre); ctx.lineTo(centre + 6, centre);
	ctx.moveTo(centre, centre - 6); ctx.lineTo(centre, centre + 6); ctx.stroke();

	// ⚠ L'étiquette distingue les deux natures de repère. « N repère(s) · rayon
	// 600 m » laissait croire que les N tenaient dans le rayon, alors que les
	// portails sont à des dizaines de kilomètres et n'apparaissent qu'en
	// chevron. Un compte exact sur une portée fausse reste un mensonge.
	if (info) {
		let dedans = 0;
		for (const p of d.points || []) {
			if (Math.hypot(p.x - j.x, p.z - j.z) <= RAYON_RADAR_M) dedans += 1;
		}
		const loin = (d.points || []).length - dedans;
		info.textContent = loin > 0
			? `${dedans} repère(s) à moins de ${RAYON_RADAR_M} m · ${loin} au-delà (chevrons)`
			: `${dedans} repère(s) à moins de ${RAYON_RADAR_M} m`;
	}
}

function DessinerRadar(d) {
	DessinerRadarDans($("radar-canvas"), $("radar-info"), d);
	DessinerRadarDans($("tel-carte-canvas"), $("tel-carte-info"), d);
	// Mini-carte du HUD (demande B1, interface.js) : dessinée seulement si affichée.
	const carteHud = document.querySelector('#hud [data-zone="carte"]');
	if (carteHud && !carteHud.hidden) DessinerRadarDans($("hud-carte-canvas"), null, d);
}
Events.Subscribe("NarvosRadar", DessinerRadar);

// ══════════════════════════════════════════════════════════════════════════════
// RÉCOLTE — prompt d'un gisement dans le monde
// ══════════════════════════════════════════════════════════════════════════════
const GISEMENT_ACTUEL = { id: null, ok: false };

function AfficherGisement(donnees) {
	const boite = $("gisement");
	if (!boite) return;
	if (!donnees) { boite.hidden = true; return; }
	$("gisement-titre").textContent = "Ressource — " + (donnees.ressource || donnees.id);
	const texte = $("gisement-texte");
	if (texte) texte.textContent = donnees.ok
		? (donnees.ready ? "Prêt — clique pour récolter." : "En repousse…")
		: (donnees.raison || "Impossible de récolter.");
	const bouton = $("gisement-bouton");
	if (bouton) bouton.disabled = !(donnees.ok && donnees.ready);
	GISEMENT_ACTUEL.id = donnees.id;
	GISEMENT_ACTUEL.ok = donnees.ok && donnees.ready;
	boite.hidden = false;
}

Events.Subscribe("NarvosGisement", (donnees) => AfficherGisement(donnees));

const btnRecolter = () => { if (typeof document !== "undefined") return document.getElementById("gisement-bouton"); };
const btnG = btnRecolter();
if (btnG) btnG.addEventListener("click", () => {
	if (GISEMENT_ACTUEL.ok) Lua("Narvos:Recolter", GISEMENT_ACTUEL.id);
});

Events.Subscribe("NarvosGisementFait", (itemId, quantite) => {
	Message(`${itemId} ×${quantite} récolté`, "ok");
});
Events.Subscribe("NarvosGisementErreur", (raison) => {
	Message(raison || "Récolte impossible", "erreur");
});
