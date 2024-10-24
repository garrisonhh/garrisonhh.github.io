const std = @import("std");
const app = @import("root.zig");
const resources = app.resources;
const Context = app.Context;
const la = @import("linalg.zig");
const Vec3 = la.Vec3;
const Mat4 = la.Mat4;
const rt = @import("runtime.zig");
const oklab = @import("oklab.zig");

const Tetris = struct {
    const Self = @This();

    const Tetromino = enum {
        O,
        I,
        J,
        L,
        S,
        T,
        Z,
    };
};

pub fn viewIngame(ctx: *Context, ts: f32) void {
    rt.drawBackground(resources.plaid_bg, ts);

    const grid_scale = la.mat4.scale(Vec3.scalar(0.4));

    const lab_blue = comptime oklab.oklabFromSrgb(la.vec3(0.0, 0.0, 1.0));
    const lab_magenta = comptime oklab.oklabFromSrgb(la.vec3(1.0, 0.0, 1.0));
    const container_lab_color = Vec3.mix(
        lab_blue,
        lab_magenta,
        Vec3.scalar((@cos(ts * 1e-3) + 1.0) / 2.0),
    ).mulElements(la.vec3(0.1, 1.0, 1.0));
    const container_color = oklab.srgbFromOklab(container_lab_color);

    ctx.camera.drawMesh(
        resources.container_model,
        Mat4.chain(&.{
            grid_scale,
            la.mat4.translate(la.vec3(0.0, -10.0, 0.0)),
        }),
        container_color,
    );

    const grid_offset = la.vec3(-4.5, -9.5, 0.0);
    const block_scale = la.mat4.scale(Vec3.scalar(0.95));

    for (0..20) |y| {
        for (0..10) |x| {
            const block_pos = la.vec3(
                @as(f32, @floatFromInt(x)),
                @as(f32, @floatFromInt(y)),
                0.0,
            );
            const final_pos = block_pos.add(grid_offset);

            const mat_model = Mat4.chain(&.{
                grid_scale,
                la.mat4.translate(final_pos),
                block_scale,
            });

            const mix_factor = @as(f32, @floatFromInt(y)) / 19.0;
            const lab_color = lab_blue.mix(lab_magenta, Vec3.scalar(mix_factor));
            const color = oklab.srgbFromOklab(lab_color);

            ctx.camera.drawMesh(resources.block_model, mat_model, color);
        }
    }
}
