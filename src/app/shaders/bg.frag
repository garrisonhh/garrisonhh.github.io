#version 300 es
precision mediump float;

#define PI 3.14159265

in vec2 vTexCoord;

uniform float uTime;

out vec4 fragColor;

void main(void) {
    vec2 c = (cos(vTexCoord + uTime * 1e-4 * PI) + 1.0) / 2.0;

    fragColor = vec4(c, 1.0, 1.0);
    fragColor.xyz *= 0.5;
    gl_FragDepth = 0.999;
}
