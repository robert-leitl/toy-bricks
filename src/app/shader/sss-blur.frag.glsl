uniform sampler2D tDiffuse;
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

void main() {
    int kernelSize = 16;
    vec2 texelSize = 1. / resolution;
    float fSigma = float(kernelSize);
    float weightSum = gaussianPdf(0.0, fSigma);

    vec4 normal = texture( tNormal, vUv);
    vec4 diffuse = texture( tDiffuse, vUv);
    vec3 colorM = diffuse.rgb;
    float depthM = normal.a;
    float scale = 4.;

    // normal.a = linear depth between 0 and 1
    if (normal.a >= 0.999) {
        discard;
    }

    float f = 25.;

    vec3 diffuseSum = diffuse.rgb * weightSum;
    for( int i = 1; i < kernelSize; i ++ ) {
        float x = float(i);
        float w = gaussianPdf(x, fSigma);
        vec2 uvOffset = uDirection * texelSize * x * scale;

        vec4 sample1 = texture( tDiffuse, vUv + uvOffset);
        float depth1 = texture( tNormal, vUv + uvOffset).a;
        float s1 = min(f * abs(depthM - depth1), 1.0);
        sample1 = mix(sample1, diffuse, s1);

        vec4 sample2 = texture( tDiffuse, vUv - uvOffset);
        float depth2 = texture( tNormal, vUv - uvOffset).a;
        float s2 = min(f * abs(depthM - depth2), 1.0);
        sample2 = mix(sample2, diffuse, s2);

        diffuseSum += (sample1.rgb + sample2.rgb) * w;
        weightSum += 2. * w;
    }
    outColor = vec4(diffuseSum/weightSum, 1.0);
}