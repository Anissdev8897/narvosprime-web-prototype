// ══════════════════════════════════════════════════════════════════════════════
// echanges.js — parler à un marchand (dialogue) et commercer (boutique).
//
// Chargé APRÈS index.js, ateliers.js et teleports.js, dans le même scope global :
// il consomme `$`, `ETAT`, `RENDUS` (index.js) et `Message` (ateliers.js).
//
// ── LE CLIENT N'A AUCUNE AUTORITÉ ─────────────────────────────────────────────
// Le serveur (Server/Index.lua) décide de tout : il présente chaque nœud de
// dialogue avec ses réponses DÉJÀ filtrées, et tranche prix, solde et proximité
// à l'achat comme à la vente. La page n'émet qu'un indice de réponse, ou un
// identifiant d'objet et une quantité ; rien n'est optimiste, le solde ne change
// qu'à la réponse du serveur. Tout texte venu du serveur passe par `textContent`.
//
// Événements :
//   Lua -> page   NarvosMarchand:Proche (info | false) · NarvosDialogue (nœud)
//                 NarvosDialogueErreur (raison) · NarvosBoutique (etat)
//                 NarvosBoutiqueFait (id, qte, solde) · NarvosBoutiqueErreur (raison)
//   page -> Lua   NarvosDialogue:Choisir (indice) · NarvosBoutique:Acheter (id, qte)
//                 NarvosBoutique:Vendre (id, qte)
// ══════════════════════════════════════════════════════════════════════════════

const ECH = {
	noeud: null,      // { orateur, texte, choix: [{ texte }] }
	boutique: null,   // { marchand, nom, sous_titre, stock: [{ id, nom, prix, rarete, rachat }], credits }
	message: "",
	ton: "info",      // "fait" | "refus" | "info"
};

const EchEl = (balise, classe, texte) => {
	const n = document.createElement(balise);
	if (classe) n.className = classe;
	if (texte !== undefined && texte !== null) n.textContent = texte;
	return n;
};

const EchBouton = (texte, attributs, classe) => {
	const b = EchEl("button", classe || null, texte);
	b.type = "button";
	for (const [k, v] of Object.entries(attributs || {})) b.setAttribute(k, v);
	return b;
};

// ── L'invite « parler » (HUD, hors panneau) ───────────────────────────────────

function MajMarchandInvite(info) {
	const boite = $("marchand-invite");
	if (!boite) return;
	if (!info || typeof info !== "object") {
		boite.hidden = true;
		return;
	}
	boite.replaceChildren();
	boite.dataset.pret = "true";
	if (info.touche) boite.append(EchEl("span", "tp-invite-touche", info.touche));
	boite.append(EchEl("span", "tp-invite-nom", `Parler — ${info.nom || "marchand"}`));
	if (info.sous_titre) boite.append(EchEl("span", "tp-invite-vers", info.sous_titre));
	boite.hidden = false;
}

// ── Dialogue ──────────────────────────────────────────────────────────────────

function RendreDialogue() {
	const n = ECH.noeud;
	const orateur = $("dlg-orateur");
	const texte = $("dlg-texte");
	const liste = $("dlg-choix");
	if (!orateur || !texte || !liste) return;
	orateur.textContent = (n && n.orateur) || "—";
	texte.textContent = (n && n.texte) || "";
	liste.replaceChildren();

	const choix = n && Array.isArray(n.choix) ? n.choix : [];
	if (choix.length === 0) {
		// Un nœud sans réponse clôt la conversation : on propose de partir par le
		// chemin commun de fermeture (`data-fermer` -> Lua), qui rend la souris.
		const li = EchEl("li");
		const b = EchBouton(null, { "data-fermer": "" });
		b.append(EchEl("span", "dlg-num", "—"), EchEl("span", null, "Partir"));
		li.append(b);
		liste.append(li);
		return;
	}
	choix.forEach((c, i) => {
		const li = EchEl("li");
		const b = EchBouton(null, { "data-dlg-choix": String(i + 1) });
		b.append(EchEl("span", "dlg-num", String(i + 1)), EchEl("span", null, c.texte || "…"));
		li.append(b);
		liste.append(li);
	});
	const premier = liste.querySelector("button");
	if (premier) premier.focus();
}

function DlgChoisir(indice) {
	const choix = ECH.noeud && Array.isArray(ECH.noeud.choix) ? ECH.noeud.choix : [];
	if (!Number.isInteger(indice) || indice < 1 || indice > choix.length) return;
	if (typeof Events !== "undefined") Events.Call("NarvosDialogue:Choisir", indice);
}

// ── Boutique ──────────────────────────────────────────────────────────────────

function BqSolde() {
	return Number(ECH.boutique && ECH.boutique.credits) || 0;
}

function MajBqPied() {
	const ligne = $("bq-message");
	if (!ligne) return;
	ligne.textContent = ECH.message || "";
	ligne.dataset.ton = ECH.ton;
}

function BqLigne(nom, rarete, prix, bouton) {
	const li = EchEl("li");
	const ligne = EchEl("div", "bq-ligne");
	const n = EchEl("span", "bq-nom", nom);
	n.dataset.rarete = rarete || "common";
	ligne.append(n, prix, bouton);
	li.append(ligne);
	return li;
}

