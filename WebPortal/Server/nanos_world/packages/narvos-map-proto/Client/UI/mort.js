// ══════════════════════════════════════════════════════════════════════════════
// NARVOS — le panneau de MORT (2026-09-15).
//
//   Lua -> page   NarvosMort({ lieu, delai_ms, auto_ms }) · NarvosMort(false) au retour
//   page -> Lua   NarvosMort:Reapparaitre  (même chemin serveur que `/revive`)
//
// Le serveur décide de tout (Zaap ou cité de retour, délais, vie rendue) :
// Server/Reapparition.lua. La page n'affiche que ce qu'on lui dit ; les comptes à
// rebours ne sont qu'un confort — le serveur refuse un appui trop tôt, et relève
// SEUL le joueur à l'échéance automatique (décision D4 de Hanibes).
// ══════════════════════════════════════════════════════════════════════════════

const MORT = { minuteur: null, pret_le: 0, auto_le: 0 };

function MortElement() {
	let racine = document.getElementById("mort-panneau");
	if (racine) return racine;
	racine = document.createElement("section");
	racine.id = "mort-panneau";
	racine.className = "mort";
	racine.hidden = true;
	racine.setAttribute("role", "alertdialog");
	racine.setAttribute("aria-labelledby", "mort-titre");

	const titre = document.createElement("h2");
	titre.id = "mort-titre";
	titre.className = "mort-titre";
	titre.textContent = "VOUS ÊTES MORT";

	const lieu = document.createElement("p");
	lieu.className = "mort-cite";
	lieu.id = "mort-cite";

	const bouton = document.createElement("button");
	bouton.type = "button";
	bouton.className = "mort-bouton";
	bouton.id = "mort-bouton";
	bouton.addEventListener("click", () => {
		if (bouton.disabled) return;
		bouton.disabled = true;
		bouton.dataset.envoye = "1";
		if (typeof Events !== "undefined") Events.Call("NarvosMort:Reapparaitre");
		// Sans réponse du serveur (refus), le bouton redevient cliquable.
		setTimeout(() => {
			delete bouton.dataset.envoye;
			if (!racine.hidden) bouton.disabled = false;
		}, 1500);
	});

	const auto = document.createElement("p");
	auto.className = "mort-auto";
	auto.id = "mort-auto";
	auto.setAttribute("aria-live", "polite");

	const aide = document.createElement("p");
	aide.className = "mort-aide";
	aide.textContent = "ou tapez /revive dans le chat";

	racine.append(titre, lieu, bouton, auto, aide);
	document.body.append(racine);
	return racine;
}

function MortRafraichir() {
	const bouton = document.getElementById("mort-bouton");
	const auto = document.getElementById("mort-auto");
	if (!bouton || !auto) return;
	const maintenant = performance.now();

	const restant_auto = Math.max(0, MORT.auto_le - maintenant);
	auto.hidden = MORT.auto_le === 0;
	auto.textContent = restant_auto > 0
		? `Réapparition automatique dans ${Math.ceil(restant_auto / 1000)} s`
		: "Réapparition…";

	const restant = Math.max(0, MORT.pret_le - maintenant);
	if (restant > 0) {
		bouton.disabled = true;
		bouton.textContent = `RÉAPPARAÎTRE · ${(restant / 1000).toFixed(1)} s`;
		return;
	}
	bouton.textContent = "RÉAPPARAÎTRE";
	if (!bouton.dataset.envoye) bouton.disabled = false;
	if (MORT.auto_le === 0 || restant_auto === 0) {
		clearInterval(MORT.minuteur);
		MORT.minuteur = null;
	}
}

function MortAfficher(donnees) {
	const racine = MortElement();
	clearInterval(MORT.minuteur);
	MORT.minuteur = null;
	if (!donnees) {
		racine.hidden = true;
		return;
	}
	delete document.getElementById("mort-bouton").dataset.envoye;
	const lieu = typeof donnees.lieu === "string" && donnees.lieu !== "" ? donnees.lieu : "votre cité";
	document.getElementById("mort-cite").textContent = `Retour : ${lieu}`;
	const maintenant = performance.now();
	const delai = Number(donnees.delai_ms);
	MORT.pret_le = maintenant + (Number.isFinite(delai) && delai > 0 ? delai : 0);
	const auto = Number(donnees.auto_ms);
	MORT.auto_le = Number.isFinite(auto) && auto > 0 ? maintenant + auto : 0;
	racine.hidden = false;
	MortRafraichir();
	if (MORT.pret_le > maintenant || MORT.auto_le > maintenant) MORT.minuteur = setInterval(MortRafraichir, 100);
}

if (typeof Events !== "undefined") {
	Events.Subscribe("NarvosMort", (donnees) => MortAfficher(donnees));
}
