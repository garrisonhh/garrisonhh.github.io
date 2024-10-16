//! linear algebra for 3d

const std = @import("std");

pub const Mat4 = Matrix(4, 4);
pub const Vec3 = Matrix(1, 3);
pub const Vec4 = Matrix(1, 4);

pub fn Matrix(comptime C: comptime_int, comptime R: comptime_int) type {
    return struct {
        const Self = @This();

        pub const columns = C;
        pub const rows = R;
        pub const Transpose = Matrix(R, C);

        data: [C][R]f32,

        pub fn init(data: [R][C]f32) Self {
            var self: Self = undefined;
            for (0..C) |col| {
                for (0..R) |row| {
                    self.data[col][row] = data[row][col];
                }
            }

            return self;
        }

        pub fn zeroes() Self {
            return std.mem.zeroes(Self);
        }

        /// useful for returning to js runtime
        pub fn ptr(self: *const Self) *const [C * R]f32 {
            return @ptrCast(&self.data);
        }

        pub fn add(self: Self, other: Self) Self {
            var res: Self = undefined;
            for (0..C) |col| {
                for (0..R) |row| {
                    res.data[col][row] = self.data[col][row] + other.data[col][row];
                }
            }
            return res;
        }

        pub fn mul(
            self: Self,
            comptime Other: type,
            other: Other,
        ) Matrix(Other.columns, Self.rows) {
            if (Other != Matrix(Other.columns, Other.rows)) {
                @compileError("bad other type");
            }

            const Result = Matrix(Other.columns, Self.rows);
            var res: Result = undefined;
            for (0..Result.columns) |col| {
                for (0..Result.rows) |row| {
                    var sum: f32 = 0.0;
                    for (0..Self.columns) |i| {
                        sum += self.data[i][row] * other.data[col][i];
                    }
                    res.data[col][row] = sum;
                }
            }

            return res;
        }

        /// chain multiply
        pub fn chain(matrices: []const Self) Self {
            if (comptime C != R) {
                @compileError("can't chain mul with non-square matrices");
            }

            var res = Self.zeroes();
            for (0..C) |i| res.data[i][i] = 1.0;

            for (matrices) |matrix| {
                res = res.mul(Self, matrix);
            }

            return res;
        }

        pub fn transpose(self: Self) Transpose {
            var res: Transpose = undefined;
            for (0..C) |col| {
                for (0..R) |row| {
                    res.data[row][col] = self.data[col][row];
                }
            }
            return res;
        }

        pub fn format(
            self: Self,
            comptime _: []const u8,
            _: std.fmt.FormatOptions,
            writer: anytype,
        ) @TypeOf(writer).Error!void {
            for (0..R) |row| {
                try writer.print("[ ", .{});
                for (0..C) |col| {
                    try writer.print("{d:9.4} ", .{self.data[col][row]});
                }
                try writer.print("]\n", .{});
            }
        }
    };
}

pub fn vec3(x: f32, y: f32, z: f32) Vec3 {
    return Vec3.init(.{
        .{x},
        .{y},
        .{z},
    });
}

pub fn vec4(x: f32, y: f32, z: f32, w: f32) Vec4 {
    return Vec4.init(.{
        .{x},
        .{y},
        .{z},
        .{w},
    });
}

