#version 100
precision highp float;

uniform mat4 modelMatrix;
attribute vec3 objectNormal;
attribute vec3 transformed;

varying vec3 vAutoWorldPos;
varying vec3 vAutoWorldNormal;

void main() {
  vAutoWorldPos    = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vAutoWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
  gl_Position = modelMatrix * vec4(transformed, 1.0);
}
