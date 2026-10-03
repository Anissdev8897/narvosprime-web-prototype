#include "math/MathWasm.h"
#include <glm/gtx/quaternion.hpp>
#include <glm/gtx/matrix_decompose.hpp>
#include <glm/gtc/matrix_inverse.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <cmath>
#include <algorithm>

namespace nv
{
    // ══════════════════════════════════════════════════════════════════
    //  Scalar math
    // ══════════════════════════════════════════════════════════════════

    f32 Approach(f32 current, f32 target, f32 maxDelta)
    {
        const f32 d = target - current;
        if (std::abs(d) <= maxDelta) return target;
        return current + (d > 0.0f ? maxDelta : -maxDelta);
    }

    f32 Lerp(f32 a, f32 b, f32 t)
    {
        return a + (b - a) * t;
    }

    f32 LerpClamped(f32 a, f32 b, f32 t)
    {
        if (t <= 0.0f) return a;
        if (t >= 1.0f) return b;
        return a + (b - a) * t;
    }

    f32 InverseLerp(f32 a, f32 b, f32 v)
    {
        const f32 d = b - a;
        if (std::abs(d) < 1e-10f) return 0.0f;
        return (v - a) / d;
    }

    f32 SmoothStep(f32 edge0, f32 edge1, f32 x)
    {
        const f32 t = LerpClamped(0.0f, 1.0f, (x - edge0) / (edge1 - edge0));
        return t * t * (3.0f - 2.0f * t);
    }

    // ══════════════════════════════════════════════════════════════════
    //  Vec3 operations (buffer-based)
    // ══════════════════════════════════════════════════════════════════

    static glm::vec3 ReadVec3(const float* buffer, u32 byteOff)
    {
        return glm::vec3(buffer[byteOff / 4], buffer[byteOff / 4 + 1], buffer[byteOff / 4 + 2]);
    }

    static void WriteVec3(float* buffer, u32 byteOff, const glm::vec3& v)
    {
        buffer[byteOff / 4 + 0] = v.x;
        buffer[byteOff / 4 + 1] = v.y;
        buffer[byteOff / 4 + 2] = v.z;
    }

    static glm::quat ReadQuat(const float* buffer, u32 byteOff)
    {
        return glm::quat(buffer[byteOff / 4 + 3], // w
                         buffer[byteOff / 4 + 0], // x
                         buffer[byteOff / 4 + 1], // y
                         buffer[byteOff / 4 + 2]);// z
    }

    static void WriteQuat(float* buffer, u32 byteOff, const glm::quat& q)
    {
        buffer[byteOff / 4 + 0] = q.x;
        buffer[byteOff / 4 + 1] = q.y;
        buffer[byteOff / 4 + 2] = q.z;
        buffer[byteOff / 4 + 3] = q.w;
    }

    void Vec3Normalize(float* buffer, u32 offset)
    {
        glm::vec3 v = ReadVec3(buffer, offset);
        const f32 lenSq = glm::length2(v);
        if (lenSq > 1e-10f)
            v /= std::sqrt(lenSq);
        WriteVec3(buffer, offset, v);
    }

    void Vec3Add(const float* buffer, u32 aOff, u32 bOff, float* dst)
    {
        glm::vec3 a = ReadVec3(buffer, aOff);
        glm::vec3 b = ReadVec3(buffer, bOff);
        WriteVec3(dst, 0, a + b);
    }

    void Vec3Sub(const float* buffer, u32 aOff, u32 bOff, float* dst)
    {
        glm::vec3 a = ReadVec3(buffer, aOff);
        glm::vec3 b = ReadVec3(buffer, bOff);
        WriteVec3(dst, 0, a - b);
    }

    void Vec3Mul(const float* buffer, u32 aOff, u32 bOff, float* dst)
    {
        glm::vec3 a = ReadVec3(buffer, aOff);
        glm::vec3 b = ReadVec3(buffer, bOff);
        WriteVec3(dst, 0, a * b);
    }

