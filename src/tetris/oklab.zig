const std = @import("std");
const rt = @import("runtime");
const Vec3 = rt.Vec3;
const Mat3 = rt.Matrix(3, 3);

const fwd_a = Mat3.init(.{
    .{ 1.0, 1.0, 1.0 },
    .{ 0.3963377774, -0.1055613458, -0.0894841775 },
    .{ 0.2158037573, -0.0638541728, -1.2914855480 },
}).transpose();
const fwd_b = Mat3.init(.{
    .{ 4.0767245293, -1.2681437731, -0.0041119885 },
    .{ -3.3072168827, 2.6093323231, -0.7034763098 },
    .{ 0.2307590544, -0.3411344290, 1.7068625689 },
}).transpose();
const inv_b = Mat3.init(.{
    .{ 0.4121656120, 0.2118591070, 0.0883097947 },
    .{ 0.5362752080, 0.6807189584, 0.2818474174 },
    .{ 0.0514575653, 0.1074065790, 0.6302613616 },
}).transpose();
const inv_a = Mat3.init(.{
    .{ 0.2104542553, 1.9779984951, 0.0259040371 },
    .{ 0.7936177850, -2.4285922050, 0.7827717662 },
    .{ -0.0040720468, 0.4505937099, -0.8086757660 },
}).transpose();

pub fn oklabFromLinearSrgb(c: Vec3) Vec3 {
    const lms = inv_b.mul(Vec3, c);
    return inv_a.mul(Vec3, lms.sign().mulElements(lms.abs().powScalar(0.3333333333333)));
}

pub fn linearSrgbFromOklab(c: Vec3) Vec3 {
    const lms = fwd_a.mul(Vec3, c);
    return fwd_b.mul(Vec3, lms.powScalar(3.0));
}

pub fn srgbFromLinearSrgb(x: Vec3) Vec3 {
    var res: Vec3 = undefined;
    for (&res.data[0], x.data[0]) |*out, value| {
        out.* = if (value >= 0.0031308)
            1.055 * std.math.pow(f32, value, 1.0 / 2.4) - 0.055
        else
            12.92 * value;
    }
    return res;
}

pub fn linearSrgbFromSrgb(x: Vec3) Vec3 {
    var res: Vec3 = undefined;
    for (&res.data[0], x.data[0]) |*out, value| {
        out.* = if (value >= 0.04045)
            std.math.pow(f32, (value + 0.055) / (1.0 + 0.055), 2.4)
        else
            value / 12.92;
    }
    return res;
}

pub fn oklabFromSrgb(c: Vec3) Vec3 {
    return oklabFromLinearSrgb(linearSrgbFromSrgb(c));
}

pub fn srgbFromOklab(c: Vec3) Vec3 {
    return srgbFromLinearSrgb(linearSrgbFromOklab(c));
}
