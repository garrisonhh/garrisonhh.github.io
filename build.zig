const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    const tetris = b.addExecutable(.{
        .name = "tetris",
        .root_source_file = b.path("src/tetris/main.zig"),
        .target = target,
        .optimize = .ReleaseSmall,
    });
    tetris.rdynamic = true;
    tetris.export_memory = true;
    tetris.entry = .disabled;

    const install_tetris = b.addInstallArtifact(tetris, .{
        .dest_dir = .{ .override = .bin },
    });
    b.getInstallStep().dependOn(&install_tetris.step);

    const install_site = b.addInstallDirectory(.{
        .source_dir = b.path("src/www"),
        .install_dir = .prefix,
        .install_subdir = "",
    });
    b.getInstallStep().dependOn(&install_site.step);
}
