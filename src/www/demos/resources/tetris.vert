#version 300 es
precision highp float;

in vec3 aVertex;
in vec3 aNormal;
in vec3 aOffset;

uniform mat4 matNormal;
uniform mat4 mvp;

out vec3 vNormal;

void main(void) {
    gl_Position = mvp * vec4(aVertex + aOffset, 1.0);
    vNormal = vec3(matNormal * vec4(aNormal, 0.0));
}
