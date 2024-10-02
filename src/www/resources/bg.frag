#version 300 es
precision mediump float;

#define PI      3.1415926538
#define TAU     (2.0 * PI)

in vec2 vTexCoord;

uniform sampler2D background;
uniform float timestamp;
uniform vec2 resolution;

out vec4 fragColor;

/* noise ==================================================================== */

uint pcgHash(uint x) {
    uint state = x * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

uint pcgHashVec2(vec2 pos) {
    uint a = pcgHash(floatBitsToUint(pos.x));
    uint b = pcgHash(floatBitsToUint(pos.y));
    return a * b;
}

// returns noisy value in range [0, 1)
float rawNoise(vec2 v) {
    return fract(uintBitsToFloat(pcgHashVec2(v)));
}

float valueNoiseLayer(vec2 pos, vec2 kernelSize) {
    vec2 pixel = pos / kernelSize;
    vec2 pixelFloor = floor(pixel);

    float a = rawNoise(pixelFloor);
    float b = rawNoise(pixelFloor + vec2(1.0, 0.0));
    float c = rawNoise(pixelFloor + vec2(0.0, 1.0));
    float d = rawNoise(pixelFloor + vec2(1.0, 1.0));

    vec2 pixelFract = fract(pixel);
    float interpolated = smoothstep(
        smoothstep(a, b, pixelFract.x),
        smoothstep(c, d, pixelFract.x),
        pixelFract.y
    );

    return interpolated;
}

/* ========================================================================== */

void main(void) {
    vec2 kernelSize = vec2(40.0, 40.0 * resolution.x / resolution.y);
    float v = valueNoiseLayer(vTexCoord * resolution, kernelSize);
    fragColor = vec4(vec3(v), 1.0);
}
