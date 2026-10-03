#pragma once
#include "core/Types.h"
#include "core/Math.h"
#include <vector>

namespace nv
{
    struct Wheel
    {
        glm::vec3 localPos{0.0f};
        f32 radius = 0.4f;
        f32 suspensionRestLength = 0.5f;
        f32 suspensionStiffness = 30.0f;
        f32 suspensionDamping = 4.5f;
        f32 friction = 3.0f;
        bool powered = false;
        bool steering = false;

        glm::vec3 worldPos{0.0f};
        glm::vec3 contactPoint{0.0f};
        glm::vec3 contactNormal{0.0f, 1.0f, 0.0f};
        f32 suspensionLength = 0.5f;
        f32 angularVel = 0.0f;
        bool inContact = false;
    };

    struct Vehicle
    {
        glm::vec3 position{0.0f};
        glm::quat rotation{1,0,0,0};
        glm::vec3 linearVel{0.0f};
        glm::vec3 angularVel{0.0f};

        f32 mass = 1500.0f;
        glm::vec3 inertia{2000.0f, 3000.0f, 2000.0f};
        f32 maxEngineTorque = 600.0f;
        f32 maxBrakeTorque = 1500.0f;
        f32 maxSteerAngle = 0.6f;

        f32 throttle = 0.0f;
        f32 brake = 0.0f;
        f32 steer = 0.0f;
        bool handbrake = false;

        std::vector<Wheel> wheels;
        glm::vec3 centerOfMass{0.0f, -0.3f, 0.0f};

        glm::mat4 GetTransform() const;
        glm::vec3 GetForward() const;
        glm::vec3 GetRight() const;
        glm::vec3 GetUp() const;
    };

    class VehicleSystem
    {
    public:
        static void InitDefaultWarthog(Vehicle& v);
        static void Update(Vehicle& v, f32 dt);
        static void ApplyInput(Vehicle& v, f32 throttle, f32 brake, f32 steer, bool handbrake);
    private:
        static void UpdateSuspension(Vehicle& v, Wheel& w, f32 dt);
        static void UpdateWheel(Vehicle& v, Wheel& w, f32 dt);
        static glm::vec3 GetPointVelocity(const Vehicle& v, const glm::vec3& point);
    };
}
