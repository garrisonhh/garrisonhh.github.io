//! the tetris game implementation

const std = @import("std");
const Allocator = std.mem.Allocator;

const Self = @This();

pub const Pos = @Vector(2, i8);
pub const Rotation = u2;
pub const RotationDir = enum { clockwise, counterclockwise };
pub const MoveDir = enum { left, right };

pub const Tetromino = enum {
    const STARTING_OFFSET: Pos = .{3, -2};

    I,
    J,
    L,
    O,
    S,
    Z,
    T,

    pub fn asCharacter(self: @This()) u8 {
        return @tagName(self)[0];
    }

    const Shape = [4]Pos;

    fn compileShape(comptime str: []const u8) Shape {
        comptime {
            var shape: Shape = undefined;
            var index: usize = 0;

            var lines = std.mem.split(u8, str, "\n");
            var y: i8 = 0;
            while (lines.next()) |line| : (y += 1) {
                for (line) |ch, x| {
                    if (ch != ' ') {
                        shape[index] = Pos{@intCast(i8, x), y};
                        index += 1;
                    }
                }
            }

            return shape;
        }
    }

    fn getShape(self: @This()) Shape {
        switch (self) {
            inline else => |mino| {
                const form: []const u8 = switch (mino) {
                    .I =>
                    \\
                    \\####
                    ,
                    .J =>
                    \\#
                    \\###
                    ,
                    .L =>
                    \\  #
                    \\###
                    ,
                    .O =>
                    \\ ##
                    \\ ##
                    ,
                    .S =>
                    \\ ##
                    \\##
                    ,
                    .T =>
                    \\ #
                    \\###
                    ,
                    .Z =>
                    \\##
                    \\ ##
                    ,
                };

                return compileShape(form);
            },
        }
    }

    /// rotation center
    fn getCenter(self: @This()) @Vector(2, f32) {
        return switch (self) {
            .I => .{1.5, 1.5},
            .O => .{1.5, 0.5},
            else => .{1.0, 1.0},
        };
    }

    /// array of positions for a mino at a specific rotation and offset
    fn at(self: @This(), rotation: Rotation, offset: Pos) Shape {
        const center = self.getCenter();
        var shape = self.getShape();

        // rotate `rotation` times
        var i: Rotation = 0;
        while (i < rotation) : (i += 1) {
            // rotate clockwise once
            for (shape) |*pos| {
                const rel_x = @intToFloat(f32, pos.*[0]) - center[0];
                const rel_y = @intToFloat(f32, pos.*[1]) - center[1];
                const next_x = -rel_y + center[0];
                const next_y = rel_x + center[1];

                pos.*[0] = @floatToInt(i8, next_x);
                pos.*[1] = @floatToInt(i8, next_y);
            }
        }

        // move to offset
        for (shape) |*pos| {
            pos.* += offset;
        }

        return shape;
    }
};

pub const Cell = struct {
    fill: ?Tetromino,

    fn filled(self: Cell) bool {
        return self.fill != null;
    }
};

const Rng = std.rand.DefaultPrng;

const WIDTH = 10;
const HEIGHT = 20;

rng: Rng,

paused: bool,
/// ms since start of game
time: usize,
/// ms since last tick
ticker: usize,

offset: Pos,
mino: Tetromino,
rotation: Rotation,

board: [HEIGHT][WIDTH]Cell,
bag: std.BoundedArray(Tetromino, 14),

pub fn init(seed: u64) Self {
    var self = Self{
        .rng = Rng.init(seed),
        .paused = true,
        .time = 0,
        .ticker = 0,
        .offset = .{0, 0},
        .mino = undefined,
        .rotation = 0,
        .board = undefined,
        .bag = .{},
    };

    for (self.board) |*row| {
        for (row) |*cell| {
            cell.* = .{ .fill = null };
        }
    }

    self.ensureBag();
    self.newMino();

    return self;
}

pub fn togglePause(self: *Self) void {
    self.paused = !self.paused;
}

pub fn move(self: *Self, dir: MoveDir) void {
    if (self.paused) return;

    const offset = self.offset + switch (dir) {
        .right => Pos{1, 0},
        .left => Pos{-1, 0},
    };

    if (!self.collides(self.mino.at(self.rotation, offset))) {
        self.offset = offset;
    }
}

pub fn rotate(self: *Self, dir: RotationDir) void {
    if (self.paused) return;

    const rotation = switch (dir) {
        .clockwise => self.rotation +% 1,
        .counterclockwise => self.rotation -% 1,
    };

    if (!self.collides(self.mino.at(rotation, self.offset))) {
        self.rotation = rotation;
    }
}

fn inbounds(pos: Pos) bool {
    return pos[1] >= 0 and pos[1] < HEIGHT and
           pos[0] >= 0 and pos[0] < WIDTH;
}

fn getPos(self: *const Self, pos: Pos) ?*const Cell {
    if (inbounds(pos)) {
        const x = @intCast(usize, pos[0]);
        const y = @intCast(usize, pos[1]);
        return &self.board[y][x];
    }

    return null;
}

/// for checking moves and stuff
fn collides(self: *const Self, shape: Tetromino.Shape) bool {
    return for (shape) |pos| {
        // out of bounds
        if (pos[0] < 0 or pos[0] >= WIDTH or pos[1] >= HEIGHT) {
            break true;
        }

        // filled cell
        if (self.getPos(pos)) |cell| {
            if (cell.fill != null) {
                break true;
            }
        }
    } else false;
}

/// ensures there are at least 7 tetrominos in the bag
fn ensureBag(self: *Self) void {
    if (self.bag.len < 7) {
        // shake and add a new bag
        var minos: [7]Tetromino = undefined;
        for (minos) |*mino, i| {
            mino.* = @intToEnum(Tetromino, i);
        }

        self.rng.random().shuffle(Tetromino, &minos);
        self.bag.appendSliceAssumeCapacity(&minos);
    }
}

fn newMino(self: *Self) void {
    self.offset = Tetromino.STARTING_OFFSET;
    self.mino = self.bag.pop();
    self.rotation = 0;

    self.moveDown();
}

fn moveDown(self: *Self) void {
    self.offset[1] += 1;
}

fn tick(self: *Self) void {
    _ = self;
}

pub fn update(self: *Self, delta_ms: usize) void {
    if (!self.paused) {
        self.time += delta_ms;
        self.ticker += delta_ms;
    }
}

const SERIAL_LEN = WIDTH * HEIGHT;

/// 20 * 10 characters representing board rows
pub fn serialize(self: *const Self) [SERIAL_LEN]u8 {
    var buf: [HEIGHT][WIDTH]u8 = undefined;

    // draw board
    for (self.board) |row, y| {
        for (row) |cell, x| {
            const char = if (cell.fill) |ty| ty.asCharacter() else ' ';
            buf[y][x] = char;
        }
    }

    // draw mino
    for (self.mino.at(self.rotation, self.offset)) |pos| {
        // if inbounds, write cell
        if (inbounds(pos)) {
            const x = @intCast(usize, pos[0]);
            const y = @intCast(usize, pos[1]);
            buf[y][x] = self.mino.asCharacter();
        }
    }

    return @bitCast([SERIAL_LEN]u8, buf);
}
