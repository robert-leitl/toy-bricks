out vec3 vNormal;
out vec3 vViewPosition;

void main() {
  vNormal = (modelMatrix * vec4(normal, 0.)).xyz;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * viewPosition;
  
  vViewPosition = - viewPosition.xyz;

  vec3 transformedNormal = vNormal;
  #include <shadowmap_vertex>
}
