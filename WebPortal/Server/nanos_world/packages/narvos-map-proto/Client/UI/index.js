// ══════════════════════════════════════════════════════════════════════════════
// NARVOS — logique des panneaux.
//
// Contrat avec le Lua, repris des packages officiels (deathmatch, sandbox) :
//   Lua  -> JS   webui:CallEvent("Nom", args...)   reçu par Events.Subscribe
//   JS   -> Lua  Events.Call("Nom", args...)       reçu par Events.Subscribe
//
// `Events` est injecté par nanos dans la page ; il n'existe pas dans un
// navigateur ordinaire. D'où les gardes : le fichier doit pouvoir être ouvert
// hors du jeu pour travailler la mise en page sans que rien ne casse.
// ══════════════════════════════════════════════════════════════════════════════

const ETAT = {
	inventaire: { objets: [], cellules: 0, max: 0 },
	classes: { classes: [], actuelle: null },
	metiers: { metiers: [], niveau_max: null },
	ouvert: null,
};

const $ = (id) => document.getElementById(id);

// ── Rendu ─────────────────────────────────────────────────────────────────────

function RendreInventaire() {
	// L'inventaire de la maquette « Inventaire NARVOS » (inventaire.js) : onglets,
	// emplacements, fiche et actions sur le sac réel. L'ancienne liste nom/quantité
	// est remplacée, la vue du serveur garde les champs qu'elle lisait.
	if (typeof RendreInventaireNarvos === "function") RendreInventaireNarvos();
}

/** Les metiers de la fiche personnage.
 *
 *  Tout ce qui se lit ici est calcule par le SERVEUR (`fiche` : niveau, XP,
 *  cible, progression). La page ne connait aucune courbe d'XP : une seconde
 *  courbe en JavaScript divergerait de celle du Lua, prouvee contre le TS. */
function RendreMetiers() {
	const liste = $("metiers");
	if (!liste) return;
	const metiers = (ETAT.metiers && ETAT.metiers.metiers) || [];
	liste.textContent = "";

	if (metiers.length === 0) {
		const li = document.createElement("li");
		li.className = "metier metier--vide";
		li.textContent = "Aucun métier — ouvrir la fiche en jeu pour les charger.";
		liste.append(li);
		return;
	}

	for (const m of metiers) {
		const f = m.fiche || {};
		const li = document.createElement("li");
		li.className = "metier";
		li.dataset.metier = m.id;
		if (m.color) li.style.setProperty("--teinte", m.color);

		const nom = document.createElement("span");
		nom.className = "metier-nom";
		// Icône vectorielle du jeu (icones.js) plutôt que l'emoji du catalogue
		// web : un emoji dépend de la police du système et fait « généré ».
		const ico = typeof Icone === "function" ? Icone(`metier_${m.id}`, "metier-ico") : null;
		if (ico) nom.append(ico);
		nom.append(document.createTextNode(m.label || m.id));

		const niveau = document.createElement("span");
		niveau.className = "metier-niveau";
		niveau.textContent = f.max ? `Niv. ${f.niveau} — max` : `Niv. ${f.niveau ?? 1}`;

		// La barre porte la progression DANS le niveau, pas la progression totale :
		// c'est ce qui bouge a chaque coup de pioche, donc ce qui se remarque.
		const barre = document.createElement("span");
		barre.className = "metier-barre";
		const plein = document.createElement("span");
		plein.className = "metier-plein";
		plein.style.width = `${Math.round(Math.max(0, Math.min(1, f.progression || 0)) * 100)}%`;
		barre.append(plein);

		const xp = document.createElement("span");
		xp.className = "metier-xp";
		xp.textContent = f.max ? `${f.xp_cumulee ?? 0} XP cumulée` : `${f.xp ?? 0} / ${f.cible ?? 0} XP`;

		// Le detail de Skill Level Manager (XP cumulee, niveau maximal) passe en
		// infobulle : utile au survol, encombrant en permanence.
		li.title = `XP cumulée : ${f.xp_cumulee ?? 0}
Niveau maximal : ${ETAT.metiers.niveau_max ?? "?"}`;

		li.append(nom, niveau, barre, xp);
		liste.append(li);
	}
}

function RendreClasses() {
	const { classes, actuelle } = ETAT.classes;
	const liste = $("classes");
	liste.textContent = "";

	for (const c of classes) {
		const li = document.createElement("li");
		li.className = "classe";
		// La couleur vient du catalogue : ajouter une classe côté TS la colore
		// ici sans toucher au CSS.
		if (c.outfitColor) li.style.setProperty("--teinte", c.outfitColor);

		const estActuelle = c.id === actuelle;
		if (estActuelle) li.setAttribute("aria-current", "true");

		const titre = document.createElement("span");
		titre.className = "titre";
		titre.textContent = c.label || c.id;

		const meta = document.createElement("span");
		meta.className = "meta";
		meta.textContent = `${c.element || "?"} · ${c.role || "?"}`;

		const stats = document.createElement("span");
		stats.className = "stats";
		const b = c.baseStats || {};
		for (const [etiquette, valeur] of [
			["PV", b.hp], ["MANA", b.mana], ["ATQ", b.attackPower], ["DEF", b.defense],
		]) {
			if (valeur === undefined || valeur === null) continue;
			const s = document.createElement("span");
			s.innerHTML = `${etiquette} <b></b>`;
			s.querySelector("b").textContent = valeur;
			stats.append(s);
		}

		li.append(titre, meta, stats);

		// Rejouer la classe portée relancerait un respawn pour rien.
		if (!estActuelle) {
			li.addEventListener("click", () => {
				if (typeof Events !== "undefined") Events.Call("Narvos:UIChoisirClasse", c.id);
			});
		}

		liste.append(li);
	}
}

