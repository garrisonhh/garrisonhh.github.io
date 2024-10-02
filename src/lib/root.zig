const std = @import("std");

const env = struct {
    extern fn logFn(level: i32, ptr: [*]const u8, len: usize) void;
};

fn logFn(
    comptime level: std.log.Level,
    comptime scope: @TypeOf(.enum_literal),
    comptime format: []const u8,
    args: anytype,
) void {
    var buf: [1024]u8 = undefined;
    if (std.fmt.bufPrint(&buf, "({s}) " ++ format, .{@tagName(scope)} ++ args)) |str| {
        env.logFn(@intFromEnum(level), str.ptr, str.len);
    } else |_| {
        const msg = "<log message overflowed internal buffer>";
        env.logFn(@intFromEnum(level), msg.ptr, msg.len);
    }
}

pub const std_options = .{
    .log_level = .debug,
    .logFn = logFn,
};

const log = std.log.scoped(.lib);

export fn add(a: f32, b: f32) f32 {
    log.info("add({d}, {d})", .{ a, b });
    return a + b;
}
