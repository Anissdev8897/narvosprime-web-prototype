// runtime/serverRules.ts — règles du SERVEUR choisi (hors-React, lisible partout).
//
// La sélection de serveur (ServerSelection) définit le contrat de mort :
//   NORMAL  (« paradisiaque »)    → mort = perte du butin NON SÉCURISÉ (expeditionLedger)
//   HEROIC  (« mort définitive ») → mort = personnage PERDU + entrée au ladder
export type ServerType = "NORMAL" | "HEROIC";

let serverType: ServerType = "NORMAL";

export const serverRules = {
  set(t: ServerType): void { serverType = t; },
  get(): ServerType { return serverType; },
  isHardcore(): boolean { return serverType === "HEROIC"; },
};
