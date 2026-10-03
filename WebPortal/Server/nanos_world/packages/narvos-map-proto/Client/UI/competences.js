// ══════════════════════════════════════════════════════════════════════════════
// NARVOS — Personnage > Compétences et Talents ; niveau et XP du HUD.
//
// La page AFFICHE, le serveur DÉCIDE (Server/Progression.lua) : niveau, XP,
// statistiques, coûts modulés, possibilité d'investir ou de rembourser un talent
// arrivent calculés. Aucune courbe d'XP ni règle de prérequis n'est recopiée
// ici — une seconde copie divergerait de celle du Lua, prouvée contre le TS.
//
// Événements :
//   Lua -> page   NarvosProgression (vue) · NarvosXP (gain) · NarvosPersonnage:Onglet
//   page -> Lua   NarvosProgression:Investir(id) · :Rembourser(id) · :Reinitialiser
// ══════════════════════════════════════════════════════════════════════════════

const PROGRESSION = {
	vue: null,
	onglet: "competences",
};

const ARCHETYPES_LIBELLES = {
	basic: "frappe", projectile: "projectile", aoe: "zone", buff: "renfort",
	shield: "bouclier", dash: "élan", summon: "invocation", ultimate: "ultime", cc: "contrôle",
};

/** Libellé lisible d'un effet de talent PAR RANG (champs de talentCatalog.ts). */
function LibelleEffet(effet) {
	if (!effet) return "";
	const pct = (v) => `${Math.round(v * 1000) / 10} %`;
	const morceaux = [];
	if (effet.damagePct) morceaux.push(`+${pct(effet.damagePct)} dégâts des pouvoirs`);
	if (effet.critFlat) morceaux.push(`+${effet.critFlat} critique`);
	if (effet.maxHpPct) morceaux.push(`+${pct(effet.maxHpPct)} PV max`);
	if (effet.defenseFlat) morceaux.push(`+${effet.defenseFlat} défense`);
	if (effet.maxManaPct) morceaux.push(`+${pct(effet.maxManaPct)} mana max`);
	if (effet.manaCostReductionPct) morceaux.push(`−${pct(effet.manaCostReductionPct)} coût en mana`);
	if (effet.manaRegenPct) morceaux.push(`+${pct(effet.manaRegenPct)} régénération`);
	if (effet.moveSpeedPct) morceaux.push(`+${pct(effet.moveSpeedPct)} vitesse`);
	return morceaux.join(" · ") + " / rang";
}

const nombre = (v) => (typeof v === "number" ? v.toLocaleString("fr-FR") : "—");

/** Icône du jeu (icones.js), ou null si le script manque — la page reste
 *  lisible sans ses icônes, elle ne casse pas. */
const IconeOuRien = (nom, classe) => (typeof Icone === "function" ? Icone(nom, classe) : null);

/** Premier champ d'effet d'un talent : c'est lui qui choisit l'icône du nœud. */
const CLES_EFFET = ["damagePct", "critFlat", "maxHpPct", "defenseFlat", "maxManaPct",
	"manaCostReductionPct", "manaRegenPct", "moveSpeedPct"];

function el(tag, classe, texte) {
	const n = document.createElement(tag);
	if (classe) n.className = classe;
	if (texte !== undefined && texte !== null) n.textContent = texte;
	return n;
}

// ── Bandeau : niveau, XP, points ─────────────────────────────────────────────

function RendreBandeau() {
	const v = PROGRESSION.vue;
	if (!v) return;
	const f = v.fiche || {};
	const t = v.talents || {};

	const identite = $("perso-identite");
	if (identite) {
		const classe = v.classe && (v.classe.label || v.classe.id);
		identite.textContent = [v.nom, classe].filter(Boolean).join(" · ") || "—";
	}
	$("perso-niveau").textContent = f.niveau ?? "—";
	$("perso-xp-plein").style.width = `${Math.round(Math.max(0, Math.min(1, f.progression || 0)) * 100)}%`;
	$("perso-xp").textContent = f.max
		? "Niveau maximal atteint"
		: `${nombre(f.xp)} / ${nombre(f.cible)} XP`;
	$("perso-xp-total").textContent = `${nombre(f.xp_cumulee)} XP cumulée · max ${f.niveau_max ?? "?"}`;

	$("perso-points").textContent = t.disponibles ?? 0;
	$("perso-points-bloc").dataset.dispo = (t.disponibles || 0) > 0 ? "oui" : "non";
}

// ── Onglet Compétences ───────────────────────────────────────────────────────

