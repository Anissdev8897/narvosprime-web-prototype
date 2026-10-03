// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 15 ligne(s) attendue(s) ici, 7 connue(s)]
// forge/forgeSync.ts — FORGE LIVE : édition collaborative temps réel (transport).
//
// v1 SNAPSHOT-SYNC : à chaque sauvegarde locale d'une scène, on diffuse la scène ENTIÈRE
// (débouncée) aux autres éditeurs ; un snapshot distant écrase la scène locale (dernier
// save gagne). Simple et robuste pour quelques admins. Granularité par-op = v2.
//
// Présence : caméra + identité diffusées en continu (throttle) → curseurs des pairs.
// [ANCIENNE VERSION ↑]
// S'appuie sur le WebSocket existant (net/socket : auth par token, reconnexion auto).
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 21 ligne(s) attendue(s) ici, 20 connue(s)]
// Le serveur rebroadcaste tout paquet FORGE_* aux AUTRES clients (cf. WebSocketServer).
import { socket } from "../../../net/socket";
import { forgeSceneStore, snapshotOf, type SceneSnapshot } from "./forgeSceneStore";
import { forgePresence, peerColor } from "./forgePresenceStore";

// Casts : les types FORGE_* ne sont pas dans l'union PacketType de net/socket → cast string.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sock = socket as any;

/** WebSocket réellement ouvert ? (évite le spam "Not connected" quand le serveur est absent). */
function connected(): boolean { return !!sock.ws && sock.ws.readyState === 1; }
function safeSend(packet: unknown): void { if (connected()) sock.send?.(packet); }

type RemoteMsg =
  // Le snapshot diffusé est le MÊME que celui de l'historique (`SceneSnapshot`).
  // Il énumérait auparavant ses champs (`Pick<…, "objects" | "waters" | "terrain" | "baseMap">`) :
  // routes, terrains multiples et ambiance n'étaient JAMAIS diffusés, donc deux
  // co-éditeurs divergeaient en silence dès qu'un seul traçait une route.
  // Défini par soustraction, il suit désormais tout ajout à `ForgeScene`.
  | { sub: "FORGE_SCENE"; room: string; from: string; scene: SceneSnapshot }
// [ANCIENNE VERSION ↑]
  /** Modifications INCRÉMENTALES — le régime normal d'une session live. */
  | { sub: "FORGE_OPS"; room: string; from: string; ops: SceneOp[] }
  | { sub: "FORGE_PRESENCE"; room: string; from: string; name: string; cam: [number, number, number] }
  | { sub: "FORGE_JOIN"; room: string; from: string };

let active = false;
let room: string | null = null;
let applyingRemote = false;       // vrai pendant l'application d'un snapshot distant → pas de rebroadcast
let unsubStore: (() => void) | null = null;
let unsubRemote: (() => void) | null = null;
let pruneTimer: ReturnType<typeof setInterval> | null = null;
let sendTimer: ReturnType<typeof setTimeout> | null = null;
let lastPresence = 0;
let selfName = "Admin";

/**
 * Dernier état DIFFUSÉ — la base de comparaison des diffs.
 *
 * Mis à jour aussi bien après un envoi qu'après l'application d'un message
 * distant : sans ça, recevoir l'opération d'un pair produirait un diff local
 * qu'on lui renverrait aussitôt, et les deux clients se répondraient en boucle.
 */
let lastSent: SceneSnapshot | null = null;

/** Snapshot COMPLET — réservé à l'arrivée d'un pair, qui n'a encore rien. */
function broadcastScene() {
  if (!room) return;
  const s = forgeSceneStore.get(room);
  if (!s) return;
  const snap = snapshotOf(s);
  lastSent = snap;
  safeSend({ type: "FORGE_OP", data: { sub: "FORGE_SCENE", room, scene: snap } });
}

/**
 * Diffuse UNIQUEMENT ce qui a changé depuis la dernière émission.
 *
 * Remplace l'envoi du snapshot complet, dont la sémantique « dernier
 * enregistrement gagne » faisait disparaître le travail d'un pair dès que deux
 * personnes touchaient la scène dans la même seconde — même sur des objets
 * DIFFÉRENTS, puisque tout l'état voyageait à chaque fois.
 */