function RendreBoutique() {
	const b = ECH.boutique;
	const titre = $("bq-titre");
	const credits = $("bq-credits");
	const stock = $("bq-stock");
	const sac = $("bq-sac");
	if (!titre || !credits || !stock || !sac) return;

	titre.textContent = b ? `${b.nom || "Boutique"}${b.sous_titre ? " — " + b.sous_titre : ""}` : "Boutique";
	credits.textContent = `${BqSolde()} cr`;

	const liste = b && Array.isArray(b.stock) ? b.stock : [];
	stock.replaceChildren();
	if (liste.length === 0) stock.append(EchEl("li", "bq-vide", "Rien en vente pour l'instant."));
	for (const o of liste) {
		const cher = Number(o.prix) > BqSolde();
		const prix = EchEl("span", "bq-prix", `${o.prix} cr`);
		if (cher) prix.dataset.tropCher = "";
		const bouton = EchBouton("Acheter", { "data-bq-acheter": o.id }, "action");
		// Trop cher : le bouton le DIT au lieu de laisser le serveur refuser.
		if (cher) {
			bouton.disabled = true;
			bouton.title = "Crédits insuffisants";
		}
		stock.append(BqLigne(o.nom || o.id, o.rarete, prix, bouton));
	}

	// Le sac : ce qu'on peut proposer. Le serveur tranche le rachat ; la page
	// n'affiche le prix que s'il l'a annoncé (objet aussi en vente ici).
	const objets = ETAT.inventaire && Array.isArray(ETAT.inventaire.objets) ? ETAT.inventaire.objets : [];
	const rachats = new Map(liste.map((o) => [o.id, o.rachat]));
	sac.replaceChildren();
	let vendables = 0;
	for (const o of objets) {
		const id = o.id || o.item_id;
		if (!id) continue;
		vendables += 1;
		const r = rachats.get(id);
		const prix = EchEl("span", "bq-prix", r !== undefined ? `${r} cr` : "");
		const bouton = EchBouton("Vendre", { "data-bq-vendre": id }, "action");
		const nom = (o.quantite || 1) > 1 ? `${o.nom || id} ×${o.quantite}` : (o.nom || id);
		sac.append(BqLigne(nom, o.rarete, prix, bouton));
	}
	if (vendables === 0) {
		sac.append(EchEl("li", "bq-vide", objets.length === 0 ? "Votre sac est vide." : "Rien à proposer ici."));
	}
	MajBqPied();
}

function BqAttente() {
	ECH.message = "demande envoyée au serveur…";
	ECH.ton = "info";
	MajBqPied();
}

// ── Gestes ────────────────────────────────────────────────────────────────────

document.addEventListener("click", (e) => {
	if (!e.target || !e.target.closest) return;
	if (ETAT.ouvert === "dialogue") {
		const b = e.target.closest("[data-dlg-choix]");
		if (b) DlgChoisir(Number(b.getAttribute("data-dlg-choix")));
		return;
	}
	if (ETAT.ouvert !== "boutique") return;
	const achat = e.target.closest("[data-bq-acheter]");
	if (achat && !achat.disabled) {
		BqAttente();
		if (typeof Events !== "undefined") Events.Call("NarvosBoutique:Acheter", achat.getAttribute("data-bq-acheter"), 1);
		return;
	}
	const vente = e.target.closest("[data-bq-vendre]");
	if (vente) {
		BqAttente();
		if (typeof Events !== "undefined") Events.Call("NarvosBoutique:Vendre", vente.getAttribute("data-bq-vendre"), 1);
	}
});

// Touches 1 à 9 : la réponse du même numéro. Échap n'est PAS traité ici :
// index.js ferme le panneau en passant par le Lua.
document.addEventListener("keydown", (e) => {
	if (ETAT.ouvert !== "dialogue") return;
	const n = Number(e.key);
	if (Number.isInteger(n) && n >= 1 && n <= 9) {
		e.preventDefault();
		DlgChoisir(n);
	}
});

// ── Pont Lua ──────────────────────────────────────────────────────────────────

RENDUS.dialogue = () => RendreDialogue();
RENDUS.boutique = () => {
	ECH.message = "";
	RendreBoutique();
};

if (typeof Events !== "undefined") {
	Events.Subscribe("NarvosMarchand:Proche", (info) => MajMarchandInvite(info));

	Events.Subscribe("NarvosDialogue", (noeud) => {
		ECH.noeud = noeud && typeof noeud === "object" ? noeud : null;
		if (ETAT.ouvert === "dialogue") RendreDialogue();
	});

	Events.Subscribe("NarvosDialogueErreur", (raison) => {
		if (typeof Message === "function") Message(String(raison || "Conversation impossible"), "erreur");
	});

	Events.Subscribe("NarvosBoutique", (etat) => {
		ECH.boutique = etat && typeof etat === "object" ? etat : null;
		if (ETAT.ouvert === "boutique") RendreBoutique();
	});

	Events.Subscribe("NarvosBoutiqueFait", (_id, _quantite, solde) => {
		if (ECH.boutique && solde !== undefined) ECH.boutique.credits = solde;
		ECH.message = `Fait — solde ${BqSolde()} cr`;
		ECH.ton = "fait";
		if (ETAT.ouvert === "boutique") RendreBoutique();
	});

	Events.Subscribe("NarvosBoutiqueErreur", (raison) => {
		ECH.message = String(raison || "Refusé");
		ECH.ton = "refus";
		MajBqPied();
	});

	// Après un achat ou une vente, le serveur renvoie le sac ; index.js le range
	// dans ETAT.inventaire (abonné avant nous) — on redessine la colonne du sac.
	Events.Subscribe("NarvosInventaire", () => {
		if (ETAT.ouvert === "boutique") RendreBoutique();
	});
}
