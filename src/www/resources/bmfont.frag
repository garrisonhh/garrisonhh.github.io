#version 300 es
precision mediump float;

in vec2 vTexCoord;

uniform vec3 color;
uniform sampler2D fontPage;

out vec4 fragColor;

void main(void) {
    vec4 s = texture(fontPage, vTexCoord);
    fragColor = vec4(color, s.r);
}
