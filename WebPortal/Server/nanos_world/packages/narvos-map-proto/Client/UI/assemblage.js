// ══════════════════════════════════════════════════════════════════════════════
// assemblage.js — l'établi d'assemblage : le joueur POSE les pièces slot par
// slot, il ne clique pas « fabriquer ».
//
// Chargé APRÈS index.js et ateliers.js, dans le même scope global : il consomme
// `$`, `ETAT`, `RENDUS` et l'icône catalogue (RoueIcone, avec repli émoji).
//
// ── LE CLIENT N'A AUCUNE AUTORITÉ ─────────────────────────────────────────────
// Le serveur pousse l'état COMPLET : les plans (catalogue lu à l'exécution),
// la session (slots, pièces posées, manquants nommés), le sac AVEC les uids,
// et pour chaque slot la liste des piles qu'il accepterait. La page ne filtre
// donc rien elle-même : elle grise ce que le serveur a déjà refusé, et chaque
// clic n'émet qu'une intention de chaînes (plan_id, slot_id, uid) — le serveur
// re-décide tout.
//
// Événements :
//   Lua -> page   NarvosAssemblage (état) · NarvosAssemblageErreur (raison)
//                 NarvosAssemblageFait (item_id, quantite)
//   page -> Lua   NarvosAssemblage:Pret · NarvosAssemblage:Ouvrir (plan_id)
//                 NarvosAssemblage:Poser (slot_id, uid)
//                 NarvosAssemblage:Retirer (slot_id, item_id)
//                 NarvosAssemblage:Abandonner · NarvosAssemblage:Finaliser
// ══════════════════════════════════════════════════════════════════════════════

const ASSEMBLAGE = {
	etabli: false,
	plans: [],
	session: null,
	sac: [],
	slot: null,             // id du slot sélectionné, ou null
	resultatNom: null,      // dernier résultat connu — pour le bandeau « fait »
	minuteurRefus: null,
	minuteurResultat: null,
};

// Rendu à l'ouverture : la page RÉCLAME l'état tamponné côté Lua plutôt que
// d'attendre le prochain envoi du serveur — un CallEvent poussé avant que la
// page soit prête tomberait dans le vide (leçon de l'écran de création).
RENDUS.assemblage = () => {
	if (typeof Events !== "undefined") Events.Call("NarvosAssemblage:Pret");
	RendreAssemblage();
};

/** Icône d'une pièce : le webp du catalogue, l'émoji en dessous par sécurité.
 *  Réutilise le constructeur de la roue (même contrat icone/iconFile) ; repli
 *  texte si le fichier est ouvert hors du jeu. */
function AsmIcone(entree) {
	if (typeof RoueIcone === "function") return RoueIcone(entree);
	const repli = document.createElement("span");
	repli.textContent = entree.icone || "?";
	return repli;
}

// ── Choix du plan ─────────────────────────────────────────────────────────────

function RendrePlans(plans) {
	const liste = $("assemblage-plans");
	if (!liste) return;
	liste.replaceChildren();

	$("assemblage-aucun-plan").hidden = plans.length > 0;

	for (const plan of plans) {
		const li = document.createElement("li");

		const r = plan.resultat || {};
		li.dataset.rarete = r.rarete || "common";

		const icone = AsmIcone(r);
		icone.classList.add("assemblage-plan-icone");
		li.append(icone);

		const nom = document.createElement("span");
		nom.className = "nom";
		nom.textContent = plan.label || plan.id;
		li.append(nom);

		// Ce que le plan ATTEND, pas sa fiche technique : les emplacements
		// obligatoires, nommés — le joueur sait ce qu'il devra poser avant de
		// s'engager.
		const attendus = (plan.emplacements || [])
			.filter((e) => e.obligatoire)
			.map((e) => `${e.label} ×${e.quantite || 1}`)
			.join(" · ");
		const detail = document.createElement("span");
		detail.className = "ref";
		detail.textContent = `→ ${r.nom || r.item_id}${attendus ? "  —  " + attendus : ""}`;
		li.append(detail);

		// Intention : le serveur rouvre ou reprend la session, et revalide.
		li.addEventListener("click", () => {
			if (typeof Events !== "undefined") Events.Call("NarvosAssemblage:Ouvrir", plan.id);
		});

		liste.append(li);
	}
}

// ── Les slots du plan ─────────────────────────────────────────────────────────

