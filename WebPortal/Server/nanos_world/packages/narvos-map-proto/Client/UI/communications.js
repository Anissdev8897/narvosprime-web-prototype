// ══════════════════════════════════════════════════════════════════════════════
// communications.js — le téléphone (carte, messages, contacts) et le clavier de
// la porte à code.
//
// Chargé APRÈS index.js et ateliers.js, dans le même scope global : il consomme
// `$`, `ETAT`, `RENDUS` (index.js), `Message` et `Lua` (ateliers.js). La carte
// est dessinée par `DessinerRadar` (ateliers.js), qui remplit AUSSI son canvas.
//
// ⚠ Les émissions passent par `Lua(…)`, jamais par un alias local : ui-liens.mjs
// reconnaît la FORME `Lua("Nom"` et `Events.Call("Nom"` — un alias préfixé
// (ComLua, TelLua…) lui échapperait, et un nom mal orthographié partirait dans
// le vide sans signal.
//
// ── LE CLIENT N'A AUCUNE AUTORITÉ ─────────────────────────────────────────────
// Téléphone : le serveur décide qui est joignable, nettoie et borne le texte,
// refuse sans smartphone. La page n'émet qu'un IDENTIFIANT de joueur et un texte.
// Digicode : la page n'a ni le code, ni l'empreinte, ni le compte d'essais ; elle
// masque les chiffres, les envoie, et affiche la réponse.
//
// Tout texte venu du serveur (noms, messages) passe par `textContent` : un nom ou
// un message choisi par un joueur n'est jamais interprété comme du HTML.
//
// Événements :
//   Lua -> page   NarvosTelephone (etat) · NarvosTelephone:Recu (de, non_lus)
//                 NarvosDigicode:Proche (info | false) · NarvosDigicode:Clavier (etat)
//                 NarvosDigicode:Resultat (ok, message)
//   page -> Lua   NarvosTelephone:Envoyer (dest_id, texte) · NarvosTelephone:Lire
//                 NarvosDigicode:Valider (mode, id, code) · Narvos:RadarRefresh
// ══════════════════════════════════════════════════════════════════════════════

const TEL = {
	applications: [],   // l'ordre et les libellés du serveur
	app: null,          // application affichée
	contacts: [],
	messages: [],
	nonLus: 0,
	radio: false,       // canal si le joueur porte un talkie-walkie, sinon false
	longueurMax: 0,     // borne du serveur ; 0 tant qu'aucun état n'est arrivé
	dest: null,         // id du contact choisi
	message: "",
	ton: "info",
	minuteurCarte: null,
};

const DC = {
	mode: "essayer",    // essayer | poser | changer
	id: "",
	titre: "",
	aide: "",
	saisie: "",
	min: 0,
	max: 0,
	message: "",
	ton: "info",
};

/** Période de rafraîchissement de la carte : celle du panneau Radar. */
const TEL_CARTE_MS = 600;

const ComEl = (balise, classe, texte) => {
	const n = document.createElement(balise);
	if (classe) n.className = classe;
	if (texte !== undefined && texte !== null) n.textContent = texte;
	return n;
};

/** Une table Lua VIDE peut traverser le pont en objet plutôt qu'en tableau. */
const ComListe = (v) => (Array.isArray(v) ? v : []);

// ══════════════════════════════════════════════════════════════════════════════
// TÉLÉPHONE
// ══════════════════════════════════════════════════════════════════════════════

function TelContact(id) {
	return ComListe(TEL.contacts).find((c) => String(c.id) === String(id)) || null;
}

