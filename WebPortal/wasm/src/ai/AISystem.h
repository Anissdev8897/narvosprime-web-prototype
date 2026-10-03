#pragma once
#include "core/Types.h"
#include "components/AITactical.h"
#include <vector>

namespace nv
{
    class AISystem
    {
    public:
        static void Update(f32 dt);

        struct AICommand
        {
            Entity entity;
            enum Action : u8 { None, MoveTo, Attack, FindCover, Retreat, Die } action = None;
            glm::vec3 targetPos{0.0f};
            Entity targetEntity = INVALID_ENTITY;
            f32 yaw = 0.0f;
        };

        static const std::vector<AICommand>& GetCommands() { return s_Commands; }
        static void WriteCommands(float* outBuffer, u32* outCount, u32 maxCommands);

    private:
        static void UpdateIdle(Entity e, AITactical& ai, f32 dt);
        static void UpdateCombat(Entity e, AITactical& ai, f32 dt);
        static void UpdateFlank(Entity e, AITactical& ai, f32 dt);
        static void FindCover(Entity e, AITactical& ai);
        static void ChooseTarget(Entity e, AITactical& ai);
        static bool CanSeeTarget(Entity e, Entity target);
        static void EmitCommand(Entity e, AICommand::Action action, const glm::vec3& pos = {}, Entity target = INVALID_ENTITY, f32 yaw = 0.0f);

        static std::vector<AICommand> s_Commands;
    };
}
