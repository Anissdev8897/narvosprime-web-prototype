#include "ai/AISystem.h"
#include "ai/EQS.h"
#include "ecs/Registry.h"
#include "components/Transform.h"
#include "components/Health.h"
#include "components/Weapon.h"
// PlayerTag était REDÉFINI localement plus bas (`struct PlayerTag { u8 dummy = 0; };`)
// alors que components/PlayerTag.h existe et porte la même définition. Deux
// définitions de `nv::PlayerTag` dans deux unités de compilation = violation de
// l'ODR : le comportement est formellement indéfini, même si en pratique le
// linker fusionne les deux (même nom décoré, même disposition mémoire) et que
// les pools indexés par `typeid` finissent par coïncider.
//
// On inclut donc l'en-tête, seule définition faisant autorité.
#include "components/PlayerTag.h"

namespace nv
{
    std::vector<AISystem::AICommand> AISystem::s_Commands;

    void AISystem::EmitCommand(Entity e, AICommand::Action action, const glm::vec3& pos, Entity target, f32 yaw)
    {
        s_Commands.push_back({e, action, pos, target, yaw});
    }

    void AISystem::Update(f32 dt)
    {
        s_Commands.clear();
        auto& aiPool = g_Registry.GetOrCreatePool<AITactical>();
        for (u32 i = 0; i < aiPool.Size(); ++i)
        {
            Entity e = aiPool.Entities()[i];
            auto& ai = aiPool.Data()[i];
            if (ai.state == AIState::Dead) continue;
            ai.stateTime += dt;

            switch (ai.state)
            {
            case AIState::Idle:
            case AIState::Patrol: UpdateIdle(e, ai, dt); break;
            case AIState::Combat: UpdateCombat(e, ai, dt); break;
            case AIState::Flank: UpdateFlank(e, ai, dt); break;
            default: break;
            }
        }
    }

    void AISystem::UpdateIdle(Entity e, AITactical& ai, f32 dt)
    {
        NV_UNUSED(dt);
        ChooseTarget(e, ai);
        if (ai.target != INVALID_ENTITY)
        {
            ai.state = AIState::Combat;
            ai.stateTime = 0.0f;
        }
    }

    void AISystem::UpdateCombat(Entity e, AITactical& ai, f32 dt)
    {
        Transform* t = g_Registry.GetComponent<Transform>(e);
        Health* h = g_Registry.GetComponent<Health>(e);
        Weapon* w = g_Registry.GetComponent<Weapon>(e);
        if (!t || !h || !w) return;

        if (ai.target == INVALID_ENTITY) { ChooseTarget(e, ai); return; }
        if (!g_Registry.IsValid(ai.target))
        {
            ai.target            = INVALID_ENTITY;
            ai.targetMemoryTimer = 0.0f;
            ai.state             = AIState::Idle;
            return;
        }

        Transform* tt = g_Registry.GetComponent<Transform>(ai.target);
        if (!tt) return;

        f32 dist = glm::distance(t->position, tt->position);
        bool canSee = CanSeeTarget(e, ai.target);

        // ── Target memory ────────────────────────────────────────
        if (canSee)
        {
            // Fresh sighting — reset memory, update last-known pos.
            ai.targetMemoryTimer  = 0.0f;
            ai.lastKnownEnemyPos  = tt->position;
        }
        else
        {
            // Lost sight — tick the memory timer.
            ai.targetMemoryTimer += dt;
        }

        // ── Memory expiration → flank ────────────────────────────
        if (!canSee && ai.targetMemoryTimer > ai.targetMemoryDuration)
        {
            ai.state             = AIState::Flank;
            ai.stateTime         = 0.0f;
            ai.targetMemoryTimer = 0.0f;
            return;
        }

        // ── Retreat when low ─────────────────────────────────────
        if (h->currentShield <= 0.0f && h->currentHealth < h->maxHealth * 0.3f && ai.courage < 0.5f)
        {
            ai.state = AIState::Retreat;
            FindCover(e, ai);
            EmitCommand(e, AICommand::Retreat, ai.coverPos);
            return;
        }

        // ── Cover ────────────────────────────────────────────────
        if (!ai.inCover && dist < 15.0f && ai.role != AISquadRole::Brute)
            FindCover(e, ai);

        // ── Action ───────────────────────────────────────────────
        if (canSee && w->currentAmmo > 0)
        {
            glm::vec3 dir = glm::normalize(tt->position - t->position);
            f32 yaw = atan2f(dir.x, dir.z);
            EmitCommand(e, AICommand::Attack, tt->position, ai.target, yaw);
        }
        else if (!canSee)
        {
            // Pursuit: move toward last known enemy position.
            EmitCommand(e, AICommand::MoveTo, ai.lastKnownEnemyPos);
        }
    }

