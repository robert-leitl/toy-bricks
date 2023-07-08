uniform mat4 projectionMatrix;
uniform vec3 uAlbedo;
uniform uint uId;

in vec3 vNormal;
in vec2 vUv;

layout(location = 0) out vec4 outDiffuse_Id;
layout(location = 1) out float outDepth;
layout(location = 2) out vec4 outNormal_Specular;
layout(location = 3) out vec4 outAlbedo;

#include "normal-noise.glsl"
#include "utils.glsl"

float blendLighten(in float base, in float blend) {
    return max(blend, base);
}

vec3 blendLighten(in vec3 base, in vec3 blend) {
    return vec3(blendLighten(base.r, blend.r),
                blendLighten(base.g, blend.g),
                blendLighten(base.b, blend.b));
}

void main(void) {
  vec3 albedo = uAlbedo;
  vec3 diffuseColor = albedo;

  vec3 nNoise = normalNoise(vUv * 300., .1, 100.);

  GeometricContext geometry;
  geometry.position = - vViewPosition;
  geometry.normal = normalize(vNormal);
  geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

  IncidentLight directLight; 
  DirectionalLight directionalLight = directionalLights[ 0 ];
	DirectionalLightShadow directionalLightShadow = directionalLightShadows[ 0 ];
	getDirectionalLightInfo( directionalLight, geometry, directLight );
  vec3 N = geometry.normal;
  vec3 L = directLight.direction;
  vec3 V = geometry.viewDir;

  ReflectedLight reflectedLight;
  LambertMaterial material;
  material.diffuseColor = diffuseColor;
  material.specularStrength = 100.;
  RE_Direct_Lambert( directLight, geometry, material, reflectedLight );
  vec3 diffuse = reflectedLight.directDiffuse;

  // apply shadow
  vec3 shadowColor = vec3(0, 0, 0);
  float shadowPower = 1.1;
  float shadowMask = getShadowMask();
  diffuse = mix(diffuse, shadowColor, (1.0 - shadowMask) * shadowPower);

  diffuse = diffuse * 0.5 + albedo * 0.4; // add a little bit ambient

	float fresnel = 1. - saturate( dot( V, N ) );
  vec3 specularNormal = normalize(N + nNoise * .4);
  float specular = BRDF_BlinnPhong(L, V, specularNormal, vec3(1.), 5.).r;
  specular = specular * (shadowMask * 0.8 + 0.2);
  specular = specular * 0.7 + fresnel * 0.05;

  outDiffuse_Id = vec4(diffuse, uId);

  outDepth = getNormalizedZPerspective(gl_FragCoord.z, projectionMatrix);

  outNormal_Specular = vec4(N, specular);

  outAlbedo = vec4(albedo, 1.);
}
