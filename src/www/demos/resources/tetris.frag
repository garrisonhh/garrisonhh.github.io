#version 300 es
precision highp float;

in vec3 vNormal;

uniform vec3 color;

out vec4 fragColor;

void main(void) {
    float facingScreen = -dot(vNormal, vec3(0.0, 0.0, 1.0));
    fragColor = vec4(facingScreen * color, 1.0);
}