/** Heure locale « 14:05 » d'un instant serveur en secondes. */
function TelHeure(quand) {
	const n = Number(quand);
	if (!Number.isFinite(n) || n <= 0) return "";
	const d = new Date(n * 1000);
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Pictogrammes du dock (tracés SVG, pas d'image) par identifiant d'application.
 *  Une application que le serveur ajouterait sans pictogramme prend l'initiale. */
const TEL_ICONES = {
	carte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/></svg>',
	messages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4V5z"/></svg>',
	contacts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5"/></svg>',
};

function RendreTelApps() {
	const nav = $("tel-apps");
	if (!nav) return;
	nav.replaceChildren();
	for (const a of ComListe(TEL.applications)) {
		const b = ComEl("button", "tel-app");
		b.type = "button";
		b.dataset.telApp = a.id;
		const icone = ComEl("span", "tel-icone");
		// Tracés FIXES du code, jamais une chaîne du serveur : innerHTML sûr ici.
		if (TEL_ICONES[a.id]) icone.innerHTML = TEL_ICONES[a.id];
		else icone.textContent = String(a.label || a.id).slice(0, 1).toUpperCase();
		b.append(icone, ComEl("span", "tel-app-nom", a.label || a.id));
		if (a.id === TEL.app) b.setAttribute("aria-current", "true");
		if (a.id === "messages" && TEL.nonLus > 0) b.append(ComEl("span", "tel-badge", String(TEL.nonLus)));
		nav.append(b);
	}
}

/** L'heure de la barre d'état : l'heure LOCALE du joueur, comme un vrai téléphone. */
function MajTelHeure() {
	const h = $("tel-heure");
	if (!h) return;
	const d = new Date();
	h.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
setInterval(() => { if (ETAT.ouvert === "telephone") MajTelHeure(); }, 15000);

function RendreTelFil() {
	const fil = $("tel-fil");
	if (!fil) return;
	fil.replaceChildren();
	const messages = ComListe(TEL.messages);
	if (messages.length === 0) {
		fil.append(ComEl("li", "tel-vide", "Aucun message. Les messages durent le temps de la session."));
		return;
	}
	// Le plus récent en haut : c'est lui qu'on vient lire.
	for (const m of [...messages].reverse()) {
		const li = ComEl("li", "tel-msg");
		if (!m.lu) li.dataset.nonLu = "";
		const tete = ComEl("div", "tel-msg-tete");
		tete.append(ComEl("span", "tel-msg-de", m.de || "?"), ComEl("span", "tel-msg-heure", TelHeure(m.quand)));
		li.append(tete, ComEl("p", "tel-msg-texte", m.texte || ""));
		fil.append(li);
	}
}

function RendreTelContacts() {
	const liste = $("tel-contacts");
	if (!liste) return;
	liste.replaceChildren();
	const contacts = ComListe(TEL.contacts);
	if (contacts.length === 0) {
		liste.append(ComEl("li", "tel-vide", "Personne d'autre n'est connecté."));
	}
	for (const c of contacts) {
		const b = ComEl("button", "tel-contact");
		b.type = "button";
		b.dataset.telContact = c.id;
		b.dataset.joignable = c.joignable ? "true" : "false";
		if (String(c.id) === String(TEL.dest)) b.setAttribute("aria-current", "true");
		b.append(ComEl("span", "tel-contact-nom", c.nom || "?"),
			ComEl("span", "tel-contact-etat", c.joignable ? "joignable" : "hors réseau"));
		const li = ComEl("li");
		li.append(b);
		liste.append(li);
	}
	RendreTelComposer();
}

function RendreTelComposer() {
	const form = $("tel-composer");
	const a = $("tel-a");
	const envoyer = $("tel-envoyer");
	if (!form || !a || !envoyer) return;
	const c = TelContact(TEL.dest);
	form.hidden = !c;
	if (!c) return;
	a.textContent = `À ${c.nom || "?"}`;
	envoyer.disabled = !c.joignable;
	envoyer.title = c.joignable ? "" : "Ce joueur n'a pas de smartphone";
	MajTelCompte();
}

function MajTelCompte() {
	const texte = $("tel-texte");
	const compte = $("tel-compte");
	if (!texte || !compte) return;
	if (TEL.longueurMax > 0) texte.maxLength = TEL.longueurMax;
	compte.textContent = TEL.longueurMax > 0 ? `${texte.value.length} / ${TEL.longueurMax}` : String(texte.value.length);
}

function MajTelPied() {
	const pied = $("tel-message");
	if (!pied) return;
	pied.textContent = TEL.message || "";
	pied.dataset.ton = TEL.ton;
	const radio = $("tel-radio");
	if (radio) radio.textContent = TEL.radio ? `radio · canal ${TEL.radio}` : "";
}

/** La carte redemande la position tant qu'elle est À L'ÉCRAN, et seulement là. */
function TelSuivreCarte() {
	const visible = ETAT.ouvert === "telephone" && TEL.app === "carte";
	if (visible && !TEL.minuteurCarte) {
		Lua("Narvos:RadarRefresh");
		TEL.minuteurCarte = setInterval(() => {
			if (ETAT.ouvert !== "telephone" || TEL.app !== "carte") {
				clearInterval(TEL.minuteurCarte);
				TEL.minuteurCarte = null;
				return;
			}
			Lua("Narvos:RadarRefresh");
		}, TEL_CARTE_MS);
	} else if (!visible && TEL.minuteurCarte) {
		clearInterval(TEL.minuteurCarte);
		TEL.minuteurCarte = null;
	}
}

function RendreTelephone() {
	const apps = ComListe(TEL.applications);
	if (!apps.some((a) => a.id === TEL.app)) TEL.app = apps.length > 0 ? apps[0].id : null;
	RendreTelApps();
	// Les vues sont lues dans la PAGE, pas recopiées en liste : une application
	// que le serveur ajouterait sans vue n'affiche rien plutôt qu'une autre.
	for (const n of document.querySelectorAll("[data-tel-vue]")) {
		n.hidden = n.dataset.telVue !== TEL.app;
	}
	if (TEL.app === "messages") RendreTelFil();
	if (TEL.app === "contacts") RendreTelContacts();
	MajTelPied();
	TelSuivreCarte();
}

function TelChoisirApp(id) {
	TEL.app = id;
	TEL.message = "";
	// Ouvrir la boîte vaut lecture : le serveur remet le compteur à zéro et renvoie l'état.
	if (id === "messages" && TEL.nonLus > 0) Lua("NarvosTelephone:Lire");
	RendreTelephone();
}

function TelEnvoyer() {
	const texte = $("tel-texte");
	const c = TelContact(TEL.dest);
	if (!texte || !c) return;
	const contenu = texte.value.trim();
	if (contenu === "") {
		TEL.message = "Message vide";
		TEL.ton = "refus";
		MajTelPied();
		return;
	}
	TEL.message = "envoi…";
	TEL.ton = "info";
	MajTelPied();
	Lua("NarvosTelephone:Envoyer", String(c.id), contenu);
}

RENDUS.telephone = () => {
	TEL.message = "";
	MajTelHeure();
	RendreTelephone();
};

document.addEventListener("click", (e) => {
	if (ETAT.ouvert !== "telephone" || !e.target || !e.target.closest) return;
	const app = e.target.closest("[data-tel-app]");
	if (app) { TelChoisirApp(app.dataset.telApp); return; }
	const contact = e.target.closest("[data-tel-contact]");
	if (contact) {
		TEL.dest = contact.dataset.telContact;
		RendreTelContacts();
		const texte = $("tel-texte");
		if (texte && !$("tel-envoyer").disabled) texte.focus();
	}
});

document.addEventListener("submit", (e) => {
	if (e.target && e.target.id === "tel-composer") {
		e.preventDefault();
		TelEnvoyer();
	}
});

document.addEventListener("input", (e) => {
	if (e.target && e.target.id === "tel-texte") MajTelCompte();
});

// Entrée envoie, Maj+Entrée va à la ligne. Échap reste à index.js.
document.addEventListener("keydown", (e) => {
	if (ETAT.ouvert !== "telephone" || !e.target || e.target.id !== "tel-texte") return;
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		TelEnvoyer();
	}
});

// ══════════════════════════════════════════════════════════════════════════════
// DIGICODE
// ══════════════════════════════════════════════════════════════════════════════

function RendreDigicode() {
	const titre = $("dc-titre");
	const aide = $("dc-aide");
	const points = $("dc-points");
	const longueur = $("dc-longueur");
	const valider = $("dc-valider");
	const pied = $("dc-message");
	if (!titre || !aide || !points || !longueur || !valider || !pied) return;

	titre.textContent = DC.titre || "Porte à code";
	aide.textContent = DC.aide || "";
	// Les chiffres ne s'affichent JAMAIS : un écran se regarde par-dessus l'épaule.
	points.textContent = "•".repeat(DC.saisie.length);
	longueur.textContent = DC.max > 0 ? `${DC.saisie.length}/${DC.max}` : String(DC.saisie.length);
	valider.disabled = DC.min > 0 && DC.saisie.length < DC.min;
	pied.textContent = DC.message || "";
	pied.dataset.ton = DC.ton;
}

function DcTouche(touche) {
	if (touche === "effacer") {
		DC.saisie = DC.saisie.slice(0, -1);
	} else if (touche === "valider") {
		if (DC.min > 0 && DC.saisie.length < DC.min) return;
		DC.message = "vérification…";
		DC.ton = "info";
		Lua("NarvosDigicode:Valider", DC.mode, DC.id, DC.saisie);
	} else if (/^[0-9]$/.test(touche)) {
		if (DC.max > 0 && DC.saisie.length >= DC.max) return;
		DC.saisie += touche;
		DC.message = "";
	}
	RendreDigicode();
}

function MajDigicodeInvite(info) {
	const boite = $("digicode-invite");
	if (!boite) return;
	if (!info || typeof info !== "object") {
		boite.hidden = true;
		return;
	}
	boite.replaceChildren();
	boite.dataset.pret = "true";
	if (info.touche) boite.append(ComEl("span", "tp-invite-touche", info.touche));
	boite.append(ComEl("span", "tp-invite-nom", "Porte à code"));
	boite.append(ComEl("span", "tp-invite-vers", info.passe_droit ? "ouvrir (vous construisez ici)" : "taper le code"));
	boite.hidden = false;
}

// À l'ouverture, la saisie repart VIDE : un code à moitié tapé ne doit pas
// survivre à la fermeture du clavier.
RENDUS.digicode = () => {
	DC.saisie = "";
	DC.message = "";
	DC.ton = "info";
	RendreDigicode();
};

document.addEventListener("click", (e) => {
	if (ETAT.ouvert !== "digicode" || !e.target || !e.target.closest) return;
	const touche = e.target.closest("[data-dc-touche]");
	if (touche && !touche.disabled) DcTouche(touche.dataset.dcTouche);
});

// Le clavier physique : chiffres (rangée et pavé), retour arrière, Entrée.
document.addEventListener("keydown", (e) => {
	if (ETAT.ouvert !== "digicode") return;
	if (/^[0-9]$/.test(e.key)) { e.preventDefault(); DcTouche(e.key); return; }
	if (e.key === "Backspace") { e.preventDefault(); DcTouche("effacer"); return; }
	if (e.key === "Enter") { e.preventDefault(); DcTouche("valider"); }
});

// ══════════════════════════════════════════════════════════════════════════════
// PONT LUA
// ══════════════════════════════════════════════════════════════════════════════

if (typeof Events !== "undefined") {
	Events.Subscribe("NarvosTelephone", (etat) => {
		if (!etat || typeof etat !== "object") return;
		TEL.applications = ComListe(etat.applications);
		TEL.contacts = ComListe(etat.contacts);
		TEL.messages = ComListe(etat.messages);
		TEL.nonLus = Number(etat.non_lus) || 0;
		TEL.radio = etat.radio || false;
		TEL.longueurMax = Number(etat.longueur_max) || 0;
		if (typeof etat.message === "string" && etat.message !== "") {
			TEL.message = etat.message;
			// Le serveur préfixe ses refus : c'est SON contrat, pas une devinette.
			TEL.ton = etat.message.startsWith("Refus") ? "refus" : "fait";
			if (TEL.ton === "fait") {
				const texte = $("tel-texte");
				if (texte) texte.value = "";
			}
		}
		if (ETAT.ouvert === "telephone") RendreTelephone();
	});

	Events.Subscribe("NarvosTelephone:Recu", (de, nonLus) => {
		TEL.nonLus = Number(nonLus) || 0;
		if (typeof Message === "function") Message(`Message de ${de}`, "info");
		if (ETAT.ouvert === "telephone") RendreTelApps();
	});

	Events.Subscribe("NarvosDigicode:Proche", (info) => MajDigicodeInvite(info));

	Events.Subscribe("NarvosDigicode:Clavier", (etat) => {
		if (!etat || typeof etat !== "object") return;
		DC.mode = String(etat.mode || "essayer");
		DC.id = String(etat.id || "");
		DC.titre = String(etat.titre || "");
		DC.aide = String(etat.aide || "");
		DC.min = Number(etat.longueur_min) || 0;
		DC.max = Number(etat.longueur_max) || 0;
		DC.saisie = "";
		RendreDigicode();
	});

	Events.Subscribe("NarvosDigicode:Resultat", (ok, message) => {
		DC.message = String(message || "");
		DC.ton = ok ? "fait" : "refus";
		DC.saisie = "";
		RendreDigicode();
		// Accepté, le Lua referme le clavier : le message doit survivre à la fermeture.
		if (ok && typeof Message === "function") Message(DC.message, "info");
	});
}
