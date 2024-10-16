#version 300 es
precision mediump float;

in vec2 vTexCoord;

out vec4 fragColor;

void main(void) {
    fragColor = vec4(vTexCoord.xy, 0.0, 1.0);
    gl_FragDepth = 0.999;
}