// ── Ouverture / fermeture ─────────────────────────────────────────────────────

// Tous les panneaux de la couche WebUI, par identifiant de section.
//
// ⚠ LISTE UNIQUE. Tant qu'il n'y en avait que deux, les masquer un par un
// tenait ; à six, une ligne oubliée laisse un panneau ouvert SOUS celui qu'on
// vient d'ouvrir — deux interfaces empilées qui se disputent la souris. La
// liste rend l'oubli impossible.
const PANNEAUX = ["inventaire", "personnage", "props", "spawn", "armes", "vehicules", "commandes", "garde-robe", "radar", "pause", "graphismes", "jouabilite", "fouille", "assemblage", "atelier", "gisement", "teleports", "dialogue", "boutique", "telephone", "digicode", "editionpnj", "interface"];

// Rendus à l'ouverture, pas à chaque message : l'état est poussé en continu par
// le serveur, redessiner un panneau fermé est du travail perdu.
// `ateliers.js` y ajoute ses propres entrées — d'où une table et non une
// cascade de `if`, qui obligerait à modifier CETTE fonction à chaque panneau.
const RENDUS = {
	inventaire: () => RendreInventaire(),
	personnage: () => { RendreClasses(); RendreMetiers(); },
	// Le Lua repond par `NarvosGraphismes`. On DEMANDE au lieu de garder une
	// copie : le niveau peut avoir change ailleurs (raccourci, autre session),
	// et un panneau qui affiche un etat perime est pire qu'un panneau vide.
	graphismes: () => { if (typeof Events !== "undefined") Events.Call("Narvos:UIGraphismesDemande"); },
	// Jouabilité : même discipline — on DEMANDE le registre + les valeurs au
	// serveur, la page ne garde aucune copie de référence.
	jouabilite: () => { if (typeof Events !== "undefined") Events.Call("Narvos:UJouabiliteDemande"); },
	// ⚠ Le menu de pause DEMANDE lui aussi. Il affiche le niveau courant sous
	// « Parametres », et `GFX` est vide tant que le panneau graphique n'a jamais
	// ete ouvert : sans cette ligne, la toute premiere pause d'une session
	// affiche « Graphismes : — ». Un tiret la ou on attend une valeur passe pour
	// une panne, pas pour un etat non charge.
	pause: () => {
		RendrePause();
		if (typeof Events !== "undefined") Events.Call("Narvos:UIGraphismesDemande");
	},
};

let radarMinuteur = null;

function Ouvrir(nom) {
	ETAT.ouvert = nom;
	// Le mode « disposition » (zones du HUD saisissables, voile effacé) n'existe
	// que panneau Interface ouvert (interface.js).
	if (nom !== "interface") delete document.body.dataset.disposition;
	$("voile").hidden = false;

	for (const p of PANNEAUX) {
		const section = $(p);
		if (section) section.hidden = p !== nom;
	}

	const rendu = RENDUS[nom];
	if (rendu) rendu();

	// Radar : une fois ouvert, on suit le joueur — re-demande périodiquement la
	// position au serveur (sinon c'est un instantané figé sur l'ouverture).
	if (nom === "radar" && !radarMinuteur) {
		radarMinuteur = setInterval(() => {
			if (typeof Events !== "undefined") Events.Call("Narvos:RadarRefresh");
		}, 600);
	}
}

function Fermer() {
	// L'inventaire rouvrira sur le sac, pas sur l'onglet Apparence (inventaire.js).
	if (ETAT.ouvert === "inventaire" && typeof InvSurFermeture === "function") InvSurFermeture();
	ETAT.ouvert = null;
	delete document.body.dataset.disposition;
	$("voile").hidden = true;
	if (radarMinuteur) { clearInterval(radarMinuteur); radarMinuteur = null; }

	for (const p of PANNEAUX) {
		const section = $(p);
		if (section) section.hidden = true;
	}
}

// ── Entrées de la page ────────────────────────────────────────────────────────

function DemanderFermeture() {
	// Toujours par le Lua : lui seul peut rendre la souris au jeu. Fermer ici
	// sans le prévenir laisserait le curseur libre et le joueur incapable de
	// tourner la caméra.
	if (typeof Events !== "undefined") Events.Call("Narvos:UIFermer");
	else Fermer();
}

document.addEventListener("click", (e) => {
	// Le bouton ESC et le voile ferment tous les deux : cliquer à côté d'une
	// fenêtre pour la fermer est un réflexe acquis, ne pas le servir agace.
	if (e.target.closest("[data-fermer]") || e.target.id === "voile") DemanderFermeture();
});

// Échap ferme le panneau ouvert. Le raccourci est traité ICI et pas seulement
// côté Lua parce que, panneau ouvert, la souris est rendue à l'interface et le
// clavier arrive d'abord à la page. Le Lua garde son propre binding en second
// filet, pour le cas où le focus resterait au jeu.
document.addEventListener("keydown", (e) => {
	if (e.key !== "Escape" || !ETAT.ouvert) return;
	e.preventDefault();
	// Sous-menu : on remonte a la pause. Le Lua fait le meme arbitrage de son
	// cote — les deux chemins doivent donner le meme resultat, sinon la touche
	// se comporte differemment selon qui a le focus, et ca passe pour un bug.
	if (SOUS_MENUS.includes(ETAT.ouvert) && typeof Events !== "undefined") {
		Events.Call("Narvos:UIPause");
		return;
	}
	DemanderFermeture();
});

// La fermeture repasse par le Lua — lui seul peut rendre la souris au jeu.
// Fermer ici sans le prévenir laisserait le curseur libre et le joueur
// incapable de tourner la caméra.

