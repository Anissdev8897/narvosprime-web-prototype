#pragma once
#include "core/Types.h"

namespace nv
{
    struct Weapon
    {
        f32 damage = 15.0f;
        f32 fireRate = 0.1f;
        i32 maxAmmo = 60;
        i32 currentAmmo = 60;
        f32 range = 10000.0f;
        f64 lastFireTime = -1000.0;
        bool isFiring = false;
        bool wantsToFire = false;
    };
}
