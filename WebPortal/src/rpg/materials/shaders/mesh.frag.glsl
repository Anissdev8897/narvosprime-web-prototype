#version 450
layout(location = 0) in vec3 fragNormal;
layout(location = 1) in vec2 fragUV;
layout(location = 2) in vec4 fragColor;

layout(binding = 0) uniform sampler2D texSampler;

layout(location = 0) out vec4 outColor;

void main() {
    vec3 lightDir = normalize(vec3(0.433, 0.866, 0.259));
    vec3 N = normalize(fragNormal);
    float NdotL = max(dot(N, lightDir), 0.3); // boosted ambient
    
    vec4 texCol = texture(texSampler, fragUV);
    vec3 baseCol = texCol.rgb * fragColor.rgb;
    
    vec3 color = baseCol * NdotL;
    outColor = vec4(color, texCol.a * fragColor.a);
}
