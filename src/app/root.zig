const std = @import("std");
const rt = @import("runtime.zig");
const la = @import("linalg.zig");

var introBg: rt.BackgroundShader = undefined;
var lavalampBg: rt.BackgroundShader = undefined;
var logoModel: rt.Mesh = undefined;
var blockModel: rt.Mesh = undefined;

export fn init() void {
    introBg = rt.must(rt.loadBackground(@embedFile("shaders/intro-bg.frag")));
    lavalampBg = rt.must(rt.loadBackground(@embedFile("shaders/lavalamp-bg.frag")));
    logoModel = rt.must(rt.loadMesh(@embedFile("models/tetris2000.obj")));
    blockModel = rt.must(rt.loadMesh(@embedFile("models/tetromino-block.obj")));
}

const State = enum {
    intro,
    ingame,
};

var camera: [3]f32 = .{ 0.0, 0.0, 8.0 };
var state: State = .intro;
var input = rt.Input{};

const IntroBlock = struct {
    pos: [3]f32,
    rot: f32,
};

var introBlocks = std.BoundedArray(IntroBlock, 32){};

fn viewIntro(ts: f32, dt: f32) void {
    const width, const height = rt.getResolution();

    // general transformations
    const matView = la.mat4.translate(-camera[0], -camera[1], -camera[2]);
    const matProjection = la.mat4.perspective(.{ .width = width, .height = height });

    const matScreenToWorld = la.mat4.invert(matProjection.mul(la.Mat4, matView));

    // logo transformations
    const logoRotation = @cos(ts * 1e-3) * 0.25 * std.math.pi;
    const matLogoModel = la.Mat4.chain(&.{
        la.mat4.rotateY(logoRotation + -0.5 * std.math.pi),
        la.mat4.translate(0.0, -1.0, -3.125),
    });
    const color = la.vec3(0.8, 0.9, 0.9);

    // manage flying blocks
    for (introBlocks.slice()) |*block| {
        block.rot += dt;
        block.pos[2] -= 1e-2 * dt;
    }

    if (input.clicked) {
        const screen_x = input.mouse_pos[0] - (width / 2.0);
        const screen_y = -input.mouse_pos[1] + (height / 2.0);

        const pos = la.mat4.apply(
            matScreenToWorld,
            la.vec3(screen_x, screen_y, -camera[2]),
        );

        const block = IntroBlock{
            .pos = .{ pos.data[0][0], pos.data[0][1], pos.data[0][2] },
            .rot = dt * 1e5,
        };

        if (introBlocks.len == introBlocks.capacity()) {
            _ = introBlocks.orderedRemove(0);
        }
        introBlocks.appendAssumeCapacity(block);
    }

    // draw everything
    rt.drawBackground(introBg, ts);
    rt.drawMesh(logoModel, matLogoModel, matView, matProjection, color);

    for (introBlocks.slice()) |block| {
        const scale = 0.4;
        const matBlockModel = la.Mat4.chain(&.{
            la.mat4.translate(block.pos[0], block.pos[1], block.pos[2]),
            la.mat4.rotateZ(block.rot * 1e-4),
            la.mat4.rotateX(block.rot * 5e-4),
            la.mat4.rotateY(block.rot * 1e-3),
            la.mat4.scale(scale, scale, scale),
        });

        rt.drawMesh(
            blockModel,
            matBlockModel,
            matView,
            matProjection,
            la.vec3(0.0, 1.0, 1.0),
        );
    }

    const testTextMvp = la.Mat4.chain(&.{
        matProjection,
        matView,
        la.mat4.translate(-1, -2 + @cos(ts * 1e-3) * 0.25, 0.0),
        la.mat4.rotateX(-0.25 * std.math.pi),
    });

    rt.addBatchedText("play", testTextMvp);
    rt.drawBatchedText();
}

export fn loop(ts: f32) void {
    const S = struct {
        var last_ts: ?f32 = 0.0;
    };

    const dt: f32 = if (S.last_ts) |last_ts| ts - last_ts else 0;
    S.last_ts = ts;

    input.poll();

    switch (state) {
        .intro => viewIntro(ts, dt),
        .ingame => @panic("TODO"),
    }
}
