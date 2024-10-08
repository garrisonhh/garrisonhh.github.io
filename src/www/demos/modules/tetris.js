import * as utils from './utils.js';
import {Mat4} from './matrix.js';

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

    const vp =
        Mat4.scale(gl.canvas.height / gl.canvas.width, 1.0, 1.0)
            .mul(Mat4.scale(0.1, 0.1, 0.1))
            .mul(Mat4.rotateY(ts * 0.001))
            .mul(Mat4.rotateX(ts * 0.002));

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindVertexArray(ctx.prism.vao);
    gl.useProgram(ctx.shader.program);
    gl.uniform1f(ctx.shader.uniforms.get('timestamp'), ts);
    gl.uniform2f(ctx.shader.uniforms.get('resolution'), gl.canvas.width, gl.canvas.height);

    const coords = [
        [0.0, 0.0, 0.0],
        [0.2, 0.0, 0.0],
        [0.0, 0.2, 0.0],
        [-0.2, 0.0, 0.0],
        [0.0, -0.2, 0.0],
    ];
    for (const coord of coords) {
        const mvp = vp.mul(Mat4.translate(...coord));

        gl.uniformMatrix4fv(ctx.shader.uniforms.get('mvp'), false, new Float32Array(mvp.data));

        gl.drawArrays(gl.TRIANGLES, 0, ctx.prism.count);
    }

    gl.bindVertexArray(null);
}

/**
 * loads a prism model onto the gpu
 *
 * @typedef {Object} PrismMesh
 * @property {GLint} vao
 * @property {number} count
 *
 * @param {WebGL2RenderingContext} gl
 * @param {utils.ShaderAttrs} attrs
 * @returns {PrismMesh}
 */
function loadPrism(gl, attrs) {
    const angle = (2.0 * Math.PI) / 3.0;
    const pA = [Math.cos(0) * 0.5, 0.0, Math.sin(0) * 0.5];
    const pB = [Math.cos(angle) * 0.5, 0.0, Math.sin(angle) * 0.5];
    const pC = [Math.cos(angle * 2.0) * 0.5, 0.0, Math.sin(angle * 2.0) * 0.5];
    const pD = [0.0, Math.hypot(...pA), 0.0];

    const prismVertices = [pD, pA, pB, pC];
    const prismColors = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
        [1.0, 1.0, 0.0],
    ];
    const prismIndices = [
        0, 1, 2,
        0, 2, 3,
        0, 3, 1,
        1, 2, 3,
    ];

    const vertices = prismIndices.flatMap(i => prismVertices[i]);
    const colors = prismIndices.flatMap(i => prismColors[i]);

    const vao = gl.createVertexArray();
    console.assert(vao != null);
    gl.bindVertexArray(vao);

    const vertexBuffer = gl.createBuffer();
    console.assert(vertexBuffer != null);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const aVertexLoc = attrs.get('aVertex');
    gl.enableVertexAttribArray(aVertexLoc);
    gl.vertexAttribPointer(aVertexLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    console.log(colors);

    const colorBuffer = gl.createBuffer();
    console.assert(colorBuffer != null);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    const aColorLoc = attrs.get('aColor');
    gl.enableVertexAttribArray(aColorLoc);
    gl.vertexAttribPointer(aColorLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    console.log(aColorLoc, aVertexLoc);

    // TODO figure out how element array buffers work...
    // const ebo = gl.createBuffer();
    // console.assert(ebo != null);
    // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    // gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(prismIndices), gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return { vao, count: vertices.length / 3 };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} imageSource
 */
export async function initTetris(canvas) {
    const gl = utils.setupWebGLContext(canvas);
    gl.enable(gl.DEPTH_TEST);

    const vertSource = await utils.loadTextFromUrl('/demos/resources/tetris.vert');
    const fragSource = await utils.loadTextFromUrl('/demos/resources/tetris.frag');
    const shader = utils.loadShader(gl, [
        [gl.VERTEX_SHADER, vertSource],
        [gl.FRAGMENT_SHADER, fragSource],
    ], ['aVertex', 'aColor'], ['mvp', 'timestamp', 'resolution']);

    const prism = loadPrism(gl, shader.attributes);

    const context = { gl, shader, prism };
    utils.requestAnimationFrame(context, tetrisLoop);
}
