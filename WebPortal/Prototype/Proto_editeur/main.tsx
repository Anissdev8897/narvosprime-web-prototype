/**
 * Proto_editeur/main.tsx — Point d'entrée standalone du prototype éditeur.
 *
 * Monte le banc d'essai dans un root React dédié, SANS App.tsx ni le routeur du
 * jeu. Le préambule (Draco, KTX2, cache three) vient de `_shared/bootstrap.ts`.
 *
 * Accessible via http://localhost:3005/Prototype/Proto_editeur/
 */
import React from "react";
import ReactDOM from "react-dom/client";

import { EditorPrototypeSandbox } from "./EditorPrototypeSandbox";
import { bootstrapPrototype } from "../_shared/bootstrap";

bootstrapPrototype();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <EditorPrototypeSandbox />,
);
