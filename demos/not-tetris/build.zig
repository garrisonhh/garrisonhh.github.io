const std = @import("std");
const builtin = @import("builtin");

pub fn build(b: *std.build.Builder) void {
    const mode = b.standardReleaseOptions();

    // version lock
    comptime {
        const desired = try std.SemanticVersion.parse("0.10.1");
        const version = builtin.zig_version;
        if (version.order(desired).compare(.neq)) {
            const msg = std.fmt.comptimePrint(
                "expected zig version {}, found {}",
                .{ desired, version },
            );
            @compileError(msg);
        }
    }

    // wasm target
    const wasm = std.zig.CrossTarget{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
        .ofmt = .wasm,
    };

    const target = b.standardTargetOptions(.{
        .whitelist = &.{wasm},
        .default_target = wasm,
    });

    // build steps
    const lib = b.addSharedLibrary("not-tetris", "src/main.zig", .unversioned);
    lib.setBuildMode(mode);
    lib.setTarget(target);
    lib.install();
}
