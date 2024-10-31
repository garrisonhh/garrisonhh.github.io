import * as utils from './utils.js';
import * as obj from './obj.js';
import * as bmfont from './bmfont.js';

/** @type {WebGL2RenderingContext | undefined} */
let gl = undefined;
/** @type {WebAssembly.Instance | undefined} */
let instance = undefined;
/** @type {utils.Shader[]} */
const backgroundShaders = [];

let backgroundVertSource = undefined;
let backgroundVao = undefined;
const backgroundShaderUniforms = ['uTime', 'uResolution'];

/** @type {Model[]} */
const models = [];
/** @type {utils.Shader | undefined} */
let modelShader = undefined;
const modelShaderUniforms = ['matNormal', 'mvp', 'color'];

/**
 * @typedef {Object} BatchedText
 * @property {string} text
 * @property {Float32Array} mvp
 */

/** @type {bmfont.Font | undefined} */
let font = undefined;
let fontVao = -1;
let fontVertexBuffer = -1;
let fontTexCoordBuffer = -1;
/** @type {BatchedText[]} */
let fontBatch = [];

/**
 * events formatted in a nice way for zig to parse
 *
 * @typedef {number[]} MouseMoveEvent [x, y] position
 * @typedef {number} MouseEvent button number
 * @typedef {string} KeyPressEvent key name
 *
 * @typedef {
 *     { mousemove: MouseMoveEvent } |
 *     { mousedown: MouseEvent } |
 *     { mouseup: MouseEvent } |
 *     { keydown: KeyPressEvent } |
 *     { keyup: KeyPressEvent }
 * } Event
 *
 * @type {Event[]}
 */
let eventQueue = [];
/** @type {FfiString | undefined} */
let lastEventsJson = undefined;

const keymap = {
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'ArrowDown': 'soft_drop',
    'Space': 'hard_drop',
    'KeyC': 'rotate_right',
    'KeyX': 'rotate_left',
};

function addAppEventListeners() {
    addEventListener('mousedown', (ev) => {
        eventQueue.push({ mousedown: ev.button });
    });
    addEventListener('touchstart', () => {
        eventQueue.push({ mousedown: 0 });
    });
    addEventListener('mousemove', (ev) => {
        eventQueue.push({ mousemove: [ev.clientX, ev.clientY] });
    });
    addEventListener('touchmove', (ev) => {
        const touch0 = ev.touches[0];
        eventQueue.push({ mousemove: [touch0.clientX, touch0.clientY] });
    });
    addEventListener('mouseup', () => {
        eventQueue.push({ mouseup: 0 });
    });
    addEventListener('touchend', () => {
        eventQueue.push({ mouseup: 0 });
    });
    addEventListener('keydown', (ev) => {
        const keyname = keymap[ev.code];
        if (keyname !== undefined) {
            eventQueue.push({ keydown: keyname });
        }
    });
    addEventListener('keyup', (ev) => {
        const keyname = keymap[ev.code];
        if (keyname !== undefined) {
            eventQueue.push({ keyup: keyname });
        }
    });
}

/**
 * @typedef {Object} Model
 * @property {Glint} vao
 * @property {number} count
 *
 * @param {obj.Mesh} mesh
 * @returns {Model}
 */
function loadModel(mesh) {
    const aVertexLoc = 0;
    const aNormalLoc = 1;

    const fvs = mesh.faces.flat();
    const vertices = fvs.flatMap((fv) => mesh.vertices[fv.vertex - 1]);
    const normals = fvs.flatMap((fv) => mesh.normals[fv.normal - 1]);

    const vao = gl.createVertexArray();
    const vertexBuffer = gl.createBuffer();
    const normalBuffer = gl.createBuffer();

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aVertexLoc);
    gl.vertexAttribPointer(aVertexLoc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aNormalLoc);
    gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    return { vao, count: mesh.faces.length * 3 };
}

/**
 * @param {number} ptr
 * @param {number} len
 * @returns {string}
 */
function readString(ptr, len) {
    const buf = new Uint8Array(instance.exports.memory.buffer, ptr, len);
    const str = new TextDecoder().decode(buf);
    return str;
}

