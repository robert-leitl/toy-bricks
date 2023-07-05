uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uDirection;
uniform vec2 resolution;

out vec4 outColor;

in vec2 vUv;

float gaussianPdf(in float x, in float sigma) {
    float k = .15915494; // 1 / (2 * PI)
    float pdf = (k / sigma) * exp(-(x * x) / (2. * sigma));
    return pow(pdf, 1.);
}

void main() {
    int kernelSize = 6;
    vec2 texelSize = 1. / resolution;
    float fSigma = float(kernelSize);
    float weightSum = gaussianPdf(0.0, fSigma);

    vec4 diffuse = texture( tDiffuse, vUv);
    vec3 colorM = diffuse.rgb;
    float depthM = texture( tDepth, vUv).r;
    float scale = 3.5;

    if (depthM >= 0.999) {
        discard;
    }

    float depthDeltaFactor = 25.;
    float lumDeltaFactor = 1.25; 

    vec3 diffuseSum = diffuse.rgb * weightSum;
    for( int i = 1; i < kernelSize; i ++ ) {
        float x = float(i);
        float w = gaussianPdf(x, fSigma);
        vec2 uvOffset = uDirection * texelSize * x * scale;

        vec4 sample1 = texture( tDiffuse, vUv + uvOffset);
        float depth1 = texture( tDepth, vUv + uvOffset).r;
        float s1 = min(depthDeltaFactor * abs(depthM - depth1), 1.0);
        float t1 = distance(sample1, diffuse) * w;
        sample1 *= (lumDeltaFactor + t1);
        sample1 = mix(sample1, diffuse, s1);

        vec4 sample2 = texture( tDiffuse, vUv - uvOffset);
        float depth2 = texture( tDepth, vUv - uvOffset).r;
        float s2 = min(depthDeltaFactor * abs(depthM - depth2), 1.0);
        float t2 = distance(sample1, diffuse) * w;
        sample2 *= (lumDeltaFactor + t2);
        sample2 = mix(sample2, diffuse, s2);

        diffuseSum += (sample1.rgb + sample2.rgb) * w;
        weightSum += 2. * w;
    }
    outColor = vec4(diffuseSum/weightSum, 1.0);
}