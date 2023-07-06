uniform mat4 projectionMatrix;
uniform vec3 uAlbedo;

in vec3 vNormal;
in vec2 vUv;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outDepth;


float map(float value, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (outMax - outMin) * (value - inMin) / (inMax - inMin);
}

float getLinearZPerspective(in float depth, in mat4 projectionMatrix) {
    float z_ndc = depth * 2.0 - 1.0;
    float A = projectionMatrix[2][2];
    float B = projectionMatrix[3][2];
    return B / (A + z_ndc);
}

float getNormalizedZPerspective(in float depth, in mat4 projectionMatrix) {
    float linearZ = getLinearZPerspective(depth, projectionMatrix);
    float near = projectionMatrix[3][2]/(projectionMatrix[2][2] - 1.);
    float far = projectionMatrix[3][2]/(projectionMatrix[2][2] + 1.);
    return map(linearZ, near, far, 0., 1.);
}

float getLinearZOrtho(in float depth, in mat4 projectionMatrix) {
    float near = (1. + projectionMatrix[3][2])/projectionMatrix[2][2];
    float far = -(1. - projectionMatrix[3][2])/projectionMatrix[2][2];
    return depth * (far - near) + near;
}

float getNormalizedZOrtho(in float depth) {
    return depth * 0.5 + 0.5;
}

void main(void) {
  vec3 albedo = uAlbedo;

  GeometricContext geometry;
  geometry.position = - vViewPosition;
  geometry.normal = normalize(vNormal);
  geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

  // apply shadow
  vec3 shadowColor = vec3(0, 0, 0);
  float shadowPower = 1.1;
  float shadowMask = getShadowMask();
  vec3 color = mix(albedo, shadowColor, (1.0 - shadowMask) * shadowPower);

  IncidentLight directLight; 
  DirectionalLight directionalLight = directionalLights[ 0 ];
	DirectionalLightShadow directionalLightShadow = directionalLightShadows[ 0 ];
	getDirectionalLightInfo( directionalLight, geometry, directLight );
  vec3 N = geometry.normal;
  vec3 L = directLight.direction;
  vec3 V = geometry.viewDir;

  ReflectedLight reflectedLight;
  LambertMaterial material;
  material.diffuseColor = color;
  material.specularStrength = 100.;
  RE_Direct_Lambert( directLight, geometry, material, reflectedLight );
  color = reflectedLight.directDiffuse;
  color = color * 0.65 + albedo * 0.35;

  outColor.rgb = color;
  outColor.a = 1.;

  outDepth.r = getNormalizedZPerspective(gl_FragCoord.z, projectionMatrix);
  //outDepth.r = getNormalizedZOrtho(gl_FragCoord.z);

  #ifdef DITHERING
  outColor.rgb = dithering(outColor.rgb);
  #endif
}
