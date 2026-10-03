import { getEngine, isEngineLoaded } from './WasmBridge';
import type { WasmWorldStats } from './WasmBridge';

export type { WasmWorldStats };

class WasmWorldCoordinator {
  private _initialized = false;

  init(): void {
    const engine = getEngine();
    if (!engine) return;
    engine.initWorld();
    this._initialized = true;
  }

  tick(dt: number): void {
    if (!this._initialized) return;
    const engine = getEngine();
    if (!engine) return;
    engine.tickWorld(Math.min(dt, 0.05));
  }

  reset(): void {
    const engine = getEngine();
    if (!engine) return;
    engine.resetWorld();
    this._initialized = false;
  }

  pause(): void {
    getEngine()?.pauseWorld();
  }

  resume(): void {
    getEngine()?.resumeWorld();
  }

  get paused(): boolean {
    return getEngine()?.isWorldPaused() ?? false;
  }

  setTimeScale(scale: number): void {
    getEngine()?.setTimeScale(scale);
  }

  get timeScale(): number {
    return getEngine()?.getTimeScale() ?? 1;
  }

  get worldTime(): number {
    return getEngine()?.getWorldTime() ?? 0;
  }

  get tickCount(): number {
    return getEngine()?.getTickCount() ?? 0;
  }

  getStats(): WasmWorldStats | null {
    const engine = getEngine();
    if (!engine || !isEngineLoaded()) return null;
    return engine.getWorldStats();
  }

  destroyEntity(entity: number): void {
    getEngine()?.destroyEntity(entity);
  }

  get initialized(): boolean {
    return this._initialized;
  }
}

export const wasmWorldCoordinator = new WasmWorldCoordinator();
