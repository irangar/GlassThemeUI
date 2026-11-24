export const opticsVertex = `#version 300 es
out vec2 uv;
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  uv = vec2(corner.x, 1.0 - corner.y);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

export const opticsFragment = `#version 300 es
precision highp float;

in vec2 uv;
out vec4 pixel;
uniform sampler2D backdrop;
uniform vec2 backdropSize, texelScale, lensOrigin, lensSize;
uniform vec4 geometry;    // shell, liquid depth, front convexity, rear curvature
uniform vec4 indices;     // air, glass, liquid, unused
uniform vec4 lighting;    // reflection strength, caustics, diffusion, roughness
uniform vec4 volume;      // transmission, absorption, dispersion, corner smoothing
uniform vec4 deformation; // tilt x/y, compression, optional wave phase
uniform float bevel, turbulence, opticalScale;
uniform int circleShape, quality, diagnostic, bounceLimit;

vec2 halfSize;
float exponent, shell, depth, frontSag, rearSag;

// Superellipse field and its analytic gradient in CSS pixel coordinates.
vec3 outline(vec2 p) {
  vec2 q = p / halfSize;
  vec2 powers = pow(abs(q), vec2(exponent));
  float radius = pow(max(powers.x + powers.y, 1e-12), 1.0 / exponent);
  vec2 gradient = sign(q) * pow(abs(q) / max(radius, 0.0001), vec2(exponent - 1.0)) / halfSize;
  return vec3(radius, gradient);
}

// Each boundary has a different sag and tangent. At the center the interface
// separations are exactly shell / liquid / shell, before optional deformation.
vec3 surface(vec2 p, int face) {
  vec3 field = outline(p);
  float t = min(field.x, 1.12);
  float root = sqrt(max(0.09, 1.0 - 0.72 * t * t));
  float curve = mix((1.0 - root) / 0.471, pow(t, 5.0), bevel * 0.47);
  float slope = mix(0.72 * t / (root * 0.471), 5.0 * pow(t, 4.0), bevel * 0.47);
  float base = -frontSag;
  float sag = frontSag;
  if (face == 1) {
    base += shell;
    sag -= shell * 0.13;
  } else if (face == 2) {
    base += shell + depth;
    sag = -rearSag + shell * 0.13;
  } else if (face == 3) {
    base += 2.0 * shell + depth;
    sag = -rearSag;
  }

  vec2 q = p / halfSize;
  float warpScale = face == 1 || face == 2 ? 1.0 : 0.48;
  float phase = dot(q, vec2(2.4, 1.8)) - deformation.w;
  float warp = dot(q, deformation.xy) + turbulence * sin(phase);
  vec2 gradWarp = (deformation.xy + turbulence * cos(phase) * vec2(2.4, 1.8)) / halfSize;
  vec2 gradient = sag * slope * field.yz * (1.0 - step(1.12, field.x));
  return vec3(base + sag * curve + warp * warpScale, gradient + gradWarp * warpScale);
}

vec3 normalOf(vec3 geometryAtHit) {
  return normalize(vec3(geometryAtHit.yz, -1.0));
}

// Solve ray.z = surface(ray.xy). Bound the Newton step near grazing incidence.
bool intersect(vec3 origin, vec3 direction, int face, out vec3 hit, out vec3 normal) {
  float vz = (direction.z < 0.0 ? -1.0 : 1.0) * max(abs(direction.z), 0.035);
  float reach = min(2.0 * min(halfSize.x, halfSize.y), 3.0 * (depth + shell * 2.0) + 8.0);
  float t = clamp((surface(origin.xy, face).x - origin.z) / vz, 0.0, reach);
  for (int i = 0; i < 4; ++i) {
    if (quality == 0 && i == 2) break;
    vec3 point = origin + direction * t;
    vec3 target = surface(point.xy, face);
    float derivative = direction.z - dot(target.yz, direction.xy);
    float inverse = derivative / max(derivative * derivative, 0.012);
    t = clamp(t - clamp((point.z - target.x) * inverse, -12.0, 12.0), 0.0, reach);
  }
  hit = origin + direction * t;
  vec3 target = surface(hit.xy, face);
  normal = normalOf(target);
  return abs(hit.z - target.x) < 0.65 && outline(hit.xy).x < 1.08 && t > 0.001;
}

float ior(int medium) {
  if (medium == 2) return indices.z;
  if (medium == 1 || medium == 3) return indices.y;
  return indices.x;
}

