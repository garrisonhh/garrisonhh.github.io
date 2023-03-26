//! the wasm interface and event loop

const std = @import("std");
const Allocator = std.mem.Allocator;
const Tetris = @import("tetris.zig");

var tetris: Tetris = undefined;

pub const Event = union(enum) {
    const Self = @This();

    const Key = enum {
        pause,
        rotate_left,
        rotate_right,
    };

    click: @Vector(2, usize),
    keypress: Key,

    const DecodeError =
        Allocator.Error ||
        std.json.TokenStream.Error ||
        error{ InvalidLiteral, InvalidCharacter, MalformedEvents };

    fn getJsValue(
        value: std.json.Value,
        comptime tag: std.meta.Tag(std.json.Value),
    ) DecodeError!std.meta.fieldInfo(std.json.Value, tag).field_type {
        switch (value) {
            inline else => |data, active| {
                return if (active != tag) DecodeError.MalformedEvents else data;
            },
        }
    }

    fn getJsField(
        value: std.json.Value,
        key: []const u8,
        comptime tag: std.meta.Tag(std.json.Value),
    ) DecodeError!std.meta.fieldInfo(std.json.Value, tag).field_type {
        const map = try getJsValue(value, .Object);
        const val = map.get(key) orelse {
            return DecodeError.MalformedEvents;
        };

        return getJsValue(val, tag);
    }

    fn decodeJsValue(value: std.json.Value) DecodeError!Self {
        const ty = try getJsField(value, "type", .String);

        if (std.mem.eql(u8, ty, "click")) {
            const x = try getJsField(value, "x", .Integer);
            const y = try getJsField(value, "y", .Integer);
            return Self{ .click = .{ @intCast(usize, x), @intCast(usize, y) } };
        } else if (std.mem.eql(u8, ty, "keypress")) {
            const keyname = try getJsField(value, "key", .String);
            const key = std.meta.stringToEnum(Key, keyname) orelse {
                return DecodeError.MalformedEvents;
            };
            return Self{ .keypress = key };
        }

        return DecodeError.MalformedEvents;
    }

    fn decodeArray(ally: Allocator, json: []const u8) DecodeError![]Self {
        var parser = std.json.Parser.init(ally, false);
        defer parser.deinit();

        const tree = try parser.parse(json);

        // decode each object
        const values = (try getJsValue(tree.root, .Array)).items;
        const events = try ally.alloc(Self, values.len);
        for (values) |value, i| {
            events[i] = try decodeJsValue(value);
        }

        return events;
    }
};

const Response = union(enum) {
    const Self = @This();

    success,
    err: anyerror,

    var res_buf: [1024]u8 = undefined;

    fn print(comptime fmt: []const u8, args: anytype) [*:0]const u8 {
        const slice = std.fmt.bufPrintZ(
            &res_buf,
            fmt,
            args,
        ) catch |e| {
            const res = Response{ .err = e };
            return res.into();
        };

        return slice.ptr;
    }

    fn into(self: Self) [*:0]const u8 {
        return switch (self) {
            .err => |err| print(
                "{{\"type\": \"error\", \"message\": \"{s}\"}}",
                .{@errorName(err)},
            ),
            .success => print(
                "{{\"type\": \"success\", \"tetris\": \"{s}\"}}",
                .{@as([]const u8, &tetris.serialize())},
            ),
        };
    }
};

// exported ====================================================================

export fn alloc(nbytes: usize) ?[*]u8 {
    const ally = std.heap.page_allocator;

    const slice = ally.alloc(u8, nbytes) catch {
        return null;
    };
    return slice.ptr;
}

export fn free(ptr: [*]const u8, len: usize) void {
    const ally = std.heap.page_allocator;

    ally.free(ptr[0..len]);
}

export fn init(rng_seed: u64) void {
    tetris = Tetris.init(rng_seed);
}

/// called every real-time tick
///
/// receives delta time since last tick and events as json, returns json data
/// representing game state.
export fn update(delta_ms: usize, events_json: [*:0]const u8) [*:0]const u8 {
    const ally = std.heap.page_allocator;

    _ = delta_ms;

    const json_len = std.mem.len(events_json);
    const events = Event.decodeArray(ally, events_json[0..json_len]) catch |e| {
        return (Response{ .err = e }).into();
    };
    defer ally.free(events);

    return (Response{ .success = {} }).into();
}
