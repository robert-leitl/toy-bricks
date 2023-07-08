float map(float value, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (outMax - outMin) * (value - inMin) / (inMax - inMin);
}

float getLinearZPerspective(in float depth, in mat4 projectionMatrix) {
    float z_ndc = depth * 2.0 - 1.0;
    float A = projectionMatrix[2][2];
    float B = projectionMatrix[3][2];
    return B / (A + z_ndc);
}

float getNormalizedZPerspective(in float depth, in mat4 projectionMatrix) {
    float linearZ = getLinearZPerspective(depth, projectionMatrix);
    float near = projectionMatrix[3][2]/(projectionMatrix[2][2] - 1.);
    float far = projectionMatrix[3][2]/(projectionMatrix[2][2] + 1.);
    return map(linearZ, near, far, 0., 1.);
}

float getLinearZOrtho(in float depth, in mat4 projectionMatrix) {
    float near = (1. + projectionMatrix[3][2])/projectionMatrix[2][2];
    float far = -(1. - projectionMatrix[3][2])/projectionMatrix[2][2];
    return depth * (far - near) + near;
}

float getNormalizedZOrtho(in float depth) {
    return depth * 0.5 + 0.5;
}