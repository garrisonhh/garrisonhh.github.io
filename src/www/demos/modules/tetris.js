import * as utils from './utils.js';

/**
 * @typedef {Object} TetrisContext
 * @property {WebGL2RenderingContext} gl
 * @property {utils.Shader} shader
 * @property {PrismMesh} prism
 *
 * @param {TetrisContext} ctx
 * @param {DOMHighResTimeStamp} ts
 */
function tetrisLoop(ctx, ts) {
    const gl = ctx.gl;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(ctx.shader.program);

    gl.uniform1f(ctx.shader.uniforms['timestamp'], ts);

    gl.bindVertexArray(ctx.prism.vao);
    gl.drawElements(gl.TRIANGLES, 12, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
}

/**
 * loads a prism model onto the gpu
 *
 * @typedef {Object} PrismMesh
 * @property {GLint} vao
 *
 * @param {WebGL2RenderingContext} gl
 * @param {utils.ShaderAttrs} attrs
 * @returns {PrismMesh}
 */
function loadPrism(gl, attrs) {
    const angle = (2.0 * Math.PI) / 3.0;
    const pA = [0.5, 0.0, 0.0];
    const pB = [Math.cos(angle) * 0.5, Math.sin(angle) * 0.5, 0.0];
    const pC = [Math.cos(angle) * 0.5, Math.sin(angle) * 0.5, 0.0];
    const pD = [0.0, 0.0, Math.hypot(pA.map((x, i) => x * pB[i]))];

    const prismVertices = [pD, pA, pB, pC];
    const prismIndices = [
        0, 2, 1,
        0, 3, 2,
        0, 1, 3,
        1, 2, 3,
    ];

    const vao = gl.createVertexArray();
    console.assert(vao != null);
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    console.assert(vbo != null);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(prismVertices), gl.STATIC_DRAW);
    gl.vertexAttribPointer(attrs.get('aVertex'), 3, gl.FLOAT, false, 0, 0);

    const ebo = gl.createBuffer();
    console.assert(ebo != null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(prismIndices), gl.STATIC_DRAW);

    return { vao, vbo, ebo };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} imageSource
 */
export async function initTetris(canvas) {
    const gl = utils.setupWebGLContext(canvas);

    const fragSource = await utils.loadTextFromUrl('/demos/resources/tetris.frag');
    const vertSource = await utils.loadTextFromUrl('/demos/resources/tetris.vert');
    const shader = utils.loadShader(gl, [
        [gl.VERTEX_SHADER, vertSource],
        [gl.FRAGMENT_SHADER, fragSource],
    ], ['aVertex'], ['timestamp']);

    const prism = loadPrism(gl, shader.attributes);

    const context = { gl, shader, prism };
    utils.requestAnimationFrame(context, tetrisLoop);
}