function RendreSlots() {
	const A = ASSEMBLAGE;
	const liste = $("assemblage-slots");
	if (!liste || !A.session) return;
	liste.replaceChildren();

	for (const slot of A.session.slots || []) {
		const li = document.createElement("li");
		li.className = "assemblage-slot";
		li.dataset.etat = slot.pose >= slot.quantite ? "complet"
			: (slot.obligatoire ? "requis" : "optionnel");
		if (A.slot === slot.id) li.setAttribute("aria-current", "true");

		const tete = document.createElement("button");
		tete.type = "button";
		tete.className = "assemblage-slot-tete";

		const nom = document.createElement("span");
		nom.className = "assemblage-slot-nom";
		nom.textContent = slot.label || slot.id;
		tete.append(nom);

		const marque = document.createElement("span");
		marque.className = "assemblage-slot-marque";
		marque.textContent = slot.obligatoire ? "requis" : "optionnel";
		tete.append(marque);

		const compte = document.createElement("span");
		compte.className = "assemblage-slot-compte";
		compte.textContent = `${slot.pose || 0} / ${slot.quantite || 1}`;
		tete.append(compte);

		tete.addEventListener("click", () => {
			A.slot = slot.id;
			RendreSlots();
			RendreSac();
		});
		li.append(tete);

		// Les pièces POSÉES, chacune retirable d'un clic : le serveur la rend
		// au sac (la place est simulée d'abord — sans place, elle reste posée).
		if ((slot.pieces || []).length > 0) {
			const posees = document.createElement("ul");
			posees.className = "assemblage-posees";
			for (const p of slot.pieces) {
				const puce = document.createElement("li");
				puce.className = "assemblage-posee";
				puce.dataset.rarete = p.rarete || "common";
				puce.title = "Retirer — la pièce revient dans le sac";

				puce.append(AsmIcone(p));

				const nomP = document.createElement("span");
				nomP.className = "nom";
				nomP.textContent = p.nom || p.item_id;
				puce.append(nomP);

				if ((p.quantite || 1) > 1) {
					const qte = document.createElement("span");
					qte.className = "qte";
					qte.textContent = `×${p.quantite}`;
					puce.append(qte);
				}

				const croix = document.createElement("span");
				croix.className = "assemblage-retirer";
				croix.textContent = "×";
				puce.append(croix);

				puce.addEventListener("click", () => {
					if (typeof Events !== "undefined") {
						Events.Call("NarvosAssemblage:Retirer", slot.id, p.item_id);
					}
				});
				posees.append(puce);
			}
			li.append(posees);
		}

		liste.append(li);
	}
}

// ── Le sac, filtré par le slot choisi ─────────────────────────────────────────

function RendreSac() {
	const A = ASSEMBLAGE;
	const liste = $("assemblage-pieces");
	if (!liste) return;
	liste.replaceChildren();

	const slot = (A.session && A.session.slots || []).find((s) => s.id === A.slot) || null;

	// Le filtrage est DÉCIDÉ par le serveur : `slot.accepte` porte les uids que
	// le slot accepterait maintenant. La page ne refait pas le calcul — elle
	// grise ce qui est refusé, avec la raison à portée de clic (le refus du
	// serveur nomme le motif si le joueur tente quand même).
	const acceptes = new Set(slot ? (slot.accepte || []) : []);

	const consigne = $("assemblage-consigne");
	if (consigne) {
		consigne.textContent = !slot
			? "Choisir un emplacement à gauche pour savoir ce qu'il accepte."
			: `Emplacement « ${slot.label || slot.id} » — cliquer une pièce pour la poser. Les pièces grisées ne conviennent pas.`;
	}

	if (A.sac.length === 0) {
		const li = document.createElement("li");
		li.className = "vide-liste";
		li.textContent = "Sac vide — rien à poser.";
		liste.append(li);
		return;
	}

	for (const piece of A.sac) {
		const li = document.createElement("li");
		const ok = slot !== null && acceptes.has(piece.uid);
		li.dataset.pose = ok ? "oui" : "non";
		li.dataset.rarete = piece.rarete || "common";

		const icone = AsmIcone(piece);
		icone.classList.add("assemblage-piece-icone");
		li.append(icone);

		const nom = document.createElement("span");
		nom.className = "nom";
		nom.textContent = piece.nom || piece.item_id;
		li.append(nom);

		if ((piece.quantite || 1) > 1) {
			const qte = document.createElement("span");
			qte.className = "qte";
			qte.textContent = `×${piece.quantite}`;
			li.append(qte);
		}

		// Une pose = UNE unité de la pile nommée (l'uid, jamais l'item_id) :
		// la consommation UID-correcte est le mécanisme du modèle, pas un détail.
		if (ok) {
			li.addEventListener("click", () => {
				if (typeof Events !== "undefined" && A.slot) {
					Events.Call("NarvosAssemblage:Poser", A.slot, piece.uid);
				}
			});
		}

		liste.append(li);
	}
}

// ── Le pied : manquants nommés, abandon, finalisation ─────────────────────────

function MajPied() {
	const A = ASSEMBLAGE;
	const session = A.session;
	const manquants = $("assemblage-manquants");
	const finaliser = $("assemblage-finaliser");
	if (!manquants || !finaliser) return;

	if (!session) {
		manquants.textContent = "—";
		finaliser.disabled = true;
		return;
	}

	// Les manquants sont NOMMÉS par le modèle, en direct : « il manque :
	// Carrosserie (0/1), Moteur (0/1) ». Jamais un compteur muet.
	const manque = session.manquants || [];
	manquants.textContent = manque.length === 0
		? `Complet — prêt à finaliser → ${(session.resultat && session.resultat.nom) || "résultat"}`
		: "Il manque : " + manque.map((m) => `${m.label} (${m.pose}/${m.requis})`).join(", ");

	finaliser.disabled = session.complet !== true;
}