    void Vec3Scale(const float* buffer, u32 vOff, f32 s, float* dst)
    {
        glm::vec3 v = ReadVec3(buffer, vOff);
        WriteVec3(dst, 0, v * s);
    }

    f32 Vec3Dot(const float* buffer, u32 aOff, u32 bOff)
    {
        return glm::dot(ReadVec3(buffer, aOff), ReadVec3(buffer, bOff));
    }

    void Vec3Cross(const float* buffer, u32 aOff, u32 bOff, float* dst)
    {
        WriteVec3(dst, 0, glm::cross(ReadVec3(buffer, aOff), ReadVec3(buffer, bOff)));
    }

    f32 Vec3Length(const float* buffer, u32 offset)
    {
        return glm::length(ReadVec3(buffer, offset));
    }

    f32 Vec3Distance(const float* buffer, u32 aOff, u32 bOff)
    {
        return glm::distance(ReadVec3(buffer, aOff), ReadVec3(buffer, bOff));
    }

    f32 Vec3LengthSq(const float* buffer, u32 offset)
    {
        return glm::length2(ReadVec3(buffer, offset));
    }

    void Vec3Lerp(const float* buffer, u32 aOff, u32 bOff, f32 t, float* dst)
    {
        glm::vec3 a = ReadVec3(buffer, aOff);
        glm::vec3 b = ReadVec3(buffer, bOff);
        WriteVec3(dst, 0, glm::mix(a, b, t));
    }

    // ══════════════════════════════════════════════════════════════════
    //  Quaternion ops (buffer-based)
    // ══════════════════════════════════════════════════════════════════

    void QuatNormalize(float* buffer, u32 offset)
    {
        glm::quat q = ReadQuat(buffer, offset);
        const f32 lenSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
        if (lenSq > 1e-10f)
        {
            const f32 invLen = 1.0f / std::sqrt(lenSq);
            q.x *= invLen; q.y *= invLen; q.z *= invLen; q.w *= invLen;
        }
        WriteQuat(buffer, offset, q);
    }

    void QuatSlerp(const float* buffer, u32 aOff, u32 bOff, f32 t, float* dst)
    {
        glm::quat a = ReadQuat(buffer, aOff);
        glm::quat b = ReadQuat(buffer, bOff);
        WriteQuat(dst, 0, glm::slerp(a, b, t));
    }

    void QuatMul(const float* buffer, u32 aOff, u32 bOff, float* dst)
    {
        glm::quat a = ReadQuat(buffer, aOff);
        glm::quat b = ReadQuat(buffer, bOff);
        WriteQuat(dst, 0, a * b);
    }

    void QuatConjugate(float* buffer, u32 offset)
    {
        glm::quat q = ReadQuat(buffer, offset);
        WriteQuat(buffer, offset, glm::conjugate(q));
    }

    f32 QuatLength(const float* buffer, u32 offset)
    {
        return glm::length(ReadQuat(buffer, offset));
    }

    void EulerToQuatDeg(f32 pitchDeg, f32 yawDeg, f32 rollDeg, float* dst)
    {
        // Convert degrees to radians
        const f32 pitch = glm::radians(pitchDeg);
        const f32 yaw   = glm::radians(yawDeg);
        const f32 roll  = glm::radians(rollDeg);

        glm::quat q = glm::quat(glm::vec3(pitch, yaw, roll));
        WriteQuat(dst, 0, q);
    }

    void QuatToEulerDeg(const float* buffer, u32 offset, float* dst)
    {
        glm::quat q = ReadQuat(buffer, offset);
        glm::vec3 euler = glm::eulerAngles(q);
        dst[0] = glm::degrees(euler.x);
        dst[1] = glm::degrees(euler.y);
        dst[2] = glm::degrees(euler.z);
    }

