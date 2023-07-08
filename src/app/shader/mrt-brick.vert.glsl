out vec3 vNormal;
out vec2 vUv;
out vec3 vViewPosition;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * viewPosition;
  
  vViewPosition = - viewPosition.xyz;

  vec3 transformedNormal = normalMatrix * normal;
  vNormal = normalize(normalMatrix * normal);
  #include <shadowmap_vertex>
}
