uniform sampler2D tDiffuse_Id;
uniform sampler2D tAlbedo;
uniform sampler2D tNormal_Specular;
uniform sampler2D tSSS;

out vec4 outColor;

in vec2 vUv;

float blendLighten(in float base, in float blend) {
    return max(blend, base);
}

vec3 blendLighten(in vec3 base, in vec3 blend) {
    return vec3(blendLighten(base.r, blend.r),
                blendLighten(base.g, blend.g),
                blendLighten(base.b, blend.b));
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

void main() {
    vec4 diffuseId = texture(tDiffuse_Id, vUv);
    vec4 normalSpecular = texture(tNormal_Specular, vUv);
    vec3 albedo = texture(tAlbedo, vUv).rgb;
    vec3 diffuse = diffuseId.rgb;
    float specular = normalSpecular.w;
    vec4 sss = texture(tSSS, vUv);

    albedo = rgb2hsv(albedo);
    albedo.r -= .14;
    albedo.b = max(.8, albedo.b);
    albedo = hsv2rgb(albedo);
    sss.r = min(1., sss.r * albedo.r);
    sss.g = min(1., sss.g * albedo.g);
    sss.b = min(1., sss.b * albedo.b);

    vec3 color = blendLighten(diffuse, sss.rgb);
    color = color + specular;

    // color correction
    color = color * pow(2., .2);
    color = mix(color, vec3(dot(vec3(.3, .59, .11), color)), .3);

    outColor = vec4(color, 1.);
    //outColor = texture(tSSS, vUv);
    //outColor = sss;
    //outColor = vec4(diffuse, 1.);

    #ifdef DITHERING
    outColor.rgb = dithering(outColor.rgb);
    #endif
}