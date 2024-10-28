const std = @import("std");
const rt = @import("runtime");

const intro = @import("intro.zig");
const ingame = @import("ingame.zig");

pub const color = struct {
    pub const steel = rt.vec3(0.8, 0.9, 0.9);
    pub const ui_text_unhovered = steel;
    pub const ui_text_hovered = rt.vec3(0.8, 0.5, 0.3);
};

pub const resources = struct {
    pub var intro_bg: rt.BackgroundShader = undefined;
    pub var plaid_bg: rt.BackgroundShader = undefined;
    pub var logo_model: rt.Mesh = undefined;
    pub var block_model: rt.Mesh = undefined;
    pub var container_model: rt.Mesh = undefined;
};

pub const Context = struct {
    pub const State = enum {
        intro,
        ingame,
    };

    state: State = .intro,
    camera: rt.Camera,
    input: rt.Input = .{},

    fn init(camera_pos: rt.Vec3, camera_target: rt.Vec3) Context {
        return .{
            .camera = rt.Camera.init(camera_pos, camera_target),
        };
    }

    pub fn setCamera(ctx: *Context, pos: rt.Vec3, target: rt.Vec3) void {
        ctx.camera = rt.Camera.init(pos, target);
    }
};

var context: Context = undefined;

export fn init() void {
    resources.intro_bg = rt.must(rt.loadBackground(@embedFile("shaders/intro-bg.frag")));
    resources.plaid_bg = rt.must(rt.loadBackground(@embedFile("shaders/plaid-bg.frag")));
    resources.logo_model = rt.must(rt.loadMesh(@embedFile("models/tetris2000.obj")));
    resources.block_model = rt.must(rt.loadMesh(@embedFile("models/tetromino-block.obj")));
    resources.container_model = rt.must(rt.loadMesh(@embedFile("models/container.obj")));

    context = Context.init(rt.vec3(0.0, 0.0, 10.0), rt.Vec3.scalar(0.0));
}

export fn loop(ts: f32) void {
    context.input.poll();
    context.camera.updateResolution();
    switch (context.state) {
        .intro => intro.viewIntro(&context, ts),
        .ingame => ingame.viewIngame(&context, ts),
    }
}

pub fn uiTextButton(ctx: *const Context, text: []const u8, mat_model: rt.Mat4) bool {
    var options = rt.TextOptions{
        .alignment = .center,
        .vert_alignment = .center,
        .color = undefined,
    };

    const rect = rt.measureText(text, options);
    const hovered = ctx.camera.pixelCollidesWithRect(mat_model, rect, ctx.input.mouse_pos);
    options.color = if (hovered) color.ui_text_hovered else color.ui_text_unhovered;
    _ = ctx.camera.addBatchedText(text, mat_model, options);

    return hovered and ctx.input.clicked;
}
