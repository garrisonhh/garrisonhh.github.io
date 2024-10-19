const std = @import("std");
const Allocator = std.mem.Allocator;
const la = @import("linalg.zig");

export fn runtimeAlloc(nbytes: usize) ?[*]u8 {
    const slice = std.heap.wasm_allocator.alloc(u8, nbytes) catch {
        return null;
    };
    return slice.ptr;
}

export fn runtimeFree(ptr: [*]const u8, nbytes: usize) void {
    std.heap.wasm_allocator.free(ptr[0..nbytes]);
}

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
    extern fn getEvents(len: *usize) [*]const u8;

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

    extern fn addBatchedText(text: [*]const u8, text_len: usize, mvp: *const [16]f32) void;
    extern fn drawBatchedText() void;
};

pub fn getResolution() [2]f32 {
    var out: [2]f32 = undefined;
    env.getResolution(&out);
    return out;
}

/// tracks state of user input
pub const Input = struct {
    const Self = @This();

    pub const KeyState = enum {
        up,
        pressed,
        down,
        released,
    };

    const KeypressMap = std.EnumArray(Key, KeyState);

    mouse_pos: [2]f32 = .{ 0, 0 },
    clicked: bool = false,
    keystates: KeypressMap = KeypressMap.initFill(.up),

    pub const Key = enum {
        left,
        right,
        soft_drop,
        hard_drop,
    };

    const Event = union(enum) {
        mousemove: [2]f32,
        click: u32,
        keydown: Key,
        keyup: Key,
    };

    fn tick(self: *Self) void {
        self.clicked = false;

        for (std.enums.values(Key)) |key| {
            self.keystates.set(key, switch (self.keystates.get(key)) {
                .up, .released => .up,
                .down, .pressed => .down,
            });
        }
    }

    fn on(self: *Self, event: Event) void {
        switch (event) {
            .mousemove => |pos| {
                self.mouse_pos = pos;
            },
            .click => |button| {
                if (button == 0) {
                    self.clicked = true;
                }
            },
            .keydown => |key| {
                self.keystates.set(key, .pressed);
            },
            .keyup => |key| {
                self.keystates.set(key, .released);
            },
        }
    }

    /// should be called every frame
    pub fn poll(self: *Self) void {
        self.tick();

        var len: usize = undefined;
        const ptr = env.getEvents(&len);
        const events_json = ptr[0..len];

        const events = must(std.json.parseFromSlice(
            []const Event,
            std.heap.wasm_allocator,
            events_json,
            .{},
        ));
        defer events.deinit();

        for (events.value) |event| {
            self.on(event);
        }
    }

    /// query state of a key
    pub fn isKey(self: *const Self, key: Key, query: KeyState) bool {
        const state = self.keystates.get(key);
        return switch (query) {
            .up => state == .up or state == .released,
            .down => state == .down or state == .pressed,
            .released => state == query,
        };
    }
};

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

pub fn drawMeshAdvanced(mesh: Mesh, matNormal: la.Mat4, mvp: la.Mat4, color: la.Vec3) void {
    env.drawMesh(mesh, matNormal.ptr(), mvp.ptr(), color.ptr());
}

pub fn drawMesh(
    mesh: Mesh,
    matModel: la.Mat4,
    matView: la.Mat4,
    matProjection: la.Mat4,
    color: la.Vec3,
) void {
    const matModelView = matView.mul(la.Mat4, matModel);
    const matNormal = la.mat4.invert(matModelView).transpose();
    const mvp = matProjection.mul(la.Mat4, matModelView);
    drawMeshAdvanced(mesh, matNormal, mvp, color);
}

pub fn addBatchedText(text: []const u8, mvp: la.Mat4) void {
    env.addBatchedText(text.ptr, text.len, mvp.ptr());
}

pub fn drawBatchedText() void {
    env.drawBatchedText();
}
