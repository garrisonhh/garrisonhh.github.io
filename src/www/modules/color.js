/**
 * OkLab color functionality
 *
 * @typedef {{ r: number, g: number, b: number }} Rgb
 * @typedef {{ l: number, a: number, b: number }} Lab
 */

/**
 * convert srgb to oklab
 *
 * @param {Rgb} rgb
 * @returns {Lab}
 */
export function rgbToLab(rgb) {
    let l = 0.4122214708 * rgb.r + 0.5363325363 * rgb.g + 0.0514459929 * rgb.b;
	let m = 0.2119034982 * rgb.r + 0.6806995451 * rgb.g + 0.1073969566 * rgb.b;
	let s = 0.0883024619 * rgb.r + 0.2817188376 * rgb.g + 0.6299787005 * rgb.b;

    let l_ = Math.cbrt(l);
    let m_ = Math.cbrt(m);
    let s_ = Math.cbrt(s);

    return {
        l: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    };
}

/**
 * convert oklab to srgb
 *
 * @param {Lab} lab
 * @returns {Rgb}
 */
export function labToRgb(lab) {
    let l_ = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
    let m_ = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
    let s_ = lab.l - 0.0894841775 * lab.a - 1.2914855480 * lab.b;

    let l = l_ * l_ * l_;
    let m = m_ * m_ * m_;
    let s = s_ * s_ * s_;

    return {
		r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    };
}

/**
 * lerp lab colors, range [0, 1] representing the space from color0 to color1
 *
 * @param {number} x
 * @param {Lab} color0
 * @param {Lab} color1
 * @returns {Lab}
 */
export function labLerp(x, color0, color1) {
    const lerp = (x, a, b) => a + x * (b - a);
    return {
        l: lerp(x, color0.l, color1.l),
        a: lerp(x, color0.a, color1.a),
        b: lerp(x, color0.b, color1.b),
    };
}
