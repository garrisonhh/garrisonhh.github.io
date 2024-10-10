#version 300 es
precision mediump float;

in vec3 aVertex;

uniform mat4 mvp;

void main(void) {
    gl_Position = mvp * vec4(aVertex, 1.0);
    gl_PointSize = 10.0;
}