// ══════════════════════════════════════════════════════════════════════════════
// COUCHE HUD
//
// Séparée du WebUI par la doctrine du canvas : le HUD affiche en continu et ne
// se clique pas ; les panneaux I et F10 se cliquent et masquent le jeu. Les deux
// ne partagent que la page.
// ══════════════════════════════════════════════════════════════════════════════

const HUD = {
	vie: { valeur: 0, max: 0 },
	armure: { valeur: 0, max: 0 },
};

// Teintes d'élément, reprises des `outfitColor` du catalogue de classes. Le
// canvas donnait deux couleurs de faction ; NARVOS en a une par élément, ce qui
// couvre le même besoin avec nos propres données.
const TEINTE_ELEMENT = {
	electric: "#4fd8ff",
	fire: "#ff7043",
	earth: "#7cb342",
	light: "#ffd54f",
	dark: "#c78cff",
	water: "#4fc3f7",
	acid: "#b2ff59",
};

/** Remplit une jauge et bascule l'alerte sous 30 %. */
function RendreJauge(idBarre, idValeur, valeur, max, alerteSur) {
	const barre = $(idBarre);
	const texte = $(idValeur);
	if (!barre || !texte) return;

	const pct = max > 0 ? Math.max(0, Math.min(100, (valeur / max) * 100)) : 0;
	barre.style.width = `${pct}%`;
	texte.textContent = `${Math.round(valeur)} / ${Math.round(max)}`;

	// Le halo unique du système : il ne s'allume qu'en alerte, parce que c'est le
	// seul moment où il porte une information. Allumé en permanence, il ne dirait
	// plus rien — et deux halos voisins sont interdits par le canvas.
	if (alerteSur) {
		const conteneur = $(alerteSur);
		if (conteneur) conteneur.classList.toggle("hud-jauge--alerte", pct > 0 && pct < 30);
	}
}

function MajVie() {
	RendreJauge("vie-barre", "vie-valeur", HUD.vie.valeur, HUD.vie.max, "jauge-vie");
}

function MajArmure() {
	RendreJauge("armure-barre", "armure-valeur", HUD.armure.valeur, HUD.armure.max, null);
}

/** Affiche l'arme tenue, ou masque le panneau si les mains sont vides. */
function MajArme(actif, nom, chargeur, reserve, viseur) {
	const panneau = $("hud-arme");
	const croix = $("viseur");
    if (!panneau || !croix) return;

	panneau.hidden = !actif;
	croix.hidden = !actif;
	if (!actif) return;

	$("arme-nom").textContent = nom || "—";
	$("arme-chargeur").textContent = chargeur ?? 0;
	$("arme-reserve").textContent = reserve ?? 0;

	// Chargeur vide : l'alerte passe sur le compteur. C'est l'information la plus
	// urgente à l'écran à cet instant.
	panneau.classList.toggle("hud-arme--vide", (chargeur ?? 0) === 0);

	// Le viseur est choisi par l'ARME, pas par un réglage : une gerbe de pompe et
	// une balle de pistolet ne se visent pas pareil.
	if (viseur) croix.dataset.viseur = viseur;
}

// ── Retour de mêlée ───────────────────────────────────────────────────────────
//
// Quatre événements poussés par `Client/Index.lua`, qui relaie les `Narvos:*`
// du serveur. Les arguments ci-dessous sont ceux RÉELLEMENT envoyés, relus dans
// les `HUD:CallEvent` — pas supposés :
//
//   NarvosCoupAnnonce(direction, fenetre_ms)
//       direction : "Front" | "Right" | "Back" | "Left" (Combat.DIRECTIONS)
//       fenetre_ms : Combat.FENETRE_CONTRE_MS — 320 aujourd'hui
//   NarvosCoup(etape, degats, critique)
//       etape : 1, 2 ou 3 (index dans Combat.CHAINE)
//       degats : entier, ou nil à poings nus (Server/Combat.lua, cas `Punch`)
//       critique : booléen
//   NarvosCoupRefuse(raison)
//       raison : le texte rendu par Combat.EtapeSuivante ("Coup en cours"…)
//   NarvosContre(direction, multiplicateur)
//       direction : "Front", "Left", "Right", "Back" — la direction du contre.
//       ⚠ Ce champ arrivait NIL jusqu'au 2026-09-09 : le serveur envoyait
//       `plan.cle`, que `Combat.Contrer` n'a jamais produit (son plan porte
//       direction/action/multiplicateur). Corrigé côté serveur ; le paramètre
//       reste ignoré ici tant que le panneau ne l'affiche pas.
//       multiplicateur : Combat.MULT_CONTRE — 1.6 aujourd'hui.

const MELEE = {
	paradeJusqua: 0,     // Date.now() de fermeture de la parade affichée
	minuteurParade: null,
	minuteurCombo: null,
};

/** Un coup arrive : chevron du côté d'où il vient, pour la durée de la fenêtre. */
function AnnoncerCoup(direction, fenetre_ms) {
	const boite = $("melee-parade");
	if (!boite || typeof direction !== "string" || direction === "") return;

	// Même règle que `Combat.Telegraphier` : deux assaillants annoncent deux
	// coups, on garde celui dont la fenêtre se ferme LE PLUS TÔT. Afficher le
	// plus récent ferait parer vers un coup pas encore parti.
	const maintenant = Date.now();
	const duree = Math.max(0, Number(fenetre_ms) || 320);
	if (maintenant < MELEE.paradeJusqua && MELEE.paradeJusqua <= maintenant + duree) return;

	boite.dataset.dir = direction;
	MELEE.paradeJusqua = maintenant + duree;

	if (MELEE.minuteurParade) clearTimeout(MELEE.minuteurParade);
	// Le repère disparaît À la fermeture de la fenêtre : rester après ferait
	// parer vers un coup déjà encaissé — c'est pour ça que le Lua oublie lui-
	// même `direction_annoncee` au bout du même délai.
	MELEE.minuteurParade = setTimeout(() => {
		boite.dataset.dir = "";
		MELEE.paradeJusqua = 0;
		MELEE.minuteurParade = null;
	}, duree);
}