function broadcastChanges() {
  if (!room) return;
  const s = forgeSceneStore.get(room);
  if (!s) return;
  const snap = snapshotOf(s);
  const ops = diffScenes(lastSent, snap);
  lastSent = snap;
  if (ops.length === 0) return;   // rien n'a bougé → aucun paquet
  safeSend({ type: "FORGE_OP", data: { sub: "FORGE_OPS", room, ops } });
}

function onRemote(msg: RemoteMsg) {
  if (!active || !msg || msg.room !== room) return;
  if (msg.sub === "FORGE_SCENE") {
    // Snapshot complet : uniquement à l'arrivée (réponse à un JOIN).
    applyingRemote = true;
    forgeSceneStore.save(msg.room, msg.scene);
    lastSent = msg.scene;   // aligne la base de diff → pas de renvoi en écho
    applyingRemote = false;
  } else if (msg.sub === "FORGE_OPS") {
    const local = forgeSceneStore.get(msg.room);
    if (!local) return;
    // Fusion : seuls les éléments désignés par les opérations changent. Un objet
    // que le pair n'a pas touché garde SA valeur locale — c'est exactement ce que
    // le snapshot complet écrasait.
    const merged = applyOps(snapshotOf(local), msg.ops);
    applyingRemote = true;
    forgeSceneStore.save(msg.room, merged);
    lastSent = merged;
    applyingRemote = false;
  } else if (msg.sub === "FORGE_PRESENCE") {
    forgePresence.upsert({ id: msg.from, name: msg.name, color: peerColor(msg.from), cam: msg.cam }, performance.now());
  } else if (msg.sub === "FORGE_JOIN") {
    // Un nouveau pair arrive → on lui envoie notre snapshot pour qu'il se synchronise.
    broadcastScene();
  }
}

export const forgeSync = {
  isActive: () => active,
  currentRoom: () => room,

  /** Démarre la session live sur une scène. identity.name = libellé affiché aux pairs. */
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : ? ligne(s) attendue(s) ici, 41 connue(s)]
  start(sceneId: string, identity: { name: string }): void {
    if (active) forgeSync.stop();
    active = true;
    room = sceneId;
    selfName = identity.name || "Admin";
    forgePresence.clear();

    // Abonnement aux changements de scène → diffuse (débouncé) sauf si on applique du distant.
    unsubStore = forgeSceneStore.subscribe(() => {
      if (applyingRemote || !active) return;
      if (sendTimer) clearTimeout(sendTimer);
      sendTimer = setTimeout(broadcastScene, 180);
    });

    unsubRemote = sock.on?.("FORGE_REMOTE", onRemote) ?? null;
    pruneTimer = setInterval(() => forgePresence.prune(performance.now()), 3000);

    // Annonce sa présence + demande les snapshots des autres.
    safeSend({ type: "FORGE_OP", data: { sub: "FORGE_JOIN", room } });
  },

  /** Diffuse la caméra (throttle 100 ms) → curseur du pair. */
  sendPresence(cam: [number, number, number]): void {
    if (!active || !room) return;
    const now = performance.now();
    if (now - lastPresence < 100) return;
    lastPresence = now;
    safeSend({ type: "FORGE_OP", data: { sub: "FORGE_PRESENCE", room, name: selfName, cam } });
  },

  stop(): void {
    if (!active) return;
    active = false;
    if (unsubStore) unsubStore(); unsubStore = null;
    if (unsubRemote) unsubRemote(); unsubRemote = null;
    if (pruneTimer) clearInterval(pruneTimer); pruneTimer = null;
    if (sendTimer) clearTimeout(sendTimer); sendTimer = null;
    room = null;
    forgePresence.clear();
  },
};
// [ANCIENNE VERSION ↑]
// [DERNIÈRE VERSION ↓ — ligne(s) sûre(s) du fichier final, lue(s) dans le tronçon ci-dessus mais non replacée(s) : il a changé de longueur. Leur n° final est entre crochets]
// [SÛRE n°129]     lastSent = null;   // nouvelle session → le premier diff part d'une base vierge
// [DERNIÈRE VERSION ↑]