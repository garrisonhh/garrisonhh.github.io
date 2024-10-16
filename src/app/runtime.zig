const std = @import("std");
const la = @import("linalg.zig");

/// utility function when an error should crash
pub fn must(x: anytype) t: {
    const T = @TypeOf(x);
    const info = @typeInfo(T);
    if (info != .ErrorUnion) {
        @compileError("must expects an error union, found " ++ @typeName(T));
    }
    break :t info.ErrorUnion.payload;
} {
    return x catch |e| {
        print("error: {s}", .{@errorName(e)});
        unreachable;
    };
}

pub const BackgroundShader = enum(u32) { _ };
pub const Mesh = enum(u32) { _ };

const env = struct {
    extern fn getResolution(out: *[2]f32) void;

    extern fn print(ptr: [*]const u8, len: usize) void;

    extern fn loadBackground(frag_source: [*]const u8, frag_len: usize) i32;
    extern fn drawBackground(shader: BackgroundShader, ts: f32) void;

    extern fn loadMesh(obj_source: [*]const u8, obj_len: usize) i32;
    extern fn drawMesh(
        mesh: Mesh,
        matNormal: *const [16]f32,
        mvp: *const [16]f32,
        color: *const [3]f32,
    ) void;
};

pub fn getResolution() [2]f32 {
    var out: [2]f32 = undefined;
    env.getResolution(&out);
    return out;
}

/// debug print to browser console
pub fn print(comptime fmt: []const u8, args: anytype) void {
    var buf: [1024]u8 = undefined;
    const str = std.fmt.bufPrint(&buf, fmt, args) catch {
        const msg = "<print function overflow>";
        env.print(msg, msg.len);
        return;
    };

    env.print(str.ptr, str.len);
}

pub const LoadShaderError = error{LoadShaderFailure};

pub fn loadBackground(frag: []const u8) LoadShaderError!BackgroundShader {
    const res = env.loadBackground(frag.ptr, frag.len);
    if (res < 0) return error.LoadShaderFailure;
    return @enumFromInt(res);
}

pub fn drawBackground(shader: BackgroundShader, ts: f32) void {
    env.drawBackground(shader, ts);
}

pub const LoadMeshError = error{LoadMeshFailure};

pub fn loadMesh(obj: []const u8) LoadMeshError!Mesh {
    const res = env.loadMesh(obj.ptr, obj.len);
    if (res < 0) return error.LoadMeshFailure;
    return @enumFromInt(res);
}

pub fn drawMesh(mesh: Mesh, matNormal: la.Mat4, mvp: la.Mat4, color: la.Vec3) void {
    env.drawMesh(mesh, matNormal.ptr(), mvp.ptr(), color.ptr());
}
