#version 100
uniform mat4 modelMatrix;
attribute vec3 position;
varying vec3 vNormal;
void main() {
  gl_Position = modelMatrix * vec4(position, 1.0);
  vNormal = vec3(0.0);
}
