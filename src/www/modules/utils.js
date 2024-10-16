/**
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function loadTextFromUrl(url) {
    return fetch(url).then((res) => res.text());
}

/**
 * @param {string} url
 * @returns {Promise<ImageData>}
 */
export async function loadImageDataFromUrl(url) {
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
 * slightly patches {@link window.requestAnimationFrame} to allow usage of a
 * context object without creating an awkward global variable
 *
 * @typedef {(ctx: any, ts: DOMHighResTimeStamp) => void} FrameCallback
 * @param {any} context
 * @param {FrameCallback} callback
 */
export function requestAnimationFrame(context, callback) {
    const closure = (ts) => {
        callback(context, ts);
        window.requestAnimationFrame(closure);
    };
    window.requestAnimationFrame(closure);
}

/**
 * retrieve a webgl2 context from the provided canvas with some minor necessary
 * tweaks to minimize jankiness
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {WebGL2RenderingContext}
 */
export function setupWebGLContext(canvas) {
    const gl = canvas.getContext('webgl2');

    const ensureSize = () => {
        const [w, h] = [window.innerWidth, window.innerHeight];
        gl.canvas.width = w;
        gl.canvas.height = h;
        gl.viewport(0, 0, w, h);
    };

    ensureSize();
    window.addEventListener('resize', ensureSize);

    return gl;
}

/**
 * @typedef {Map<string, GLint>} ShaderAttrs
 * @typedef {Map<string, WebGLUniformLocation | null>} ShaderUniforms
 *
 * @typedef {Object} Shader
 * @property {WebGLProgram} program
 * @property {ShaderAttrs} attributes
 * @property {ShaderUniforms} uniforms
 */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {Array<[GLenum, string]>} shaderSources
 *   array of tuples of shader kind and source text
 * @param {Array<string>} attributeNames
 * @param {Array<string>} uniformNames
 * @returns {Shader}
 */
export function loadShader(gl, shaderSources, attributeNames, uniformNames) {
    const program = gl.createProgram();
    console.assert(program != null);

    for (const [kind, source] of shaderSources) {
        const shader = gl.createShader(kind);
        console.assert(shader != null);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (!success) {
            const msg = `shader compilation: ${gl.getShaderInfoLog(shader)}`;
            gl.deleteShader(shader);
            gl.deleteProgram(program);
            throw new Error(msg);
        }

        gl.attachShader(program, shader);
    }

    gl.linkProgram(program);

    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
        const msg = `program linkage: ${gl.getProgramInfoLog(program)}`;
        gl.deleteProgram(program);
        throw new Error(msg);
    }

    const attributes = new Map(attributeNames.map((name) => {
        const loc = gl.getAttribLocation(program, name);
        return [name, loc];
    }));
    const uniforms = new Map(uniformNames.map((name) => {
        const loc = gl.getUniformLocation(program, name);
        return [name, loc];
    }));

    return { program, attributes, uniforms };
}