function RendreStats() {
	const dl = $("perso-stats");
	const s = PROGRESSION.vue && PROGRESSION.vue.stats;
	if (!dl) return;
	dl.replaceChildren();
	if (!s) return;
	for (const [cle, nom, valeur] of [
		["stat_vie", "PV", nombre(s.vie_max)], ["stat_mana", "Mana", nombre(s.mana_max)],
		["stat_puissance", "Puissance", nombre(s.puissance)], ["stat_defense", "Défense", nombre(s.defense)],
		["stat_critique", "Critique", `${nombre(s.critique)} %`], ["stat_vitesse", "Vitesse", `×${s.vitesse}`],
		["stat_pouvoirs", "Pouvoirs", `×${s.degats_sorts}`],
	]) {
		const bloc = el("div", "perso-stat");
		const dt = el("dt");
		const ico = IconeOuRien(cle, "stat-ico");
		if (ico) dt.append(ico);
		dt.append(document.createTextNode(nom));
		bloc.append(dt, el("dd", null, valeur));
		dl.append(bloc);
	}
}

function RendreCompetences() {
	const liste = $("competences");
	if (!liste) return;
	liste.replaceChildren();
	const comps = (PROGRESSION.vue && PROGRESSION.vue.competences) || [];

	if (comps.length === 0) {
		liste.append(el("li", "competence competence--vide", "Aucun pouvoir pour cette classe."));
		return;
	}

	for (const c of comps) {
		const li = el("li", "competence");
		if (c.couleur) li.style.setProperty("--teinte", c.couleur);

		// La tuile : l'image du sort à son plein (ses propres VFX, pas une icône
		// générique), et la touche RÉELLE en surimpression — le client Lua l'ajoute.
		const touche = el("div", "competence-tuile");
		if (c.icone) {
			const img = el("img", "competence-vignette");
			img.src = c.icone;
			img.alt = "";
			img.draggable = false;
			touche.append(img);
		}
		touche.append(el("kbd", "competence-touche", c.touche || String(c.emplacement)));

		const corps = el("div", "competence-corps");
		const titre = el("div", "competence-titre");
		titre.append(
			el("span", "competence-nom", c.label || c.id),
			el("span", "competence-meta", `${c.element_label || c.element || "?"} · ${ARCHETYPES_LIBELLES[c.archetype] || c.archetype || "?"}`),
		);
		corps.append(titre, el("p", "competence-desc", c.description || ""));

		const chiffres = el("dl", "competence-chiffres");
		const lignes = [];
		if (c.degats > 0) lignes.push(["Dégâts", c.degats !== c.degats_base ? `${c.degats} (${c.degats_base})` : `${c.degats}`]);
		if (c.soin > 0) lignes.push(["Soin", `${c.soin}`]);
		lignes.push(["Mana", `${c.cout}`], ["Recharge", `${c.recharge} s`]);
		if (c.portee > 0) lignes.push(["Portée", `${c.portee} m`]);
		if (c.zone > 0) lignes.push(["Zone", `${c.zone} m`]);
		for (const [k, val] of lignes) {
			const bloc = el("div");
			bloc.append(el("dt", null, k), el("dd", null, val));
			chiffres.append(bloc);
		}

		li.append(touche, corps, chiffres);
		liste.append(li);
	}
}

// ── Onglet Talents ───────────────────────────────────────────────────────────

function RendreTalents() {
	const racine = $("talents");
	const t = PROGRESSION.vue && PROGRESSION.vue.talents;
	if (!racine || !t) return;
	racine.replaceChildren();

	const regle = $("talents-regle");
	if (regle) {
		const prochain = t.prochain_point ? ` · prochain point au niveau ${t.prochain_point}` : "";
		regle.textContent = `1 point tous les ${t.par_point} niveaux — ${t.gagnes} gagné(s), ${t.depenses} investi(s)${prochain}`;
	}
	const reinit = $("talents-reinit");
	if (reinit) reinit.disabled = !(t.depenses > 0);

	for (const b of t.branches || []) {
		const colonne = el("section", "talent-branche");
		if (b.color) colonne.style.setProperty("--teinte", b.color);
		// L'icône vectorielle de la branche remplace l'emoji du catalogue web.
		const titre = el("h3", "talent-branche-titre");
		const icoBranche = IconeOuRien(`branche_${b.id}`, "branche-ico");
		if (icoBranche) titre.append(icoBranche);
		titre.append(document.createTextNode(b.label));
		colonne.append(titre);

		const noeuds = (t.noeuds || []).filter((n) => n.branch === b.id).sort((x, y) => (x.tier - y.tier));
		for (const n of noeuds) {
			const bloc = el("article", "talent");
			bloc.dataset.etat = !n.deverrouille ? "verrouille" : n.rang >= n.maxRank ? "max" : n.rang > 0 ? "investi" : "libre";

			const tete = el("div", "talent-tete");
			const nomTalent = el("span", "talent-nom");
			const cleEffet = CLES_EFFET.find((k) => n.effect && n.effect[k]);
			const icoEffet = cleEffet ? IconeOuRien(`effet_${cleEffet}`, "talent-ico") : null;
			if (icoEffet) nomTalent.append(icoEffet);
			nomTalent.append(document.createTextNode(n.name));
			const rangTalent = el("span", "talent-rang");
			if (!n.deverrouille) {
				const verrou = IconeOuRien("verrou", "verrou-ico");
				if (verrou) rangTalent.append(verrou);
			}
			rangTalent.append(document.createTextNode(`${n.rang} / ${n.maxRank}`));
			tete.append(nomTalent, rangTalent);

			const pips = el("div", "talent-pips");
			for (let i = 0; i < n.maxRank; i++) pips.append(el("i", i < n.rang ? "plein" : ""));

			const desc = el("p", "talent-desc", n.description || "");
			const effet = el("p", "talent-effet", LibelleEffet(n.effect));
			if (!n.deverrouille && n.requires) {
				const requis = (t.noeuds || []).find((x) => x.id === n.requires);
				effet.textContent += ` — requiert « ${requis ? requis.name : n.requires} »`;
			}

			const gestes = el("div", "talent-gestes");
			const moins = el("button", "talent-moins");
			moins.append(IconeOuRien("rembourser") || document.createTextNode("−"));
			moins.type = "button";
			moins.disabled = !n.peut_rembourser;
			moins.title = "Rembourser un rang";
			moins.addEventListener("click", () => Lua("NarvosProgression:Rembourser", n.id));
			const plus = el("button", "talent-plus");
			plus.append(IconeOuRien("investir") || document.createTextNode("+"));
			plus.type = "button";
			plus.disabled = !n.peut_investir;
			plus.title = "Investir un point";
			plus.addEventListener("click", () => Lua("NarvosProgression:Investir", n.id));
			gestes.append(moins, plus);

			bloc.append(tete, pips, desc, effet, gestes);
			colonne.append(bloc);
		}
		racine.append(colonne);
	}
}

