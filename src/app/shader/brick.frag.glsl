in vec3 vNormal;

out vec4 outColor;


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
  vec3 N = vNormal;
  vec3 L = directLight.direction;
  vec3 V = geometry.viewDir;

  ReflectedLight reflectedLight;
  LambertMaterial material;
  material.diffuseColor = color;
  material.specularStrength = 100.;
  RE_Direct_Lambert( directLight, geometry, material, reflectedLight );
  color = reflectedLight.directDiffuse * .8 + 0.4 * albedo;

  // fresnel term
	float fresnel = 1. - saturate( dot( V, N ) );
  vec3 specular = BRDF_BlinnPhong(L, V, N, vec3(1.), 6.);
  color = color * 0.9 + fresnel * 0.1;
  color += specular * 0.4;

  outColor.rgb = color;
  outColor.a = 1.;

  #ifdef DITHERING
  outColor.rgb = dithering(outColor.rgb);
  #endif
}
