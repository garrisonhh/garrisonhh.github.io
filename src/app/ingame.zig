const std = @import("std");
const app = @import("root.zig");
const resources = app.resources;
const Context = app.Context;
const la = @import("linalg.zig");
const Vec3 = la.Vec3;
const Mat4 = la.Mat4;
const rt = @import("runtime.zig");
const oklab = @import("oklab.zig");

pub fn viewIngame(ctx: *Context, ts: f32) void {
    rt.drawBackground(resources.plaid_bg, ts);

    const grid_offset = la.vec3(-5.0, -10.0, 0.0);
    const grid_scale = la.mat4.scale(Vec3.scalar(0.4));
    const block_scale = la.mat4.scale(Vec3.scalar(0.95));

    const lab_blue = oklab.oklabFromSrgb(la.vec3(0.0, 0.0, 1.0));
    const lab_magenta = oklab.oklabFromSrgb(la.vec3(1.0, 0.0, 1.0));

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

            const lab_color = lab_blue.mix(lab_magenta, Vec3.scalar(@as(f32, @floatFromInt(y)) / 19.0));
            const color = oklab.srgbFromOklab(lab_color);

            ctx.camera.drawMesh(resources.block_model, mat_model, color);
        }
    }
}
