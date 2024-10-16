#version 300 es
precision mediump float;

in vec3 aVertex;
in vec2 aTexCoord;

uniform mat4 mvp;

out vec2 vTexCoord;

void main(void) {
    gl_Position = mvp * vec4(aVertex, 1.0);
    // gl_Position = vec4(aVertex * 0.5 - 0.25, 0.25);
    vTexCoord = aTexCoord;
}
