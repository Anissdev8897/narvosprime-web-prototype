cmake_minimum_required(VERSION 3.20)
project(NarvosWasm LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# GLM — header-only, bundled
add_subdirectory(vendor/glm EXCLUDE_FROM_ALL)

set(SOURCES
    src/core/Types.h
    src/core/Math.h
    src/ecs/ComponentPool.h
    src/ecs/Registry.h
    src/ecs/Registry.cpp
    src/components/Transform.h
    src/components/Health.h
    src/components/Weapon.h
    src/components/AITactical.h
    src/animation/Skeleton.h
    src/animation/Skeleton.cpp
    src/animation/Animator.h
    src/animation/AnimationGraph.h
    src/animation/AnimationGraph.cpp
    src/physics/Raycast.h
    src/physics/Raycast.cpp
    src/physics/CollisionSystem.h
    src/physics/CollisionSystem.cpp
    src/physics/Vehicle.h
    src/physics/Vehicle.cpp
    src/ai/EQS.h
    src/ai/EQS.cpp
    src/ai/AISystem.h
    src/ai/AISystem.cpp
    src/combat/DamageEvents.h
    src/combat/StatusEffects.h
    src/combat/StatusEffects.cpp
    src/components/PlayerTag.h
    src/bridge/AnimationBridge.h
    src/bridge/AnimationBridge.cpp
    src/bridge/WorldCoordinator.h
    src/bridge/WorldCoordinator.cpp
    src/streaming/ChunkStreamingManager.h
    src/streaming/ChunkStreamingManager.cpp
    src/streaming/AssetBudgetManager.h
    src/streaming/AssetBudgetManager.cpp
    src/navigation/NavMesh.h
    src/navigation/NavMesh.cpp
    src/navigation/PathManager.h
    src/navigation/PathManager.cpp
    src/physics/BVH.h
    src/physics/BVH.cpp
    src/physics/TriggerSystem.h
    src/physics/TriggerSystem.cpp
    src/bridge/Bindings.cpp
)

add_executable(narvos-engine ${SOURCES})
target_include_directories(narvos-engine PRIVATE src)
target_compile_definitions(narvos-engine PRIVATE GLM_ENABLE_EXPERIMENTAL)
target_link_libraries(narvos-engine PRIVATE glm::glm)

if(EMSCRIPTEN)
    option(NARVOS_PTHREADS "Enable pthreads (requires COOP/COEP headers)" OFF)

    set_target_properties(narvos-engine PROPERTIES
        SUFFIX ".js"
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/dist"
    )

    # SIMD 128-bit : gains 3-80x sur les kernels math/physique/IA (gratuit, supporté partout)
    target_compile_options(narvos-engine PRIVATE -msimd128)

    target_link_options(narvos-engine PRIVATE
        "SHELL:-s WASM=1"
        "SHELL:-s ALLOW_MEMORY_GROWTH=1"
        "SHELL:-s INITIAL_MEMORY=67108864"
        "SHELL:-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPF32','HEAPU32']"
        "SHELL:-s EXPORTED_FUNCTIONS=['_malloc','_free']"
        "SHELL:-s MODULARIZE=1"
        "SHELL:-s EXPORT_NAME=NarvosEngine"
        "SHELL:-s ENVIRONMENT=web"
        "SHELL:-s NO_EXIT_RUNTIME=1"
        "SHELL:-s MALLOC=mimalloc"
        "SHELL:--bind"
        "-msimd128"
        "-O2"
    )

    if(NARVOS_PTHREADS)
        target_compile_options(narvos-engine PRIVATE -pthread)
        target_link_options(narvos-engine PRIVATE
            -pthread
            "SHELL:-s SHARED_MEMORY=1"
            "SHELL:-s PTHREAD_POOL_SIZE=navigator.hardwareConcurrency"
        )
    endif()
endif()
