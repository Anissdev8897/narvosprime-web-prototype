#include "ecs/ECSBenchmark.h"

// ── Standalone benchmark entry point ──
// Compile with: emcc -O2 -msimd128 -I src src/ecs/ECSBenchmark.cpp ... -o bench.html
// or natively: g++ -O2 -std=c++20 -I src src/ecs/ECSBenchmark.cpp src/ecs/Registry.cpp ... -o ecs_bench

#ifdef __EMSCRIPTEN__
#include <emscripten.h>

extern "C" {

EMSCRIPTEN_KEEPALIVE
void ecs_run_benchmark(int entityCount, int iterations)
{
    nv::ECSBenchmark::RunAll(
        entityCount > 0 ? (u32)entityCount : 500,
        iterations > 0 ? (u32)iterations : 100
    );
}

}
#else
// Native build — just run the benchmark
int main()
{
    nv::ECSBenchmark::RunAll(500, 100);
    return 0;
}
#endif
