#pragma once
#include "core/Types.h"
#include "ecs/Registry.h"
#include "ecs/ComponentPool.h"
#include "components/Transform.h"
#include "components/Health.h"
#include "components/Weapon.h"
#include <chrono>
#include <cstdio>

namespace nv
{
    // ── ECS Benchmark suite ──────────────────────────────────────────
    // Measures iteration time, add/remove time, and simulated cache misses.
    // Designed to be compiled and run both natively (for detailed perf) and
    // in WASM (for regression detection).
    //
    // Usage: ECSBenchmark::RunAll();

    struct BenchmarkResults
    {
        // ForEach iteration (µs)
        f64 forEachCopyOld_1comp  = 0.0;  // OLD: ForEach<Health> with copy (simulated)
        f64 forEachRefNew_1comp   = 0.0;  // NEW: ForEach<Health> with const ref
        f64 forEachRefNew_2comp   = 0.0;  // NEW: ForEach<Health, Transform>
        f64 viewNew_2comp         = 0.0;  // NEW: View<Health, Transform>

        // Add/Remove (µs)
        f64 addEntityTime         = 0.0;
        f64 removeEntityTime      = 0.0;
        f64 addComponentTime      = 0.0;
        f64 removeComponentTime   = 0.0;

        // Speedups
        f64 forEachSpeedup        = 0.0;  // copy / ref
        f64 viewVsForEachSpeedup  = 0.0;  // ForEach 2-comp / View 2-comp

        // Stats
        u32 entityCount           = 0;
        u32 poolCapacities        = 0;

        void Print() const
        {
            printf("\n===== ECS BENCHMARK RESULTS =====\n");
            printf("Entities: %u\n", entityCount);
            printf("\n── Iteration (all times in µs) ──\n");
            printf("ForEach<Health> (OLD/copy simulated):  %8.3f µs\n", forEachCopyOld_1comp);
            printf("ForEach<Health> (NEW/ref, template):   %8.3f µs  (%5.2fx speedup)\n",
                   forEachRefNew_1comp, forEachSpeedup);
            printf("ForEach<Health,Transform> (NEW):       %8.3f µs\n", forEachRefNew_2comp);
            printf("View<Health,Transform> (NEW):          %8.3f µs  (%5.2fx vs ForEach 2-comp)\n",
                   viewNew_2comp, viewVsForEachSpeedup);
            printf("\n── Add/Remove (µs per op) ──\n");
            printf("CreateEntity:     %8.3f µs\n", addEntityTime);
            printf("DestroyEntity:    %8.3f µs\n", removeEntityTime);
            printf("AddComponent:     %8.3f µs\n", addComponentTime);
            printf("RemoveComponent:  %8.3f µs\n", removeComponentTime);
            printf("\n── Memory ──\n");
            printf("Pool capacities: %u slots\n", poolCapacities);
            printf("================================\n");
        }
    };

