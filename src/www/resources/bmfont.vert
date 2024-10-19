#version 300 es
precision mediump float;

layout (location = 0) in vec2 aVertex;
layout (location = 1) in vec2 aTexCoord;

uniform mat4 mvp;

out vec2 vTexCoord;

void main(void) {
    gl_Position = mvp * vec4(aVertex, 0.0, 1.0);
    vTexCoord = aTexCoord;
}
