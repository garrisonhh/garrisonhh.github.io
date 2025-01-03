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
const Tetromino = @import("mino.zig").Tetromino;

fn vec2FromCoord(coord: [2]u8) Vec2 {
    return rt.vec2(@floatFromInt(coord[0]), @floatFromInt(coord[1]));
}

/// tracks animation values with different linear transformations
///
/// all animation values start at 1.0 and end at 0.0
const Animations = struct {
    const Self = @This();

    const max_animation_count = 1024;
    const Key = enum(std.math.IntFittingRange(0, max_animation_count)) { _ };

    const Transform = enum {
        linear,
        /// start quickly and finish gently
        square,
        /// start very quickly and finish very gently
        quad,
        /// shake with intensity decreasing quadratically
        thud,
    };

    const Timer = struct {
        transform: Transform,
        value: f32,
        speed: f32,
    };

    values: std.BoundedArray(Timer, max_animation_count) = .{},

    fn register(self: *Self, transform: Transform, speed: f32) Key {
        std.debug.assert(speed > 0.0);
        const index = self.values.len;
        self.values.append(.{
            .transform = transform,
            .value = 0.0,
            .speed = speed,
        }) catch @panic("too many animations used");
        return @enumFromInt(index);
    }

    fn throttle(self: *Self, key: Key, speed: f32) void {
        self.values.slice()[@intFromEnum(key)].speed = speed;
    }

    fn reset(self: *Self, key: Key) void {
        self.values.slice()[@intFromEnum(key)].value = 1.0;
    }

    fn stop(self: *Self, key: Key) void {
        self.values.slice()[@intFromEnum(key)].value = 0.0;
    }

    fn get(self: *const Self, key: Key) f32 {
        const timer = self.values.get(@intFromEnum(key));
        return switch (timer.transform) {
            .linear => timer.value,
            .square => std.math.pow(f32, timer.value, 2.0),
            .quad => std.math.pow(f32, timer.value, 4.0),
            .thud => @cos(timer.value * 4.5 * std.math.pi) * std.math.pow(f32, timer.value, 2.0),
        };
    }

    fn tick(self: *Self, dt: f32) void {
        for (self.values.slice()) |*timer| {
            timer.value = @max(timer.value - dt * timer.speed, 0.0);
        }
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

    const rotate_speed = 1.0 / 150.0;
    const translate_speed = 1.0 / 100.0;
    const thud_speed = 1.0 / 100.0;
    const thud_scale = 0.5;
    const drop_ms = 1000.0; // TODO speed by level

    time: f32 = 0.0,
    start_ts: f32,
    last_ts: f32,
    drop_tick: f32,

    bm: BoardMino,
    /// guaranteed to have at least `Tetromino.count` minos at all times
    bag: std.BoundedArray(Tetromino, 2 * Tetromino.count),
    prng: std.rand.DefaultPrng,
    board: Board,

    anims: Animations,
    rotl_anim: Animations.Key,
    rotr_anim: Animations.Key,
    left_anim: Animations.Key,
    right_anim: Animations.Key,
    up_anim: Animations.Key,
    down_anim: Animations.Key,
    thud_anim: Animations.Key,

    pub fn init(ts: f32) Self {
        var self = Self{
            .board = std.mem.zeroes(Board),
            .bm = undefined,
            .bag = .{},
            .prng = std.rand.DefaultPrng.init(@as(u32, @bitCast(ts))),
            .start_ts = ts,
            .last_ts = ts,
            .drop_tick = undefined,
            .anims = .{},
            .rotl_anim = undefined,
            .rotr_anim = undefined,
            .left_anim = undefined,
            .right_anim = undefined,
            .up_anim = undefined,
            .down_anim = undefined,
            .thud_anim = undefined,
        };
        self.popMino();

        self.rotl_anim = self.anims.register(.quad, rotate_speed);
        self.rotr_anim = self.anims.register(.quad, rotate_speed);
        self.left_anim = self.anims.register(.square, translate_speed);
        self.right_anim = self.anims.register(.square, translate_speed);
        self.up_anim = self.anims.register(.quad, translate_speed);
        self.down_anim = self.anims.register(.quad, translate_speed);
        self.thud_anim = self.anims.register(.thud, translate_speed);

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

    fn tick(self: *Self, ts: f32, soft_drop: bool) void {
        const dt = ts - self.last_ts;
        self.last_ts = ts;
        self.time = self.last_ts - self.start_ts;

        const drop_dt = if (soft_drop) dt * 2.0 else dt;
        self.drop_tick -= drop_dt;
        if (self.drop_tick < 0) {
            _ = self.dropMinoOnce();
            self.drop_tick += drop_ms;
        }

        self.anims.tick(dt);
    }

    /// returns rotation value in radians
    fn getMinoRotation(self: *const Self) f32 {
        const left = self.anims.get(self.rotl_anim);
        const right = self.anims.get(self.rotr_anim);
        return (std.math.pi / 2.0) * (right - left);
    }

    /// returns vector offset in board coordinates
    fn getMinoOffset(self: *const Self) Vec2 {
        const offset = rt.vec2(
            self.anims.get(self.left_anim) - self.anims.get(self.right_anim),
            self.anims.get(self.down_anim) - self.anims.get(self.up_anim),
        );

        return self.bm.pos.add(offset);
    }

    /// calculates ghost offset
    fn findGhostOffset(self: *const Self) Vec2 {
        var trav = self.bm;
        while (true) {
            var next = trav;
            next.pos = next.pos.add(rt.vec2(0.0, -1.0));
            if (!self.validBoardMino(next)) break;
            trav = next;
        }

        const x_offset = self.anims.get(self.left_anim) - self.anims.get(self.right_anim);
        return trav.pos.add(rt.vec2(x_offset, 0.0));
    }

    fn getThudOffset(self: *const Self) Vec2 {
        const thud = -self.anims.get(self.thud_anim) * thud_scale;
        return rt.vec2(0.0, thud);
    }

    fn getGridOffset(self: *const Self) Vec2 {
        return rt.vec2(-4.5, -9.5).add(self.getThudOffset());
    }

    /// ensure bag size > mino count, and pop next mino to active
    fn popMino(self: *Self) void {
        self.ensureBag();
        self.bm = .{ .mino = self.bag.orderedRemove(0) };
        self.anims.stop(self.rotr_anim);
        self.anims.stop(self.rotl_anim);
        self.anims.stop(self.left_anim);
        self.anims.stop(self.right_anim);
        self.anims.stop(self.up_anim);
        self.anims.reset(self.down_anim);
        self.drop_tick = drop_ms;
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
        rt.print("ROTATE {} ({} -> {})", .{ dir, self.bm.rotation, rotated.rotation });

        const kick: Vec2 = kick: {
            if (self.validBoardMino(rotated)) {
                break :kick Vec2.zeroes();
            }

            for (rotated.mino.getKicks(self.bm.rotation, rotated.rotation)) |offset| {
                var kicked = rotated;
                kicked.pos = kicked.pos.add(offset);
                if (self.validBoardMino(kicked)) {
                    rotated = kicked;
                    break :kick offset;
                }
            }

            // no valid rotation + offset found
            return false;
        };

        // found valid rotation + offset
        self.anims.reset(switch (dir) {
            .left => self.rotl_anim,
            .right => self.rotr_anim,
        });
        switch (std.math.order(kick.data[0][0], 0)) {
            .gt => self.anims.reset(self.right_anim),
            .lt => self.anims.reset(self.left_anim),
            .eq => {},
        }
        switch (std.math.order(kick.data[0][1], 0)) {
            .gt => self.anims.reset(self.up_anim),
            .lt => self.anims.reset(self.down_anim),
            .eq => {},
        }

        self.bm = rotated;
        return true;
    }

    /// returns success
    fn translateMino(self: *Self, v: Vec2) bool {
        var translated = self.bm;
        translated.pos = translated.pos.add(v);
        if (self.validBoardMino(translated)) {
            self.bm = translated;
            switch (std.math.order(v.data[0][0], 0.0)) {
                .gt => self.anims.reset(self.right_anim),
                .lt => self.anims.reset(self.left_anim),
                else => {},
            }
            if (v.data[0][1] < 0.0) {
                self.anims.reset(self.down_anim);
            }

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
        self.anims.reset(self.thud_anim);

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
const block_scale = rt.mat4.scale(Vec3.scalar(0.95));

const BlockKind = enum { mino, ghost };

fn drawBlock(ctx: *const Context, kind: BlockKind, field_pos: Vec2, color: Vec3) void {
    const grid_offset = ctx.tetris.getGridOffset();

    const final_pos = field_pos.add(grid_offset);

    const mat_model = Mat4.chain(&.{
        grid_scale,
        rt.mat4.translate(final_pos.expandVec(3, .{0})),
        block_scale,
    });

    const mesh = switch (kind) {
        .mino => resources.block_model,
        .ghost => resources.ghost_model,
    };
    ctx.camera.drawMesh(mesh, mat_model, color);
}

fn drawMino(
    ctx: *const Context,
    kind: BlockKind,
    mino: Tetromino,
    rot: Tetromino.Rotation,
    rot_anim: f32,
    offset: Vec2,
) void {
    const spawn = Tetromino.spawns.get(mino);
    const grid_offset = ctx.tetris.getGridOffset();

    for (spawn.rotated(rot)) |fill| {
        const center = vec2FromCoord(spawn.box).sub(Vec2.scalar(1.0)).divScalar(2.0);
        const fill_offset = fill.sub(center);

        const centered_grid_offset = grid_offset.add(center).add(offset);

        const mat_model = Mat4.chain(&.{
            grid_scale,
            rt.mat4.translate(centered_grid_offset.expandVec(3, .{0.0})),
            rt.mat4.rotateZ(rot_anim),
            rt.mat4.translate(fill_offset.expandVec(3, .{0})),
            block_scale,
        });

        switch (kind) {
            .mino => ctx.camera.drawMesh(resources.block_model, mat_model, mino.color()),
            .ghost => ctx.camera.drawMesh(resources.ghost_model, mat_model, Tetromino.ghost_color),
        }
    }
}

fn drawTetris(ctx: *const Context, ts: f32) void {
    rt.drawBackground(resources.plaid_bg, ts);

    const thud_offset = ctx.tetris.getThudOffset().expandVec(3, .{0});

    // container
    const lab_blue = comptime oklab.oklabFromSrgb(rt.vec3(0.0, 0.0, 1.0));
    const lab_magenta = comptime oklab.oklabFromSrgb(rt.vec3(1.0, 0.0, 1.0));
    const container_lab_color = Vec3.mix(
        lab_blue,
        lab_magenta,
        Vec3.scalar((@cos(ts * 1e-3) + 1.0) / 2.0),
    ).mulElements(rt.vec3(0.5, 1.0, 1.0));
    const container_color = oklab.srgbFromOklab(container_lab_color);

    const container_offset = rt.vec3(0.0, -10.0, 0.0).add(thud_offset);
    ctx.camera.drawMesh(
        resources.container_model,
        Mat4.chain(&.{
            grid_scale,
            rt.mat4.translate(container_offset),
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

        const text_offset = rt.vec3(-7.0, 10.0, 0.0).add(thud_offset);
        const mat_text = Mat4.chain(&.{
            grid_scale,
            rt.mat4.translate(text_offset),
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
        const offset = rt.vec2(12.0, 18.0 - @as(f32, @floatFromInt(i)) * 4.0);
        drawMino(ctx, .mino, mino, .zero, 0.0, offset);
    }

    // tetris board + mino
    for (0..Tetris.board_height) |y| {
        for (0..Tetris.board_width) |x| {
            const mino = ctx.tetris.board[y][x] orelse continue;
            drawBlock(ctx, .mino, rt.vec2(@floatFromInt(x), @floatFromInt(y)), mino.color());
        }
    }

    drawMino(
        ctx,
        .mino,
        ctx.tetris.bm.mino,
        ctx.tetris.bm.rotation,
        ctx.tetris.getMinoRotation(),
        ctx.tetris.getMinoOffset(),
    );

    drawMino(
        ctx,
        .ghost,
        ctx.tetris.bm.mino,
        ctx.tetris.bm.rotation,
        ctx.tetris.getMinoRotation(),
        ctx.tetris.findGhostOffset(),
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
