#version 300 es
precision highp float;

#define PI      3.1415926538
#define TAU     (2.0 * PI)

in vec3 aVertex;
in vec3 aColor;

// uniform float timestamp;
// uniform vec2 resolution;

uniform mat4 mvp;

out vec3 vColor;

void main(void) {
    vec3 vertex = (mvp * vec4(aVertex, 1.0)).xyz;
    float dist = distance(vec3(0.0), aVertex);
    gl_Position = vec4(vertex, dist);

    vColor = aColor;
}