// ── Onglets ──────────────────────────────────────────────────────────────────

function ChoisirOnglet(nom) {
	const section = $("personnage");
	if (!section) return;
	const valides = [...section.querySelectorAll(".perso-onglets [data-onglet]")].map((b) => b.dataset.onglet);
	if (!valides.includes(nom)) return;
	PROGRESSION.onglet = nom;
	for (const b of section.querySelectorAll(".perso-onglets [data-onglet]")) {
		b.setAttribute("aria-selected", b.dataset.onglet === nom ? "true" : "false");
	}
	for (const p of section.querySelectorAll(".perso-page")) {
		p.hidden = p.dataset.page !== nom;
	}
}

function RendreProgression() {
	RendreBandeau();
	RendreStats();
	RendreCompetences();
	RendreTalents();
	MajHudXp(PROGRESSION.vue && PROGRESSION.vue.fiche);
}

// ── HUD : niveau et XP ───────────────────────────────────────────────────────

function MajHudXp(fiche) {
	const bloc = $("hud-xp");
	if (!bloc || !fiche) return;
	bloc.hidden = false;
	$("hud-niveau").textContent = fiche.niveau ?? "—";
	$("hud-xp-valeur").textContent = fiche.max ? "MAX" : `${nombre(fiche.xp)} / ${nombre(fiche.cible)}`;
	$("hud-xp-barre").style.width = `${Math.round(Math.max(0, Math.min(1, fiche.progression || 0)) * 100)}%`;
}

// ── Branchements ─────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
	const section = $("personnage");
	if (!section) return;
	for (const b of section.querySelectorAll(".perso-onglets [data-onglet]")) {
		b.addEventListener("click", () => ChoisirOnglet(b.dataset.onglet));
	}
	const reinit = $("talents-reinit");
	if (reinit) {
		const ico = IconeOuRien("reinitialiser", "bouton-ico");
		if (ico) reinit.prepend(ico);
		reinit.addEventListener("click", () => Lua("NarvosProgression:Reinitialiser"));
	}
	// L'étiquette « Niveau » du bandeau porte l'étoile du jeu.
	const etiquette = document.querySelector(".perso-etiquette");
	const etoile = IconeOuRien("niveau", "niveau-ico");
	if (etiquette && etoile) etiquette.prepend(etoile);
	ChoisirOnglet(PROGRESSION.onglet);
});

if (typeof Events !== "undefined") {
	Events.Subscribe("NarvosProgression", (vue) => {
		if (!vue || typeof vue !== "object") return;
		PROGRESSION.vue = vue;
		RendreProgression();
	});

	Events.Subscribe("NarvosXP", (gain) => {
		if (!gain) return;
		if (gain.fiche) {
			MajHudXp(gain.fiche);
			if (PROGRESSION.vue) {
				PROGRESSION.vue.fiche = gain.fiche;
				RendreBandeau();
			}
		}
		const texte = gain.niveaux > 0
			? `+${gain.xp_gagnee} XP — niveau ${gain.fiche ? gain.fiche.niveau : ""} !`
			: `+${gain.xp_gagnee} XP`;
		if (typeof Message === "function") Message(texte, "info");
	});

	Events.Subscribe("NarvosPersonnage:Onglet", ChoisirOnglet);
}
