out vec3 vNormal;
out vec3 vTangent;
out vec2 vUv;
out vec3 vViewPosition;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * viewPosition;
  
  vViewPosition = - viewPosition.xyz;

  vec3 transformedNormal = normalMatrix * normal;
  vNormal = normalize(transformedNormal);
  vTangent = normalize(normalMatrix * tangent.xyz);
  #include <shadowmap_vertex>
}
