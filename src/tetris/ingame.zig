const std = @import("std");
const app = @import("root.zig");
const resources = app.resources;
const Context = app.Context;
const rt = @import("runtime");
const Vec2 = rt.Vec2;
const Vec3 = rt.Vec3;
const Mat3 = rt.Matrix(3, 3);
const Mat4 = rt.Mat4;
const oklab = @import("oklab.zig");

fn vec2FromCoord(coord: [2]u8) Vec2 {
    return rt.vec2(@floatFromInt(coord[0]), @floatFromInt(coord[1]));
}

const Tetromino = enum {
    pub const count: comptime_int = std.enums.values(@This()).len;

    O,
    I,
    J,
    L,
    S,
    T,
    Z,

    const Rotation = enum(u2) {
        zero,
        right,
        two,
        left,

        fn rotateRight(rot: Rotation) Rotation {
            return @enumFromInt(@intFromEnum(rot) +% 1);
        }

        fn rotateLeft(rot: Rotation) Rotation {
            return @enumFromInt(@intFromEnum(rot) +% 3);
        }
    };

    /// specifies location of tetromino at spawn (and indirectly its rotation center)
    /// - tetromino is spawned its box's bottom left corner at the spawn offset
    /// - tetromino rotates its filled points around the box center
    const Spawn = struct {
        box: [2]u8,
        filled: [4][2]u8,

        // get coords with this rotation
        fn rotated(spawn: Spawn, rot: Rotation) [4][2]u8 {
            const center = vec2FromCoord(spawn.box).sub(Vec2.scalar(1.0)).divScalar(2.0);

            var res: [4][2]u8 = undefined;
            for (&res, spawn.filled) |*out, fill| {
                var pos = vec2FromCoord(fill);
                pos = pos.sub(center);

                const x, const y = pos.data[0];
                pos.data[0] = switch (rot) {
                    .zero => .{ x, y },
                    .right => .{ -y, x },
                    .two => .{ -x, -y },
                    .left => .{ y, -x },
                };

                pos = pos.add(center);
                out.* = .{ @intFromFloat(pos.data[0][0]), @intFromFloat(pos.data[0][1]) };
            }

            return res;
        }
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

pub const Tetris = struct {
    const Self = @This();

    const board_width = 10;
    const board_height = 24;
    const spawn_offset = [2]u8{ 3, 20 };

    const Board = [board_height][board_width]?Tetromino;
    const BoardMino = struct {
        mino: Tetromino,
        rotation: Tetromino.Rotation = .zero,
        pos: [2]u8 = spawn_offset,
    };

    time: f32 = 0.0,
    start_ts: f32,
    last_ts: f32,

    bm: BoardMino,
    /// guaranteed to have at least `Tetromino.count` minos at all times
    bag: std.BoundedArray(Tetromino, 2 * Tetromino.count),
    prng: std.rand.DefaultPrng,
    board: Board,

    pub fn init(ts: f32) Self {
        var self = Self{
            .board = std.mem.zeroes(Board),
            .bm = undefined,
            .bag = .{},
            .prng = std.rand.DefaultPrng.init(@as(u32, @bitCast(ts))),
            .start_ts = ts,
            .last_ts = ts,
        };
        self.popMino();

        return self;
    }

    fn ensureBag(self: *Self) void {
        var random = self.prng.random();
        while (self.bag.len <= Tetromino.count) {
            var buf: [Tetromino.count]Tetromino = undefined;
            for (&buf) |*out| {
                out.* = random.enumValue(Tetromino);
            }

            self.bag.appendSlice(&buf) catch unreachable;
        }
    }

    /// ensure bag size > mino count, and pop next mino to active
    fn popMino(self: *Self) void {
        self.ensureBag();
        self.bm = .{ .mino = self.bag.pop() };
    }

    fn tick(self: *Self, ts: f32) void {
        const dt = ts - self.last_ts;
        self.last_ts = ts;
        self.time = self.last_ts - self.start_ts;

        _ = dt;
    }
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

/// TODO rotation when spinning
fn drawMino(ctx: *const Context, mino: Tetromino, rot: Tetromino.Rotation, offset: Vec2) void {
    const spawn = Tetromino.spawns.get(mino);

    for (spawn.rotated(rot)) |fill| {
        const pos = offset.add(vec2FromCoord(fill));
        drawBlock(ctx, pos, mino.color());
    }
}

fn drawTetris(ctx: *const Context, ts: f32) void {
    rt.drawBackground(resources.plaid_bg, ts);

    // container
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

    // timer
    const total_seconds = (ctx.tetris.last_ts - ctx.tetris.start_ts) * 1e-3;
    const minutes: u32 = @intFromFloat(total_seconds / 60.0);
    const seconds: u8 = @intFromFloat(@rem(total_seconds, 60.0));

    {
        var buf: [32]u8 = undefined;
        const text = std.fmt.bufPrint(&buf, "{d}:{d:0>2}", .{ minutes, seconds }) catch unreachable;

        const mat_text = Mat4.chain(&.{
            grid_scale,
            rt.mat4.translate(rt.vec3(-7.0, 10.0, 0.0)),
            rt.mat4.scale(Vec3.scalar(2.0)),
        });

        _ = ctx.camera.addBatchedText(text, mat_text, .{
            .alignment = .right,
            .color = Vec3.scalar(1.0),
        });
    }

    // next 2 minos in bag
    for (0..2) |i| {
        const mino = ctx.tetris.bag.get(i);
        drawMino(ctx, mino, .zero, rt.vec2(12.0, 18.0 - @as(f32, @floatFromInt(i)) * 4.0));
    }

    // tetris board + mino
    for (0..Tetris.board_height) |y| {
        for (0..Tetris.board_width) |x| {
            const mino = ctx.tetris.board[y][x] orelse continue;
            drawBlock(ctx, rt.vec2(@floatFromInt(x), @floatFromInt(y)), mino.color());
        }
    }

    drawMino(
        ctx,
        ctx.tetris.bm.mino,
        ctx.tetris.bm.rotation,
        vec2FromCoord(ctx.tetris.bm.pos),
    );

    rt.drawBatchedText();
}

pub fn viewIngame(ctx: *Context, ts: f32) void {
    ctx.tetris.tick(ts);

    if (ctx.input.isKey(.right, .pressed)) {
        rt.print("RIGHT", .{});
        ctx.tetris.bm.rotation = ctx.tetris.bm.rotation.rotateRight();
    }
    if (ctx.input.isKey(.left, .pressed)) {
        rt.print("LEFT", .{});
        ctx.tetris.bm.rotation = ctx.tetris.bm.rotation.rotateLeft();
    }

    drawTetris(ctx, ts);
}