// Unpolarized dielectric Fresnel, with explicit handling of total internal reflection.
float splitRay(vec3 ray, vec3 normal, float from, float to, out vec3 transmitted) {
  transmitted = refract(ray, normal, from / to);
  if (dot(transmitted, transmitted) < 0.01) return 1.0;
  float a = max(-dot(ray, normal), 0.0001);
  float b = max(-dot(transmitted, normal), 0.0001);
  float s = (from * a - to * b) / (from * a + to * b);
  float p = (to * a - from * b) / (to * a + from * b);
  return 0.5 * (s * s + p * p);
}

vec2 screenPoint(vec3 p) {
  return lensOrigin + lensSize * 0.5 + p.xy / opticalScale;
}

vec2 project(vec3 point, vec3 ray, float distance, float limit) {
  vec2 offset = ray.xy * distance / max(abs(ray.z), 0.24);
  return screenPoint(point) + offset * (min(1.0, limit / max(length(offset), 0.001)) / opticalScale);
}

vec3 readScene(vec2 point, float lod) {
  return textureLod(backdrop, clamp(point / backdropSize, 0.0, 1.0), lod).rgb;
}

vec3 environment(vec3 origin, vec3 direction, float scatter) {
  // The available environment is the wider scene texture projected onto a
  // virtual plane. Preserve direction and soften grazing / rough reflections.
  float size = min(halfSize.x, halfSize.y);
  vec2 point = project(origin, direction, 18.0 + size * 0.94, 75.0 + size);
  float footprint = 1.15 + scatter + lighting.w * (16.0 + size * 0.3);
  return readScene(point, log2(max(1.0, footprint * max(texelScale.x, texelScale.y))));
}

struct Reflection {
  vec3 origin;
  vec3 direction;
  int medium;
  int stepDirection;
  float energy;
};

// Trace a reflected branch back across the stack. At an outer boundary the
// escaping portion samples the scene; the remainder can reflect again. At
// inner boundaries follow the dominant transmitted lobe unless TIR occurs.
vec3 traceReflection(Reflection branch) {
  vec3 radiance = vec3(0.0);
  int bounces = 1;
  for (int i = 0; i < 18; ++i) {
    if (branch.energy < 0.003 || bounces > bounceLimit) break;
    int face = branch.medium + min(0, branch.stepDirection);
    int next = branch.medium + branch.stepDirection;
    vec3 hit, normal;
    if (!intersect(branch.origin, branch.direction, face, hit, normal)) break;
    if (branch.stepDirection < 0) normal = -normal;
    if (dot(branch.direction, normal) >= 0.0) break;
    if (branch.medium == 2) branch.energy *= exp(-volume.y * length(hit - branch.origin));
    vec3 transmitted;
    float f = splitRay(branch.direction, normal, ior(branch.medium), ior(next), transmitted);
    bool tir = dot(transmitted, transmitted) < 0.01;
    bool escaping = next == 0 || next == 4;
    if (escaping && !tir) {
      radiance += branch.energy * (1.0 - f) * environment(hit, transmitted, float(bounces));
    } else if (!tir) {
      branch.energy *= 1.0 - f;
      branch.medium = next;
      branch.direction = transmitted;
      branch.origin = hit;
      continue;
    }
    branch.energy *= f * 0.86;
    branch.direction = reflect(branch.direction, normal);
    branch.stepDirection = -branch.stepDirection;
    branch.origin = hit;
    ++bounces;
  }
  return radiance;
}

vec3 encodeSRGB(vec3 color) {
  color = clamp(color, 0.0, 1.0);
  return mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, color));
}

