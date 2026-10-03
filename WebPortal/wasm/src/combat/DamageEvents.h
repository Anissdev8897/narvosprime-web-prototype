#pragma once
#include "core/Types.h"
#include <glm/vec3.hpp>
#include <array>

namespace nv
{
    enum class DamageKind : u8 { Hit, Crit, PlayerHurt, Heal };

    struct DamageEvent
    {
        glm::vec3 worldPos{0.0f};
        f32 amount = 0.0f;
        DamageKind kind = DamageKind::Hit;
    };

    class DamageEvents
    {
    public:
        static constexpr u32 kMaxQueue = 64;

        void MarkNextCrit() { m_NextCrit = true; }
        bool ConsumeNextCrit() { bool c = m_NextCrit; m_NextCrit = false; return c; }

        void Emit(const glm::vec3& pos, f32 amount, DamageKind kind)
        {
            m_Queue[m_WriteIdx % kMaxQueue] = {pos, amount, kind};
            m_WriteIdx++;
            if (m_WriteIdx - m_ReadIdx > kMaxQueue)
                m_ReadIdx = m_WriteIdx - kMaxQueue;
        }

        u32 Drain(DamageEvent* out, u32 maxCount)
        {
            u32 count = 0;
            while (m_ReadIdx < m_WriteIdx && count < maxCount)
            {
                out[count++] = m_Queue[m_ReadIdx % kMaxQueue];
                m_ReadIdx++;
            }
            return count;
        }

        void Clear() { m_ReadIdx = m_WriteIdx = 0; m_NextCrit = false; }
        u32 Pending() const { return (u32)(m_WriteIdx - m_ReadIdx); }

        void WritePending(float* outBuffer, u32* outCount, u32 maxEvents)
        {
            DamageEvent events[kMaxQueue];
            u32 count = Drain(events, std::min(maxEvents, kMaxQueue));
            *outCount = count;
            for (u32 i = 0; i < count; ++i)
            {
                u32 base = i * 5;
                outBuffer[base + 0] = events[i].worldPos.x;
                outBuffer[base + 1] = events[i].worldPos.y;
                outBuffer[base + 2] = events[i].worldPos.z;
                outBuffer[base + 3] = events[i].amount;
                outBuffer[base + 4] = (float)events[i].kind;
            }
        }

    private:
        std::array<DamageEvent, kMaxQueue> m_Queue{};
        u64 m_WriteIdx = 0;
        u64 m_ReadIdx = 0;
        bool m_NextCrit = false;
    };

    extern DamageEvents g_DamageEvents;
}
