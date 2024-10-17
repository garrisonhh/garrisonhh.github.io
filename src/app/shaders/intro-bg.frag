#version 300 es
precision highp float;

#define PI      3.1415926538
#define TAU     (2.0 * PI)

in vec2 vTexCoord;

uniform float uTime;
uniform vec2 uResolution;

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

/* noise ==================================================================== */

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

/* ========================================================================== */

void main(void) {
    float angleA = uTime * 1e-4 * PI;
    float angleB = angleA + PI / 2.0;
    vec3 colorA = 0.5 * vec3(2.0, cos(angleA), sin(angleA));
    vec3 colorB = 0.5 * vec3(2.0, cos(angleB), sin(angleB));

    vec2 coordScale = vec2(
        max(1.0, uResolution.x / uResolution.y),
        max(1.0, uResolution.y / uResolution.x)
    );
    vec2 centeredCoord = (vTexCoord - vec2(0.5)) * coordScale;

    float cylAngle = atan(centeredCoord.y, centeredCoord.x);
    float cylHor = abs(fract(cylAngle / PI) * 2.0 - 1.0);
    float cylDist = length(centeredCoord) / length(coordScale);

    vec2 cylSampleCoord = vec2(cylHor, log(cylDist) / 9.0);
    vec2 kernelSize = vec2(0.1);
    float t = uTime * 2e-5;

    float spaceNoiseRatio = 4.0;
    float a = noise(cylSampleCoord + vec2(t, t * spaceNoiseRatio), kernelSize);
    float b = noise(cylSampleCoord + vec2(-t, t * spaceNoiseRatio), kernelSize);
    float spaceNoise = (a + b) / 2.0;

    float gradients = fract(spaceNoise * 5.0);
    float n = pow(2.0 * gradients - 1.0, 2.0);

    vec3 noiseColor = mix(colorA, colorB, n);
    noiseColor.x = 0.5 * pow(1.0 - cylDist, 4.0); // fade out
    vec3 finalColor = srgb_from_oklab(noiseColor);

    fragColor = vec4(finalColor, 1.0);
}
