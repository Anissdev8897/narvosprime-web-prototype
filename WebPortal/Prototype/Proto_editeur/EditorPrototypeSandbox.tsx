/**
 * Proto_editeur/EditorPrototypeSandbox.tsx — Banc d'essai de l'éditeur de monde.
 *
 * IMPORTE `ForgeEditor` tel quel : aucun code déplacé, aucune copie. Dupliquer
 * l'éditeur produirait deux versions qui divergent (cf.
 * docs/ARCHITECTURE_PROTOTYPES.md §5).
 *
 * `onExit` est OPTIONNEL côté `ForgeEditor` : ne pas le passer masque le bouton
 * « Quitter », ce qui est le comportement juste ici — il n'y a rien derrière,
 * c'est un onglet autonome.
 *
 * ⚠ Ce prototype charge de VRAIES maps : c'est le métier de l'éditeur. Il ne
 * respecte donc pas la règle « aucun chargement de map » qui vaut pour les
 * bancs de mécanique (combat, animation) — l'éditeur EST l'outil de map, le
 * priver de maps le viderait de son objet.
 *
 * Accessible via http://localhost:3005/Prototype/Proto_editeur/
 */
import React from "react";

import { ForgeEditor } from "../../src/rpg/forge/ForgeEditor";

export function EditorPrototypeSandbox() {
  return <ForgeEditor />;
}
