// wasm interaction ============================================================

async function initWASM() {
  const memory = new WebAssembly.Memory({
    initial: 10,
    maximum: 100,
    shared: true,
  });

  const path = "not-tetris/not-tetris.wasm";
  const src = await WebAssembly.instantiateStreaming(fetch(path), {
    js: { mem: memory },
  });

  return src.instance;
}

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
  const array = new TextEncoder().encode(str);

  cart.exports.free(addr, array.len + 1);
}

// loads json from wasm c string
function readJSON(cart, addr) {
  return JSON.parse(readString(cart, addr));
}

// events ======================================================================

const eventQueue = [];

let canvas = undefined;
let ctx = undefined;

// drawing consts
const CELL_SIZE = 20;

const COLORS = new Map(Object.entries({
  ' ': 'rgb(25, 25, 25)',
  'I': 'rgb(0, 240, 240)',
  'J': 'rgb(0, 0, 240)',
  'L': 'rgb(221, 164, 34)',
  'O': 'rgb(241, 239, 47)',
  'S': 'rgb(138, 234, 40)',
  'T': 'rgb(136, 44, 237)',
  'Z': 'rgb(207, 54, 22)',
}));

const CONTROLS = new Map(Object.entries({
  "Escape": "pause",
  "ArrowLeft": "left",
  "ArrowRight": "right",
  "ArrowUp": "clockwise",
  "z": "counterclockwise",
  "x": "clockwise",
}));

// draw a cell at a canvas position
function drawCell(mino, x, y) {
  ctx.fillStyle = COLORS.get(mino);
  ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
}

// takes serialized tetris board and draws it to the canvas
function draw(paused, serialized) {
  // clear canvas with an obnoxious pink
  ctx.fillStyle = '#F0A';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // draw board
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 10; x++) {
      const rx = x * CELL_SIZE;
      const ry = y * CELL_SIZE;
      drawCell(serialized[y * 10 + x], rx, ry);
    }
  }

  // draw next shapes (TODO)

  // pause overlay
  if (paused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw pause text in the center of the screen
    const pauseText = 'paused';
    const measure = ctx.measureText(pauseText);

    const pauseW = measure.width;
    const pauseH = measure.actualBoundingBoxAscent;
    const pauseX = (canvas.width - pauseW) / 2;
    const pauseY = (canvas.height - pauseH) / 2;

    ctx.fillStyle = 'white';
    ctx.fillText(pauseText, pauseX, pauseY);
  }
}

addEventListener('load', () => {
  canvas = document.querySelector('#game')
  canvas.width = 10 * CELL_SIZE;
  canvas.height = 20 * CELL_SIZE;

  ctx = canvas.getContext('2d');
  ctx.font = '20px sans-serif';

  const canvasX = canvas.offsetLeft + canvas.clientLeft;
  const canvasY = canvas.offsetTop + canvas.clientTop;

  // controls
  canvas.addEventListener('click', (ev) => {
    // only active on left click
    if (ev.button != 0) return;

    const event = {
      type: "click",
      x: ev.pageX - canvasX,
      y: ev.pageY - canvasY,
    };
    console.log("click:", event);

    eventQueue.push(event);
  }, false);

  addEventListener('keydown', (ev) => {
    const key = CONTROLS.get(ev.key);
    if (key === undefined) return;

    const event = { type: "keydown", key };
    console.log("keydown:", event);

    eventQueue.push(event);
  }, false);
});

// game lifetime ===============================================================

// call update function and act on json results
function update(cart, delta_ms) {
  // encode input
  const inputStr = JSON.stringify(eventQueue);
  eventQueue.length = 0;

  const input = dupeString(cart, inputStr);

  // call update and read response
  const strAddr = cart.exports.update(delta_ms, input);
  const obj = readJSON(cart, strAddr);
  freeString(cart, input);

  // show json in debug info (TODO remove)
  const debugging = document.querySelector('#debugging');
  debugging.innerText = JSON.stringify(obj, undefined, 2);

  // act on response
  switch (obj.type) {
    case "error":
      const err = new Error(obj.message);
      err.name = "error in cart";
      throw err;
    case "success":
      let { paused, tetris } = obj;
      draw(paused, tetris);
      break;
  }
}

function startGame(cart) {
  cart.exports.init(BigInt(Date.now()));

  let prevTs = undefined;
  const loop = (ts) => {
    if (prevTs === undefined) {
      prevTs = ts;
    }

    const delta_ms = prevTs - ts;
    update(cart, delta_ms);

    prevTs = ts;
    window.requestAnimationFrame(loop);
  };

  window.requestAnimationFrame(loop);
}

addEventListener('load', () => {
  initWASM().then((instance) => startGame(instance));
});