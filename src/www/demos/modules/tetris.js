import * as utils from './utils.js';
import { Mat4 } from './matrix.js';
import * as parseObj from './parseObj.js';

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
async function setupGame(canvas) {
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
        console.log("click:", event);

        tetris.eventQueue.push(event);
    }, false);

    addEventListener('keydown', (ev) => {
        const key = CONTROLS.get(ev.key);
        if (key === undefined) return;

        const event = { type: "keydown", key };
        console.log("keydown:", event);

        tetris.eventQueue.push(event);
    }, false);

    return tetris;
}

/**
 * @param {Tetris} tetris
 * @param {DOMHighResTimeStamp} ts
 * @returns {Object}
 */
function updateGame(tetris, ts) {
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

/**
 * @typedef {Object} TetrisContext
 * @property {WebGL2RenderingContext} gl
 * @property {Tetris} tetris
 * @property {utils.Shader} shader
 * @property {Mesh} mesh
 * @property {number} offsetBuffer
 *
 * @param {TetrisContext} ctx
 * @param {DOMHighResTimeStamp} ts
 */
function tetrisLoop(ctx, ts) {
    const gl = ctx.gl;

    const res = updateGame(ctx.tetris, ts);
    console.log(res.board);

    const blocks = [];
    {
        const h = 20;
        const w = 10;
        for (let y = 0; y < h; ++y) {
            for (let x = 0; x < w; ++x) {
                if (res.board[y * w + x] != ' ') {
                    blocks.push([(-w / 2.0) + x, (h / 2.0) - y, 0.0]);
                }
            }
        }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, ctx.offsetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(blocks.flat()), gl.DYNAMIC_DRAW);
    const aOffsetLoc = ctx.shader.attributes.get('aOffset');
    gl.enableVertexAttribArray(aOffsetLoc);
    gl.vertexAttribPointer(aOffsetLoc, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aOffsetLoc, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(ctx.shader.program);

    const matModel = Mat4.chain(
        Mat4.scale(0.5, 0.5, 0.5),
    );
    const matView = Mat4.chain(
        Mat4.translate(0.0, -1.0, 5.0),
        Mat4.rotateX(-Math.PI / 16.0),
    );
    const matProjection = Mat4.perspective({
        near: 0.01,
        far: 100.0,
        width: gl.canvas.width,
        height: gl.canvas.height,
    });

    const matNormal = Mat4.invert(matView.mul(matModel)).transpose();
    const mvp = Mat4.chain(matProjection, matView, matModel);

    gl.uniformMatrix4fv(ctx.shader.uniforms.get('matNormal'), false, new Float32Array(matNormal.data));
    gl.uniformMatrix4fv(ctx.shader.uniforms.get('mvp'), false, new Float32Array(mvp.data));
    gl.uniform3f(ctx.shader.uniforms.get('color'), ...[0.9, 0.7, 0.1]);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, ctx.mesh.model.faces.length * 3, blocks.length);
}

/**
 * @typedef {Object} Mesh
 * @property {parseObj.Model} model
 *
 * @param {WebGL2RenderingContext} gl
 * @param {utils.ShaderAttrs} attrs
 * @param {string} objText
 * @returns {Mesh}
 */
function loadMinoBlock(gl, attrs, objText) {
    const model = parseObj.parseObj(objText);
    const vertices = model.faces.flatMap((face) => face.flatMap((fv) => model.vertices[fv.vertex - 1]));
    const normals = model.faces.flatMap((face) => face.flatMap((fv) => model.normals[fv.normal - 1]));

    const vertexBuffer = gl.createBuffer();
    console.assert(vertexBuffer != null);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const aVertexLoc = attrs.get('aVertex');
    gl.enableVertexAttribArray(aVertexLoc);
    gl.vertexAttribPointer(aVertexLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const normalBuffer = gl.createBuffer();
    console.assert(normalBuffer != null);
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    const aNormalLoc = attrs.get('aNormal');
    gl.enableVertexAttribArray(aNormalLoc);
    gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return { model };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} imageSource
 */
export async function initTetris(canvas) {
    const gl = utils.setupWebGLContext(canvas);
    gl.enable(gl.DEPTH_TEST);
    // gl.enable(gl.CULL_FACE);

    const vertSource = await utils.loadTextFromUrl('/demos/resources/tetris.vert');
    const fragSource = await utils.loadTextFromUrl('/demos/resources/tetris.frag');
    const shader = utils.loadShader(gl,
        [
            [gl.VERTEX_SHADER, vertSource],
            [gl.FRAGMENT_SHADER, fragSource],
        ],
        ['aVertex', 'aNormal', 'aOffset'],
        ['matNormal', 'mvp', 'color']
    );

    const blockObj = await utils.loadTextFromUrl('/demos/resources/tetromino-block.obj');
    const mesh = loadMinoBlock(gl, shader.attributes, blockObj);

    const offsetBuffer = gl.createBuffer();

    const tetris = await setupGame(canvas);
    const context = { gl, tetris, shader, mesh, offsetBuffer };
    utils.requestAnimationFrame(context, tetrisLoop);
}