// ── L'écran, deux états ───────────────────────────────────────────────────────

function RendreAssemblage() {
	const A = ASSEMBLAGE;
	const session = A.session;

	$("assemblage-choix").hidden = !!session;
	$("assemblage-en-cours").hidden = !session;

	$("assemblage-titre").textContent = session
		? `Établi — ${session.label || session.plan_id}`
		: "Établi d'assemblage";

	// L'avancement en une ligne, dans l'en-tête : posées / attendues.
	if (session) {
		let pose = 0, attendu = 0;
		for (const s of session.slots || []) {
			pose += s.pose || 0;
			attendu += s.quantite || 1;
		}
		$("assemblage-avancement").textContent = `${pose} / ${attendu} pièce(s) posée(s)`;
	} else {
		$("assemblage-avancement").textContent = A.plans.length > 0
			? `${A.plans.length} plan(s)`
			: "—";
	}

	if (session) {
		RendreSlots();
		RendreSac();
		MajPied();
	} else {
		RendrePlans(A.plans);
	}
}

// ── Retours du serveur ────────────────────────────────────────────────────────

/** Refus nommé : posé au bas du panneau, et il repart tout seul. */
function AsmRefus(raison) {
	const boite = $("assemblage-refus");
	if (boite) {
		boite.textContent = raison || "Refusé";
		boite.hidden = false;
		if (ASSEMBLAGE.minuteurRefus) clearTimeout(ASSEMBLAGE.minuteurRefus);
		ASSEMBLAGE.minuteurRefus = setTimeout(() => { boite.hidden = true; }, 3600);
	}
	// Le bandeau commun double le signal : un refus doit se voir même si le
	// joueur regarde ailleurs (même canal que les refus de la roue).
	if (typeof Message === "function" && raison) Message(String(raison), "erreur");
}

/** Finalisé : le résultat est un OBJET dans le sac — on le dit honnêtement,
 *  pas une promesse de véhicule qui roule (le spawn est un exécutant ultérieur). */
function AsmFait(item_id, quantite) {
	const nom = ASSEMBLAGE.resultatNom || item_id || "résultat";
	const boite = $("assemblage-resultat");
	if (boite) {
		boite.textContent = `Assemblé : ${nom} ×${quantite || 1} — à récupérer dans le sac. `
			+ "C'est un objet assemblé ; le véhicule qui roule viendra d'un chantier ultérieur.";
		boite.hidden = false;
		if (ASSEMBLAGE.minuteurResultat) clearTimeout(ASSEMBLAGE.minuteurResultat);
		ASSEMBLAGE.minuteurResultat = setTimeout(() => { boite.hidden = true; }, 7000);
	}
	if (typeof Message === "function") Message(`${nom} assemblé — dans le sac`, "ok");
}

// ── Pont Lua ──────────────────────────────────────────────────────────────────

// Abandon et finalisation : un écouteur délégué, comme les autres panneaux —
// les lignes sont recréées à chaque rendu, un écouteur par bouton fuirait.
document.addEventListener("click", (e) => {
	if (typeof Events === "undefined") return;
	if (e.target.closest("[data-assemblage-abandonner]")) {
		Events.Call("NarvosAssemblage:Abandonner");
	} else if (e.target.closest("[data-assemblage-finaliser]")) {
		Events.Call("NarvosAssemblage:Finaliser");
	}
});

if (typeof Events !== "undefined") {
	Events.Subscribe("NarvosAssemblage", (donnees) => {
		ASSEMBLAGE.etabli = !!(donnees && donnees.etabli);
		ASSEMBLAGE.plans = (donnees && donnees.plans) || [];
		ASSEMBLAGE.sac = (donnees && donnees.sac) || [];
		ASSEMBLAGE.session = (donnees && donnees.session) || null;

		if (ASSEMBLAGE.session) {
			// Mémorise le nom du résultat pour le bandeau « fait » : après la
			// finalisation, la session est détruite et le nom part avec elle.
			ASSEMBLAGE.resultatNom = (ASSEMBLAGE.session.resultat
				&& ASSEMBLAGE.session.resultat.nom) || ASSEMBLAGE.resultatNom;

			// Le slot sélectionné suit la session : disparu → premier incomplet,
			// sinon premier tout court. Une sélection qui pointerait dans le vide
			// griserait tout le sac sans raison.
			const slots = ASSEMBLAGE.session.slots || [];
			if (!slots.some((s) => s.id === ASSEMBLAGE.slot)) {
				const cible = slots.find((s) => (s.pose || 0) < (s.quantite || 1)) || slots[0];
				ASSEMBLAGE.slot = cible ? cible.id : null;
			}
		} else {
			ASSEMBLAGE.slot = null;
		}

		if (ETAT.ouvert === "assemblage") RendreAssemblage();
	});

	Events.Subscribe("NarvosAssemblageErreur", AsmRefus);
	Events.Subscribe("NarvosAssemblageFait", AsmFait);
}
