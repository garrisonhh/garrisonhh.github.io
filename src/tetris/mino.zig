const std = @import("std");
const rt = @import("runtime");
const Vec2 = rt.Vec2;
const Vec3 = rt.Vec3;
const oklab = @import("oklab.zig");

fn vec2FromCoord(coord: [2]u8) Vec2 {
    return rt.vec2(@floatFromInt(coord[0]), @floatFromInt(coord[1]));
}

pub const Tetromino = enum {
    pub const count: comptime_int = std.enums.values(@This()).len;

    pub const ghost_color = oklab.srgbFromOklab(rt.vec3(0.5, 0.0, 0.0));

    O,
    I,
    J,
    L,
    S,
    T,
    Z,

    pub const Rotation = enum(u2) {
        zero,
        right,
        two,
        left,

        pub fn rotateRight(rot: Rotation) Rotation {
            return @enumFromInt(@intFromEnum(rot) +% 1);
        }

        pub fn rotateLeft(rot: Rotation) Rotation {
            return @enumFromInt(@intFromEnum(rot) +% 3);
        }
    };

    /// specifies location of tetromino at spawn (and indirectly its rotation center)
    /// - tetromino is spawned its box's bottom left corner at the spawn offset
    /// - tetromino rotates its filled points around the box center
    pub const Spawn = struct {
        box: [2]u8,
        filled: [4][2]u8,

        // get coords with this rotation
        pub fn rotated(spawn: Spawn, rot: Rotation) [4]Vec2 {
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

    pub const spawns = std.EnumArray(Tetromino, Spawn).init(.{
        .O = .{
            .box = .{ 4, 2 },
            .filled = .{ .{ 1, 0 }, .{ 2, 0 }, .{ 1, 1 }, .{ 2, 1 } },
        },
        .I = .{
            .box = .{ 4, 4 },
            .filled = .{ .{ 0, 2 }, .{ 1, 2 }, .{ 2, 2 }, .{ 3, 2 } },
        },
        .J = .{
            .box = .{ 3, 3 },
            .filled = .{ .{ 0, 2 }, .{ 0, 1 }, .{ 1, 1 }, .{ 2, 1 } },
        },
        .L = .{
            .box = .{ 3, 3 },
            .filled = .{ .{ 2, 2 }, .{ 0, 1 }, .{ 1, 1 }, .{ 2, 1 } },
        },
        .S = .{
            .box = .{ 3, 3 },
            .filled = .{ .{ 1, 2 }, .{ 2, 2 }, .{ 0, 1 }, .{ 1, 1 } },
        },
        .T = .{
            .box = .{ 3, 3 },
            .filled = .{ .{ 1, 2 }, .{ 0, 1 }, .{ 1, 1 }, .{ 2, 1 } },
        },
        .Z = .{
            .box = .{ 3, 3 },
            .filled = .{ .{ 0, 2 }, .{ 1, 2 }, .{ 1, 1 }, .{ 2, 1 } },
        },
    });

    const KickEntry = struct { Rotation, Rotation, [4]Vec2 };

    const most_kicks = [_]KickEntry{
        .{ .zero, .right, .{ rt.vec2(-1, 0), rt.vec2(-1, 1), rt.vec2(0, -2), rt.vec2(-1, -2) } },
        .{ .right, .zero, .{ rt.vec2(1, 0), rt.vec2(1, -1), rt.vec2(0, 2), rt.vec2(1, 2) } },
        .{ .right, .two, .{ rt.vec2(1, 0), rt.vec2(1, -1), rt.vec2(0, 2), rt.vec2(1, 2) } },
        .{ .two, .right, .{ rt.vec2(-1, 0), rt.vec2(-1, 1), rt.vec2(0, -2), rt.vec2(-1, -2) } },
        .{ .two, .left, .{ rt.vec2(1, 0), rt.vec2(1, 1), rt.vec2(0, -2), rt.vec2(1, -2) } },
        .{ .left, .two, .{ rt.vec2(-1, 0), rt.vec2(-1, -1), rt.vec2(0, 2), rt.vec2(-1, 2) } },
        .{ .left, .zero, .{ rt.vec2(-1, 0), rt.vec2(-1, -1), rt.vec2(0, 2), rt.vec2(-1, 2) } },
        .{ .zero, .left, .{ rt.vec2(1, 0), rt.vec2(1, 1), rt.vec2(0, -2), rt.vec2(1, -2) } },
    };

    const i_kicks = [_]KickEntry{
        .{ .zero, .right, .{ rt.vec2(-2, 0), rt.vec2(1, 0), rt.vec2(-2, -1), rt.vec2(1, 2) } },
        .{ .right, .zero, .{ rt.vec2(2, 0), rt.vec2(-1, 0), rt.vec2(2, 1), rt.vec2(-1, -2) } },
        .{ .right, .two, .{ rt.vec2(-1, 0), rt.vec2(2, 0), rt.vec2(-1, 2), rt.vec2(2, -1) } },
        .{ .two, .right, .{ rt.vec2(1, 0), rt.vec2(-2, 0), rt.vec2(1, -2), rt.vec2(-2, 1) } },
        .{ .two, .left, .{ rt.vec2(2, 0), rt.vec2(-1, 0), rt.vec2(2, 1), rt.vec2(-1, -2) } },
        .{ .left, .two, .{ rt.vec2(-2, 0), rt.vec2(1, 0), rt.vec2(-2, -1), rt.vec2(1, 2) } },
        .{ .left, .zero, .{ rt.vec2(1, 0), rt.vec2(-2, 0), rt.vec2(1, -2), rt.vec2(-2, 1) } },
        .{ .zero, .left, .{ rt.vec2(-1, 0), rt.vec2(2, 0), rt.vec2(-1, 2), rt.vec2(2, -1) } },
    };

    pub fn getKicks(mino: Tetromino, from: Rotation, to: Rotation) [4]Vec2 {
        const entries: []const KickEntry = switch (mino) {
            .I => &i_kicks,
            else => &most_kicks,
        };

        for (entries) |entry| {
            if (entry.@"0" == from and entry.@"1" == to) {
                return entry.@"2";
            }
        } else unreachable;
    }

    pub fn color(mino: Tetromino) Vec3 {
        return oklab.srgbFromOklab(rt.mat4.transform(
            rt.mat4.rotateX((@as(f32, @floatFromInt(@intFromEnum(mino))) / 7.0) * std.math.pi * 2.0),
            rt.vec3(0.7, 0.3, 0.0),
        ));
    }
};