/** Efface la parade tout de suite (fenêtre consommée par un contre réussi). */
function EffacerParade() {
	const boite = $("melee-parade");
	if (boite) boite.dataset.dir = "";
	MELEE.paradeJusqua = 0;
	if (MELEE.minuteurParade) { clearTimeout(MELEE.minuteurParade); MELEE.minuteurParade = null; }
}

/** Éteint les paliers de combo : refus du serveur, ou fenêtre expirée. */
function EteindreCombo() {
	const paliers = $("combo-paliers");
	if (!paliers) return;
	for (const li of paliers.children) li.classList.remove("atteint", "courant");
	if (MELEE.minuteurCombo) { clearTimeout(MELEE.minuteurCombo); MELEE.minuteurCombo = null; }
}

/** Notre coup est parti : impact bref, palier d'enchaînement, dégâts si connus. */
function CoupParti(etape, degats, critique) {
	const impact = $("melee-impact");
	if (impact) {
		// Le cycle retrait/reflow/ajout REJOUe l'animation : sans lui, deux coups
		// rapprochés n'afficheraient qu'un seul éclair.
		impact.classList.remove("actif", "critique");
		void impact.offsetWidth;
		if (critique === true) impact.classList.add("critique");
		impact.classList.add("actif");
	}

	const paliers = $("combo-paliers");
	if (paliers) {
		const n = Math.max(1, Math.min(3, Number(etape) || 1));
		[...paliers.children].forEach((li, i) => {
			li.classList.toggle("atteint", i < n);
			li.classList.toggle("courant", i === n - 1);
		});
		if (MELEE.minuteurCombo) clearTimeout(MELEE.minuteurCombo);
		// Les paliers s'éteignent d'eux-mêmes : la fenêtre d'enchaînement se
		// ferme côté serveur sans nous prévenir, et une barre figée mentirait.
		// Un refus, lui, les éteint immédiatement via `CoupRefuse`.
		MELEE.minuteurCombo = setTimeout(EteindreCombo, 900);
	}

	// À poings nus, degats arrive nil : n'afficher que ce qu'on sait.
	if (typeof degats === "number") {
		const sortie = $("combo-degats");
		if (sortie) {
			sortie.textContent = String(Math.round(degats));
			sortie.classList.toggle("critique", critique === true);
			sortie.classList.remove("actif");
			void sortie.offsetWidth;
			sortie.classList.add("actif");
		}
	}
}

/** Coup refusé : l'enchaînement repart de zéro — le joueur doit le VOIR. */
function CoupRefuse(raison) {
	EteindreCombo();
	// Le refus passe par le canal commun des refus du serveur (recharge,
	// plafond, touche prise…) : même ton, même durée. Le retrait des paliers
	// est le signal propre au combo — c'est lui qui dit « on repart de zéro ».
	if (typeof Message === "function" && raison) Message(String(raison), "erreur");
}

/** Contre réussi : la fenêtre est consommée, la riposte est annoncée. */
function ContreReussi(_direction, multiplicateur) {
	EffacerParade();

	const boite = $("melee-contre");
	if (!boite) return;
	const mult = $("contre-mult");
	const m = Number(multiplicateur);
	if (mult) mult.textContent = m > 0 ? `×${String(m).replace(".", ",")}` : "";

	boite.classList.remove("actif");
	void boite.offsetWidth;
	boite.classList.add("actif");
}

// ── Pause et graphismes ───────────────────────────────────────────────────────
//
// Le menu de pause REMPLACE celui de nanos : le Lua consomme la touche Echap
// (`return false` dans `KeyPress`), donc rien d'autre ne s'ouvre. Ce qui est
// affiche ici est tout ce que le joueur a.

// Panneaux atteints DEPUIS le menu de pause. Echap y remonte a la pause au lieu
// de tout fermer.
//
// ⚠ Le Lua tient la meme liste, et les deux doivent rester d'accord : sinon la
// touche se comporte differemment selon qui a le focus — panneau ouvert, le
// clavier arrive d'abord a la page ; focus au jeu, il arrive au Lua. Un ecart
// ici passe pour un bug intermittent, le pire genre a diagnostiquer.
const SOUS_MENUS = ["graphismes", "commandes", "jouabilite", "interface"];

// Dernier etat recu du Lua. On ne le fabrique pas : libelles, ordre, resumes et
// chiffres viennent tous de `Narvos.Graphismes.PourInterface`.
let GFX = [];

/** Le nom du niveau courant, ou un tiret tant que le Lua n'a pas repondu. */
function NiveauCourant() {
	const actif = GFX.find((n) => n.actif);
	return actif ? actif.libelle : "—";
}

/** Le menu de pause affiche le niveau courant sous « Parametres ». */
function RendrePause() {
	const note = $("pause-niveau");
	if (note) note.textContent = "Graphismes : " + NiveauCourant();
}

/**
 * Les trois niveaux, avec leurs chiffres.
 *
 * ⚠ `portee_m` arrive DEJA en metres — la conversion depuis les centimetres
 * d'Unreal se fait en Lua, une seule fois. La refaire ici donnerait 1,5 m au
 * lieu de 150 : c'est l'erreur metre/centimetre qui a rendu 31 PNJ hauts de
 * 1,7 cm.
 */
