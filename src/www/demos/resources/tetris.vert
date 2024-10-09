#version 300 es
precision highp float;

in vec3 aVertex;
in vec3 aColor;

// uniform float timestamp;
// uniform vec2 resolution;

uniform mat4 mvp;

out vec3 vColor;

void main(void) {
    gl_Position = mvp * vec4(aVertex, 1.0);
    vColor = aColor;
}
