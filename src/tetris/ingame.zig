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
        fn rotated(spawn: Spawn, rot: Rotation) [4]Vec2 {
            const center = vec2FromCoord(spawn.box).sub(Vec2.scalar(1.0)).divScalar(2.0);

            var res: [4]Vec2 = undefined;
            for (&res, spawn.filled) |*out, fill| {
                var pos = vec2FromCoord(fill);
                pos = pos.sub(center);

                const x, const y = pos.data[0];
                pos.data[0] = switch (rot) {
                    .zero => .{ x, y },
                    .right => .{ y, -x },
                    .two => .{ -x, -y },
                    .left => .{ -y, x },
                };

                pos = pos.add(center);
                out.* = pos;
            }

            return res;
        }
    };

    const spawns = std.EnumArray(Tetromino, Spawn).init(.{
        .O = .{
            .box = .{ 4, 2 },
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
    const Board = [board_height][board_width]?Tetromino;

    const BoardMino = struct {
        mino: Tetromino,
        rotation: Tetromino.Rotation = .zero,
        pos: Vec2 = rt.vec2(3, 20),
    };

    const anim_snap_ms = 75.0;

    time: f32 = 0.0,
    start_ts: f32,
    last_ts: f32,
    rotation_anim: f32 = 0.0,
    translate_anim: Vec2 = Vec2.scalar(0.0),

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
            var roll: [Tetromino.count]Tetromino = undefined;
            @memcpy(&roll, comptime std.enums.values(Tetromino));
            random.shuffle(Tetromino, &roll);
            self.bag.appendSlice(&roll) catch unreachable;
        }
    }

    fn animSnap(x: f32, reduce: f32) f32 {
        const x0 = @min(1.0, @max(0.0, @abs(x) - reduce));
        const x1 = std.math.pow(f32, x0, 2.0);
        return std.math.sign(x) * x1;
    }

    fn tick(self: *Self, ts: f32, soft_drop: bool) void {
        _ = soft_drop;

        const dt = ts - self.last_ts;
        self.last_ts = ts;
        self.time = self.last_ts - self.start_ts;

        const anim_reduce = dt / anim_snap_ms;
        self.rotation_anim = animSnap(self.rotation_anim, anim_reduce);
        self.translate_anim.data[0][0] = animSnap(self.translate_anim.data[0][0], anim_reduce);
        self.translate_anim.data[0][1] = animSnap(self.translate_anim.data[0][1], anim_reduce);
    }

    /// ensure bag size > mino count, and pop next mino to active
    fn popMino(self: *Self) void {
        self.ensureBag();
        self.bm = .{ .mino = self.bag.orderedRemove(0) };
        self.rotation_anim = 0.0;
        self.translate_anim = rt.vec2(0.0, 20.0);
    }

    // check if a move is possible based on a mino
    fn validBoardMino(self: *const Self, bm: BoardMino) bool {
        const spawn = Tetromino.spawns.get(bm.mino);
        for (spawn.rotated(bm.rotation)) |fill| {
            const pos = fill.add(bm.pos);
            const x, const y = pos.data[0];

            if (x < 0.0 or x >= board_width or y < 0.0) {
                return false;
            }

            const cell = self.board[@intFromFloat(y)][@intFromFloat(x)];
            if (cell != null) return false;
        }

        return true;
    }

    /// returns success
    fn rotateMino(self: *Self, dir: enum { left, right }) bool {
        var rotated = self.bm;
        rotated.rotation = switch (dir) {
            .left => self.bm.rotation.rotateLeft(),
            .right => self.bm.rotation.rotateRight(),
        };
        // TODO rotation tables
        if (self.validBoardMino(rotated)) {
            self.bm = rotated;
            self.rotation_anim += switch (dir) {
                .left => -1.0,
                .right => 1.0,
            };
            return true;
        }
        return false;
    }

    /// returns success
    fn translateMino(self: *Self, v: Vec2) bool {
        var translated = self.bm;
        translated.pos = translated.pos.add(v);
        if (self.validBoardMino(translated)) {
            self.bm = translated;
            self.translate_anim = self.translate_anim.sub(v);
            return true;
        }
        return false;
    }

    /// returns if new mino was generated
    fn dropMinoOnce(self: *Self) bool {
        if (self.translateMino(rt.vec2(0.0, -1.0))) {
            return false;
        }

        // splat mino onto board
        var spawn = Tetromino.spawns.get(self.bm.mino);
        for (spawn.rotated(self.bm.rotation)) |offset| {
            const pos = self.bm.pos.add(offset);
            const x, const y = pos.data[0];
            self.board[@intFromFloat(y)][@intFromFloat(x)] = self.bm.mino;
        }

        self.popMino();

        // check for lines cleared
        var clear = std.BoundedArray(usize, board_height){};

        scan: for (self.board, 0..) |line, y| {
            for (line) |cell| {
                if (cell == null) continue :scan;
            }
            clear.append(y) catch unreachable;
        }

        var rev_clear = std.mem.reverseIterator(clear.slice());
        while (rev_clear.next()) |y| {
            @memcpy(self.board[y .. board_height - 1], self.board[y + 1 ..]);
            @memset(&self.board[board_height - 1], null);
        }

        return true;
    }

    fn hardDrop(self: *Self) void {
        while (!self.dropMinoOnce()) {}
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
fn drawMino(
    ctx: *const Context,
    mino: Tetromino,
    rot: Tetromino.Rotation,
    rot_anim: f32,
    offset: Vec2,
) void {
    const spawn = Tetromino.spawns.get(mino);

    for (spawn.rotated(rot)) |fill| {
        const center = vec2FromCoord(spawn.box).sub(Vec2.scalar(1.0)).divScalar(2.0);
        const fill_offset = fill.sub(center);

        const grid_offset =
            rt.vec3(-4.5, -9.5, 0.0)
            .add(center.add(offset).expandVec(3, .{0.0}));
        const block_scale = rt.mat4.scale(Vec3.scalar(0.95));

        const mat_model = Mat4.chain(&.{
            grid_scale,
            rt.mat4.translate(grid_offset),
            block_scale,
            rt.mat4.rotateZ(rot_anim * (std.math.pi / 2.0)),
            rt.mat4.translate(fill_offset.expandVec(3, .{0})),
        });

        ctx.camera.drawMesh(resources.block_model, mat_model, mino.color());
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
        drawMino(ctx, mino, .zero, 0.0, rt.vec2(12.0, 18.0 - @as(f32, @floatFromInt(i)) * 4.0));
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
        ctx.tetris.rotation_anim,
        ctx.tetris.bm.pos.add(ctx.tetris.translate_anim),
    );

    rt.drawBatchedText();
}

pub fn viewIngame(ctx: *Context, ts: f32) void {
    const soft_drop = ctx.input.isKey(.soft_drop, .down);
    ctx.tetris.tick(ts, soft_drop);

    if (ctx.input.isKey(.right, .pressed)) {
        _ = ctx.tetris.translateMino(rt.vec2(1, 0));
    }
    if (ctx.input.isKey(.left, .pressed)) {
        _ = ctx.tetris.translateMino(rt.vec2(-1, 0));
    }
    if (ctx.input.isKey(.rotate_right, .pressed)) {
        _ = ctx.tetris.rotateMino(.right);
    }
    if (ctx.input.isKey(.rotate_left, .pressed)) {
        _ = ctx.tetris.rotateMino(.left);
    }
    if (ctx.input.isKey(.hard_drop, .pressed)) {
        _ = ctx.tetris.hardDrop();
    }

    drawTetris(ctx, ts);
}
