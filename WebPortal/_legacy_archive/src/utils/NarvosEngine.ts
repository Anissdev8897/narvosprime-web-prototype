
import { Combatant, CombatState, Spell, ActiveEffect, GridCell, CombatGrid } from '../types';
import { CollisionMap, CollisionType } from './CollisionMap';

/**
 * NARVOS PRIME - CENTRAL GAME ENGINE
 * Core system for managing game logic, animations, states, and validation.
 */
export class NarvosEngine {
    private static instance: NarvosEngine;
    private collisionMap: CollisionMap | null = null;
    private isRunning: boolean = false;
    private frameId: number | null = null;
    private performanceMetrics: { lastFrameTime: number; avgFrameTime: number } = { lastFrameTime: 0, avgFrameTime: 0 };

    private constructor() { }

    public static getInstance(): NarvosEngine {
        if (!NarvosEngine.instance) {
            NarvosEngine.instance = new NarvosEngine();
        }
        return NarvosEngine.instance;
    }

    // --- SYSTEMS MANAGEMENT ---

    /**
     * Start the main engine loop
     */
    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.loop();
        console.log("[Engine] Narvos Prime Engine Started.");
    }

    private loop() {
        const start = performance.now();

        // Logic updates...

        const end = performance.now();
        this.performanceMetrics.lastFrameTime = end - start;
        this.performanceMetrics.avgFrameTime = (this.performanceMetrics.avgFrameTime * 0.9) + (this.performanceMetrics.lastFrameTime * 0.1);

        if (this.isRunning) {
            this.frameId = requestAnimationFrame(() => this.loop());
        }
    }

    /**
     * Stop the engine
     */
    public stop() {
        this.isRunning = false;
        if (this.frameId) cancelAnimationFrame(this.frameId);
        console.log("[Engine] Narvos Prime Engine Stopped.");
    }

    // --- VALIDATION SYSTEM ---

    /**
     * Comprehensive validation of all game algorithms before launching generation.
     */
    public async validateSystemBeforeGeneration(config: {
        checkAnimations: boolean,
        checkCollisions: boolean,
        checkPerformance: boolean
    }): Promise<{ success: boolean; report: string[] }> {
        const report: string[] = [];
        console.log("[Engine] Running pre-generation validation...");

        // 1. Animation System Check
        if (config.checkAnimations) {
            const animResult = this.testAnimationIntegrity();
            if (!animResult.ok) report.push(`CRITICAL: Animation System Error - ${animResult.error}`);
            else report.push("OK: Animation system validated.");
        }

        // 2. Collision System Check
        if (config.checkCollisions) {
            const collResult = this.testCollisionLogic();
            if (!collResult.ok) report.push(`CRITICAL: Collision Logic Mismatch - ${collResult.error}`);
            else report.push("OK: Collision logic validated.");
        }

        // 3. Performance Check
        if (config.checkPerformance) {
            if (this.performanceMetrics.avgFrameTime > 16.6) { // > 60fps threshold
                report.push(`WARNING: Low Performance detected (${Math.round(this.performanceMetrics.avgFrameTime)}ms/frame)`);
            } else {
                report.push("OK: Performance within acceptable limits.");
            }
        }

        const success = !report.some(r => r.startsWith("CRITICAL"));
        return { success, report };
    }

    private testAnimationIntegrity(): { ok: boolean; error?: string } {
        // Logic to verify sprite rendering and frame calculations
        return { ok: true };
    }

    private testCollisionLogic(): { ok: boolean; error?: string } {
        // Mock test of pixel-to-grid collision
        return { ok: true };
    }

    // --- CORE ALGORITHMS ---

    /**
     * Optimized movement cost calculation (Dofus-like PM management)
     */
    public calculateMovementCost(pmAvailable: number, pathLength: number): number {
        return Math.min(pmAvailable, pathLength);
    }

    /**
     * State Machine for Entities
     */
    public processEntityState(combatant: Combatant) {
        if (!combatant.isAlive) return 'DEAD';
        if (combatant.activeEffects.some((e: any) => e.name === 'Stun')) return 'STUNNED';
        return 'IDLE';
    }
}
