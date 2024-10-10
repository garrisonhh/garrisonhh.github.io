import * as utils from './utils.js';
import {Mat4} from './matrix.js';

function backgroundLoop(ctx, ts) {
    const gl = ctx.gl;

    const starz = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
    ];

    const matModel = Mat4.chain();
    const matView = Mat4.chain(
        Mat4.translate(0.0, 0.0, 5.0),
    );
    const matProjection = Mat4.perspective({
        near: 0.01,
        far: 100.0,
        width: gl.canvas.width,
        height: gl.canvas.height,
    });

    // const matNormal = Mat4.invert(matView.mul(matModel)).transpose();
    const mvp = Mat4.chain(matProjection, matView, matModel);

    gl.bindBuffer(gl.ARRAY_BUFFER, ctx.starzBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(starz.flat()), gl.DYNAMIC_DRAW);
    const aVertexLoc = ctx.shader.attributes.get('aVertex');
    gl.enableVertexAttribArray(aVertexLoc);
    gl.vertexAttribPointer(aVertexLoc, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aVertexLoc, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(ctx.shader.program);

    gl.uniformMatrix4fv(ctx.shader.uniforms.get('mvp'), false, new Float32Array(mvp.data));
    gl.drawArrays(gl.POINTS, 0, starz.length);
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export async function initStarz(canvas) {
    const gl = utils.setupWebGLContext(canvas);
    gl.enable(gl.DEPTH_TEST);

    const shader = utils.loadShader(gl, [
        [gl.VERTEX_SHADER, await utils.loadTextFromUrl('/demos/resources/starz.vert')],
        [gl.FRAGMENT_SHADER, await utils.loadTextFromUrl('/demos/resources/starz.frag')],
    ], ['aVertex'], []);

    const starzBuffer = gl.createBuffer();
    console.assert(starzBuffer != null);

    const context = { gl, shader, starzBuffer };
    utils.requestAnimationFrame(context, backgroundLoop);
}
