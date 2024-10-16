#version 300 es
precision mediump float;

layout (location = 0) in vec2 aTexCoord;

out vec2 vTexCoord;

void main(void) {
    gl_Position = vec4(aTexCoord * 2.0 - 1.0, 0.0, 1.0);
    vTexCoord = vec2(aTexCoord.x, 1.0 - aTexCoord.y);
}
