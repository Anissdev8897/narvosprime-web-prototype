// camera/recoilDispatcher.ts — pont Animation Event → effet caméra.
//
// Unique point de traduction "un event d'anim a été franchi" → "applique tel effet".
// Décision projet : recoil = VISUEL pur, profil porté par le payload de l'event.
// Extensible : ajouter un case (sfx/vfx) sans toucher anim/ ni camera/.
import type { AnimEvent } from "../animation/animEvents";
import { recoilProfileStore } from "./recoilProfileStore";
import { cameraRecoil } from "./CameraRecoilController";

export function dispatchAnimEvent(ev: AnimEvent): void {
  switch (ev.type) {
    case "recoil":
    case "impact": {
      // get() = override réglé (admin) sinon profil usine → tuning live sans recompil.
      const profile = ev.payload ? recoilProfileStore.get(ev.payload) : undefined;
      if (profile) cameraRecoil.applyRecoil(profile);
      break;
    }
    // "sfx" / "vfx" : branchements futurs (audioManager / spawn VFX).
    default:
      break;
  }
}
