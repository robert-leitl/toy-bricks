in vec3 vNormal;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormal;

void main(void) {
  vec3 albedo = vec3(0.15, 0.35, .9);
  vec3 ambient = vec3(0.1, 0.1, 0.08);

  GeometricContext geometry;
  geometry.position = - vViewPosition;
  geometry.normal = normalize(vNormal);
  geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

  // apply shadow
  vec3 shadowColor = vec3(0, 0, 0);
  float shadowPower = 1.2;
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

  #ifdef DITHERING
  outColor.rgb = dithering(outColor.rgb);
  #endif
}
