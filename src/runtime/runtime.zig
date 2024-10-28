const std = @import("std");
const Allocator = std.mem.Allocator;
const la = @import("linalg.zig");

const runtime = @This();

pub const Matrix = la.Matrix;
pub const Mat4 = la.Mat4;
pub const Vec2 = la.Vec2;
pub const Vec3 = la.Vec3;
pub const Vec4 = la.Vec4;
pub const mat4 = la.mat4;
pub const vec2 = la.vec2;
pub const vec3 = la.vec3;
pub const vec4 = la.vec4;

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
        mat_normal: *const [16]f32,
        mvp: *const [16]f32,
        color: *const [3]f32,
    ) void;

    extern fn measureText(
        text: [*]const u8,
        text_len: usize,
        out_rect: *[4]f32,
    ) void;
    extern fn addBatchedText(
        text: [*]const u8,
        text_len: usize,
        mvp: *const [16]f32,
        color: *const [3]f32,
    ) void;
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

pub fn drawMeshAdvanced(mesh: Mesh, mat_normal: la.Mat4, mvp: la.Mat4, color: la.Vec3) void {
    env.drawMesh(mesh, mat_normal.ptr(), mvp.ptr(), color.ptr());
}

pub fn drawMesh(
    mesh: Mesh,
    mat_model: la.Mat4,
    mat_view: la.Mat4,
    mat_projection: la.Mat4,
    color: la.Vec3,
) void {
    const mat_model_view = mat_view.mul(la.Mat4, mat_model);
    const mat_normal = la.mat4.invert(mat_model_view).transpose();
    const mvp = mat_projection.mul(la.Mat4, mat_model_view);
    drawMeshAdvanced(mesh, mat_normal, mvp, color);
}

pub const TextOptions = struct {
    alignment: enum { left, center, right } = .center,
    vert_alignment: enum { top, center, bottom } = .center,
    color: la.Vec3 = la.vec3(1.0, 1.0, 1.0),
};

pub const Rect = extern struct {
    x: f32,
    y: f32,
    width: f32,
    height: f32,
};

pub fn measureText(text: []const u8, opts: TextOptions) Rect {
    var rect: Rect = undefined;
    env.measureText(text.ptr, text.len, @ptrCast(&rect));

    const x_offset = switch (opts.alignment) {
        .left => 0,
        .center => -rect.width / 2.0,
        .right => -rect.width,
    };
    const y_offset = switch (opts.vert_alignment) {
        .top => 0,
        .center => -rect.height / 2.0,
        .bottom => -rect.height,
    };

    return Rect{
        .x = rect.x + x_offset,
        .y = rect.y + y_offset,
        .width = rect.width,
        .height = rect.height,
    };
}

pub fn addBatchedText(text: []const u8, mvp: la.Mat4, color: la.Vec3) void {
    env.addBatchedText(text.ptr, text.len, mvp.ptr(), color.ptr());
}

pub fn drawBatchedText() void {
    env.drawBatchedText();
}

pub const Camera = struct {
    const Self = @This();

    pos: la.Vec3,
    target: la.Vec3,
    z_near: f32,
    z_far: f32,
    resolution: [2]f32,
    mat_view: la.Mat4,
    mat_proj: la.Mat4,

    pub fn init(pos: la.Vec3, target: la.Vec3) Self {
        const z_near = 0.01;
        const z_far = 100.0;
        const resolution = getResolution();

        // TODO fix this
        const diff = pos.sub(target);
        const rot_y = std.math.atan2(diff.data[0][0], diff.data[0][2]);
        const diff2 = la.mat4.transform(la.mat4.rotateY(rot_y), pos).sub(target);
        const rot_x = std.math.atan2(diff2.data[0][1], diff2.data[0][2]);

        const mat_view = la.Mat4.chain(&.{
            la.mat4.rotateY(rot_y),
            la.mat4.rotateX(rot_x),
            la.mat4.translate(pos.negate()),
        });
        const mat_proj = la.mat4.perspective(.{
            .near = z_near,
            .far = z_far,
            .width = resolution[0],
            .height = resolution[1],
        });

        return Self{
            .pos = pos,
            .target = target,
            .z_near = z_near,
            .z_far = z_far,
            .resolution = resolution,
            .mat_view = mat_view,
            .mat_proj = mat_proj,
        };
    }

    pub fn updateResolution(self: *Self) void {
        const cur = getResolution();
        if (cur[0] == self.resolution[0] and cur[1] == self.resolution[1]) {
            return;
        }
        self.* = init(self.pos, self.target);
    }

    pub fn computeMatNormal(self: Self, mat_model: la.Mat4) la.Mat4 {
        const mat_model_view = self.mat_view.mul(la.Mat4, mat_model);
        return la.mat4.invert(mat_model_view).transpose();
    }

    pub fn computeMvp(self: Self, mat_model: la.Mat4) la.Mat4 {
        return la.Mat4.chain(&.{ self.mat_proj, self.mat_view, mat_model });
    }

    pub fn drawMesh(self: Self, mesh: Mesh, mat_model: la.Mat4, color: la.Vec3) void {
        runtime.drawMesh(mesh, mat_model, self.mat_view, self.mat_proj, color);
    }

    /// adds text with some formatting and returns rendered text rect in model
    /// space
    pub fn addBatchedText(
        self: Self,
        text: []const u8,
        mat_model: la.Mat4,
        opts: TextOptions,
    ) Rect {
        const rect = measureText(text, opts);

        const mvp = la.Mat4.chain(&.{
            self.mat_proj,
            self.mat_view,
            mat_model,
            la.mat4.translate(la.vec3(rect.x, rect.y + rect.height, 0.0)),
        });
        runtime.addBatchedText(text, mvp, opts.color);

        return rect;
    }

    pub fn pixelScreenspacePos(self: Self, pixel: [2]f32) la.Vec3 {
        const screen_pos = la.vec3(
            (pixel[0] * 2.0 / self.resolution[0] - 1.0),
            -(pixel[1] * 2.0 / self.resolution[1] - 1.0),
            1.0,
        );

        return screen_pos;
    }

    pub fn pixelRay(self: Self, mat_model: la.Mat4, pixel: [2]f32) la.Vec3 {
        const inv_proj = la.mat4.invert(self.mat_proj);
        const inv_mv = la.mat4.invert(self.mat_view.mul(la.Mat4, mat_model));
        const screen_pos = self.pixelScreenspacePos(pixel);
        const view_dir =
            inv_proj.mul(la.Vec4, screen_pos.expandVec(4, .{1.0}))
            .shrinkVec(3)
            .normalize();
        const model_dir =
            inv_mv.mul(la.Vec4, view_dir.expandVec(4, .{0.0}))
            .shrinkVec(3)
            .normalize();

        return model_dir;
    }

    /// check if pixel is within a rect on the 2d plane towards +X, +Y
    /// useful for clicking on or hovering over text
    pub fn pixelCollidesWithRect(
        self: Self,
        mat_model: la.Mat4,
        rect: Rect,
        pixel: [2]f32,
    ) bool {
        const ray_dir = self.pixelRay(mat_model, pixel);
        const ray_pos = la.mat4.transform(la.mat4.invert(mat_model), self.pos);
        const pos = ray_pos.sub(ray_dir.mulScalar(ray_pos.data[0][2] / ray_dir.data[0][2]));

        if (@abs(pos.data[0][2]) > 0.0001) {
            @panic("FUCK math is broken");
        }

        const mx = pos.data[0][0];
        const my = pos.data[0][1];
        return mx > rect.x and mx < rect.x + rect.width and
            my > rect.y and my < rect.y + rect.height;
    }
};
