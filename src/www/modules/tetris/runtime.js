function wasmStrlen(cart, addr) {
    const memory = cart.exports.memory;
    const view = new DataView(memory.buffer);

    // get cstr len
    let len = 0;
    while (view.getUint8(addr + len) !== 0) {
        len++;
    }

    return len;
}

function wasmAlloc(cart, nbytes) {
    const addr = cart.exports.alloc(nbytes);

    if (addr < 0) {
        throw new Error("wasm OOM");
    }

    return addr;
}

// loads a js string from a wasm c string
function readString(cart, addr) {
    const mem = cart.exports.memory;
    const len = wasmStrlen(cart, addr);

    const buf = new Uint8Array(mem.buffer, addr, len);
    const str = new TextDecoder().decode(buf);

    return str;
}

// allocate and write a wasm c string
function dupeString(cart, str) {
    const mem = cart.exports.memory;
    const src = new TextEncoder().encode(str);

    const addr = wasmAlloc(cart, src.length + 1);

    new Uint8Array(mem.buffer, addr, src.length).set(src);
    new DataView(mem.buffer, addr).setUint8(src.length, 0);

    return addr;
}

// free a wasm c string
function freeString(cart, addr) {
    const str = readString(cart, addr);
    const len = new TextEncoder().encode(str).length + 1;

    cart.exports.free(addr, len);
}

// loads json from wasm c string
function readJSON(cart, addr) {
    return JSON.parse(readString(cart, addr));
}

/** @returns {Promise<WebAssembly.Instance>} */
async function initWASM() {
    const memory = new WebAssembly.Memory({
        initial: 10,
        maximum: 100,
        shared: true,
    });

    const path = "/bin/tetris.wasm";
    const src = await WebAssembly.instantiateStreaming(fetch(path), {
        js: { mem: memory },
    });

    return src.instance;
}

const CONTROLS = new Map(Object.entries({
    "Escape": "pause",
    "ArrowLeft": "left",
    "ArrowRight": "right",
    "ArrowUp": "clockwise",
    "z": "counterclockwise",
    "x": "clockwise",
    " ": "hard_drop",
}));

/**
 * @typedef {Object} Tetris
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Tetris>}
 */
export async function setupGame(canvas) {
    const tetris = {
        cart: await initWASM(),
        eventQueue: [],
    };

    tetris.cart.exports.init(BigInt(Date.now()));

    canvas.addEventListener('click', (ev) => {
        // only active on left click
        if (ev.button != 0) return;

        const canvasX = canvas.offsetLeft + canvas.clientLeft;
        const canvasY = canvas.offsetTop + canvas.clientTop;

        const event = {
            type: "click",
            x: ev.pageX - canvasX,
            y: ev.pageY - canvasY,
        };

        tetris.eventQueue.push(event);
    }, false);

    addEventListener('keydown', (ev) => {
        const key = CONTROLS.get(ev.key);
        if (key === undefined) return;

        const event = { type: "keydown", key };
        tetris.eventQueue.push(event);
    }, false);

    return tetris;
}

/**
 * @param {Tetris} tetris
 * @param {DOMHighResTimeStamp} ts
 * @returns {Object}
 */
export function updateGame(tetris, ts) {
    const {cart, eventQueue} = tetris;

    const inputStr = JSON.stringify(eventQueue);
    eventQueue.length = 0;

    const delta_ms = 16.6667; // TODO actually calculate

    const input = dupeString(cart, inputStr);
    const strAddr = cart.exports.update(delta_ms, input);
    const output = readJSON(cart, strAddr);
    freeString(cart, input);

    switch (output.type) {
        case "error":
            const err = new Error(obj.message);
            err.name = "error in cart";
            throw err;
        case "success":
            return output;
    }
}
