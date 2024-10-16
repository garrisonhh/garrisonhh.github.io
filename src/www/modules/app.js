import * as utils from './utils.js';

/** @type {WebGL2RenderingContext | undefined} */
let gl = undefined;
/** @type {WebAssembly.Instance | undefined} */
let instance = undefined;
/** @type {utils.Shader[]} */
const backgroundShaders = [];

let backgroundVertSource = undefined;
let backgroundVao = undefined;
const backgroundShaderAttrs = [];
const backgroundShaderUniforms = [];

/**
 * @param {number} ptr
 * @param {number} len
 */
function loadString(ptr, len) {
    const buf = new Uint8Array(instance.exports.memory.buffer, ptr, len);
    const str = new TextDecoder().decode(buf);
    return str;
}

const env = {
    /**
     * @param {number} ptr
     * @param {number} len
     */
    print(ptr, len) {
        const buf = new Uint8Array(instance.exports.memory.buffer, ptr, len);
        const str = new TextDecoder().decode(buf);
        console.debug('[app]', str);
    },

    loadBackground(fragSourcePtr, fragSourceLen) {
        const fragSource = loadString(fragSourcePtr, fragSourceLen);
        try {
            const shader = utils.loadShader(gl, [
                [gl.VERTEX_SHADER, backgroundVertSource],
                [gl.FRAGMENT_SHADER, fragSource],
            ], backgroundShaderAttrs, backgroundShaderUniforms);

            const id = backgroundShaders.length;
            backgroundShaders.push(shader);
            return id;
        } catch {
            return -1;
        }
    },

    drawBackground(id) {
        const shader = backgroundShaders[id];
        gl.useProgram(shader.program);
        gl.bindVertexArray(backgroundVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.useProgram(null);
    }
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

    // set up background
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
    instance.exports.loop(ts);
}
