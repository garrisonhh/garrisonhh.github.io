const std = @import("std");
const rt = @import("runtime.zig");
const la = @import("linalg.zig");

var bg: rt.BackgroundShader = undefined;
var tetris2000: rt.Mesh = undefined;

export fn init() void {
    bg = rt.must(rt.loadBackground(@embedFile("shaders/bg.frag")));
    tetris2000 = rt.must(rt.loadMesh(@embedFile("models/tetris2000.obj")));
}

export fn loop(ts: f32) void {
    const width, const height = rt.getResolution();

    const rotation = @cos(ts * 1e-3) * 0.25 * std.math.pi;

    const matModel = la.Mat4.chain(&.{
        la.mat4.rotateY(rotation + -0.5 * std.math.pi),
        la.mat4.translate(0.0, -1.0, -3.125),
    });
    const matView = la.mat4.translate(0.0, 0.0, -5.0);
    const matProjection = la.mat4.perspective(.{ .width = width, .height = height });

    const matModelView = matView.mul(la.Mat4, matModel);
    const mvp = matProjection.mul(la.Mat4, matModelView);
    const matNormal = la.mat4.invert(matModelView).transpose();
    const color = la.vec3(1.0, 0.0, 0.0);

    rt.drawBackground(bg, ts);
    rt.drawMesh(tetris2000, matNormal, mvp, color);
}
