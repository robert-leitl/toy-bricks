uniform sampler2D tDiffuse;
uniform sampler2D tNormal;
uniform sampler2D tSSS;
uniform vec2 resolution;

in vec3 vNormal;

out vec4 outColor;

float blendLighten(in float base, in float blend) {
    return max(blend, base);
}

vec3 blendLighten(in vec3 base, in vec3 blend) {
    return vec3(blendLighten(base.r, blend.r),
                blendLighten(base.g, blend.g),
                blendLighten(base.b, blend.b));
}

float brightnessContrast( float value, float brightness, float contrast ) {
    return ( value - 0.5 ) * contrast + 0.5 + brightness;
}

vec3 brightnessContrast( vec3 color, float brightness, float contrast ) {
    return ( color - 0.5 ) * contrast + 0.5 + brightness;
}

vec4 brightnessContrast( vec4 color, float brightness, float contrast ) {
    return vec4(brightnessContrast(color.rgb, brightness, contrast), color.a);
}

void main(void) {
  vec2 st = gl_FragCoord.xy / resolution;

  vec4 diffuse = texture(tDiffuse, st);
  vec4 normal = texture(tNormal, st);
  vec4 sss = texture(tSSS, st);

  sss.r = min(1., sss.r * 1.0);
  sss.g = min(1., sss.g * 1.3);
  sss.b = min(1., sss.b * .7);
  
  vec3 color = blendLighten(diffuse.rgb, sss.rgb * 1.2);

  GeometricContext geometry;
  geometry.position = - vViewPosition;
  geometry.normal = normalize(vNormal);
  geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

  IncidentLight directLight; 
  DirectionalLight directionalLight = directionalLights[ 0 ];
	DirectionalLightShadow directionalLightShadow = directionalLightShadows[ 0 ];
	getDirectionalLightInfo( directionalLight, geometry, directLight );
  vec3 N = normalize(vNormal.xyz);
  vec3 L = directLight.direction;
  vec3 V = geometry.viewDir;

  float shadowMask = getShadowMask() * 0.8 + 0.2;

  // fresnel term
	float fresnel = 1. - saturate( dot( V, N ) );
  fresnel *= shadowMask;
  color = color * 0.9 + fresnel * 0.1;

  // specular
  vec3 specular = BRDF_BlinnPhong(L, V, N, vec3(1.), 10.);
  specular *= shadowMask;
  color += specular * 0.2;

  outColor.rgb = mix(color, vec3(1.), smoothstep(0.5, 1., normal.a));
  outColor.a = 1.;

  #ifdef DITHERING
  outColor.rgb = dithering(outColor.rgb);
  #endif
}
