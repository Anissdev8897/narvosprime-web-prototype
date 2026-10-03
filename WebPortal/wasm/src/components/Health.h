#pragma once
#include "core/Types.h"

namespace nv
{
    struct Health
    {
        f32 maxHealth = 75.0f;
        f32 maxShield = 100.0f;
        f32 currentHealth = 75.0f;
        f32 currentShield = 100.0f;
        f32 shieldRechargeDelay = 4.0f;
        f32 shieldRechargeRate = 25.0f;
        f64 lastDamageTime = 0.0;
        bool isDead = false;
    };
}
