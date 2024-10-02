import { requestAnimationFrame } from './utils.js';

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
async function loadTextFromUrl(url) {
    return fetch(url).then((res) => res.text());
}

/**
 * @param {string} url
 * @returns {Promise<ImageData>}
 */
async function loadImageDataFromUrl(url) {
    /** @type Promise<HTMLImageElement> */
    const loadImage = new Promise((resolve, reject) => {
        let img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });

    return loadImage.then((img) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        canvas.remove();

        return imageData;
    });
}

/**
 * @typedef {Object} ShaderAttrs
 * @property {GLint} aTexCoord
 *
 * @typedef {Object} ShaderUniforms
 * @property {WebGLUniformLocation | null} background
 * @property {WebGLUniformLocation | null} timestamp
 * @property {WebGLUniformLocation | null} resolution
 *
 * @typedef {Object} BackgroundShader
 * @property {WebGLProgram} program
 * @property {ShaderAttrs} attributes
 * @property {ShaderUniforms} uniforms
 */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} vertSource
 * @param {string} fragSource
 * @returns {BackgroundShader}
 */
function loadShader(gl, vertSource, fragSource) {
    const loadInternal = (kind, source) => {
        const shader = gl.createShader(kind);
        console.assert(shader != null);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (!success) {
            const msg = `shader compilation: ${gl.getShaderInfoLog(shader)}`;
            gl.deleteShader(shader);
            throw new Error(msg);
        }

        return shader;
    };

    const vert = loadInternal(gl.VERTEX_SHADER, vertSource);
    const frag = loadInternal(gl.FRAGMENT_SHADER, fragSource);

    const program = gl.createProgram();
    console.assert(program != null);
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
        const msg = `program linkage: ${gl.getProgramInfoLog(program)}`;
        gl.deleteProgram(program);
        throw new Error(msg);
    }

    const aTexCoord = gl.getAttribLocation(program, "aTexCoord");
    const background = gl.getUniformLocation(program, "background");
    const timestamp = gl.getUniformLocation(program, "timestamp");
    const resolution = gl.getUniformLocation(program, "resolution");

    return {
        program,
        attributes: { aTexCoord },
        uniforms: { background, timestamp, resolution },
    };
}

/**
 * @typedef {Object} BackgroundContext
 * @property {WebGL2RenderingContext} gl
 * @property {BackgroundShader} shader
 *
 * @param {BackgroundContext} ctx
 * @param {DOMHighResTimeStamp} ts
 */
function backgroundLoop(ctx, ts) {
    const gl = ctx.gl;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(ctx.shader.program);
    gl.enableVertexAttribArray(ctx.shader.attributes.aTexCoord);

    gl.uniform1f(ctx.shader.uniforms.timestamp, ts);
    gl.uniform2f(ctx.shader.uniforms.resolution, gl.canvas.width, gl.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disableVertexAttribArray(ctx.shader.attributes.aTexCoord);

    requestAnimationFrame(ctx, backgroundLoop);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} imageSource
 */
export async function initBackground(canvas) {
    const gl = canvas.getContext('webgl2');

    const ensureSize = () => {
        const [w, h] = [window.innerWidth, window.innerHeight];
        gl.canvas.width = w;
        gl.canvas.height = h;
        gl.viewport(0, 0, w, h);
    };

    ensureSize();
    window.addEventListener('resize', ensureSize);

    const fragSource = await loadTextFromUrl('./resources/bg.frag');
    const vertSource = await loadTextFromUrl('./resources/bg.vert');
    const shader = loadShader(gl, vertSource, fragSource);

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
        shader.attributes.aTexCoord,
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