void main() {
  // Keep the traced lens geometry at the calibrated size, then project it
  // back into the actual element bounds for the backdrop lookup.
  vec2 opticalSize = lensSize * opticalScale;
  halfSize = 0.5 * opticalSize;
  exponent = circleShape == 1 ? 2.0 : mix(2.15, 4.5, volume.w);
  vec2 p = (uv - 0.5) * opticalSize;
  vec3 silhouette = outline(p);
  float aa = max(0.0005, fwidth(silhouette.x) * 0.68);
  float coverage = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, silhouette.x);

  shell = geometry.x;
  depth = geometry.y * (1.0 - deformation.z * 0.08);
  float maxSag = min(min(halfSize.x, halfSize.y) * 0.45, depth * 0.75);
  frontSag = maxSag * geometry.z * 0.65;
  rearSag = maxSag * geometry.w * 0.58;

  vec3 normals[4];
  Reflection branches[3];
  vec3 origin = vec3(p, surface(p, 0).x);
  vec3 ray = vec3(0.0, 0.0, 1.0);
  vec3 frontReflection = vec3(0.0);
  float energy = 1.0;
  float liquidTravel = 0.0;
  float shellTravel = 0.0;

  for (int face = 0; face < 4; ++face) {
    vec3 hit = origin;
    vec3 normal = normalOf(surface(origin.xy, face));
    bool valid = true;
    if (face > 0) valid = intersect(origin, ray, face, hit, normal);
    normals[face] = normal;
    if (face > 0) branches[face - 1].energy = 0.0;
    if (!valid || energy <= 0.0 || dot(ray, normal) >= 0.0) {
      energy = 0.0;
      continue;
    }
    float travel = length(hit - origin);
    if (face == 2) {
      liquidTravel = travel;
      energy *= exp(-volume.y * travel);
    } else if (face > 0) {
      shellTravel += travel;
    }
    vec3 transmitted;
    float f = splitRay(ray, normal, ior(face), ior(face + 1), transmitted);
    vec3 reflected = reflect(ray, normal);
    bool tir = dot(transmitted, transmitted) < 0.01;
    float reflectedFraction = tir || face == 0 ? f : f * lighting.x;
    if (face == 0) {
      frontReflection = f * environment(hit, reflected, 0.0);
    } else {
      branches[face - 1] = Reflection(hit, reflected, face, -1, energy * reflectedFraction);
    }
    energy *= 1.0 - reflectedFraction;
    origin = hit;
    if (!tir) ray = transmitted;
  }

  vec2 center = lensOrigin + uv * lensSize;
  float projectionDepth = 10.0 + min(halfSize.x, halfSize.y) * 0.83;
  vec2 through = project(origin, ray, projectionDepth, 0.68 * min(halfSize.x, halfSize.y) + 18.0);
  // Fade unresolved/critical rays into a continuous field before taking derivatives.
  float resolved = smoothstep(0.015, 0.20, energy);
  through = mix(center, through, resolved);
  vec2 dx = dFdx(through);
  vec2 dy = dFdy(through);
  float area = abs(dx.x * dy.y - dx.y * dy.x) / max(lensSize.x * lensSize.y * abs(dFdx(uv.x) * dFdy(uv.y)), 0.0001);
  float concentration = -clamp(log2(max(0.25, area)), -1.4, 1.4) / 1.4;
  // The derivatives above are intentionally evaluated before edge discard.
  if (coverage <= 0.0) discard;

  float pathRatio = liquidTravel / max(depth, 1.0);
  float diffusion = lighting.z * clamp(pathRatio * (0.24 + 0.32 * silhouette.x), 0.0, 1.3);
  diffusion += lighting.w * (shellTravel * 0.20 + liquidTravel * 0.10);
  float footprint = max(length(dx * texelScale), length(dy * texelScale));
  float blur = diffusion * max(texelScale.x, texelScale.y);
  float lod = 0.5 * log2(max(1.0, footprint * footprint + blur * blur));
  vec3 transmitted = readScene(through, lod);
  if (quality == 1 && volume.z > 0.0) {
    vec2 spread = ray.xy * volume.z * resolved;
    transmitted.r = readScene(through + spread, lod).r;
    transmitted.b = readScene(through - spread, lod).b;
  }
  float scatter = clamp(0.018 * pathRatio, 0.0, 0.055);
  if (quality == 1) transmitted = mix(transmitted, readScene(through, lod + 1.25), scatter);
  float gain = concentration * lighting.y * resolved;
  // Bounded contrast redistribution. Black and white remain bounded and
  // reflection/transmission weights are split before applying this term.
  transmitted += gain * transmitted * (1.0 - transmitted);

  vec3 internal = vec3(0.0);
  if (bounceLimit > 0) {
    if (quality == 1) {
      for (int i = 0; i < 3; ++i) internal += traceReflection(branches[i]);
    } else {
      int strongest = 0;
      for (int i = 1; i < 3; ++i) {
        if (branches[i].energy > branches[strongest].energy) strongest = i;
      }
      internal = traceReflection(branches[strongest]);
    }
  }
  vec3 color = energy * volume.x * transmitted + frontReflection + internal;
  if (diagnostic >= 1 && diagnostic <= 4) {
    vec3 normal = normals[diagnostic - 1];
    color = vec3(0.5 + normal.xy * 0.5, -normal.z);
  } else if (diagnostic == 5) {
    color = vec3(0.5 + ray.xy * 0.5, max(0.0, ray.z)) * resolved;
  } else if (diagnostic == 6) {
    color = internal * 4.0;
  } else if (diagnostic == 7) {
    color = mix(vec3(0.12, 0.18, 0.25), vec3(1.0, 0.61, 0.19), max(0.0, concentration)) * resolved;
    color *= 1.0 + min(0.0, concentration) * 0.85;
  } else if (diagnostic == 8) {
    color = vec3(1.0 - exp(-volume.y * liquidTravel));
  }
  pixel = vec4(encodeSRGB(color), coverage);
}`;
