#version 450
layout(push_constant) uniform PushConstants {
    mat4 mvp;
    vec4 baseColor;
} pc;

layout(set = 1, binding = 0) uniform Skeleton {
    mat4 bones[128];
} skel;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;
layout(location = 2) in vec2 inUV;
layout(location = 3) in vec4 inJointIndices;
layout(location = 4) in vec4 inJointWeights;

layout(location = 0) out vec3 fragNormal;
layout(location = 1) out vec2 fragUV;
layout(location = 2) out vec4 fragColor;

void main() {
    mat4 skin = 
        skel.bones[int(inJointIndices.x)] * inJointWeights.x +
        skel.bones[int(inJointIndices.y)] * inJointWeights.y +
        skel.bones[int(inJointIndices.z)] * inJointWeights.z +
        skel.bones[int(inJointIndices.w)] * inJointWeights.w;

    if (inJointWeights.x + inJointWeights.y + inJointWeights.z + inJointWeights.w < 0.01) {
        skin = mat4(1.0);
    }

    gl_Position = pc.mvp * skin * vec4(inPosition, 1.0);
    fragNormal = (skin * vec4(inNormal, 0.0)).xyz;
    fragUV = inUV;
    fragColor = pc.baseColor;
}

