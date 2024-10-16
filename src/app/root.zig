const std = @import("std");
const rt = @import("runtime.zig");

var bg: rt.BackgroundShader = undefined;

export fn init() void {
    rt.print("hello, web!", .{});

    bg = rt.must(rt.loadBackground(@embedFile("shaders/bg.frag")));
}

export fn loop(ts: f32) void {
    _ = ts;

    rt.drawBackground(bg);
}