pub const mat4 = struct {
    /// apply a mat4 transformation to a vec3
    pub fn apply(transform: Mat4, v: Vec3) Vec3 {
        const v4 = vec4(v.data[0][0], v.data[0][1], v.data[0][2], 1.0);
        const homo = transform.mul(Vec4, v4);
        const w = homo.data[0][3];
        return vec3(
            homo.data[0][0] / w,
            homo.data[0][1] / w,
            homo.data[0][2] / w,
        );
    }

    pub fn identity() Mat4 {
        return Mat4.init(.{
            .{ 1, 0, 0, 0 },
            .{ 0, 1, 0, 0 },
            .{ 0, 0, 1, 0 },
            .{ 0, 0, 0, 1 },
        });
    }

    pub fn invert(self: Mat4) Mat4 {
        // translated from raymath.h, so super ugly
        const b00 = self.data[0][0] * self.data[1][1] - self.data[0][1] * self.data[1][0];
        const b01 = self.data[0][0] * self.data[1][2] - self.data[0][2] * self.data[1][0];
        const b02 = self.data[0][0] * self.data[1][3] - self.data[0][3] * self.data[1][0];
        const b03 = self.data[0][1] * self.data[1][2] - self.data[0][2] * self.data[1][1];
        const b04 = self.data[0][1] * self.data[1][3] - self.data[0][3] * self.data[1][1];
        const b05 = self.data[0][2] * self.data[1][3] - self.data[0][3] * self.data[1][2];
        const b06 = self.data[2][0] * self.data[3][1] - self.data[2][1] * self.data[3][0];
        const b07 = self.data[2][0] * self.data[3][2] - self.data[2][2] * self.data[3][0];
        const b08 = self.data[2][0] * self.data[3][3] - self.data[2][3] * self.data[3][0];
        const b09 = self.data[2][1] * self.data[3][2] - self.data[2][2] * self.data[3][1];
        const b10 = self.data[2][1] * self.data[3][3] - self.data[2][3] * self.data[3][1];
        const b11 = self.data[2][2] * self.data[3][3] - self.data[2][3] * self.data[3][2];

        const invDet = 1.0 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);

        var res: Mat4 = undefined;
        res.data[0][0] = (self.data[1][1] * b11 - self.data[1][2] * b10 + self.data[1][3] * b09) * invDet;
        res.data[0][1] = (-self.data[0][1] * b11 + self.data[0][2] * b10 - self.data[0][3] * b09) * invDet;
        res.data[0][2] = (self.data[3][1] * b05 - self.data[3][2] * b04 + self.data[3][3] * b03) * invDet;
        res.data[0][3] = (-self.data[2][1] * b05 + self.data[2][2] * b04 - self.data[2][3] * b03) * invDet;
        res.data[1][0] = (-self.data[1][0] * b11 + self.data[1][2] * b08 - self.data[1][3] * b07) * invDet;
        res.data[1][1] = (self.data[0][0] * b11 - self.data[0][2] * b08 + self.data[0][3] * b07) * invDet;
        res.data[1][2] = (-self.data[3][0] * b05 + self.data[3][2] * b02 - self.data[3][3] * b01) * invDet;
        res.data[1][3] = (self.data[2][0] * b05 - self.data[2][2] * b02 + self.data[2][3] * b01) * invDet;
        res.data[2][0] = (self.data[1][0] * b10 - self.data[1][1] * b08 + self.data[1][3] * b06) * invDet;
        res.data[2][1] = (-self.data[0][0] * b10 + self.data[0][1] * b08 - self.data[0][3] * b06) * invDet;
        res.data[2][2] = (self.data[3][0] * b04 - self.data[3][1] * b02 + self.data[3][3] * b00) * invDet;
        res.data[2][3] = (-self.data[2][0] * b04 + self.data[2][1] * b02 - self.data[2][3] * b00) * invDet;
        res.data[3][0] = (-self.data[1][0] * b09 + self.data[1][1] * b07 - self.data[1][2] * b06) * invDet;
        res.data[3][1] = (self.data[0][0] * b09 - self.data[0][1] * b07 + self.data[0][2] * b06) * invDet;
        res.data[3][2] = (-self.data[3][0] * b03 + self.data[3][1] * b01 - self.data[3][2] * b00) * invDet;
        res.data[3][3] = (self.data[2][0] * b03 - self.data[2][1] * b01 + self.data[2][2] * b00) * invDet;

        return res;
    }

    pub const PerspectiveConfig = struct {
        near: f32 = 0.01,
        far: f32 = 1000.0,
        width: f32,
        height: f32,
    };

    pub fn perspective(cfg: PerspectiveConfig) Mat4 {
        const d = cfg.near - cfg.far;
        const c1 = (cfg.far + cfg.near) / d;
        const c2 = (2.0 * cfg.far * cfg.near) / d;

        const sx = @max(1.0, cfg.height / cfg.width);
        const sy = @max(1.0, cfg.width / cfg.height);

        return Mat4.init(.{
            .{ sx, 0, 0, 0 },
            .{ 0, sy, 0, 0 },
            .{ 0, 0, c1, c2 },
            .{ 0, 0, -1, 0 },
        });
    }

    pub fn translate(x: f32, y: f32, z: f32) Mat4 {
        return Mat4.init(.{
            .{ 1, 0, 0, x },
            .{ 0, 1, 0, y },
            .{ 0, 0, 1, z },
            .{ 0, 0, 0, 1 },
        });
    }

    pub fn scale(x: f32, y: f32, z: f32) Mat4 {
        return Mat4.init(.{
            .{ x, 0, 0, 0 },
            .{ 0, y, 0, 0 },
            .{ 0, 0, z, 0 },
            .{ 0, 0, 0, 1 },
        });
    }

    pub fn rotateX(angle: f32) Mat4 {
        const c = @cos(angle);
        const s = @sin(angle);
        return Mat4.init(.{
            .{ 1, 0, 0, 0 },
            .{ 0, c, -s, 0 },
            .{ 0, s, c, 0 },
            .{ 0, 0, 0, 1 },
        });
    }

    pub fn rotateY(angle: f32) Mat4 {
        const c = @cos(angle);
        const s = @sin(angle);
        return Mat4.init(.{
            .{ c, 0, -s, 0 },
            .{ 0, 1, 0, 0 },
            .{ s, 0, c, 0 },
            .{ 0, 0, 0, 1 },
        });
    }

    pub fn rotateZ(angle: f32) Mat4 {
        const c = @cos(angle);
        const s = @sin(angle);
        return Mat4.init(.{
            .{ c, -s, 0, 0 },
            .{ s, c, 0, 0 },
            .{ 0, 0, 1, 0 },
            .{ 0, 0, 0, 1 },
        });
    }
};