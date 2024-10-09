import * as utils from './utils.js';
import { Mat4 } from './matrix.js';
import * as parseObj from './parseObj.js';

/**
 * @typedef {Object} TetrisContext
 * @property {WebGL2RenderingContext} gl
 * @property {utils.Shader} shader
 * @property {Mesh} mesh
 * @property {GLint} aMatModelLoc
 *
 * @param {TetrisContext} ctx
 * @param {DOMHighResTimeStamp} ts
 */
function tetrisLoop(ctx, ts) {
    const gl = ctx.gl;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(ctx.shader.program);

    const matModel = Mat4.translate(0, 0, 10);
    const matView = Mat4.identity();
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
    gl.drawArrays(gl.TRIANGLES, 0, ctx.mesh.model.faces.length * 3);
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
    console.log(model);

    const vertices = model.faces.flatMap((face) => face.flatMap((fv) => model.vertices[fv.vertex - 1]));
    const normals = model.faces.flatMap((face) => face.flatMap((fv) => model.normals[fv.normal - 1]));
    console.log(vertices);

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
        ['aVertex', 'aNormal'],
        ['matNormal', 'mvp', 'color']
    );

    const blockObj = await utils.loadTextFromUrl('/demos/resources/tetromino-block.obj');
    const mesh = loadMinoBlock(gl, shader.attributes, blockObj);

    const context = { gl, shader, mesh };
    utils.requestAnimationFrame(context, tetrisLoop);
}
