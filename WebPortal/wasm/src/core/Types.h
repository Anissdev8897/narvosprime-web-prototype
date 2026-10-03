#pragma once
#include <cstdint>
#include <cstddef>

// World space: Y-up, right-handed.
// Transform yaw convention: yaw = atan2(dir.x, dir.z)
//   yaw 0 -> +Z,  yaw pi/2 -> +X  (GLTF characters face +Z)

#define NV_UNUSED(x) (void)(x)

using u8 = uint8_t;
using u16 = uint16_t;
using u32 = uint32_t;
using u64 = uint64_t;
using i8 = int8_t;
using i16 = int16_t;
using i32 = int32_t;
using i64 = int64_t;
using f32 = float;
using f64 = double;
using Entity = u32;
constexpr Entity INVALID_ENTITY = 0xFFFFFFFF;
