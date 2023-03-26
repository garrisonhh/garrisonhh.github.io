//! the tetris game implementation

const std = @import("std");
const Allocator = std.mem.Allocator;

const Self = @This();

pub const Tetromino = struct {
    pub const Type = enum {
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
    };
};

pub const Cell = struct {
    fill: ?Tetromino.Type,

    fn filled(self: Cell) bool {
        return self.fill != null;
    }
};

const Rng = std.rand.DefaultPrng;

rng: Rng,
board: [20][10]Cell,
bag: std.BoundedArray(Tetromino.Type, 14),

pub fn init(seed: u64) Self {
    var self = Self{
        .rng = Rng.init(seed),
        .board = undefined,
        .bag = .{},
    };

    for (self.board) |*row| {
        for (row) |*cell| {
            cell.* = .{ .fill = null };
        }
    }

    self.ensureBag();

    return self;
}

/// ensures there are at least 7 tetrominos in the bag
fn ensureBag(self: *Self) void {
    if (self.bag.len < 7) {
        var minos: [7]Tetromino.Type = undefined;
        for (minos) |*mino, i| {
            mino.* = @intToEnum(Tetromino.Type, i);
        }

        self.rng.random().shuffle(Tetromino.Type, &minos);
        self.bag.appendSliceAssumeCapacity(&minos);
    }
}

const SERIAL_LEN = 20 * 10 + 7;

/// first 20 * 10 characters represent board rows
/// last 7 characters represent the bag
pub fn serialize(self: *const Self) [SERIAL_LEN]u8 {
    var buf: [SERIAL_LEN]u8 = undefined;

    for (self.board) |row, y| {
        for (row) |cell, x| {
            buf[y * 10 + x] = if (cell.fill) |ty| ty.asCharacter() else ' ';
        }
    }

    for (self.bag.slice()[0..7]) |ty, i| {
        buf[20 * 10 + i] = ty.asCharacter();
    }

    // TODO remove
    buf[14] = 'T';
    buf[15] = 'I';

    return buf;
}

