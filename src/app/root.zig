const std = @import("std");
const rt = @import("runtime.zig");
const la = @import("linalg.zig");

const color = struct {
    const steel = la.vec3(0.8, 0.9, 0.9);
    const ui_text_unhovered = steel;
    const ui_text_hovered = la.vec3(0.8, 0.5, 0.3);
};

var intro_bg: rt.BackgroundShader = undefined;
var lavalamp_bg: rt.BackgroundShader = undefined;
var logo_model: rt.Mesh = undefined;
var block_model: rt.Mesh = undefined;

export fn init() void {
    intro_bg = rt.must(rt.loadBackground(@embedFile("shaders/intro-bg.frag")));
    lavalamp_bg = rt.must(rt.loadBackground(@embedFile("shaders/lavalamp-bg.frag")));
    logo_model = rt.must(rt.loadMesh(@embedFile("models/tetris2000.obj")));
    block_model = rt.must(rt.loadMesh(@embedFile("models/tetromino-block.obj")));
}

const State = enum {
    intro,
    ingame,
};

var camera = rt.Camera.init(
    la.vec3(0.0, 0.0, 8.0),
    la.vec3(0.0, 0.0, 0.0),
);
var state: State = .intro;
var input = rt.Input{};

fn uiTextButton(text: []const u8, mat_model: la.Mat4) bool {
    var options = rt.TextOptions{
        .alignment = .center,
        .vert_alignment = .center,
        .color = undefined,
    };

    const rect = rt.measureText(text, options);
    const hovered = camera.pixelCollidesWithRect(mat_model, rect, input.mouse_pos);
    options.color = if (hovered) color.ui_text_hovered else color.ui_text_unhovered;
    _ = camera.addBatchedText(text, mat_model, options);

    return hovered and input.clicked;
}

fn viewIntro(ts: f32, dt: f32) void {
    _ = dt;

    input.poll();
    camera.update();

    // logo transformations
    const logo_rotation = @cos(ts * 1e-3) * 0.25 * std.math.pi;
    const mat_logo_model = la.Mat4.chain(&.{
        la.mat4.rotateY(logo_rotation),
        la.mat4.translate(la.vec3(-3.125, -1.0, 0.0)),
    });

    // draw everything
    rt.drawBackground(intro_bg, ts);
    camera.drawMesh(logo_model, mat_logo_model, color.steel);

    const clicked_play = uiTextButton("play", la.Mat4.chain(&.{
        la.mat4.translate(la.vec3(0.0, -3.0 + @cos(ts * 1e-3) * 0.25, 0.0)),
        la.mat4.rotateX(-0.25 * std.math.pi),
    }));
    if (clicked_play) {
        rt.print("PLAY", .{});
    }

    rt.drawBatchedText();
}

export fn loop(ts: f32) void {
    const S = struct {
        var last_ts: ?f32 = 0.0;
    };

    const dt: f32 = if (S.last_ts) |last_ts| ts - last_ts else 0;
    S.last_ts = ts;

    switch (state) {
        .intro => viewIntro(ts, dt),
        .ingame => @panic("TODO"),
    }
}
