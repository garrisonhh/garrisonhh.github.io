const rt = @import("runtime");

var bg: rt.BackgroundShader = undefined;

export fn init() void {
    bg = rt.must(rt.loadBackground(@embedFile("bg.frag")));
}

export fn loop(ts: f32) void {
    rt.drawBackground(bg, ts);
}
