// ══════════════════════════════════════════════════════════════════════════════
// interface.js — disposition du HUD (zones déplaçables) et boussole. Demande B1.
//
// Chargé APRÈS index.js et ateliers.js : il consomme `$`, `ETAT`, `RENDUS`
// (index.js) et `DessinerRadarDans` (ateliers.js).
//
// ── QUI DÉCIDE ────────────────────────────────────────────────────────────────
// La disposition VIT côté Lua (Client/Index.lua → Package.SetPersistentData,
// normalisée par Logic/Disposition.lua) : relancer le jeu la retrouve. La page ne
// fait qu'appliquer ce qu'elle reçoit et proposer des gestes — un déplacement
// part au Lua au RELÂCHEMENT (pas à chaque pixel), qui renvoie l'état normalisé.
//
// Positions : fractions de l'écran, CENTRE de l'élément (transform -50 %/-50 %).
//
// Événements :
//   Lua -> page   NarvosInterface:Etat (etat = { disposition, zones, options })
//                 NarvosBoussole (cap, cardinal)
//   page -> Lua   NarvosInterface:Placer (zone, x, y) · NarvosInterface:Option (id, valeur)
//                 NarvosInterface:Defaut
// ══════════════════════════════════════════════════════════════════════════════

const UI_DISPO = {
	etat: null,          // dernier état du Lua
	glisse: null,        // { zone, el } pendant un déplacement
	cap: 0,
};

/** Toutes les zones déplaçables présentes dans le HUD. */
function UiZones() {
	return Array.from(document.querySelectorAll("#hud [data-zone]"));
}

/** Applique positions et options reçues. Rien reçu : le CSS d'origine reste. */
function AppliquerDisposition() {
	const d = UI_DISPO.etat && UI_DISPO.etat.disposition;
	if (!d || typeof d !== "object") return;
	const zones = d.zones || {};
	for (const el of UiZones()) {
		const pos = zones[el.dataset.zone];
		if (!pos) continue;
		el.style.left = `${(Number(pos.x) * 100).toFixed(2)}%`;
		el.style.top = `${(Number(pos.y) * 100).toFixed(2)}%`;
		el.style.right = "auto";
		el.style.bottom = "auto";
		el.style.transform = "translate(-50%, -50%)";
	}
	const options = d.options || {};
	const boussole = document.querySelector('#hud [data-zone="boussole"]');
	if (boussole) boussole.hidden = options.boussole === false;
	const carte = document.querySelector('#hud [data-zone="carte"]');
	if (carte) carte.hidden = options.carte !== true;
}

// ── Déplacement ───────────────────────────────────────────────────────────────

document.addEventListener("mousedown", (e) => {
	if (ETAT.ouvert !== "interface" || e.button !== 0) return;
	const el = e.target.closest("#hud [data-zone]");
	if (!el) return;
	e.preventDefault();
	UI_DISPO.glisse = { zone: el.dataset.zone, el };
	el.dataset.glisse = "true";
});

document.addEventListener("mousemove", (e) => {
	const g = UI_DISPO.glisse;
	if (!g) return;
	const x = Math.min(0.99, Math.max(0.01, e.clientX / window.innerWidth));
	const y = Math.min(0.99, Math.max(0.01, e.clientY / window.innerHeight));
	g.el.style.left = `${(x * 100).toFixed(2)}%`;
	g.el.style.top = `${(y * 100).toFixed(2)}%`;
	g.el.style.right = "auto";
	g.el.style.bottom = "auto";
	g.el.style.transform = "translate(-50%, -50%)";
	g.x = x;
	g.y = y;
});

document.addEventListener("mouseup", () => {
	const g = UI_DISPO.glisse;
	if (!g) return;
	UI_DISPO.glisse = null;
	delete g.el.dataset.glisse;
	if (typeof g.x === "number" && typeof Events !== "undefined") {
		Events.Call("NarvosInterface:Placer", g.zone, g.x, g.y);
	}
});

