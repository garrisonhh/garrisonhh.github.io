const std = @import("std");
const app = @import("root.zig");
const resources = app.resources;
const Context = app.Context;
const rt = @import("runtime");
const Vec2 = rt.Vec2;
const Vec3 = rt.Vec3;
const Mat4 = rt.Mat4;
const oklab = @import("oklab.zig");

const Tetromino = enum {
    O,
    I,
    J,
    L,
    S,
    T,
    Z,

    /// specifies location of tetromino at spawn (and indirectly its rotation center)
    /// - tetromino is spawned its box's bottom left corner at the spawn offset
    /// - tetromino rotates its filled points around the box center
    const Spawn = struct {
        box: [2]u8,
        filled: [4][2]u8,
    };

    const spawns = std.EnumArray(Tetromino, Spawn).init(.{
        .O = .{
            .box = .{ 4, 3 },
            .filled = .{ .{ 1, 0 }, .{ 2, 0 }, .{ 1, 1 }, .{ 2, 1 } },
        },
        .I = .{
            .box = .{ 4, 4 },
            .filled = .{ .{ 0, 1 }, .{ 1, 1 }, .{ 2, 1 }, .{ 3, 1 } },
        },
        .J = .{
            .box = .{ 3, 3 },
            .filled = .{ .{ 0, 0 }, .{ 0, 1 }, .{ 1, 1 }, .{ 2, 1 } },
        },
        .L = .{
            .box = .{ 3, 3 },
            .filled = .{ .{ 2, 0 }, .{ 0, 1 }, .{ 1, 1 }, .{ 2, 1 } },
        },
        .S = .{
            .box = .{ 3, 3 },
            .filled = .{ .{ 1, 0 }, .{ 2, 0 }, .{ 0, 1 }, .{ 1, 1 } },
        },
        .T = .{
            .box = .{ 3, 3 },
            .filled = .{ .{ 1, 0 }, .{ 0, 1 }, .{ 1, 1 }, .{ 2, 1 } },
        },
        .Z = .{
            .box = .{ 3, 3 },
            .filled = .{ .{ 0, 0 }, .{ 1, 0 }, .{ 1, 1 }, .{ 2, 1 } },
        },
    });

    fn color(mino: Tetromino) Vec3 {
        return oklab.srgbFromOklab(rt.mat4.transform(
            rt.mat4.rotateX((@as(f32, @floatFromInt(@intFromEnum(mino))) / 7.0) * std.math.pi * 2.0),
            rt.vec3(0.5, 0.3, 0.0),
        ));
    }
};

const Tetris = struct {
    const Self = @This();

    const spawn_offset = [2]u8{ 3, 20 };
};

const grid_scale = rt.mat4.scale(Vec3.scalar(0.4));

fn drawBlock(ctx: *const Context, field_pos: Vec2, color: Vec3) void {
    const grid_offset = rt.vec3(-4.5, -9.5, 0.0);
    const block_scale = rt.mat4.scale(Vec3.scalar(0.95));

    const final_pos = field_pos.expandVec(3, .{0}).add(grid_offset);

    const mat_model = Mat4.chain(&.{
        grid_scale,
        rt.mat4.translate(final_pos),
        block_scale,
    });

    ctx.camera.drawMesh(resources.block_model, mat_model, color);
}

pub fn viewIngame(ctx: *Context, ts: f32) void {
    rt.drawBackground(resources.plaid_bg, ts);

    const lab_blue = comptime oklab.oklabFromSrgb(rt.vec3(0.0, 0.0, 1.0));
    const lab_magenta = comptime oklab.oklabFromSrgb(rt.vec3(1.0, 0.0, 1.0));
    const container_lab_color = Vec3.mix(
        lab_blue,
        lab_magenta,
        Vec3.scalar((@cos(ts * 1e-3) + 1.0) / 2.0),
    ).mulElements(rt.vec3(0.1, 1.0, 1.0));
    const container_color = oklab.srgbFromOklab(container_lab_color);

    ctx.camera.drawMesh(
        resources.container_model,
        Mat4.chain(&.{
            grid_scale,
            rt.mat4.translate(rt.vec3(0.0, -10.0, 0.0)),
        }),
        container_color,
    );

    const mino: Tetromino = @enumFromInt(@as(u64, @intFromFloat(ts * 2e-3)) % 7);
    const spawn = Tetromino.spawns.get(mino);

    for (spawn.filled) |fill_pos| {
        const pos = rt.vec2(
            @floatFromInt(Tetris.spawn_offset[0] + fill_pos[0]),
            @floatFromInt(Tetris.spawn_offset[1] + fill_pos[1]),
        );

        drawBlock(ctx, pos, mino.color());
    }
}