class FfiString {
    constructor(str) {
        const encoded = new TextEncoder().encode(str);

        this.nbytes = encoded.length;
        this.ptr = instance.exports.runtimeAlloc(this.nbytes);
        if (this.ptr == 0) {
            throw new Error("OOM :(");
        }

        const dst = new Uint8ClampedArray(
            instance.exports.memory.buffer,
            this.ptr,
            this.nbytes
        );
        dst.set(encoded);
    }

    delete() {
        instance.exports.runtimeFree(this.ptr, this.nbytes);
    }
}

/**
 * @param {number} ptr
 * @param {number} len
 * @returns {Float32Array}
 */
function viewFloat32Array(ptr, len) {
    return new Float32Array(instance.exports.memory.buffer, ptr, len);
}

const env = {
    /**
     * @param {number} ptr
     */
    getResolution(out) {
        const arr = viewFloat32Array(out, 2);
        arr[0] = gl.canvas.width;
        arr[1] = gl.canvas.height;
    },

    /**
     * @param {number} outLen
     * @returns {number}
     */
    getEvents(outLen) {
        const box = new Uint32Array(instance.exports.memory.buffer, outLen, 1);
        box[0] = lastEventsJson.nbytes;
        return lastEventsJson.ptr;
    },

    /**
     * @param {number} ptr
     * @param {number} len
     */
    print(ptr, len) {
        const buf = new Uint8Array(instance.exports.memory.buffer, ptr, len);
        const str = new TextDecoder().decode(buf);
        console.debug('[app]', str);
    },

    /**
     * @param {number} fragSourcePtr
     * @param {number} fragSourceLen
     * @returns {number}
     */
    loadBackground(fragSourcePtr, fragSourceLen) {
        const fragSource = readString(fragSourcePtr, fragSourceLen);
        try {
            const shader = utils.loadShader(gl, [
                [gl.VERTEX_SHADER, backgroundVertSource],
                [gl.FRAGMENT_SHADER, fragSource],
            ], [], backgroundShaderUniforms);

            const id = backgroundShaders.length;
            backgroundShaders.push(shader);
            return id;
        } catch (e) {
            console.error(e.message);
            return -1;
        }
    },

    /**
     * @param {number} id
     * @param {number} ts
     */
    drawBackground(id, ts) {
        const shader = backgroundShaders[id];
        gl.useProgram(shader.program);
        gl.bindVertexArray(backgroundVao);
        gl.uniform1f(shader.uniforms.get('uTime'), ts);
        gl.uniform2f(shader.uniforms.get('uResolution'), gl.canvas.width, gl.canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.useProgram(null);
        gl.clear(gl.DEPTH_BUFFER_BIT);
    },

    /**
     * @param {number} objSourcePtr
     * @param {number} objSourceLen
     * @returns {number}
     */
    loadMesh(objSourcePtr, objSourceLen) {
        const source = readString(objSourcePtr, objSourceLen);
        try {
            const mesh = obj.parseObj(source);
            const model = loadModel(mesh);
            const id = models.length;
            models.push(model);
            return id;
        } catch (e) {
            console.error(e.message);
            return -1;
        }
    },

    /**
     * @param {number} id
     * @param {number} matNormal pointer to mat4 data
     * @param {number} mvpPtr pointer to mat4 data
     * @param {number} colorPtr pointer to vec3 data
     */
    drawMesh(id, matNormalPtr, mvpPtr, colorPtr) {
        const model = models[id];
        const matNormal = viewFloat32Array(matNormalPtr, 16);
        const mvp = viewFloat32Array(mvpPtr, 16);
        const color = viewFloat32Array(colorPtr, 3);

        gl.useProgram(modelShader.program);
        gl.bindVertexArray(model.vao);
        gl.uniformMatrix4fv(modelShader.uniforms.get('matNormal'), false, matNormal);
        gl.uniformMatrix4fv(modelShader.uniforms.get('mvp'), false, mvp);
        gl.uniform3f(modelShader.uniforms.get('color'), ...color);
        gl.drawArrays(gl.TRIANGLES, 0, model.count);
        gl.bindVertexArray(null);
        gl.useProgram(null);
    },

    /**
     * @param {number} textPtr
     * @param {number} textLen
     * @param {number} outRectPtr
     */
    measureText(textPtr, textLen, outRectPtr) {
        const text = readString(textPtr, textLen);
        const v = [
            Infinity,
            Infinity,
            0,
            0,
        ];
        for (const { dst } of font.typeset(text)) {
            v[0] = Math.min(v[0], dst[0]);
            v[1] = Math.min(v[1], dst[1]);
            v[2] = Math.max(v[2], dst[0] + dst[2]);
            v[3] = Math.max(v[3], dst[1] + dst[3]);
        }

        viewFloat32Array(outRectPtr, 4).set([
            v[0],
            v[1],
            v[2] - v[0],
            v[3] - v[1],
        ]);
    },

    /**
     * @param {number} textPtr
     * @param {number} textLen
     * @param {number} mvpPtr
     * @param {number} colorPtr
     */
    addBatchedText(textPtr, textLen, mvpPtr, colorPtr) {
        const text = readString(textPtr, textLen);
        const mvp = new Float32Array([...viewFloat32Array(mvpPtr, 16)]);
        const color = new Float32Array([...viewFloat32Array(colorPtr, 3)]);

        fontBatch.push({ text, mvp, color });
    },

    drawBatchedText() {
        const square = [
            [0.0, 1.0],
            [0.0, 0.0],
            [1.0, 1.0],
            [0.0, 0.0],
            [1.0, 1.0],
            [1.0, 0.0],
        ];

        const cullFace = gl.isEnabled(gl.CULL_FACE);
        if (cullFace) gl.disable(gl.CULL_FACE);
        gl.useProgram(font.shader.program);
        gl.bindVertexArray(fontVao);

        // TODO multi page support will probably be necessary at some point
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, font.pageTextures[0]);
        gl.uniform1i(font.shader.uniforms.get('fontPage'), 0);

        for (const item of fontBatch) {
            const vertices = [];
            const texcoords = [];

            for (const { src, dst } of font.typeset(item.text)) {
                // add vertices + texcoords
                vertices.push(...square.flatMap(([tx, ty]) => [
                    (dst[0] + dst[2] * tx),
                    -(dst[1] + dst[3] * ty),
                ]));
                texcoords.push(...square.flatMap(([x, y]) => [
                    src[0] + src[2] * x,
                    src[1] + src[3] * y,
                ]));
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, fontVertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, fontTexCoordBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STREAM_DRAW);
            gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);

            gl.uniformMatrix4fv(font.shader.uniforms.get('mvp'), false, item.mvp);
            gl.uniform3f(font.shader.uniforms.get('color'), ...item.color);
            gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
        };

        gl.bindVertexArray(null);
        gl.useProgram(null);
        if (cullFace) gl.enable(gl.CULL_FACE);

        fontBatch = [];
    },
};

