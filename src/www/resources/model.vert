#version 300 es
precision highp float;

layout (location = 0) in vec3 aVertex;
layout (location = 1) in vec3 aNormal;

uniform mat4 matNormal;
uniform mat4 mvp;

out vec3 vNormal;

void main(void) {
    gl_Position = mvp * vec4(aVertex, 1.0);
    vNormal = vec3(matNormal * vec4(aNormal, 0.0));
}
