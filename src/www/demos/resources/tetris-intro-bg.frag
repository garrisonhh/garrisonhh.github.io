#version 300 es
precision highp float;

#define PI      3.1415926538
#define TAU     (2.0 * PI)

in vec2 vTexCoord;

uniform float timestamp;
uniform vec2 resolution;

out vec4 fragColor;

float hashVec2(vec2 pos) {
    return fract(sin(dot(pos, vec2(12.9898, 78.233))) * 43758.5453);
}

float slerp(float a, float b, float x) {
    x = clamp(x, 0.0, 1.0);
    return a + (b - a) * ((1.0 - cos(x * PI)) / 2.0);
}

float noise(vec2 pos, vec2 kernelSize) {
    vec2 pixel = pos / kernelSize;
    vec2 pixelFloor = floor(pixel);

    float a = hashVec2(pixelFloor);
    float b = hashVec2(pixelFloor + vec2(1.0, 0.0));
    float c = hashVec2(pixelFloor + vec2(0.0, 1.0));
    float d = hashVec2(pixelFloor + vec2(1.0, 1.0));

    vec2 pixelFract = fract(pixel);
    float interpolated = slerp(
        slerp(a, b, pixelFract.x),
        slerp(c, d, pixelFract.x),
        pixelFract.y
    );

    return interpolated;
}

void main(void) {
    vec2 coordScale = 2.0 * vec2(resolution.x / resolution.y, resolution.y / resolution.x);
    vec2 centeredCoord = (vTexCoord - vec2(0.5)) * coordScale;

    float cylAngle = atan(centeredCoord.y, centeredCoord.x);
    float cylHor = abs(fract(cylAngle / PI) * 2.0 - 1.0);
    float cylDist = length(centeredCoord) / length(coordScale);

    vec2 cylSampleCoord = vec2(cylHor, log(cylDist) / 9.0);
    vec2 kernelSize = vec2(0.1);
    float t = timestamp * 2e-5;

    float spaceNoiseRatio = 4.0;
    float a = noise(cylSampleCoord + vec2(t, t * spaceNoiseRatio), kernelSize);
    float b = noise(cylSampleCoord + vec2(-t, t * spaceNoiseRatio), kernelSize);
    float spaceNoise = (a + b) / 2.0;

    float gradients = fract(spaceNoise * 5.0);
    float n = pow(2.0 * gradients - 1.0, 2.0);

    vec3 noiseColor = mix(
        vec3(0.0, 0.1, 0.6),
        vec3(0.0, 0.8, 0.3),
        n
    );
    vec3 fadedColor = mix(
        noiseColor,
        vec3(0.3),
        pow(1.0 - cylDist, 4.0)
    );

    fragColor = vec4(fadedColor, 1.0);
}