    void QuatFromTwoVectors(const float* buffer, u32 fromOff, u32 toOff, float* dst)
    {
        glm::vec3 from = ReadVec3(buffer, fromOff);
        glm::vec3 to   = ReadVec3(buffer, toOff);
        WriteQuat(dst, 0, glm::quat(glm::normalize(from), glm::normalize(to)));
    }

    // ══════════════════════════════════════════════════════════════════
    //  4×4 matrix operations
    // ══════════════════════════════════════════════════════════════════

    void Mat4Mul(const float* buffer, u32 aOff, u32 bOff, float* dst)
    {
        const float* a = buffer + aOff / 4;
        const float* b = buffer + bOff / 4;
        glm::mat4 ma = glm::make_mat4(a);
        glm::mat4 mb = glm::make_mat4(b);
        glm::mat4 mc = ma * mb;
        std::memcpy(dst, glm::value_ptr(mc), 16 * sizeof(float));
    }

    void Mat4Transpose(float* buffer, u32 offset)
    {
        glm::mat4 m = glm::make_mat4(buffer + offset / 4);
        m = glm::transpose(m);
        std::memcpy(buffer + offset / 4, glm::value_ptr(m), 16 * sizeof(float));
    }

    bool Mat4Inverse(float* buffer, u32 offset)
    {
        glm::mat4 m = glm::make_mat4(buffer + offset / 4);
        glm::mat4 inv;
        f32 det = glm::determinant(m);
        if (std::abs(det) < 1e-12f)
            return false;
        inv = glm::inverse(m);
        std::memcpy(buffer + offset / 4, glm::value_ptr(inv), 16 * sizeof(float));
        return true;
    }

    // ══════════════════════════════════════════════════════════════════
    //  Batch operations
    // ══════════════════════════════════════════════════════════════════

    void BatchVec3Normalize(float* buffer, u32 byteOffset, u32 count)
    {
        for (u32 i = 0; i < count; ++i)
        {
            Vec3Normalize(buffer, byteOffset + i * 12);
        }
    }

    void CalcBlendWeights(f32 speed, f32 directionDeg, float* dst)
    {
        // 8-directional blend weight calculation
        // cardinal directions: forward, forwardRight, right, backRight,
        //                     back, backLeft, left, forwardLeft
        // directionDeg: 0 = forward, 90 = right, etc.
        // speed: 0 = idle, 1 = walk, 2 = run

        const f32 dirRad = glm::radians(directionDeg);
        const f32 cosDir = std::cos(dirRad);
        const f32 sinDir = std::sin(dirRad);

        // Strength of movement in each cardinal direction
        // We use a 2-cardinal blend: find the two nearest axes and blend
        // Weight = max(0, dot(dir, cardinal)) ^ 2 for smooth transition

        constexpr f32 CARD_ANGLES[8] = {
            0.0f,           // forward      (+Z)
            45.0f,          // forwardRight
            90.0f,          // right         (+X)
            135.0f,         // backRight
            180.0f,         // back          (-Z)
            225.0f,         // backLeft
            270.0f,         // left          (-X)
            315.0f          // forwardLeft
        };

        f32 totalWeight = 0.0f;
        for (u32 i = 0; i < 8; ++i)
        {
            const f32 cardRad = glm::radians(CARD_ANGLES[i]);
            // Cosine of angle between movement direction and cardinal axis
            f32 dot = std::cos(dirRad - cardRad);
            f32 w = dot > 0.0f ? dot * dot : 0.0f; // squared cosine for sharper blend
            // Boost with speed: at speed=0, all weights equal (idle)
            w *= (speed > 0.01f) ? 1.0f : 0.125f;
            dst[i] = w;
            totalWeight += w;
        }

        // Normalize
        if (totalWeight > 1e-10f)
        {
            const f32 invTotal = 1.0f / totalWeight;
            for (u32 i = 0; i < 8; ++i)
                dst[i] *= invTotal;
        }
        else
        {
            // Fallback: full weight on forward
            dst[0] = 1.0f;
            for (u32 i = 1; i < 8; ++i)
                dst[i] = 0.0f;
        }
    }
}
