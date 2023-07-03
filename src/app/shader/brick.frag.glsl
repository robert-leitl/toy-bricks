uniform sampler2D tDiffuse;
uniform sampler2D tNormal;
uniform vec2 resolution;

in vec3 vNormal;

out vec4 outColor;

void main(void) {
  vec2 st = gl_FragCoord.xy / resolution;

  vec4 diffuse = texture(tDiffuse, st);
  vec4 normal = texture(tNormal, st);
  vec3 color = diffuse.rgb;

  GeometricContext geometry;
  geometry.position = - vViewPosition;
  geometry.normal = normalize(vNormal);
  geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

  IncidentLight directLight; 
  DirectionalLight directionalLight = directionalLights[ 0 ];
	DirectionalLightShadow directionalLightShadow = directionalLightShadows[ 0 ];
	getDirectionalLightInfo( directionalLight, geometry, directLight );
  vec3 N = normalize(normal.xyz);
  vec3 L = directLight.direction;
  vec3 V = geometry.viewDir;

  // fresnel term
	float fresnel = 1. - saturate( dot( V, N ) );
  color = color * 0.9 + fresnel * 0.1;

  // specular
  vec3 specular = BRDF_BlinnPhong(L, V, N, vec3(1.), 6.);
  color += specular * 0.4;

  outColor.rgb = color;
  outColor.a = 1.;

  //outColor.rgb = vec3(normal.a);

  #ifdef DITHERING
  outColor.rgb = dithering(outColor.rgb);
  #endif
}
