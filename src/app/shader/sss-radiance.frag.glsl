uniform mat4 projectionMatrix;

in vec3 vNormal;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormal;

float map(float value, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (outMax - outMin) * (value - inMin) / (inMax - inMin);
}

void main(void) {
  vec3 albedo = vec3(0.15, 0.35, .9);
  vec3 ambient = vec3(0.1, 0.1, 0.08);

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
  vec3 N = normalize(vNormal);
  vec3 L = directLight.direction;
  vec3 V = geometry.viewDir;

  ReflectedLight reflectedLight;
  LambertMaterial material;
  material.diffuseColor = color;
  material.specularStrength = 100.;
  RE_Direct_Lambert( directLight, geometry, material, reflectedLight );
  color = reflectedLight.directDiffuse * .8 + 0.4 * albedo;

  outColor.rgb = color;
  outColor.a = 1.;

  outNormal = vec4(N, 0.0);

  float z_ndc = gl_FragCoord.z * 2.0 - 1.0;
  float A = projectionMatrix[2][2];
  float B = projectionMatrix[3][2];
  float z_eye = B / (A + z_ndc);
  float near = projectionMatrix[3][2]/(projectionMatrix[2][2]-1.);
  float far = projectionMatrix[3][2]/(projectionMatrix[2][2]+1.);
  outNormal.a = map(z_eye, near, far, 0., 1.);
  outColor.a = outNormal.a;

  #ifdef DITHERING
  outColor.rgb = dithering(outColor.rgb);
  #endif
}
