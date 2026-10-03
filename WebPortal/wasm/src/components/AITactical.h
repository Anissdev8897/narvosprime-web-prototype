#pragma once
#include "core/Types.h"
#include <glm/vec3.hpp>

namespace nv
{
    enum class AIState : u8 { Idle, Patrol, Investigate, Combat, Suppress, Flank, Retreat, Dead };
    enum class AISquadRole : u8 { Grunt, Leader, Sniper, Brute };

    struct AITactical
    {
        AIState state = AIState::Idle;
        AISquadRole role = AISquadRole::Grunt;
        Entity target = INVALID_ENTITY;
        Entity squadLeader = INVALID_ENTITY;
        glm::vec3 lastKnownEnemyPos{0.0f};
        glm::vec3 coverPos{0.0f};
        f32 stateTime = 0.0f;
        f32 alertLevel = 0.0f;
        f32 courage = 1.0f;
        f32 accuracy = 0.8f;
        bool inCover = false;
        bool suppressing = false;

        // ── Perception (NPCEyesSightPRO port) ──────────────────
        // Range at which this NPC can acquire a target (meters).
        f32 sightRange = 50.0f;
        // Half-angle of the vision cone in radians (π/3 = 60° → 120° FOV).
        f32 sightHalfAngle = 1.0472f;
        // How long the NPC remembers a target after losing sight (seconds).
        f32 targetMemoryDuration = 5.0f;
        // Time since the current target was last seen (0 = currently seen).
        f32 targetMemoryTimer = 0.0f;
    };
}
