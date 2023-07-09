uniform mat4 projectionMatrix;

in vec3 vNormal;
in vec2 vUv;

layout(location = 0) out vec4 outDiffuse_Id;
layout(location = 1) out float outDepth;
layout(location = 2) out vec4 outNormal_Specular;
layout(location = 3) out vec4 outAlbedo;

#include "utils.glsl"

void main(void) {
  float mask = length(vUv * 2. - 1.);
  vec3 diffuseColor = vec3(mask * 0.4 + 0.6) * .15;

  GeometricContext geometry;
  geometry.position = - vViewPosition;
  geometry.normal = normalize(vNormal);
  geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

  IncidentLight directLight; 
  DirectionalLight directionalLight = directionalLights[ 0 ];
	DirectionalLightShadow directionalLightShadow = directionalLightShadows[ 0 ];
	getDirectionalLightInfo( directionalLight, geometry, directLight );
  vec3 N = geometry.normal;

  ReflectedLight reflectedLight;
  LambertMaterial material;
  material.diffuseColor = diffuseColor;
  material.specularStrength = 100.;
  RE_Direct_Lambert( directLight, geometry, material, reflectedLight );

  vec3 diffuse = reflectedLight.directDiffuse;

  // apply shadow
  vec3 shadowColor = vec3(0, 0, 0);
  float shadowPower = .4;
  float shadowMask = getShadowMask();
  diffuse = mix(diffuse, shadowColor, (1.0 - shadowMask) * shadowPower);

  outDiffuse_Id = vec4(diffuse, 0.);

  outDepth = getNormalizedZPerspective(gl_FragCoord.z, projectionMatrix);

  outNormal_Specular = vec4(N, 0.);

  outAlbedo = vec4(1.);

  #ifdef DITHERING
  outDiffuse_Id.rgb = dithering(outDiffuse_Id.rgb);
  #endif
}
