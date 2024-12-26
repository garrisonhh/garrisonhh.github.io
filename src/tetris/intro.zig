const std = @import("std");
const app = @import("root.zig");
const color = app.color;
const resources = app.resources;
const Context = app.Context;
const rt = @import("runtime");
const Tetromino = @import("mino.zig").Tetromino;

pub const Debris = struct {};

pub fn viewIntro(ctx: *Context, ts: f32) void {
    // logo transformations
    const logo_rotation = @cos(ts * 1e-3) * 0.25 * std.math.pi;
    const mat_logo_model = rt.Mat4.chain(&.{
        rt.mat4.rotateY(logo_rotation),
        rt.mat4.translate(rt.vec3(-3.125, -1.0, 0.0)),
    });

    // draw everything
    rt.drawBackground(resources.intro_bg, ts);
    ctx.camera.drawMesh(resources.logo_model, mat_logo_model, color.steel);

    const clicked_play = app.uiTextButton(ctx, "play", rt.Mat4.chain(&.{
        rt.mat4.translate(rt.vec3(0.0, -3.0 + @cos(ts * 1e-3) * 0.25, 0.0)),
        rt.mat4.rotateX(-0.25 * std.math.pi),
    }));
    if (clicked_play) {
        ctx.startGame(ts);
    }

    rt.drawBatchedText();
}