// ── Le panneau ────────────────────────────────────────────────────────────────

function RendreInterface() {
	const boite = $("ui-options");
	if (!boite) return;
	boite.replaceChildren();
	const etat = UI_DISPO.etat || {};
	const options = (etat.disposition && etat.disposition.options) || {};
	for (const o of Array.isArray(etat.options) ? etat.options : []) {
		const b = document.createElement("button");
		b.type = "button";
		b.className = "ui-option";
		b.setAttribute("aria-pressed", options[o.id] ? "true" : "false");
		const voyant = document.createElement("span");
		voyant.className = "ui-voyant";
		const libelle = document.createElement("span");
		libelle.textContent = o.libelle;
		b.append(voyant, libelle);
		b.addEventListener("click", () => {
			if (typeof Events !== "undefined") Events.Call("NarvosInterface:Option", o.id, !options[o.id]);
		});
		boite.append(b);
	}
	const zones = document.createElement("p");
	zones.className = "ui-aide";
	const noms = (Array.isArray(etat.zones) ? etat.zones : []).map((z) => z.libelle).join(" · ");
	zones.textContent = noms ? `Déplaçables : ${noms}.` : "";
	boite.append(zones);
}

const defaut = $("ui-defaut");
if (defaut) {
	defaut.addEventListener("click", () => {
		if (typeof Events !== "undefined") Events.Call("NarvosInterface:Defaut");
		const etat = $("ui-etat");
		if (etat) etat.textContent = "Disposition par défaut rétablie";
	});
}

// L'édition se lit sur le <body> : le CSS rend les zones saisissables et efface
// le voile tant que le panneau Interface est ouvert, et SEULEMENT lui.
RENDUS.interface = () => {
	document.body.dataset.disposition = "edition";
	RendreInterface();
};
// Fermer ou passer à un autre panneau quitte le mode édition : c'est `Ouvrir`
// et `Fermer` (index.js) qui retirent `data-disposition` — pas un second abonné.

// ── Boussole ──────────────────────────────────────────────────────────────────

const CARDINAUX_REGLE = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
const PX_PAR_DEGRE = 2.2;   // 90° = 198 px de règle

/** Construit une fois la règle : trois tours de graduations, pour défiler sans bord. */
function ConstruireRegle() {
	const regle = $("boussole-regle");
	if (!regle || regle.childElementCount > 0) return;
	for (let tour = -1; tour <= 1; tour++) {
		for (let deg = 0; deg < 360; deg += 15) {
			const repere = document.createElement("span");
			const angle = tour * 360 + deg;
			repere.className = deg % 45 === 0 ? "boussole-lettre" : "boussole-trait";
			if (deg % 45 === 0) repere.textContent = CARDINAUX_REGLE[deg / 45];
			if (deg % 90 === 0) repere.dataset.majeur = "true";
			repere.style.left = `${angle * PX_PAR_DEGRE}px`;
			regle.append(repere);
		}
	}
}

function MajBoussole(cap, cardinal) {
	const c = Number(cap);
	if (!Number.isFinite(c)) return;
	UI_DISPO.cap = c;
	ConstruireRegle();
	const regle = $("boussole-regle");
	if (regle) regle.style.transform = `translateX(${-(c * PX_PAR_DEGRE)}px)`;
	const affiche = $("boussole-cap");
	if (affiche && cardinal) affiche.textContent = cardinal;
}

// ── Pont Lua ──────────────────────────────────────────────────────────────────

if (typeof Events !== "undefined") {
	Events.Subscribe("NarvosInterface:Etat", (etat) => {
		if (!etat || typeof etat !== "object") return;
		UI_DISPO.etat = etat;
		AppliquerDisposition();
		if (ETAT.ouvert === "interface") RendreInterface();
	});
	Events.Subscribe("NarvosBoussole", MajBoussole);
	// La mini-carte du HUD est dessinée par `DessinerRadar` (ateliers.js), sur le
	// même fil que le radar : un seul abonné par événement.
}
