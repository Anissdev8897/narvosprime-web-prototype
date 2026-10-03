// ══════════════════════════════════════════════════════════════════════════════
// mcs-editeur.js — l'éditeur d'apparence du Meta Customization System.
//
// Partagé par l'écran de création (creation/index.html) et le menu en jeu
// (index.html). Il ne parle à PERSONNE : il reçoit les options et l'apparence,
// et rend une apparence NOUVELLE à chaque geste par `ctx.surChangement`. Chaque
// page relaie à son Lua ; le SERVEUR normalise tout (Logic/MetaCustom.lua).
//
//   EditeurMCS.rendre(hote, {
//     options,            // Narvos.MetaCustomLogic.Options(genre), reçu du serveur
//     apparence,          // apparence courante (normalisée)
//     surChangement(a),   // appelée avec une COPIE modifiée
//     emplacements,       // facultatif : { liste: [{ n, rempli }], sauver(n), charger(n) }
//   })
//
// Les onglets reprennent ceux du pack (Body / Facial Customization, Tint & Tattoo,
// Eye Color, Hair, Clothing, Props, Slots 1-18) avec des libellés français.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
	"use strict";

	const ONGLETS = [
		{ id: "modele", label: "Modèle" },
		{ id: "corps", label: "Corps" },
		{ id: "visage", label: "Visage" },
		{ id: "peau", label: "Peau & tatouage" },
		{ id: "yeux", label: "Yeux" },
		{ id: "cheveux", label: "Cheveux" },
		{ id: "vetements", label: "Vêtements" },
		{ id: "accessoires", label: "Accessoires" },
		{ id: "emplacements", label: "Emplacements" },
	];

	const LIBELLES_VETEMENTS = { haut: "Haut", bas: "Bas", chaussures: "Chaussures", tenue: "Tenue complète" };
	const LIBELLES_GROOMS = { cheveux: "Coiffure", sourcils: "Sourcils", cils: "Cils", duvet: "Duvet", barbe: "Barbe", moustache: "Moustache" };
	const DELAI_CURSEUR_MS = 120;

	let ongletActif = "modele";
	const filtres = {};
	let minuteur = null;

	const el = (balise, classes, texte) => {
		const n = document.createElement(balise);
		if (classes) n.className = classes;
		if (texte !== undefined) n.textContent = texte;
		return n;
	};

	/** Copie profonde d'une apparence (objets et tableaux simples). */
	const copie = (a) => JSON.parse(JSON.stringify(a || {}));

	/** `differe` : geste continu (glissière) — envoi retardé, et SANS re-rendu, pour
	 *  ne pas arracher la glissière de sous la souris. Un clic re-rend la section. */
	function emettre(ctx, a, differe) {
		const info = { rerendre: !differe && differe !== false };
		if (differe === undefined) info.rerendre = true;
		if (!differe) {
			if (minuteur) { clearTimeout(minuteur); minuteur = null; }
			ctx.surChangement(a, info);
			return;
		}
		if (minuteur) clearTimeout(minuteur);
		minuteur = setTimeout(() => { minuteur = null; ctx.surChangement(a, info); }, DELAI_CURSEUR_MS);
	}

	// ── Briques ──────────────────────────────────────────────────────────────────

	function bloc(titre, compte) {
		const b = el("section", "mcs-bloc");
		const t = el("h3", "mcs-bloc-titre", titre);
		if (compte !== undefined) t.appendChild(el("span", "mcs-compte", String(compte)));
		b.appendChild(t);
		return b;
	}

	function carte(label, sous, choisi, onClick) {
		const b = el("button", "mcs-carte");
		b.type = "button";
		b.setAttribute("aria-pressed", String(Boolean(choisi)));
		b.appendChild(el("span", "mcs-carte-titre", label));
		if (sous) b.appendChild(el("span", "mcs-carte-sous", sous));
		b.addEventListener("click", onClick);
		return b;
	}

	/** Une ligne de curseur : libellé, glissière, valeur. Double-clic sur le libellé = défaut. */
	function curseur(c, valeur, surValeur) {
		const ligne = el("div", "mcs-curseur");
		const nom = el("span", "mcs-curseur-nom", c.label);
		nom.title = "Double-clic : valeur par défaut";
		const g = document.createElement("input");
		g.type = "range";
		g.className = "mcs-glissiere";
		g.min = String(c.min);
		g.max = String(c.max);
		g.step = String(c.pas || (c.max - c.min) / 100);
		g.value = String(valeur !== undefined ? valeur : c.defaut);
		g.setAttribute("aria-label", c.label);
		const lecture = el("span", "mcs-curseur-valeur", Number(g.value).toFixed(2));
		g.addEventListener("input", () => {
			lecture.textContent = Number(g.value).toFixed(2);
			surValeur(Number(g.value), true);
		});
		nom.addEventListener("dblclick", () => {
			g.value = String(c.defaut);
			lecture.textContent = Number(c.defaut).toFixed(2);
			surValeur(Number(c.defaut), false);
		});
		ligne.append(nom, g, lecture);
		return ligne;
	}

	function bascule(label, actif, surBascule) {
		const b = el("button", "mcs-bascule");
		b.type = "button";
		b.setAttribute("aria-pressed", String(Boolean(actif)));
		b.appendChild(el("span", "mcs-bascule-voyant"));
		b.appendChild(el("span", "mcs-bascule-texte", label));
		b.addEventListener("click", () => surBascule(!actif));
		return b;
	}

	/** Une grille d'options avec « Aucun » en tête et un filtre si la liste est longue. */
	function grilleOptions(ctx, cle, liste, choisi, surChoix, aucun) {
		const cadre = el("div", "mcs-grille-cadre");
		if (liste.length > 12) {
			const champ = document.createElement("input");
			champ.type = "search";
			champ.className = "mcs-filtre";
			champ.placeholder = `Filtrer ${liste.length} éléments…`;
			champ.value = filtres[cle] || "";
			champ.addEventListener("input", () => {
				filtres[cle] = champ.value;
				remplir();
			});
			cadre.appendChild(champ);
		}
		const grille = el("div", "mcs-grille");
		cadre.appendChild(grille);
		const remplir = () => {
			grille.textContent = "";
			if (aucun) grille.appendChild(carte("Aucun", null, !choisi, () => surChoix(null)));
			const f = (filtres[cle] || "").trim().toLowerCase();
			for (const o of liste) {
				if (f && !o.label.toLowerCase().includes(f)) continue;
				grille.appendChild(carte(o.label, null, choisi === o.id, () => surChoix(o.id)));
			}
		};
		remplir();
		return cadre;
	}

	// ── Sections ─────────────────────────────────────────────────────────────────

	const SECTIONS = {
		modele(ctx, hote) {
			const o = ctx.options;
			const b = bloc("Modèle MetaHuman", o.identites.length);
			b.appendChild(el("p", "mcs-note", "Le visage et la peau de base du personnage."));
			const g = el("div", "mcs-grille");
			for (const i of o.identites) {
				g.appendChild(carte(i.label, null, ctx.apparence.identite === i.id, () => {
					const a = copie(ctx.apparence);
					a.identite = i.id;
					emettre(ctx, a);
				}));
			}
			b.appendChild(g);
			hote.appendChild(b);
		},

		corps(ctx, hote) {
			const o = ctx.options;
			const b = bloc("Personnalisation du corps", o.corps.length);
			const barre = el("div", "mcs-bascules");
			barre.appendChild(bascule("Personnalisation", ctx.apparence.corps_actif !== false, (v) => {
				const a = copie(ctx.apparence); a.corps_actif = v; emettre(ctx, a);
			}));
			barre.appendChild(bascule("Physique", ctx.apparence.physique !== false, (v) => {
				const a = copie(ctx.apparence); a.physique = v; emettre(ctx, a);
			}));
			barre.appendChild(bascule("Animation", ctx.apparence.animation !== false, (v) => {
				const a = copie(ctx.apparence); a.animation = v; emettre(ctx, a);
			}));
			b.appendChild(barre);
			const liste = el("div", "mcs-curseurs");
			for (const c of o.corps) {
				liste.appendChild(curseur(c, (ctx.apparence.corps || {})[c.id], (v, differe) => {
					ctx.apparence.corps = ctx.apparence.corps || {};
					ctx.apparence.corps[c.id] = v;
					emettre(ctx, copie(ctx.apparence), differe);
				}));
			}
			b.appendChild(liste);
			hote.appendChild(b);
		},

		visage(ctx, hote) {
			const o = ctx.options;
			const b = bloc("Personnalisation du visage", o.visage.length);
			if (o.visage.length === 0) {
				b.appendChild(el("p", "mcs-note",
					"Les curseurs du visage (forme des yeux, du nez, de la mâchoire, des lèvres, des oreilles) "
					+ "arrivent avec l'outil visage MetaHuman du pack, en cours de branchement."));
			}
			const liste = el("div", "mcs-curseurs");
			for (const c of o.visage) {
				liste.appendChild(curseur(c, (ctx.apparence.visage || {})[c.id], (v, differe) => {
					ctx.apparence.visage = ctx.apparence.visage || {};
					ctx.apparence.visage[c.id] = v;
					emettre(ctx, copie(ctx.apparence), differe);
				}));
			}
			b.appendChild(liste);
			hote.appendChild(b);
		},

		peau(ctx, hote) {
			const o = ctx.options;
			const t = ctx.apparence.teinte || {};
			const b = bloc("Teinte de peau");
			const echantillon = el("span", "mcs-echantillon");
			const peindre = () => {
				echantillon.style.background = `hsl(${Math.round(t.h || 0)}, ${Math.round((t.s ?? 1) * 100)}%, ${Math.round((t.v ?? 1) * 50)}%)`;
			};
			peindre();
			const barre = el("div", "mcs-bascules");
			barre.appendChild(bascule("Teinte active", t.actif === true, (v) => {
				const a = copie(ctx.apparence); a.teinte = { ...(a.teinte || {}), actif: v }; emettre(ctx, a);
			}));
			barre.appendChild(echantillon);
			b.appendChild(barre);
			const liste = el("div", "mcs-curseurs");
			const defs = [
				{ id: "h", label: "Nuance", min: 0, max: 360, pas: 1, defaut: (o.defaut_teinte || {}).h ?? 0 },
				{ id: "s", label: "Saturation", min: 0, max: 1, pas: 0.01, defaut: (o.defaut_teinte || {}).s ?? 1 },
				{ id: "v", label: "Luminosité", min: 0, max: 1, pas: 0.01, defaut: (o.defaut_teinte || {}).v ?? 1 },
			];
			for (const d of defs) {
				liste.appendChild(curseur(d, t[d.id], (v, differe) => {
					ctx.apparence.teinte = { ...(ctx.apparence.teinte || {}), [d.id]: v };
					t[d.id] = v;
					peindre();
					emettre(ctx, copie(ctx.apparence), differe);
				}));
			}
			b.appendChild(liste);
			hote.appendChild(b);

			const bt = bloc("Tatouage et marques", o.tatouages.length);
			bt.appendChild(grilleOptions(ctx, "tatouage", o.tatouages, ctx.apparence.tatouage, (id) => {
				const a = copie(ctx.apparence); a.tatouage = id; emettre(ctx, a);
			}, true));
			hote.appendChild(bt);
		},

		yeux(ctx, hote) {
			const o = ctx.options;
			const b = bloc("Couleur des yeux", o.yeux.length);
			const liste = el("div", "mcs-curseurs");
			for (const y of o.yeux) {
				liste.appendChild(curseur({ ...y, pas: 0.01 }, (ctx.apparence.yeux || {})[y.id], (v, differe) => {
					ctx.apparence.yeux = { ...(ctx.apparence.yeux || {}), [y.id]: v };
					emettre(ctx, copie(ctx.apparence), differe);
				}));
			}
			b.appendChild(liste);
			hote.appendChild(b);
		},

		cheveux(ctx, hote) {
			const o = ctx.options;
			for (const [sorte, liste] of Object.entries(o.grooms)) {
				if (!liste || liste.length === 0) continue;
				const compatibles = liste.filter(g => !g.identites || g.identites.includes(ctx.apparence.identite));
				if (compatibles.length === 0) continue;
				const b = bloc(LIBELLES_GROOMS[sorte] || sorte, compatibles.length);
				b.appendChild(grilleOptions(ctx, `groom_${sorte}`, compatibles, (ctx.apparence.grooms || {})[sorte], (id) => {
					const a = copie(ctx.apparence);
					a.grooms = { ...(a.grooms || {}), [sorte]: id };
					emettre(ctx, a);
				}, true));
				hote.appendChild(b);
			}
			const cc = ctx.apparence.cheveux_couleur || {};
			const b = bloc("Couleur des cheveux");
			const barre = el("div", "mcs-bascules");
			barre.appendChild(bascule("Teinture active", cc.actif === true, (v) => {
				const a = copie(ctx.apparence); a.cheveux_couleur = { ...(a.cheveux_couleur || {}), actif: v }; emettre(ctx, a);
			}));
			b.appendChild(barre);
			const liste = el("div", "mcs-curseurs");
			const defs = [
				{ id: "h", label: "Nuance", min: 0, max: 360, pas: 1, defaut: (o.defaut_cheveux || {}).h ?? 0 },
				{ id: "v", label: "Intensité", min: 0, max: 1, pas: 0.01, defaut: (o.defaut_cheveux || {}).v ?? 0.5 },
			];
			for (const d of defs) {
				liste.appendChild(curseur(d, cc[d.id], (v, differe) => {
					ctx.apparence.cheveux_couleur = { ...(ctx.apparence.cheveux_couleur || {}), [d.id]: v };
					emettre(ctx, copie(ctx.apparence), differe);
				}));
			}
			b.appendChild(liste);
			hote.appendChild(b);
		},

		vetements(ctx, hote) {
			const o = ctx.options;
			for (const sorte of ["tenue", "haut", "bas", "chaussures"]) {
				const liste = o.vetements[sorte] || [];
				if (liste.length === 0) continue;
				const b = bloc(LIBELLES_VETEMENTS[sorte], liste.length);
				if (sorte === "tenue") b.appendChild(el("p", "mcs-note", "Une tenue complète remplace le haut et le bas."));
				b.appendChild(grilleOptions(ctx, `vet_${sorte}`, liste, (ctx.apparence.vetements || {})[sorte], (id) => {
					const a = copie(ctx.apparence);
					a.vetements = { ...(a.vetements || {}), [sorte]: id };
					emettre(ctx, a);
				}, true));
				hote.appendChild(b);
			}
		},

		accessoires(ctx, hote) {
			const liste = ctx.options.vetements.accessoire || [];
			const b = bloc("Accessoires de tête et props", liste.length);
			b.appendChild(grilleOptions(ctx, "vet_accessoire", liste, (ctx.apparence.vetements || {}).accessoire, (id) => {
				const a = copie(ctx.apparence);
				a.vetements = { ...(a.vetements || {}), accessoire: id };
				emettre(ctx, a);
			}, true));
			hote.appendChild(b);
		},

		emplacements(ctx, hote) {
			const e = ctx.emplacements;
			const b = bloc("Emplacements de sauvegarde", e ? e.liste.length : 0);
			if (!e) {
				b.appendChild(el("p", "mcs-note", "Les 18 emplacements s'utilisent en jeu, une fois le personnage créé."));
				hote.appendChild(b);
				return;
			}
			const g = el("div", "mcs-emplacements");
			for (const s of e.liste) {
				const case_ = el("div", "mcs-emplacement" + (s.rempli ? " mcs-emplacement--rempli" : ""));
				case_.appendChild(el("span", "mcs-emplacement-num", String(s.n).padStart(2, "0")));
				const sauver = el("button", "mcs-mini", "Sauver");
				sauver.type = "button";
				sauver.addEventListener("click", () => e.sauver(s.n));
				const charger = el("button", "mcs-mini", "Charger");
				charger.type = "button";
				charger.disabled = !s.rempli;
				charger.addEventListener("click", () => e.charger(s.n));
				case_.append(sauver, charger);
				g.appendChild(case_);
			}
			b.appendChild(g);
			hote.appendChild(b);
		},
	};

	function rendre(hote, ctx) {
		if (!hote || !ctx || !ctx.options) return;
		ctx.apparence = ctx.apparence || {};
		hote.textContent = "";
		hote.classList.add("mcs");

		const onglets = el("nav", "mcs-onglets");
		onglets.setAttribute("aria-label", "Personnalisation MetaHuman");
		for (const o of ONGLETS) {
			const b = el("button", "mcs-onglet", o.label);
			b.type = "button";
			b.setAttribute("aria-selected", String(o.id === ongletActif));
			b.addEventListener("click", () => {
				ongletActif = o.id;
				rendre(hote, ctx);
			});
			onglets.appendChild(b);
		}
		hote.appendChild(onglets);

		const corps = el("div", "mcs-corps");
		hote.appendChild(corps);
		const section = SECTIONS[ongletActif] || SECTIONS.modele;
		section(ctx, corps);
	}

	window.EditeurMCS = { rendre, copie };
})();
