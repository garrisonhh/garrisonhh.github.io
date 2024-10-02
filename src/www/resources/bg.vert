#version 300 es
precision mediump float;

in vec2 aTexCoord;

out vec2 vTexCoord;

void main(void) {
    gl_Position = vec4(aTexCoord * 2.0 - 1.0, 0.0, 1.0);
    vTexCoord = aTexCoord * vec2(1.0, -1.0);
}
