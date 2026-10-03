#pragma once
#include "core/Types.h"
#include <glm/vec3.hpp>
#include <glm/gtc/quaternion.hpp>

namespace nv
{
    // ── Scalar math ─────────────────────────────────────────────────
    /** Rapproche `current` vers `target` d'au plus `maxDelta`. */
    f32 Approach(f32 current, f32 target, f32 maxDelta);

    /** Interpolation linéaire entre a et b (t dans [0,1]). */
    f32 Lerp(f32 a, f32 b, f32 t);

    /** Interpolation linéaire avec clamp de t dans [0,1]. */
    f32 LerpClamped(f32 a, f32 b, f32 t);

    /** Inverse lerp : factor t for value v between a and b. */
    f32 InverseLerp(f32 a, f32 b, f32 v);

    /** Smoothstep (Hermite). */
    f32 SmoothStep(f32 edge0, f32 edge1, f32 x);

    // ── Vec3 operations (buffer-based, HeapF32 compatible) ──────────
    /** Normalize vec3 in-place in buffer at byte offset. */
    void Vec3Normalize(float* buffer, u32 offset);

    /** Vec3 add: dst = a + b (each read from buffer at offsets). */
    void Vec3Add(const float* buffer, u32 aOff, u32 bOff, float* dst);

    /** Vec3 sub: dst = a - b. */
    void Vec3Sub(const float* buffer, u32 aOff, u32 bOff, float* dst);

    /** Vec3 mul (component-wise): dst = a * b. */
    void Vec3Mul(const float* buffer, u32 aOff, u32 bOff, float* dst);

    /** Vec3 scale: dst = v * s. */
    void Vec3Scale(const float* buffer, u32 vOff, f32 s, float* dst);

    /** Vec3 dot product. */
    f32 Vec3Dot(const float* buffer, u32 aOff, u32 bOff);

    /** Vec3 cross product: dst = a × b. */
    void Vec3Cross(const float* buffer, u32 aOff, u32 bOff, float* dst);

    /** Vec3 length (magnitude). */
    f32 Vec3Length(const float* buffer, u32 offset);

    /** Vec3 distance between a and b. */
    f32 Vec3Distance(const float* buffer, u32 aOff, u32 bOff);

    /** Vec3 length squared. */
    f32 Vec3LengthSq(const float* buffer, u32 offset);

    /** Vec3 lerp: dst = lerp(a, b, t). */
    void Vec3Lerp(const float* buffer, u32 aOff, u32 bOff, f32 t, float* dst);

    // ── Quaternion ops (buffer-based) ──────────────────────────────
    /** Quaternion normalize (in-place in buffer at byte offset). */
    void QuatNormalize(float* buffer, u32 offset);

    /** Quaternion slerp: dst = slerp(a, b, t). */
    void QuatSlerp(const float* buffer, u32 aOff, u32 bOff, f32 t, float* dst);

    /** Quaternion multiply: dst = a * b. */
    void QuatMul(const float* buffer, u32 aOff, u32 bOff, float* dst);

    /** Quaternion conjugate (in-place). */
    void QuatConjugate(float* buffer, u32 offset);

    /** Quaternion length. */
    f32 QuatLength(const float* buffer, u32 offset);

    /** Convert euler angles (degrees) to quaternion. */
    void EulerToQuatDeg(f32 pitchDeg, f32 yawDeg, f32 rollDeg, float* dst);

    /** Convert quaternion to euler angles (degrees) written to buffer. */
    void QuatToEulerDeg(const float* buffer, u32 offset, float* dst);

    /** Quaternion from two vectors: rotates from → to. */
    void QuatFromTwoVectors(const float* buffer, u32 fromOff, u32 toOff, float* dst);

    // ── 4×4 matrix operations ─────────────────────────────────────
    /** 4×4 matrix multiply: dst = a * b (16 floats each, column-major). */
    void Mat4Mul(const float* buffer, u32 aOff, u32 bOff, float* dst);
    /** 4×4 matrix transpose (in-place). */
    void Mat4Transpose(float* buffer, u32 offset);
    /** 4×4 matrix inverse (in-place). Returns true if invertible. */
    bool Mat4Inverse(float* buffer, u32 offset);

    // ── Batch operations (bulk array processing) ──────────────────
    /** Normalize N vec3s in a flat array [x0,y0,z0, x1,y1,z1, ...]. stride=3 floats. */
    void BatchVec3Normalize(float* buffer, u32 byteOffset, u32 count);

    /** Blend weight calculation for N blend entries.
     *  Input: (speed, direction) → 8 cardinal blend weights.
     *  Writes 8 f32 weights to dst byte offset. */
    void CalcBlendWeights(f32 speed, f32 directionDeg, float* dst);
}
