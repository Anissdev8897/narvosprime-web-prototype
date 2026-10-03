#include "physics/Vehicle.h"

namespace nv
{
    glm::mat4 Vehicle::GetTransform() const
    {
        return glm::translate(glm::mat4(1.0f), position) * glm::mat4_cast(rotation);
    }
    glm::vec3 Vehicle::GetForward() const { return rotation * glm::vec3(0,0,1); }
    glm::vec3 Vehicle::GetRight() const { return rotation * glm::vec3(1,0,0); }
    glm::vec3 Vehicle::GetUp() const { return rotation * glm::vec3(0,1,0); }

    void VehicleSystem::InitDefaultWarthog(Vehicle& v)
    {
        v.mass = 1800.0f;
        v.inertia = {2500.0f, 3500.0f, 2500.0f};
        v.maxEngineTorque = 800.0f;
        v.maxBrakeTorque = 2000.0f;
        v.centerOfMass = {0.0f, -0.4f, 0.0f};
        v.wheels.clear();
        Wheel fl; fl.localPos = {-0.9f,-0.3f,1.4f}; fl.steering = true; fl.radius = 0.45f;
        v.wheels.push_back(fl);
        Wheel fr = fl; fr.localPos.x = 0.9f; v.wheels.push_back(fr);
        Wheel rl; rl.localPos = {-0.9f,-0.3f,-1.4f}; rl.powered = true; rl.radius = 0.45f;
        v.wheels.push_back(rl);
        Wheel rr = rl; rr.localPos.x = 0.9f; v.wheels.push_back(rr);
    }

    void VehicleSystem::ApplyInput(Vehicle& v, f32 throttle, f32 brake, f32 steer, bool handbrake)
    {
        v.throttle = glm::clamp(throttle, 0.0f, 1.0f);
        v.brake = glm::clamp(brake, 0.0f, 1.0f);
        v.steer = glm::clamp(steer, -1.0f, 1.0f);
        v.handbrake = handbrake;
    }

    glm::vec3 VehicleSystem::GetPointVelocity(const Vehicle& v, const glm::vec3& point)
    {
        glm::vec3 r = point - (v.position + v.rotation * v.centerOfMass);
        return v.linearVel + glm::cross(v.angularVel, r);
    }

    void VehicleSystem::UpdateSuspension(Vehicle& v, Wheel& w, f32 dt)
    {
        NV_UNUSED(dt);
        glm::mat4 trans = v.GetTransform();
        glm::vec3 wheelWorldPos = glm::vec3(trans * glm::vec4(w.localPos, 1.0f));
        glm::vec3 rayDir = -v.GetUp();
        f32 rayLen = w.suspensionRestLength + w.radius;
        f32 t = (0.0f - wheelWorldPos.y) / rayDir.y;
        w.inContact = t > 0.0f && t < rayLen;
        if (w.inContact)
        {
            w.contactPoint = wheelWorldPos + rayDir * t;
            w.contactNormal = glm::vec3(0,1,0);
            w.suspensionLength = glm::clamp(t - w.radius, 0.0f, w.suspensionRestLength);
        }
        else
        {
            w.suspensionLength = w.suspensionRestLength;
            w.contactNormal = glm::vec3(0,1,0);
        }
        w.worldPos = wheelWorldPos - v.GetUp() * w.suspensionLength;
    }

    void VehicleSystem::UpdateWheel(Vehicle& v, Wheel& w, f32 dt)
    {
        if (!w.inContact) { w.angularVel *= 0.98f; return; }
        f32 compression = w.suspensionRestLength - w.suspensionLength;
        f32 suspensionForce = compression * w.suspensionStiffness;
        glm::vec3 velAtWheel = GetPointVelocity(v, w.worldPos);
        f32 velAlongNormal = glm::dot(velAtWheel, w.contactNormal);
        suspensionForce -= velAlongNormal * w.suspensionDamping;
        suspensionForce = glm::max(0.0f, suspensionForce);
        glm::vec3 forward = v.GetForward();
        glm::vec3 right = v.GetRight();
        if (w.steering)
        {
            f32 steerAngle = v.steer * v.maxSteerAngle;
            glm::mat4 steerRot = glm::rotate(glm::mat4(1.0f), steerAngle, v.GetUp());
            forward = glm::vec3(steerRot * glm::vec4(forward, 0.0f));
            right = glm::vec3(steerRot * glm::vec4(right, 0.0f));
        }
        f32 velForward = glm::dot(velAtWheel, forward);
        f32 maxFriction = suspensionForce * w.friction;
        f32 forwardForce = 0.0f;
        if (w.powered) forwardForce = v.throttle * v.maxEngineTorque / w.radius;
        if (v.brake > 0.0f || v.handbrake) forwardForce -= glm::sign(velForward) * v.brake * v.maxBrakeTorque / w.radius;
        forwardForce = glm::clamp(forwardForce, -maxFriction, maxFriction);
        f32 velRight = glm::dot(velAtWheel, right);
        f32 rightForce = -velRight * maxFriction * 2.0f;
        rightForce = glm::clamp(rightForce, -maxFriction, maxFriction);
        glm::vec3 force = forward * forwardForce + right * rightForce + w.contactNormal * suspensionForce;
        glm::vec3 r = w.worldPos - (v.position + v.rotation * v.centerOfMass);
        v.linearVel += force / v.mass * dt;
        glm::mat3 R = glm::mat3_cast(v.rotation);
        glm::mat3 I_local(0.0f);
        I_local[0][0] = v.inertia.x; I_local[1][1] = v.inertia.y; I_local[2][2] = v.inertia.z;
        glm::mat3 I_world = R * I_local * glm::transpose(R);
        v.angularVel += glm::inverse(I_world) * glm::cross(r, force) * dt;
    }

    void VehicleSystem::Update(Vehicle& v, f32 dt)
    {
        for (auto& w : v.wheels) UpdateSuspension(v, w, dt);
        for (auto& w : v.wheels) UpdateWheel(v, w, dt);
        v.linearVel.y -= 9.81f * dt;
        v.position += v.linearVel * dt;
        glm::quat angVelQuat(0, v.angularVel.x * dt, v.angularVel.y * dt, v.angularVel.z * dt);
        v.rotation = glm::normalize(v.rotation + 0.5f * angVelQuat * v.rotation);
        v.linearVel *= 0.999f;
        v.angularVel *= 0.99f;
        if (v.position.y < 0.5f) { v.position.y = 0.5f; if (v.linearVel.y < 0) v.linearVel.y = 0; }
    }
}