    void AISystem::UpdateFlank(Entity e, AITactical& ai, f32 dt)
    {
        NV_UNUSED(dt);
        if (ai.stateTime > 5.0f)
        {
            ai.state = AIState::Combat;
            ai.stateTime = 0.0f;
        }
    }

    void AISystem::FindCover(Entity e, AITactical& ai)
    {
        Transform* t = g_Registry.GetComponent<Transform>(e);
        if (!t) return;

        EQSQuery q;
        q.querier = t->position;
        q.radius = 20.0f;
        q.gridSize = 16;
        q.tests.push_back({EQSTest::Distance, [&](const glm::vec3& p) {
            f32 d = glm::distance(p, ai.lastKnownEnemyPos);
            return (d > 5.0f && d < 15.0f) ? 1.0f : 0.0f;
        }, 1.0f});

        auto results = EQS::RunQuery(q);
        if (!results.empty() && results[0].valid)
        {
            ai.coverPos = results[0].position;
            ai.inCover = true;
            EmitCommand(e, AICommand::FindCover, ai.coverPos);
        }
    }

    // ── Perception helpers (NPCEyesSightPRO port) ────────────────────
    // Checks whether `targetPos` lies within the NPC's forward-facing
    // vision cone.  Returns true if the angle between the NPC's forward
    // vector and the direction to `targetPos` is ≤ sightHalfAngle.
    static bool IsInVisionCone(const Transform& npc, const glm::vec3& targetPos, f32 halfAngle)
    {
        glm::vec3 toTarget = glm::normalize(targetPos - npc.position);
        f32 dot = glm::dot(npc.Forward(), toTarget);
        f32 threshold = cosf(halfAngle);   // narrower angle → higher threshold
        return dot >= threshold;
    }

    void AISystem::ChooseTarget(Entity e, AITactical& ai)
    {
        Transform* t = g_Registry.GetComponent<Transform>(e);
        if (!t) return;

        // ── Memory decay ─────────────────────────────────────────
        // If we already have a target but just lost sight, let memory
        // keep it alive for targetMemoryDuration seconds so we chase
        // the last-known position instead of instantly snapping to a
        // new target or dropping back to Idle.
        if (ai.target != INVALID_ENTITY && ai.targetMemoryTimer > 0.0f)
        {
            // Still within memory window — keep the current target.
            return;
        }

        Entity player = INVALID_ENTITY;
        auto& playerPool = g_Registry.GetOrCreatePool<PlayerTag>();
        if (!playerPool.Entities().empty())
            player = playerPool.Entities()[0];

        if (player == INVALID_ENTITY || !g_Registry.IsValid(player))
            return;

        Transform* pt = g_Registry.GetComponent<Transform>(player);
        if (!pt) return;

        // ── Range gate ───────────────────────────────────────────
        f32 dist = glm::distance(t->position, pt->position);
        if (dist > ai.sightRange)
            return;   // too far — don't even consider

        // ── Vision cone ──────────────────────────────────────────
        if (!IsInVisionCone(*t, pt->position, ai.sightHalfAngle))
            return;   // outside FOV

        // ── Line-of-sight ────────────────────────────────────────
        if (!CanSeeTarget(e, player))
            return;   // occluded

        // Acquire.
        ai.target              = player;
        ai.lastKnownEnemyPos   = pt->position;
        ai.targetMemoryTimer   = 0.0f;   // currently seen
    }

    bool AISystem::CanSeeTarget(Entity e, Entity target)
    {
        Transform* t1 = g_Registry.GetComponent<Transform>(e);
        Transform* t2 = g_Registry.GetComponent<Transform>(target);
        if (!t1 || !t2) return false;
        return !EQS::TraceTest(t1->position + glm::vec3(0,1.6f,0), t2->position + glm::vec3(0,1.6f,0));
    }

    void AISystem::WriteCommands(float* outBuffer, u32* outCount, u32 maxCommands)
    {
        u32 count = std::min((u32)s_Commands.size(), maxCommands);
        *outCount = count;
        // Per command: entity(u32 as float), action(u8 as float), targetX, targetY, targetZ, targetEntity(as float), yaw
        // = 7 floats per command
        for (u32 i = 0; i < count; ++i)
        {
            const auto& cmd = s_Commands[i];
            u32 base = i * 7;
            outBuffer[base + 0] = (float)cmd.entity;
            outBuffer[base + 1] = (float)cmd.action;
            outBuffer[base + 2] = cmd.targetPos.x;
            outBuffer[base + 3] = cmd.targetPos.y;
            outBuffer[base + 4] = cmd.targetPos.z;
            outBuffer[base + 5] = (float)cmd.targetEntity;
            outBuffer[base + 6] = cmd.yaw;
        }
    }
}
