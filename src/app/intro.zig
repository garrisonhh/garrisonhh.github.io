const std = @import("std");
const app = @import("root.zig");
const color = app.color;
const resources = app.resources;
const Context = app.Context;
const la = @import("linalg.zig");
const rt = @import("runtime.zig");

pub fn viewIntro(ctx: *Context, ts: f32) void {
    // logo transformations
    const logo_rotation = @cos(ts * 1e-3) * 0.25 * std.math.pi;
    const mat_logo_model = la.Mat4.chain(&.{
        la.mat4.rotateY(logo_rotation),
        la.mat4.translate(la.vec3(-3.125, -1.0, 0.0)),
    });

    // draw everything
    rt.drawBackground(resources.intro_bg, ts);
    ctx.camera.drawMesh(resources.logo_model, mat_logo_model, color.steel);

    const clicked_play = app.uiTextButton(ctx, "play", la.Mat4.chain(&.{
        la.mat4.translate(la.vec3(0.0, -3.0 + @cos(ts * 1e-3) * 0.25, 0.0)),
        la.mat4.rotateX(-0.25 * std.math.pi),
    }));
    if (clicked_play) {
        ctx.state = .ingame;
    }

    rt.drawBatchedText();
}