function RendreGraphismes() {
	const liste = $("gfx-liste");
	if (!liste) return;

	liste.innerHTML = "";

	for (const n of GFX) {
		const li = document.createElement("li");
		li.className = "gfx-ligne" + (n.actif ? " gfx-ligne--actif" : "");

		const bouton = document.createElement("button");
		bouton.className = "gfx-bouton";
		bouton.dataset.niveau = n.id;

		const tete = document.createElement("span");
		tete.className = "gfx-tete";

		const nom = document.createElement("span");
		nom.className = "gfx-nom";
		nom.textContent = n.libelle;
		tete.appendChild(nom);

		// Les chiffres, pas des adjectifs. « portee reduite » ne se verifie pas ;
		// « 150 m » se verifie en marchant.
		const chiffres = document.createElement("span");
		chiffres.className = "gfx-chiffres";
		const d = n.details || {};
		chiffres.textContent = [
			(d.portee_m || 0) + " m",
			d.ombres ? "ombres" : "sans ombres",
			d.effets ? "effets d'image" : "sans effets",
		].join(" · ");
		tete.appendChild(chiffres);

		const resume = document.createElement("span");
		resume.className = "gfx-resume";
		resume.textContent = n.resume || "";

		bouton.appendChild(tete);
		bouton.appendChild(resume);
		li.appendChild(bouton);
		liste.appendChild(li);
	}

	const actuel = $("gfx-actuel");
	if (actuel) actuel.textContent = NiveauCourant();
}

// ── Jouabilité ─────────────────────────────────────────────────────────────────
//
// La page rend le REGISTRE poussé par le serveur (`Narvos:Jouabilite`) : un
// toggle, un choix, une sélection multiple ou un groupe de sous-paramètres —
// chaque type a SA forme, et un paramètre ajouté demain apparaît sans toucher
// à ce fichier. Les gestes repartent au serveur, qui valide et renvoie l'état.

/** Dernier état reçu du Lua : { categories, parametres }. Vide tant que rien. */
let JOUAB = { categories: [], parametres: [] };

/** Une ligne de paramètre (toggle, choix ou multi) — la structure vient du registre. */
function LigneJouabilite(p, avecRetour) {
	const li = document.createElement("li");
	li.className = "joua-ligne";

	const tete = document.createElement("div");
	tete.className = "joua-tete";
	const nom = document.createElement("span");
	nom.className = "joua-nom";
	nom.textContent = p.label;
	tete.appendChild(nom);
	if (p.description) {
		const desc = document.createElement("span");
		desc.className = "joua-desc";
		desc.textContent = p.description;
		tete.appendChild(desc);
	}
	li.appendChild(tete);

	if (p.type === "toggle") {
		const bouton = document.createElement("button");
		bouton.className = "joua-bouton" + (p.valeur ? " joua-bouton--actif" : "");
		bouton.dataset.jouabiliteToggle = p.id;
		bouton.textContent = p.valeur ? "Activé" : "Désactivé";
		li.appendChild(bouton);
	} else if (p.type === "choix") {
		const zone = document.createElement("span");
		zone.className = "joua-choix";
		for (const v of p.valeurs || []) {
			const b = document.createElement("button");
			b.className = "joua-option" + (p.valeur === v.id ? " joua-option--actif" : "");
			b.dataset.jouabiliteChoix = p.id;
			b.dataset.valeur = v.id;
			b.textContent = v.label;
			zone.appendChild(b);
		}
		li.appendChild(zone);
	} else if (p.type === "multi") {
		const zone = document.createElement("span");
		zone.className = "joua-choix";
		for (const v of p.valeurs || []) {
			const actif = !!(p.valeur && p.valeur[v.id]);
			const b = document.createElement("button");
			b.className = "joua-option" + (actif ? " joua-option--actif" : "");
			b.dataset.jouabiliteMulti = p.id;
			b.dataset.valeur = v.id;
			b.textContent = v.label;
			zone.appendChild(b);
		}
		li.appendChild(zone);
	} else {
		li.classList.add("joua-ligne--inconnu");
		const note = document.createElement("span");
		note.className = "joua-desc";
		note.textContent = "type inconnu : " + (p.type || "?");
		li.appendChild(note);
	}

	if (avecRetour) {
		const bouton = document.createElement("button");
		bouton.className = "action action--fantome joua-reinit";
		bouton.dataset.jouabiliteReinit = p.id;
		bouton.textContent = "défaut";
		li.appendChild(bouton);
	}
	return li;
}

function RendreJouabilite() {
	const liste = $("jouabilite-liste");
	if (!liste) return;
	liste.innerHTML = "";

	for (const p of JOUAB.parametres || []) {
		if (p.type === "groupe") {
			const titre = document.createElement("li");
			titre.className = "joua-groupe-titre";
			const nom = document.createElement("span");
			nom.className = "joua-nom";
			nom.textContent = p.label;
			titre.appendChild(nom);
			if (p.description) {
				const desc = document.createElement("span");
				desc.className = "joua-desc";
				desc.textContent = p.description;
				titre.appendChild(desc);
			}
			liste.appendChild(titre);
			for (const s of p.sous || []) liste.appendChild(LigneJouabilite(s, false));
			continue;
		}
		liste.appendChild(LigneJouabilite(p, true));
	}
}

// ── Fouille ────────────────────────────────────────────────────────────────────
//
// Le serveur ouvre CE panneau (Narvos:Fouille) avec la liste du cadavre le plus
// proche : uid, libellé, quantité, poids. Prendre / tout prendre repartent au
// serveur, qui revalide la proximité et le sac — la page n'a aucun catalogue.

/** Dernière vue reçue : { objets: [], poids }. */
let FOUILLE = { objets: [], poids: 0 };

