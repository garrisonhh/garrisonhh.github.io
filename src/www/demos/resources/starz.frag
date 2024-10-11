#version 300 es
precision mediump float;

out vec4 fragColor;

void main(void) {
    float c = 1.0 - min(1.0, length(gl_PointCoord.xy * 2.0 - 1.0));
    fragColor = vec4(vec3(1.0), c);
}
