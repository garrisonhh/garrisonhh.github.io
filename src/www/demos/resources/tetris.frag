#version 300 es
precision highp float;

#define PI      3.1415926538
#define TAU     (2.0 * PI)

in vec3 vColor;

out vec4 fragColor;

void main(void) {
    fragColor = vec4(vColor, 1.0);
}
