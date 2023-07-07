uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tSSS;
uniform vec2 resolution;
uniform vec3 uAlbedo;

in vec3 vNormal;
in vec2 vUv;

out vec4 outColor;

//	Simplex 3D Noise 
//	by Ian McEwan, Ashima Arts
//
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float simplexNoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0. + 0.0 * C 
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

// Permutations
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients
// ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

vec3 normalNoise(vec2 _st, float _zoom, float _speed){
	vec2 v1 = _st;
	vec2 v2 = _st;
	vec2 v3 = _st;
	float expon = pow(10.0, _zoom*2.0);
	v1 /= 1.0*expon;
	v2 /= 0.62*expon;
	v3 /= 0.83*expon;
	float n = _speed;
	float nr = (simplexNoise(vec3(v1, n)) + simplexNoise(vec3(v2, n)) + simplexNoise(vec3(v3, n))) / 6.0 + 0.5;
	n = _speed + 1000.0;
	float ng = (simplexNoise(vec3(v1, n)) + simplexNoise(vec3(v2, n)) + simplexNoise(vec3(v3, n))) / 6.0 + 0.5;
	return vec3(nr,ng,0.5);
}


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

vec3 rgb2hsv(in vec3 rgb)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(rgb.bg, K.wz), vec4(rgb.gb, K.xy), step(rgb.b, rgb.g));
    vec4 q = mix(vec4(p.xyw, rgb.r), vec4(rgb.r, p.yzx), step(p.x, rgb.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;

    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb( in vec3 hsv )
{
    vec3 rgb = clamp( abs(mod(hsv.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );

	return hsv.z * mix( vec3(1.0), rgb, hsv.y);
}

void main(void) {
  vec2 st = gl_FragCoord.xy / resolution;

  vec3 nn = normalNoise(vUv * 300., .1, 100.);

  vec4 diffuse = texture(tDiffuse, st);
  float depth = texture(tDepth, st).r;
  vec4 sss = texture(tSSS, st);

  vec3 albedo = rgb2hsv(uAlbedo);
  albedo.r -= .14;
  albedo.b = max(.8, albedo.b);
  albedo = hsv2rgb(albedo);
  sss.r = min(1., sss.r * albedo.r);
  sss.g = min(1., sss.g * albedo.g);
  sss.b = min(1., sss.b * albedo.b);
  
  vec3 color = blendLighten(diffuse.rgb, sss.rgb);

  GeometricContext geometry;
  geometry.position = - vViewPosition;
  geometry.normal = normalize(vNormal + nn * .4);
  geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

  IncidentLight directLight; 
  DirectionalLight directionalLight = directionalLights[ 0 ];
	DirectionalLightShadow directionalLightShadow = directionalLightShadows[ 0 ];
	getDirectionalLightInfo( directionalLight, geometry, directLight );
  vec3 N = geometry.normal;
  vec3 L = directLight.direction;
  vec3 V = geometry.viewDir;

  float shadowMask = getShadowMask() * 0.8 + 0.2;

  // fresnel term
	float fresnel = 1. - saturate( dot( V, N ) );
  //fresnel *= shadowMask;
  color = color * 0.9 + fresnel * 0.1;

  // specular
  vec3 specular = BRDF_BlinnPhong(L, V, N, vec3(1.), 5.);
  specular *= shadowMask;
  color += specular * 0.7;

  color = color * pow(2., .25);
  outColor.rgb = mix(color, vec3(dot(vec3(.3, .59, .11), color)), .3);
  outColor.a = 1.;

  //outColor.rgb = vec3(depth);
  //outColor.rgb = sss.rgb;
  //outColor.rgb = nn;
  //outColor.rgb = albedo;

  #ifdef DITHERING
  outColor.rgb = dithering(outColor.rgb);
  #endif
}
