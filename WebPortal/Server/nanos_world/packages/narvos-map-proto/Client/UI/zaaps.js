// ══════════════════════════════════════════════════════════════════════════════
// NARVOS — l'invite des ZAAPS (points de sauvegarde, décision D4, 2026-09-15).
//
//   Lua -> page   NarvosZaap:Proche (info | false) · NarvosZaap:Actif (nom)
//                 NarvosZaap:Refus (raison)
//
// La page n'écrit rien vers le Lua : la touche d'interaction est lue par
// Client/Index.lua (`ACTIONS.interagir`), le serveur décide (Server/Zaaps.lua).
// Même boîte que l'invite de passage des téléports (`.tp-invite`) : un joueur
// reconnaît le geste « [touche] devant quelque chose ».
// ══════════════════════════════════════════════════════════════════════════════

const ZaapEl = (balise, classe, texte) => {
	const n = document.createElement(balise);
	if (classe) n.className = classe;
	if (texte !== undefined && texte !== null) n.textContent = texte;
	return n;
};

/** Même règle que `Zaaps.Libelle` (Logic/Zaaps.lua) : « Zaap du port » reste tel
 *  quel, « Port d'Akarlys » devient « Zaap · Port d'Akarlys ». */
function ZaapLibelle(nom) {
	const s = String(nom || "");
	return /^zaap([\s\p{P}]|$)/iu.test(s) ? s : `Zaap · ${s}`;
}

function MajZaapInvite(info) {
	const boite = $("zaap-invite");
	if (!boite) return;
	if (!info || typeof info !== "object") {
		boite.hidden = true;
		return;
	}
	const actif = info.actif === true;
	boite.replaceChildren();
	boite.dataset.pret = "true";
	boite.dataset.genre = "zaap";
	boite.dataset.actif = actif ? "true" : "false";
	if (info.touche && !actif) boite.append(ZaapEl("span", "tp-invite-touche", info.touche));
	boite.append(ZaapEl("span", "tp-invite-nom", ZaapLibelle(info.nom || info.id)));
	boite.append(ZaapEl("span", "tp-invite-vers",
		actif ? "votre point de réapparition" : "activer · point de réapparition"));
	boite.hidden = false;
}

if (typeof Events !== "undefined") {
	Events.Subscribe("NarvosZaap:Proche", (info) => MajZaapInvite(info));

	Events.Subscribe("NarvosZaap:Actif", (nom) => {
		if (typeof Message === "function") {
			Message(`${nom ? ZaapLibelle(nom) : "Zaap"} activé — vous réapparaîtrez ici`, "info");
		}
	});

	Events.Subscribe("NarvosZaap:Refus", (raison) => {
		if (typeof Message === "function") Message(String(raison || "Zaap indisponible"), "erreur");
	});
}