function RendreFouille() {
	const liste = $("fouille-liste");
	const poids = $("fouille-poids");
	const etat = $("fouille-etat");
	if (!liste) return;

	liste.innerHTML = "";
	if (poids) poids.textContent = "poids restant : " + (FOUILLE.poids || 0).toFixed(2) + " kg";
	if (etat) etat.textContent = (FOUILLE.objets || []).length + " objet(s)";

	for (const o of FOUILLE.objets || []) {
		const li = document.createElement("li");
		li.className = "fouille-ligne";

		const nom = document.createElement("span");
		nom.className = "fouille-nom";
		nom.textContent = o.label;

		const details = document.createElement("span");
		details.className = "fouille-details";
		details.textContent = "×" + o.quantite + " · " + (o.poids || 0).toFixed(2) + " kg";

		const bouton = document.createElement("button");
		bouton.className = "action fouille-prendre";
		bouton.dataset.fouillePrendre = o.uid;
		bouton.textContent = "Prendre";

		li.append(nom, details, bouton);
		liste.appendChild(li);
	}
}

// Clics du menu de pause et du panneau graphique. Un seul ecouteur delegue :
// les lignes sont recreees a chaque rendu, un ecouteur par bouton fuirait.
document.addEventListener("click", (e) => {
	const action = e.target.closest("[data-pause]");
	if (action) {
		if (typeof Events === "undefined") return;
		const quoi = action.dataset.pause;
		if (quoi === "reprendre") Events.Call("Narvos:UIReprendre");
		else if (quoi === "parametres") Events.Call("Narvos:UIGraphismesPanneau");
		else if (quoi === "commandes") Events.Call("Narvos:UICommandesPanneau");
		else if (quoi === "jouabilite") Events.Call("Narvos:UIJouabilitePanneau");
		else if (quoi === "interface") Events.Call("Narvos:UIInterfacePanneau");
		else if (quoi === "retour") Events.Call("Narvos:UIPause");
		else if (quoi === "quitter") Events.Call("Narvos:UIQuitter");
		return;
	}

	const niveau = e.target.closest("[data-niveau]");
	if (niveau && typeof Events !== "undefined") {
		Events.Call("Narvos:UIGraphismes", niveau.dataset.niveau);
		return;
	}

	// ── Jouabilité : chaque geste repart au serveur, qui valide et renvoie. ──
	if (typeof Events !== "undefined") {
		const toggle = e.target.closest("[data-jouabilite-toggle]");
		if (toggle) {
			const id = toggle.dataset.jouabiliteToggle;
			const ligne = JOUAB.parametres.find((p) => p.id === id);
			Events.Call("Narvos:UIJouabiliteDefinir", id, !(ligne && ligne.valeur));
			return;
		}

		const choix = e.target.closest("[data-jouabilite-choix]");
		if (choix) {
			Events.Call("Narvos:UIJouabiliteDefinir", choix.dataset.jouabiliteChoix, choix.dataset.valeur);
			return;
		}

		const multi = e.target.closest("[data-jouabilite-multi]");
		if (multi) {
			const id = multi.dataset.jouabiliteMulti;
			const ligne = JOUAB.parametres.find((p) => p.id === id);
			const valeur = { ...((ligne && ligne.valeur) || {}) };
			valeur[multi.dataset.valeur] = !valeur[multi.dataset.valeur];
			Events.Call("Narvos:UIJouabiliteDefinir", id, valeur);
			return;
		}

		const reinit = e.target.closest("[data-jouabilite-reinit]");
		if (reinit) {
			Events.Call("Narvos:UIJouabiliteReinit", reinit.dataset.jouabiliteReinit);
			return;
		}

		const toutReinit = e.target.closest("[data-jouabilite-reset]");
		if (toutReinit) {
			Events.Call("Narvos:UIJouabiliteReinit", "");
			return;
		}

		// ── Fouille ──
		const prendre = e.target.closest("[data-fouille-prendre]");
		if (prendre) {
			Events.Call("Narvos:UIFouillePrendre", Number(prendre.dataset.fouillePrendre));
			return;
		}

		const tout = e.target.closest("[data-fouille-tout]");
		if (tout) {
			Events.Call("Narvos:UIFouilleTout");
			return;
		}

		const fermerFouille = e.target.closest("[data-fouille-fermer]");
		if (fermerFouille) {
			Events.Call("Narvos:UIFouilleFermer");
			return;
		}
	}
});

// ── Pont Lua ──────────────────────────────────────────────────────────────────

