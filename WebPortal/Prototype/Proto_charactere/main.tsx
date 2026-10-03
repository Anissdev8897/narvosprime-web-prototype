/**
 * Proto_charactere/main.tsx — Point d'entrée standalone du prototype créateur.
 *
 * Monte le banc d'essai dans un root React dédié, SANS App.tsx ni le routeur du
 * jeu. Le préambule (Draco, KTX2, cache three) vient de `_shared/bootstrap.ts` :
 * il est commun à tous les prototypes, pas recopié ici.
 *
 * Accessible via http://localhost:3005/Prototype/Proto_charactere/
 */
import React from "react";
import ReactDOM from "react-dom/client";

import { CharacterPrototypeSandbox } from "./CharacterPrototypeSandbox";
import { bootstrapPrototype } from "../_shared/bootstrap";

bootstrapPrototype();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <CharacterPrototypeSandbox />,
);
