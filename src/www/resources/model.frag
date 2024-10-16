#version 300 es
precision highp float;

in vec3 vNormal;

uniform vec3 color;

out vec4 fragColor;

void main(void) {
    fragColor = vec4(color, 1.0);
    fragColor = vec4((vNormal + 1.0) / 2.0, 1.0);
}