if (typeof Events !== "undefined") {
	Events.Subscribe("NarvosOuvrir", Ouvrir);
	Events.Subscribe("NarvosFermer", Fermer);

	Events.Subscribe("NarvosInventaire", (donnees) => {
		ETAT.inventaire = donnees || ETAT.inventaire;
		// Notifications de butin (inventaire.js) : comparées à l'envoi précédent,
		// même panneau fermé.
		if (typeof InvDetecterButin === "function") InvDetecterButin();
		if (ETAT.ouvert === "inventaire") RendreInventaire();
	});

	Events.Subscribe("NarvosMetiers", (donnees) => {
		ETAT.metiers = donnees || ETAT.metiers;
		if (ETAT.ouvert === "personnage") RendreMetiers();
	});

	// Un GAIN : on remplace la seule fiche concernee, sans redemander la liste.
	// Si la fiche n'a jamais ete chargee, il n'y a rien a mettre a jour — la
	// prochaine ouverture redemandera l'etat complet.
	Events.Subscribe("NarvosMetier", (gain) => {
		const liste = ETAT.metiers && ETAT.metiers.metiers;
		if (!gain || !Array.isArray(liste)) return;
		const m = liste.find((x) => x.id === gain.metier);
		if (m && gain.fiche) m.fiche = gain.fiche;
		if (ETAT.ouvert === "personnage") RendreMetiers();
	});

	Events.Subscribe("NarvosClasses", (donnees) => {
		ETAT.classes = donnees || ETAT.classes;
		if (ETAT.ouvert === "personnage") RendreClasses();
	});

	// Le Lua pousse la liste à l'ouverture du panneau ET à chaque changement de
	// niveau. On redessine les deux panneaux qui l'affichent : le menu de pause
	// montre le niveau courant sous « Parametres », et il reste ouvert derriere.
	Events.Subscribe("NarvosGraphismes", (niveaux) => {
		GFX = Array.isArray(niveaux) ? niveaux : [];
		if (ETAT.ouvert === "graphismes") RendreGraphismes();
		RendrePause();
	});

	// ── Jouabilité (2026-09-19) : le serveur pousse registre + valeurs après
	// chaque changement. On redessine si le panneau est ouvert.
	Events.Subscribe("NarvosJouabilite", (donnees) => {
		JOUAB = donnees || { categories: [], parametres: [] };
		if (ETAT.ouvert === "jouabilite") RendreJouabilite();
	});

	// ── Fouille (2026-09-19) : le serveur ouvre le panneau PAR cette vue.
	// Ouvrir() a déjà rendu la section visible (Basculer côté Lua) ; la vue
	// arrive juste après et remplit la liste.
	Events.Subscribe("NarvosFouille", (vue) => {
		FOUILLE = vue || { objets: [], poids: 0 };
		RendreFouille();
	});

	// ── Événements du HUD ────────────────────────────────────────────────────

	Events.Subscribe("HudVie", (valeur, max) => {
		HUD.vie = { valeur, max };
		MajVie();
	});

	Events.Subscribe("HudArmure", (valeur, max) => {
		HUD.armure = { valeur, max };
		MajArmure();
	});

	Events.Subscribe("HudArme", MajArme);

	// L'identité de classe pilote la teinte de TOUT le HUD : nom d'arme, viseur,
	// accents. Une variable CSS posée ici, et rien d'autre à changer — c'est ce
	// qui permet d'ajouter une classe sans toucher au style.
	Events.Subscribe("HudClasse", (label, element) => {
		const titre = $("hud-classe");
		if (titre) titre.textContent = label || "—";

		const teinte = TEINTE_ELEMENT[element];
		if (teinte) document.documentElement.style.setProperty("--element", teinte);
	});

	// ── Retour de mêlée ────────────────────────────────────────────────────
	// Les quatre événements de combat que le Lua pousse déjà (relais des
	// `Narvos:Coup*` du serveur) et qu'aucune page n'écoutait jusqu'ici.
	Events.Subscribe("NarvosCoupAnnonce", AnnoncerCoup);
	Events.Subscribe("NarvosCoup", CoupParti);
	Events.Subscribe("NarvosCoupRefuse", CoupRefuse);
	Events.Subscribe("NarvosContre", ContreReussi);
}


// ══════════════════════════════════════════════════════════════════════════════
// ROUE D'OBJETS (TAB)
//
// Cinq emplacements persistés PAR PERSONNAGE, garnis d'armes et de
// consommables. La page ne décide de rien : chaque geste (assigner, retirer,
// activer) part au Lua, le serveur revalide — le sac et l'arme tenue sont de
// son côté, jamais du nôtre.
//
// Événements :
//   Lua -> page   NarvosRoue (vue) · NarvosRoue:Ouvrir · NarvosRoue:Fermer
//                 NarvosRoueRefus (raison) · NarvosRoueActivee (emplacement)
//   page -> Lua   NarvosRoue:Activer (e) · NarvosRoue:Assigner (e, item_id)
//                 NarvosRoue:Liberer (e) · NarvosRoue:UIFermer
// ══════════════════════════════════════════════════════════════════════════════

const ROUE = {
	ouverte: false,
	vue: { emplacements: [], eligibles: [] },
	cible: null,          // emplacement (1..5) en cours d'assignation, ou null
	minuteurRefus: null,
};

/** Icône d'un objet : le webp du catalogue, l'émoji en dessous par sécurité. */
function RoueIcone(entree) {
	const boite = document.createElement("span");
	boite.className = "roue-icone";

	const emoji = document.createElement("span");
	emoji.className = "roue-emoji";
	emoji.textContent = entree.icone || "?";
	boite.append(emoji);

	if (entree.iconFile) {
		const img = document.createElement("img");
		img.className = "roue-img";
		img.src = "img/items/" + entree.iconFile + ".webp";
		img.alt = "";
		// Icône absente du paquet : l'émoji dessous prend le relais.
		img.addEventListener("error", () => img.remove());
		boite.append(img);
	}

	return boite;
}

function RendreRoue() {
	const arc = $("roue-arc");
	if (!arc) return;
	arc.textContent = "";

	const emplacements = ROUE.vue.emplacements || [];
	for (let e = 1; e <= 5; e++) {
		const entree = emplacements[e - 1] || { emplacement: e };

		const li = document.createElement("li");
		li.className = "roue-slot";
		li.dataset.rang = String(e);

		const bouton = document.createElement("button");
		bouton.className = "roue-case";
		if (!entree.item_id) {
			bouton.classList.add("roue-case--vide");
		} else {
			bouton.dataset.rarete = entree.rarete || "common";
			// Assignée mais plus dans le sac : grisée AVANT le refus du serveur.
			if (entree.present === false) bouton.classList.add("roue-case--absente");
		}

		const numero = document.createElement("span");
		numero.className = "roue-num";
		numero.textContent = String(e);
		bouton.append(numero);

		if (entree.item_id) {
			bouton.append(RoueIcone(entree));
			const nom = document.createElement("span");
			nom.className = "roue-nom";
			nom.textContent = entree.nom || entree.item_id;
			bouton.append(nom);
		}

		// Clic sur la case : utiliser ce qu'elle contient. Sur une case vide,
		// le serveur refuse et le refus s'affiche — le retour visuel est là.
		bouton.addEventListener("click", () => {
			if (typeof Events !== "undefined") Events.Call("NarvosRoue:Activer", e);
		});

		li.append(bouton);

		// Le + / × vit SOUS la case, pas dessus : la case reste un seul geste
		// (utiliser), jamais deux zones qui se disputent le clic.
		const outil = document.createElement("button");
		outil.className = "roue-outil";
		if (entree.item_id) {
			outil.textContent = "×";
			outil.title = "Retirer de l'emplacement";
			outil.addEventListener("click", () => {
				if (typeof Events !== "undefined") Events.Call("NarvosRoue:Liberer", e);
			});
		} else {
			outil.textContent = "+";
			outil.title = "Assigner un objet";
			outil.addEventListener("click", () => RoueAssignation(e));
		}
		li.append(outil);

		arc.append(li);
	}

	// La liste d'assignation suit la même vue : elle se rerend si elle est ouverte.
	if (ROUE.cible !== null) RendreEligibles();
}

