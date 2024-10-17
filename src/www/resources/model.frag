#version 300 es
precision highp float;

in vec3 vNormal;

uniform vec3 color;

out vec4 fragColor;

void main(void) {
    vec3 lightDir = vec3(0.0, 0.0, -1.0);
    float ambient = 0.3;

    float l = dot(vNormal, -lightDir);
    l = ambient + l * (1.0 - ambient);

    fragColor = vec4(color * l, 1.0);
}
