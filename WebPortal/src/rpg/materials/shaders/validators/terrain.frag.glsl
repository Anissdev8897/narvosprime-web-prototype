#version 100
precision highp float;

varying vec3 vAutoWorldPos;
varying vec3 vAutoWorldNormal;

varying vec3 faceDirection;
varying vec3 normal;

uniform mat4 viewMatrix;

uniform sampler2D uFlatMap;
uniform sampler2D uFlatNrm;
uniform sampler2D uMidMap;
uniform sampler2D uMidNrm;
uniform sampler2D uSteepMap;
uniform sampler2D uSteepNrm;
uniform sampler2D uVariation;
uniform vec4 uTileSizes;
uniform vec4 uBlend;
uniform float uHasMid;

vec3 triWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  return w / max(w.x + w.y + w.z, 1e-5);
}

vec4 triSample(sampler2D tex, vec3 wp, vec3 w, float tile) {
  float s = 1.0 / max(tile, 1e-3);
  vec4 x = texture2D(tex, wp.zy * s);
  vec4 y = texture2D(tex, wp.xz * s);
  vec4 z = texture2D(tex, wp.xy * s);
  return x * w.x + y * w.y + z * w.z;
}

vec3 triNormal(sampler2D tex, vec3 wp, vec3 w, float tile, vec3 geoN) {
  float s = 1.0 / max(tile, 1e-3);
  vec3 nx = texture2D(tex, wp.zy * s).xyz * 2.0 - 1.0;
  vec3 ny = texture2D(tex, wp.xz * s).xyz * 2.0 - 1.0;
  vec3 nz = texture2D(tex, wp.xy * s).xyz * 2.0 - 1.0;
  nx = vec3(nx.xy + geoN.zy, abs(nx.z) * geoN.x);
  ny = vec3(ny.xy + geoN.xz, abs(ny.z) * geoN.y);
  nz = vec3(nz.xy + geoN.xy, abs(nz.z) * geoN.z);
  return normalize(nx.zyx * w.x + ny.xzy * w.y + nz.xyz * w.z);
}

void main() {
  vec3 autoN   = normalize(vAutoWorldNormal);
  vec3 autoW   = triWeights(autoN);
  vec3 autoPos = vAutoWorldPos;

  float autoSlope = 1.0 - min(1.0, abs(autoN.y));

  float autoVar = texture2D(uVariation, autoPos.xz / max(uTileSizes.w, 1e-3)).r;
  autoSlope += (autoVar - 0.5) * uBlend.z;

  float autoT = smoothstep(uBlend.x, uBlend.y, autoSlope);

  vec4 cFlat  = triSample(uFlatMap,  autoPos, autoW, uTileSizes.x);
  vec4 cSteep = triSample(uSteepMap, autoPos, autoW, uTileSizes.z);

  float wMid  = uHasMid > 0.5 ? 4.0 * autoT * (1.0 - autoT) : 0.0;
  float rest  = 1.0 - wMid;
  vec4 cMid   = uHasMid > 0.5 ? triSample(uMidMap, autoPos, autoW, uTileSizes.y) : vec4(0.0);

  vec4 autoCol = cFlat * (rest * (1.0 - autoT)) + cMid * wMid + cSteep * (rest * autoT);

  gl_FragColor = autoCol;
}