/**
 * @param {WebGL2RenderingContext} glContext
 * @param {string} url
 * @returns {Promise<void>}
 */
export async function load(glContext, url) {
    gl = glContext;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    addAppEventListeners();

    // set up background rendering
    backgroundVertSource = await utils.loadTextFromUrl('/resources/background.vert');

    backgroundVao = gl.createVertexArray();
    gl.bindVertexArray(backgroundVao);
    const texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    // set up model rendering
    modelShader = utils.loadShader(gl, [
        [gl.VERTEX_SHADER, await utils.loadTextFromUrl('/resources/model.vert')],
        [gl.FRAGMENT_SHADER, await utils.loadTextFromUrl('/resources/model.frag')],
    ], [], modelShaderUniforms);

    // set up font rendering
    font = await bmfont.loadFont(gl, '/resources/conthrax.fnt');
    fontVao = gl.createVertexArray();
    fontVertexBuffer = gl.createBuffer();
    fontTexCoordBuffer = gl.createBuffer();

    gl.bindVertexArray(fontVao);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.bindVertexArray(null);

    // set up wasm
    const memory = new WebAssembly.Memory({
        initial: 10,
        maximum: 100,
        shared: true,
    });

    const importObj = { js: { mem: memory }, env };
    const wasm = await WebAssembly.instantiateStreaming(fetch(url), importObj);
    instance = wasm.instance;

    instance.exports.init();
}

/**
 * @param {DOMHighResTimeStamp} ts
 */
export function loop(ts) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    lastEventsJson = new FfiString(JSON.stringify(eventQueue));
    eventQueue = [];

    instance.exports.loop(ts);

    lastEventsJson.delete();
    lastEventsJson = undefined;
}
