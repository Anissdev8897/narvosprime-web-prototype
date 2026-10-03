import { useSyncExternalStore } from "react";
import { portalAdminStore, type PortalAdminConfig } from "./portalAdminStore";

export function usePortalAdmin(): PortalAdminConfig {
  useSyncExternalStore(portalAdminStore.subscribe, portalAdminStore.getVersion, portalAdminStore.getVersion);
  return portalAdminStore.get();
}
