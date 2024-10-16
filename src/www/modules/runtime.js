import * as app from './app.js';
import * as utils from './utils.js';

/**
 * @param {Object} ctx
 * @property {WebGL2RenderingContext} gl
 * @param {DOMHighResTimeStamp} ts
 */
function loop(ctx, ts) {
    app.loop(ts);
}

/**
 * initializes wasm app
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} appUrl
 */
export async function start(canvas, appUrl) {
    const gl = utils.setupWebGLContext(canvas);

    await app.load(gl, appUrl);

    const ctx = { gl };
    utils.requestAnimationFrame(ctx, loop);
}
