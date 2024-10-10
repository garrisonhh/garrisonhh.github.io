#version 300 es
precision highp float;

in vec3 vNormal;

uniform vec3 color;

out vec4 fragColor;

const vec3 lightPos = vec3(0.0, 10.0, -5.0);
const float ambientLightLevel = 0.3;

void main(void) {
    // compute simple point lighting
    vec3 lightDir = normalize(gl_FragCoord.xyz - lightPos);
    float directionalLightLevel = (-dot(vNormal, lightDir) + 1.0) / 2.0;
    float lightLevel =
        ambientLightLevel +
        directionalLightLevel * (1.0 - ambientLightLevel);

    fragColor = vec4(lightLevel * color, 1.0);
}
