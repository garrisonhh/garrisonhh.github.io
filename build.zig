const std = @import("std");

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

    const tetris = b.addExecutable(.{
        .name = "tetris",
        .root_source_file = b.path("src/tetris/root.zig"),
        .target = target,
        .optimize = optimize,
    });
    tetris.root_module.addImport("runtime", runtime);
    tetris.rdynamic = true;
    tetris.export_memory = true;
    tetris.entry = .disabled;

    const install = b.getInstallStep();

    const isntall_tetris = b.addInstallArtifact(tetris, .{
        .dest_dir = .{ .override = .lib },
    });
    install.dependOn(&isntall_tetris.step);

    const install_site = b.addInstallDirectory(.{
        .source_dir = b.path("src/www"),
        .install_dir = .prefix,
        .install_subdir = "",
    });
    install.dependOn(&install_site.step);
}
