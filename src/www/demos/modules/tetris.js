import * as utils from './utils.js';
import { Mat4 } from './matrix.js';
import * as parseObj from './parseObj.js';

/**
 * @typedef {Object} TetrisContext
 * @property {WebGL2RenderingContext} gl
 * @property {utils.Shader} shader
 * @property {Mesh} mesh
 *
 * @param {TetrisContext} ctx
 * @param {DOMHighResTimeStamp} ts
 */
function tetrisLoop(ctx, ts) {
    const gl = ctx.gl;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(ctx.shader.program);
    gl.uniform1f(ctx.shader.uniforms.get('timestamp'), ts);
    gl.uniform2f(ctx.shader.uniforms.get('resolution'), gl.canvas.width, gl.canvas.height);

    const coords = [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [-1, 0, 0],
        [0, -1, 0],
        [0, 0, -1],
    ];
    for (const coord of coords) {
        const mvp = Mat4.chain(
            Mat4.perspective({
                near: 0.01,
                far: 100.0,
                width: gl.canvas.width,
                height: gl.canvas.height,
            }),
            Mat4.translate(0, 0, 5),
            // Mat4.rotateZ(ts * 0.003),
            // Mat4.rotateY(ts * 0.002),
            Mat4.rotateX(ts * 0.001),
            Mat4.translate(...coord),
        );

        gl.uniformMatrix4fv(ctx.shader.uniforms.get('mvp'), false, new Float32Array(mvp.data));
        gl.drawArrays(gl.TRIANGLES, 0, ctx.mesh.model.faces.length / 3);
    }
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
    // const model = parseObj.parseObj(objText);

    const model = {
        vertices: new Float32Array([
            0.0, 1.0, 0.0,
            1.0, 0.0, 0.0,
            -1.0, 0.0, 0.0,
        ]),
        faces: new Uint16Array([
            0, 1, 2
        ]),
    };

    const vertices = [...model.faces].flatMap((i) => [...model.vertices.slice(i * 3, (i + 1) * 3)]);
    console.log(vertices);

    const vertexBuffer = gl.createBuffer();
    console.assert(vertexBuffer != null);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const aVertexLoc = attrs.get('aVertex');
    gl.enableVertexAttribArray(aVertexLoc);
    gl.vertexAttribPointer(aVertexLoc, 3, gl.FLOAT, false, 0, 0);

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

    const vertSource = await utils.loadTextFromUrl('/demos/resources/tetris.vert');
    const fragSource = await utils.loadTextFromUrl('/demos/resources/tetris.frag');
    const shader = utils.loadShader(gl, [
        [gl.VERTEX_SHADER, vertSource],
        [gl.FRAGMENT_SHADER, fragSource],
    ], ['aVertex', 'aColor'], ['mvp', 'timestamp', 'resolution']);

    const blockObj = await utils.loadTextFromUrl('/demos/resources/tetromino-block.obj');
    const mesh = loadMinoBlock(gl, shader.attributes, blockObj);

    const context = { gl, shader, mesh };
    utils.requestAnimationFrame(context, tetrisLoop);
}
