const std = @import("std");
const rt = @import("runtime.zig");
const la = @import("linalg.zig");

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
    la.vec3(0.0, 0.0, -8.0),
    la.vec3(0.0, 0.0, 0.0),
);
var state: State = .intro;
var input = rt.Input{};

const IntroBlock = struct {
    pos: [3]f32,
    rot: f32,
};

var intro_blocks = std.BoundedArray(IntroBlock, 32){};

fn viewIntro(ts: f32, dt: f32) void {
    const steel_color = la.vec3(0.8, 0.9, 0.9);

    // logo transformations
    const logo_rotation = @cos(ts * 1e-3) * 0.25 * std.math.pi;
    const mat_logo_model = la.Mat4.chain(&.{
        la.mat4.rotateY(logo_rotation + -0.5 * std.math.pi),
        la.mat4.translate(0.0, -1.0, -3.125),
    });

    const mat_screen_to_world =
        la.mat4.invert(camera.mat_proj.mul(la.Mat4, camera.mat_view));

    // manage flying blocks
    for (intro_blocks.slice()) |*block| {
        block.rot += dt;
        block.pos[2] -= 1e-2 * dt;
    }

    if (input.clicked) {
        const screenspace_pos = la.vec4(
            (input.mouse_pos[0] / camera.resolution[0]) * 2.0 - 1.0,
            -(input.mouse_pos[1] / camera.resolution[1] * 2.0 - 1.0),
            1.0,
            1.0,
        );

        const pos = mat_screen_to_world.mul(la.Vec4, screenspace_pos);
        const final_pos = la.vec3(pos.data[0][0], pos.data[0][1], pos.data[0][2]).sub(camera.pos);
        const block = IntroBlock{
            .pos = final_pos.data[0],
            .rot = dt * 1e5,
        };

        if (intro_blocks.len == intro_blocks.capacity()) {
            _ = intro_blocks.orderedRemove(0);
        }
        intro_blocks.appendAssumeCapacity(block);
    }

    // draw everything
    rt.drawBackground(intro_bg, ts);
    camera.drawMesh(logo_model, mat_logo_model, steel_color);

    for (intro_blocks.slice()) |block| {
        const scale = 0.4;
        const mat_block_model = la.Mat4.chain(&.{
            la.mat4.translate(block.pos[0], block.pos[1], block.pos[2]),
            la.mat4.rotateZ(block.rot * 1e-4),
            la.mat4.rotateX(block.rot * 5e-4),
            la.mat4.rotateY(block.rot * 1e-3),
            la.mat4.scale(scale, scale, scale),
        });

        camera.drawMesh(block_model, mat_block_model, la.vec3(0.0, 1.0, 1.0));
    }

    const mat_play_model = la.Mat4.chain(&.{
        la.mat4.translate(0.0, -2 + @cos(ts * 1e-3) * 0.25, 0.0),
        la.mat4.rotateX(-0.25 * std.math.pi),
    });

    // TODO text alignment or some kind of measuring to allow for computing alignment
    const play_rect = camera.addBatchedText("play", mat_play_model, .{
        .alignment = .center,
        .vert_alignment = .center,
        .color = steel_color,
    });
    if (camera.pixelCollidesWithRect(mat_play_model, play_rect, input.mouse_pos)) {
        rt.print("COLLIDE", .{});
    }

    rt.drawBatchedText();
}

export fn loop(ts: f32) void {
    const S = struct {
        var last_ts: ?f32 = 0.0;
    };

    const dt: f32 = if (S.last_ts) |last_ts| ts - last_ts else 0;
    S.last_ts = ts;

    input.poll();
    camera.update();

    switch (state) {
        .intro => viewIntro(ts, dt),
        .ingame => @panic("TODO"),
    }
}
