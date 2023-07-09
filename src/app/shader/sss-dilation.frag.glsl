uniform sampler2D tDiffuse_Id;
uniform vec2 uDirection;
uniform vec2 resolution;

out vec4 outDiffuse_Id;

in vec2 vUv;

void main() {
    vec2 texelSize = 1. / resolution;
    vec4 cDiffuseId = texture(tDiffuse_Id, vUv);
    float scale = 3.;
    int kernelSize = 2;
    float weight = 1. / float(kernelSize + 1);


    float cLum = dot(cDiffuseId.rgb, cDiffuseId.rgb);
    vec3 result = cDiffuseId.rgb;
    for( int i = 1; i < kernelSize; i ++ ) {
        float x = float(i);
        vec2 uvOffset = uDirection * texelSize * x * scale;
        vec4 diffuseId = texture(tDiffuse_Id, vUv + uvOffset);
        float lum = dot(diffuseId.rgb, diffuseId.rgb);

        if (lum > cLum) {
            result = diffuseId.rgb;
            cLum = lum;
        }
        
        diffuseId = texture(tDiffuse_Id, vUv - uvOffset);

        if (lum > cLum) {
            result = diffuseId.rgb;
            cLum = lum;
        }
    }

    outDiffuse_Id = vec4(result, 1.);
}