export function oklabFromLinearSrgb([r, g, b]) {
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
	const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
	const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    return [
        0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_,
        1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_,
        0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_,
    ];
}

export function linearSrgbFromOklab([l, a, b]) {
    const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

    const l2 = l_*l_*l_;
    const m = m_*m_*m_;
    const s = s_*s_*s_;

    return [
		+4.0767416621 * l2 - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l2 + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l2 - 0.7034186147 * m + 1.7076147010 * s,
    ];
}

export function linearSrgbFromRgb(rgb) {
    return rgb.map((x) => {
        if (x >= 0.04045)
            return Math.pow(((x + 0.055)/(1 + 0.055)), 2.4);
        else
            return x / 12.92;
    });
}

export function rgbFromLinearSrgb(linearSrgb) {
    return linearSrgb.map((x) => {
        if (x >= 0.0031308)
            return (1.055) * Math.pow(x, (1.0/2.4)) - 0.055;
        else
            return 12.92 * x;
    });
}

export function oklabFromRgb(rgb) {
    return oklabFromLinearSrgb(linearSrgbFromRgb(rgb));
}

export function rgbFromOklab(lab) {
    return rgbFromLinearSrgb(linearSrgbFromOklab(lab));
}
