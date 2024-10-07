import {
    requestAnimationFrame,
    loadTextFromUrl,
    loadShader,
    setupWebGLContext,
} from './utils.js';

/**
 * @typedef {Object} BackgroundContext
 * @property {WebGL2RenderingContext} gl
 * @property {Shader} shader
 *
 * @param {BackgroundContext} ctx
 * @param {DOMHighResTimeStamp} ts
 */
function backgroundLoop(ctx, ts) {
    const gl = ctx.gl;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(ctx.shader.program);
    gl.enableVertexAttribArray(ctx.shader.attributes['aTexCoord']);

    gl.uniform1f(ctx.shader.uniforms.get('timestamp'), ts);
    gl.uniform2f(ctx.shader.uniforms.get('resolution'), gl.canvas.width, gl.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disableVertexAttribArray(ctx.shader.attributes.aTexCoord);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} imageSource
 */
export async function initBackground(canvas) {
    const gl = setupWebGLContext(canvas);
    const shader = loadShader(gl, [
        [gl.VERTEX_SHADER, await loadTextFromUrl('/demos/resources/bg.vert')],
        [gl.FRAGMENT_SHADER, await loadTextFromUrl('/demos/resources/bg.frag')],
    ], ['aTexCoord'], ['timestamp', 'resolution']);

    const texCoordBuffer = gl.createBuffer();
    console.assert(texCoordBuffer != null);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);

    const texcoords = [
        0.0, 0.0,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);
    gl.vertexAttribPointer(
        shader.attributes.get('aTexCoord'),
        2,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const bgContext = { gl, shader };
    requestAnimationFrame(bgContext, backgroundLoop);
}
