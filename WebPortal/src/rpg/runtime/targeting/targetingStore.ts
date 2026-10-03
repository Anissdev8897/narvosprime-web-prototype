import { useSyncExternalStore } from "react";

export interface TargetInfo {
  id: string;
  label: string;
  hpFraction: number;
  maxHp: number;
  level: number;
}

type Listener = () => void;

class TargetingStore {
  private target: TargetInfo | null = null;
  private subs = new Set<Listener>();

  setTarget(t: TargetInfo | null): void {
    if (t === this.target) return;
    if (t && this.target && t.id === this.target.id
      && t.hpFraction === this.target.hpFraction
      && t.label === this.target.label) return;
    this.target = t;
    for (const fn of this.subs) fn();
  }

  getSnapshot = (): TargetInfo | null => this.target;
  subscribe = (fn: Listener): (() => void) => {
    this.subs.add(fn);
    return () => { this.subs.delete(fn); };
  };

  clear(): void { this.target = null; for (const fn of this.subs) fn(); }
}

export const targetingStore = new TargetingStore();

export function useCurrentTarget(): TargetInfo | null {
  return useSyncExternalStore(targetingStore.subscribe, targetingStore.getSnapshot);
}
