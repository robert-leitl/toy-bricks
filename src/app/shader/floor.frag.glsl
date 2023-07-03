in vec3 vNormal;
in vec2 vUv;

out vec4 outColor;


void main(void) {
  vec3 color = vec3(length(vUv * 2. - 1.) * 0.3 + 0.7);

  GeometricContext geometry;
  geometry.position = - vViewPosition;
  geometry.normal = normalize(vNormal);
  geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

  IncidentLight directLight; 
  DirectionalLight directionalLight = directionalLights[ 0 ];
	DirectionalLightShadow directionalLightShadow = directionalLightShadows[ 0 ];
	getDirectionalLightInfo( directionalLight, geometry, directLight );

  ReflectedLight reflectedLight;
  LambertMaterial material;
  material.diffuseColor = color;
  material.specularStrength = 100.;
  RE_Direct_Lambert( directLight, geometry, material, reflectedLight );

  color = reflectedLight.directDiffuse;

  // apply shadow
  vec3 shadowColor = vec3(0, 0, 0);
  float shadowPower = .3;
  float shadowMask = getShadowMask();
  color = mix(color, shadowColor, (1.0 - shadowMask) * shadowPower);

  outColor.rgb = color;
  outColor.a = 1.;

  #ifdef DITHERING
  outColor.rgb = dithering(outColor.rgb);
  #endif
}
