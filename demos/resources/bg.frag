#version 300 es
precision highp float;

#define PI      3.1415926538
#define TAU     (2.0 * PI)

in vec2 vTexCoord;

uniform highp float timestamp;
uniform vec2 resolution;

out vec4 fragColor;

/* oklab ==================================================================== */

// taken from https://www.shadertoy.com/view/WtccD7

vec3 srgb_from_linear_srgb(vec3 x) {
    vec3 xlo = 12.92*x;
    vec3 xhi = 1.055 * pow(x, vec3(0.4166666666666667)) - 0.055;
    return mix(xlo, xhi, step(vec3(0.0031308), x));
}

vec3 linear_srgb_from_srgb(vec3 x) {
    vec3 xlo = x / 12.92;
    vec3 xhi = pow((x + 0.055)/(1.055), vec3(2.4));

    return mix(xlo, xhi, step(vec3(0.04045), x));
}

const mat3 fwdA = mat3(
    1.0, 1.0, 1.0,
    0.3963377774, -0.1055613458, -0.0894841775,
    0.2158037573, -0.0638541728, -1.2914855480
);
const mat3 fwdB = mat3(
    4.0767245293, -1.2681437731, -0.0041119885,
    -3.3072168827, 2.6093323231, -0.7034763098,
    0.2307590544, -0.3411344290,  1.7068625689
);
const mat3 invB = mat3(
    0.4121656120, 0.2118591070, 0.0883097947,
    0.5362752080, 0.6807189584, 0.2818474174,
    0.0514575653, 0.1074065790, 0.6302613616
);
const mat3 invA = mat3(
    0.2104542553, 1.9779984951, 0.0259040371,
    0.7936177850, -2.4285922050, 0.7827717662,
    -0.0040720468, 0.4505937099, -0.8086757660
);

vec3 oklab_from_linear_srgb(vec3 c) {
    vec3 lms = invB * c;
    return invA * (sign(lms)*pow(abs(lms), vec3(0.3333333333333)));
}

vec3 linear_srgb_from_oklab(vec3 c) {
    vec3 lms = fwdA * c;
    return fwdB * (lms * lms * lms);
}

vec3 oklab_from_srgb(vec3 c) {
    return oklab_from_linear_srgb(linear_srgb_from_srgb(c));
}

vec3 srgb_from_oklab(vec3 c) {
    return srgb_from_linear_srgb(linear_srgb_from_oklab(c));
}

vec3 mix_srgb(vec3 a, vec3 b, float x) {
    vec3 a_lab = oklab_from_srgb(a);
    vec3 b_lab = oklab_from_srgb(b);
    vec3 mixed = mix(a_lab, b_lab, x);
    return srgb_from_oklab(mixed);
}

vec3 rotational_mix_srgb(vec3 a, vec3 b, float x) {
    vec3 a_lab = oklab_from_srgb(a);
    vec3 b_lab = oklab_from_srgb(b);

    float angleA = atan(a_lab.y, a_lab.z);
    float magA = distance(a_lab.yz, vec2(0.0));
    float angleB = atan(b_lab.y, b_lab.z);
    float magB = distance(b_lab.yz, vec2(0.0));

    float lightness = mix(a_lab.x, b_lab.x, x);
    float angle = mix(angleA, angleB, x);
    float mag = mix(magA, magB, x);

    vec3 mixed = vec3(
        lightness,
        cos(angle) * mag,
        sin(angle) * mag
    );

    return srgb_from_oklab(mixed);
}

/* noise ==================================================================== */

const highp uint MAX_UINT = 2147483647u;
const highp uint FNV_PRIME = 2166136261u;

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

float fluidNoise(vec2 pos, vec2 kernelSize, float t) {
    float tA = t;
    float tB = t + 1.0;
    float tC = t + 2.0;
    float tD = t + 3.0;

    float a = noise(pos + vec2(tA, tA), kernelSize);
    float b = noise(pos + vec2(tB, -tB), kernelSize);
    float c = noise(pos + vec2(-tC, tC), kernelSize);
    float d = noise(pos + vec2(-tD, -tD), kernelSize);
    float v = (a + b + c + d) / 4.0;
    return 1.0 - cos(v * PI);
}

/* ========================================================================== */

void main(void) {
    vec2 pos = vTexCoord * resolution;

    float kernelSizeFactor = min(resolution.x, resolution.y);
    vec2 flowKernel = vec2(kernelSizeFactor / 8.0);
    vec2 warpKernel = vec2(kernelSizeFactor / 12.0);

    float fluidValue = fluidNoise(pos, flowKernel, timestamp * 0.01);

    float offsetScalar = 80.0;
    float angle = fluidValue * TAU;
    vec2 offset = offsetScalar * vec2(cos(angle), sin(angle));
    float warped = noise(pos + offset, warpKernel);
    warped = clamp(warped, 0.0, 1.0);
    warped *= warped;

    vec3 colorA = vec3(0.07, 0.17, 0.23);
    vec3 colorB = vec3(0.16, 0.33, 0.94);
    vec3 colorC = vec3(0.78, 0.20, 0.54);

    vec3 color = mix_srgb(
        mix_srgb(colorA, colorB, warped),
        mix_srgb(colorB, colorC, warped),
        warped
    );

    fragColor = vec4(color, 1.0);
}
