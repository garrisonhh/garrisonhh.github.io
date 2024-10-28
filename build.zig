const std = @import("std");

fn addApp(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    runtime: *std.Build.Module,
    name: []const u8,
    root: std.Build.LazyPath,
) void {
    const app = b.addExecutable(.{
        .name = name,
        .root_source_file = root,
        .target = target,
        .optimize = optimize,
    });
    app.root_module.addImport("runtime", runtime);
    app.rdynamic = true;
    app.export_memory = true;
    app.entry = .disabled;

    const install_app = b.addInstallArtifact(app, .{
        .dest_dir = .{ .override = .lib },
    });
    b.getInstallStep().dependOn(&install_app.step);
}

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });
    const optimize = std.builtin.OptimizeMode.ReleaseSmall;

    const runtime = b.createModule(.{
        .root_source_file = b.path("src/runtime/runtime.zig"),
        .target = target,
        .optimize = optimize,
    });

    addApp(b, target, optimize, runtime, "index", b.path("src/index/root.zig"));
    addApp(b, target, optimize, runtime, "tetris", b.path("src/tetris/root.zig"));

    const install_site = b.addInstallDirectory(.{
        .source_dir = b.path("src/www"),
        .install_dir = .prefix,
        .install_subdir = "",
    });
    b.getInstallStep().dependOn(&install_site.step);
}