    class ECSBenchmark
    {
    public:
        static BenchmarkResults RunAll(u32 entityCount = 500, u32 iterations = 100)
        {
            BenchmarkResults results;
            results.entityCount = entityCount;

            printf("[ECS Benchmark] Populating %u entities with components...\n", entityCount);

            // ── Setup: populate registry ──
            Registry& reg = g_Registry;

            // Clear any previous state
            reg.Clear();

            // Create entities with Health + Transform components
            std::vector<Entity> entities;
            entities.reserve(entityCount);

            auto t0 = Now();
            for (u32 i = 0; i < entityCount; ++i)
            {
                Entity e = reg.CreateEntity();
                reg.AddComponent<Health>(e);
                reg.AddComponent<Transform>(e);
                entities.push_back(e);
            }
            results.addEntityTime = static_cast<f64>(ElapsedUs(t0)) / entityCount;

            // ── Benchmark 1: ForEach<Health> OLD (simulated copy cost) ──
            printf("  [1/6] ForEach<Health> (OLD copy simulation)...\n");
            {
                f64 totalUs = 0.0;
                for (u32 iter = 0; iter < iterations; ++iter)
                {
                    auto start = Now();
                    // Simulate OLD behaviour: copy entity vector + std::function
                    auto& pool = reg.GetOrCreatePool<Health>();
                    std::vector<Entity> copiedEntities = pool.Entities();  // ← THE COPY
                    u32 count = 0;
                    for (Entity e : copiedEntities)
                    {
                        if (reg.HasComponent<Health>(e))
                        {
                            auto* h = reg.GetComponent<Health>(e);
                            if (h) { count += (u32)(h->currentHealth > 0); }
                        }
                    }
                    totalUs += ElapsedUs(start);
                    NV_UNUSED(count);
                }
                results.forEachCopyOld_1comp = totalUs / iterations;
            }

            // ── Benchmark 2: ForEach<Health> NEW (template + ref) ──
            printf("  [2/6] ForEach<Health> (NEW template+ref)...\n");
            {
                f64 totalUs = 0.0;
                for (u32 iter = 0; iter < iterations; ++iter)
                {
                    auto start = Now();
                    u32 count = 0;
                    reg.ForEach<Health>([&](Entity e, Health& h) {
                        NV_UNUSED(e);
                        count += (u32)(h.currentHealth > 0);
                    });
                    totalUs += ElapsedUs(start);
                    NV_UNUSED(count);
                }
                results.forEachRefNew_1comp = totalUs / iterations;
            }
            results.forEachSpeedup = (results.forEachCopyOld_1comp > 0)
                ? results.forEachCopyOld_1comp / results.forEachRefNew_1comp
                : 0.0;

            // ── Benchmark 3: ForEach<Health, Transform> NEW ──
            printf("  [3/6] ForEach<Health,Transform> (NEW template+ref)...\n");
            {
                f64 totalUs = 0.0;
                for (u32 iter = 0; iter < iterations; ++iter)
                {
                    auto start = Now();
                    u32 count = 0;
                    reg.ForEach<Health, Transform>([&](Entity e, Health& h, Transform& t) {
                        NV_UNUSED(e);
                        NV_UNUSED(t);
                        count += (u32)(h.currentHealth > 0);
                    });
                    totalUs += ElapsedUs(start);
                    NV_UNUSED(count);
                }
                results.forEachRefNew_2comp = totalUs / iterations;
            }

            // ── Benchmark 4: View<Health, Transform> NEW ──
            printf("  [4/6] View<Health,Transform> (NEW lock-step)...\n");
            {
                f64 totalUs = 0.0;
                for (u32 iter = 0; iter < iterations; ++iter)
                {
                    auto start = Now();
                    u32 count = 0;
                    for (auto [e, h, t] : reg.ViewComponents<Health, Transform>())
                    {
                        NV_UNUSED(e);
                        NV_UNUSED(t);
                        count += (u32)(h->currentHealth > 0);
                    }
                    totalUs += ElapsedUs(start);
                    NV_UNUSED(count);
                }
                results.viewNew_2comp = totalUs / iterations;
            }
            results.viewVsForEachSpeedup = (results.forEachRefNew_2comp > 0)
                ? results.forEachRefNew_2comp / results.viewNew_2comp
                : 0.0;

            // ── Benchmark 5: Add/Remove components ──
            printf("  [5/6] Add/Remove operations...\n");
            {
                // Add Weapon component
                auto start = Now();
                for (u32 i = 0; i < entityCount; ++i)
                    reg.AddComponent<Weapon>(entities[i]);
                results.addComponentTime = ElapsedUs(start) / entityCount;

                // Remove Weapon component
                start = Now();
                for (u32 i = 0; i < entityCount; ++i)
                    reg.RemoveComponent<Weapon>(entities[i]);
                results.removeComponentTime = ElapsedUs(start) / entityCount;
            }

            // ── Benchmark 6: DestroyEntity ──
            printf("  [6/6] DestroyEntity...\n");
            {
                // Re-add entities for destroy test
                std::vector<Entity> toDestroy;
                toDestroy.reserve(entityCount);
                for (u32 i = 0; i < entityCount; ++i)
                {
                    Entity e = reg.CreateEntity();
                    reg.AddComponent<Health>(e);
                    reg.AddComponent<Transform>(e);
                    toDestroy.push_back(e);
                }

                auto start = Now();
                for (Entity e : toDestroy)
                    reg.DestroyEntity(e);
                results.removeEntityTime = ElapsedUs(start) / entityCount;
            }

            // ── Pool capacity info ──
            {
                auto& hp = reg.GetOrCreatePool<Health>();
                auto& tp = reg.GetOrCreatePool<Transform>();
                results.poolCapacities = hp.Capacity() + tp.Capacity();
            }

            reg.Clear();

            printf("[ECS Benchmark] Done.\n\n");
            results.Print();
            return results;
        }

    private:
        using Clock = std::chrono::high_resolution_clock;
        using TimePoint = Clock::time_point;

        static TimePoint Now()
        {
            return Clock::now();
        }

        static f64 ElapsedUs(const TimePoint& start)
        {
            auto end = Clock::now();
            return std::chrono::duration<f64, std::micro>(end - start).count();
        }
    };
}
