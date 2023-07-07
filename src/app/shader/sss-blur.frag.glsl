uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 uDirection;
uniform vec2 resolution;

out vec4 outColor;

in vec2 vUv;

float gaussianPdf(in float x, in float sigma) {
    float k = .15915494; // 1 / (2 * PI)
    float pdf = (k / sigma) * exp(-(x * x) / (2. * sigma));
    return pow(pdf, 1.);
}

vec4 getKernelSample(
    in vec4 cDiffuse, 
    in float cDepth, 
    in vec3 cNormal, 
    in float weight,
    in vec2 uv,
    in float depthDeltaFactor,
    in float lumDeltaFactor
) {
    vec4 result = texture(tDiffuse, uv);
    float depth = texture(tDepth, uv).r;
    vec3 normal = texture(tNormal, uv).xyz;

    float n = distance(cNormal, normal); 
    float s = min(depthDeltaFactor * abs(cDepth - depth) * (1. + n), 1.0);
    float t = distance(result, cDiffuse) * weight * .7;
    result *= (lumDeltaFactor + t);
    result = mix(result, cDiffuse, s);

    return result;
}

void main() {
    int kernelSize = 3;
    vec2 texelSize = 1. / resolution;
    float fSigma = float(kernelSize);
    float weightSum = gaussianPdf(0.0, fSigma);

    vec4 cDiffuse = texture( tDiffuse, vUv);
    float cDepth = texture( tDepth, vUv).r;
    vec3 cNormal = texture(tNormal, vUv).xyz;
    float scale = 8.5;

    if (cDepth >= 0.999) {
        discard;
    }

    float depthDeltaFactor = 25.;
    float lumDeltaFactor = 1.25; 

    vec3 diffuseSum = cDiffuse.rgb * weightSum;
    for( int i = 1; i < kernelSize; i ++ ) {
        float x = float(i);
        float w = gaussianPdf(x, fSigma);
        vec2 uvOffset = uDirection * texelSize * x * scale;

        vec4 sample1 = getKernelSample(
            cDiffuse, 
            cDepth, 
            cNormal, 
            w,
            vUv + uvOffset,
            depthDeltaFactor,
            lumDeltaFactor
        );
        vec4 sample2 = getKernelSample(
            cDiffuse, 
            cDepth, 
            cNormal, 
            w,
            vUv - uvOffset,
            depthDeltaFactor,
            lumDeltaFactor
        );

        diffuseSum += (sample1.rgb + sample2.rgb) * w;
        weightSum += 2. * w;
    }
    outColor = vec4(diffuseSum/weightSum, 1.0);
}