uniform sampler2D tDiffuse_Id;
uniform sampler2D tDepth;
uniform sampler2D tNormal_Specular;
uniform vec2 uDirection;
uniform vec2 resolution;
uniform float uFBOScale;

out vec4 outColor;

in vec2 vUv;

uint bgId = uint(0);

float gaussianPdf(in float x, in float sigma) {
    float k = .15915494; // 1 / (2 * PI)
    float pdf = (k / sigma) * exp(-(x * x) / (2. * sigma));
    return pow(pdf, 1.);
}

vec3 getKernelSample(
    in vec3 cDiffuse, 
    in float cDepth, 
    in vec3 cNormal, 
    in float cId,
    in float weight,
    in vec2 uv,
    in float depthDeltaFactor,
    in float lumDeltaFactor,
    in float normDeltaFactor
) {
    vec4 diffuseId = texture(tDiffuse_Id, uv);
    vec3 result = diffuseId.rgb;
    vec4 normSpecular = texture(tNormal_Specular, uv);
    vec3 normal = normSpecular.xyz;
    float id = diffuseId.w * 255.;
    float depth = texture(tDepth, uv).r;

    if (uint(id) != uint(cId)) return cDiffuse;

    float n = distance(cNormal, normal) * normDeltaFactor; 
    float s = min(depthDeltaFactor * abs(cDepth - depth) * (1. + n), 1.0);
    float t = distance(result, cDiffuse) * weight * .7;
    result *= (lumDeltaFactor + t);
    result = mix(result, cDiffuse, s);

    return result;
}

void main() {
    int kernelSize = 4;
    vec2 texelSize = 1. / resolution;
    float fSigma = float(kernelSize);
    float weightSum = gaussianPdf(0.0, fSigma);

    vec4 diffuseId = texture(tDiffuse_Id, vUv);
    vec3 cDiffuse = diffuseId.rgb;
    float cDepth = texture( tDepth, vUv).r;
    vec4 normSpecular = texture(tNormal_Specular, vUv);
    vec3 cNormal = normSpecular.xyz;
    float cId = diffuseId.w * 255.;
    float scale = 8.5 * uFBOScale;


    if (uint(cId) == bgId) {
        outColor = vec4(0.);
        return;
    }

    float depthDeltaFactor = 25.;
    float lumDeltaFactor = 1.25;
    float normDeltaFactor = 1.;

    vec3 diffuseSum = cDiffuse * weightSum;
    for( int i = 1; i < kernelSize; i ++ ) {
        float x = float(i);
        float w = gaussianPdf(x, fSigma);
        vec2 uvOffset = uDirection * texelSize * x * scale;

        vec3 sample1 = getKernelSample(
            cDiffuse, 
            cDepth, 
            cNormal, 
            cId,
            w,
            vUv + uvOffset,
            depthDeltaFactor,
            lumDeltaFactor,
            normDeltaFactor
        );
        vec3 sample2 = getKernelSample(
            cDiffuse, 
            cDepth, 
            cNormal, 
            cId,
            w,
            vUv - uvOffset,
            depthDeltaFactor,
            lumDeltaFactor,
            normDeltaFactor
        );

        diffuseSum += (sample1 + sample2) * w;
        weightSum += 2. * w;
    }
    outColor = vec4(diffuseSum/weightSum, diffuseId.w);
}