const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    const wasm = b.addExecutable(.{
        .name = "app",
        .root_source_file = b.path("src/app/root.zig"),
        .target = target,
        .optimize = .ReleaseSmall,
    });
    wasm.rdynamic = true;
    wasm.export_memory = true;
    wasm.entry = .disabled;

    const install_wasm = b.addInstallArtifact(wasm, .{
        .dest_dir = .{ .override = .lib },
    });
    b.getInstallStep().dependOn(&install_wasm.step);

    const install_site = b.addInstallDirectory(.{
        .source_dir = b.path("src/www"),
        .install_dir = .prefix,
        .install_subdir = "",
    });
    b.getInstallStep().dependOn(&install_site.step);
}