function RoueAssignation(e) {
	ROUE.cible = ROUE.cible === e ? null : e;
	$("roue-assignation").hidden = ROUE.cible === null;
	if (ROUE.cible !== null) {
		$("roue-cible").textContent = String(ROUE.cible);
		RendreEligibles();
	}
}

function RendreEligibles() {
	const liste = $("roue-eligibles");
	if (!liste) return;
	liste.textContent = "";

	const eligibles = ROUE.vue.eligibles || [];
	$("roue-aucun-eligible").hidden = eligibles.length > 0;

	for (const o of eligibles) {
		const li = document.createElement("li");

		const bouton = document.createElement("button");
		bouton.className = "roue-eligible";
		bouton.dataset.rarete = o.rarete || "common";

		bouton.append(RoueIcone(o));

		const nom = document.createElement("span");
		nom.className = "nom";
		nom.textContent = o.nom || o.item_id;
		bouton.append(nom);

		// « ×1 » sur chaque ligne noierait les vraies piles dans du bruit.
		if ((o.quantite || 1) > 1) {
			const qte = document.createElement("span");
			qte.className = "qte";
			qte.textContent = `×${o.quantite}`;
			bouton.append(qte);
		}

		bouton.addEventListener("click", () => {
			if (typeof Events !== "undefined" && ROUE.cible !== null) {
				Events.Call("NarvosRoue:Assigner", ROUE.cible, o.item_id);
			}
		});

		li.append(bouton);
		liste.append(li);
	}
}

function RoueOuvrir() {
	ROUE.ouverte = true;
	ROUE.cible = null;
	$("roue-assignation").hidden = true;
	$("roue-refus").hidden = true;
	$("roue").hidden = false;
	RendreRoue();
}

function RoueFermer() {
	ROUE.ouverte = false;
	ROUE.cible = null;
	$("roue").hidden = true;
}

/** Refus du serveur : bref, posé au-dessus de l'arc, et il repart tout seul. */
function RoueRefus(raison) {
	const boite = $("roue-refus");
	if (!boite) return;
	boite.textContent = raison || "Refusé";
	boite.hidden = false;
	// Le cycle retrait/reflow/ajout REJOUe l'animation, comme l'impact de mêlée.
	boite.classList.remove("actif");
	void boite.offsetWidth;
	boite.classList.add("actif");

	if (ROUE.minuteurRefus) clearTimeout(ROUE.minuteurRefus);
	ROUE.minuteurRefus = setTimeout(() => { boite.hidden = true; }, 2600);
}

/** Le serveur a exécuté le choix : un éclair bref sur la case concernée. */
function RoueActivee(emplacement) {
	const e = Number(emplacement);
	if (!e) return;
	const slot = document.querySelector(`.roue-slot[data-rang="${e}"] .roue-case`);
	if (!slot) return;
	slot.classList.remove("actif");
	void slot.offsetWidth;
	slot.classList.add("actif");
}

// Échap ferme la roue. Traitée ICI comme pour les panneaux : roue ouverte, la
// souris est à l'interface et le clavier arrive d'abord à la page. Le Lua garde
// son propre binding en second filet, pour le cas où le focus resterait au jeu.
document.addEventListener("keydown", (e) => {
	if (e.key !== "Escape" || !ROUE.ouverte) return;
	e.preventDefault();
	// La fermeture repasse par le Lua : lui seul peut rendre la souris au jeu.
	if (typeof Events !== "undefined") Events.Call("NarvosRoue:UIFermer");
});

// Clic sur le fond (ni case ni panneau d'assignation) : fermer. Le réflexe
// « cliquer à côté pour fermer » est acquis, ne pas le servir agace.
document.addEventListener("click", (e) => {
	if (!ROUE.ouverte || typeof Events === "undefined") return;
	if (e.target.id === "roue" || e.target.classList.contains("roue-scene")) {
		Events.Call("NarvosRoue:UIFermer");
	}
});

// ── Pont Lua ──────────────────────────────────────────────────────────────────

if (typeof Events !== "undefined") {
	// L'état arrive en continu (poussé avec l'inventaire) : on ne redessine que
	// si la roue est ouverte — redessiner une roue fermée est du travail perdu.
	Events.Subscribe("NarvosRoue", (donnees) => {
		ROUE.vue = donnees || ROUE.vue;
		if (ROUE.ouverte) RendreRoue();
	});

	Events.Subscribe("NarvosRoue:Ouvrir", RoueOuvrir);
	Events.Subscribe("NarvosRoue:Fermer", RoueFermer);
	Events.Subscribe("NarvosRoueRefus", RoueRefus);
	Events.Subscribe("NarvosRoueActivee", RoueActivee);
}
