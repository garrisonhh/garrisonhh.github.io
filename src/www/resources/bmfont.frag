#version 300 es
precision mediump float;

in vec2 vTexCoord;

uniform sampler2D page;

out vec4 fragColor;

void main(void) {
    vec4 s = texture(page, vTexCoord);
    fragColor = vec4(vec3(1.0), s.g);
}
