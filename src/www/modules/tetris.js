import * as utils from './utils.js';
import { Mat4 } from './matrix.js';
import * as parseObj from './parseObj.js';
import * as oklab from './oklab.js';
import * as runtime from './tetris/runtime.js';

/**
 * @param {TetrisContext} ctx
 * @param {DOMHighResTimeStamp} ts
 */
function drawIntro(ctx, ts) {
    const gl = ctx.gl;

    const angleDiff = Math.PI * 2.0 / 3.0;
    const colorAngle = ts * 1e-4 * Math.PI;

    const [colorA, colorB, colorC] = new Array(3).fill(null).map((_, i) => {
        const angle = colorAngle + i * angleDiff;
        const lab = [0.5, Math.cos(angle) * 0.5, Math.sin(angle) * 0.5];
        return lab;
    });

    const tetris2000Color = oklab.rgbFromOklab(colorC);

    // background
    gl.useProgram(ctx.bgShader.program);
    gl.bindVertexArray(ctx.bgMesh.vao);

    gl.uniform1f(ctx.bgShader.uniforms.get('timestamp'), ts);
    gl.uniform2f(ctx.bgShader.uniforms.get('resolution'), gl.canvas.width, gl.canvas.height);
    gl.uniform3f(ctx.bgShader.uniforms.get('colorA'), ...colorA);
    gl.uniform3f(ctx.bgShader.uniforms.get('colorB'), ...colorB);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    // tetris2000 text
    const matModel = Mat4.chain(
        Mat4.rotateY(Math.cos(ts * 0.001) * (0.2 * Math.PI) + (-0.5 * Math.PI)),
        Mat4.translate(0.0, -1.0, -3.0),
    );
    const matView = Mat4.chain(
        Mat4.translate(0.0, 0.0, -3.0),
    );
    const matProjection = Mat4.perspective({
        near: 0.01,
        far: 100.0,
        width: gl.canvas.width,
        height: gl.canvas.height,
    });

    const matNormal = Mat4.invert(matView.mul(matModel)).transpose();
    const mvp = Mat4.chain(matProjection, matView, matModel);

    gl.useProgram(ctx.modelShader.program);
    gl.bindVertexArray(ctx.tetris2000Mesh.vao);

    gl.uniformMatrix4fv(ctx.modelShader.uniforms.get('matNormal'), false, new Float32Array(matNormal.data));
    gl.uniformMatrix4fv(ctx.modelShader.uniforms.get('mvp'), false, new Float32Array(mvp.data));
    gl.uniform3f(ctx.modelShader.uniforms.get('color'), ...tetris2000Color);
    gl.uniform3f(ctx.modelShader.uniforms.get('lightPos'), 0.0, 0.0, -100.0);
    gl.drawArrays(gl.TRIANGLES, 0, ctx.tetris2000Mesh.model.faces.length * 3);

    gl.bindVertexArray(null);
}

/**
 * @param {TetrisContext} ctx
 * @param {DOMHighResTimeStamp} ts
 */
function drawInGame(ctx, res) {
    const gl = ctx.gl;

    const blocks = [];
    {
        const h = 20;
        const w = 10;
        for (let y = 0; y < h; ++y) {
            for (let x = 0; x < w; ++x) {
                if (res.board[y * w + x] != ' ') {
                    blocks.push([(-w / 2.0) + x, (h / 2.0) - y, 0.0]);
                }
            }
        }
    }

    gl.bindVertexArray(ctx.blockMesh.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, ctx.offsetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(blocks.flat()), gl.DYNAMIC_DRAW);
    const aOffsetLoc = ctx.modelShader.attributes.get('aOffset');
    gl.enableVertexAttribArray(aOffsetLoc);
    gl.vertexAttribPointer(aOffsetLoc, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aOffsetLoc, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.useProgram(ctx.modelShader.program);

    const matModel = Mat4.chain(
        Mat4.scale(0.5, 0.5, 0.5),
    );
    const matView = Mat4.chain(
        Mat4.translate(0.0, 0.0, -5.0),
    );
    const matProjection = Mat4.perspective({
        near: 0.01,
        far: 100.0,
        width: gl.canvas.width,
        height: gl.canvas.height,
    });

    const matNormal = Mat4.invert(matView.mul(matModel)).transpose();
    const mvp = Mat4.chain(matProjection, matView, matModel);

    gl.uniformMatrix4fv(ctx.modelShader.uniforms.get('matNormal'), false, new Float32Array(matNormal.data));
    gl.uniformMatrix4fv(ctx.modelShader.uniforms.get('mvp'), false, new Float32Array(mvp.data));
    gl.uniform3f(ctx.modelShader.uniforms.get('color'), ...[0.9, 0.7, 0.1]);
    gl.uniform3f(ctx.modelShader.uniforms.get('lightPos'), 0.0, 5.0, 0.0);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, ctx.blockMesh.model.faces.length * 3, blocks.length);

    gl.bindVertexArray(null);
}

/**
 * @typedef {Object} TetrisContext
 * @property {WebGL2RenderingContext} gl
 * @property {Tetris} tetris
 * @property {utils.Shader} bgShader
 * @property {utils.Shader} modelShader
 * @property {BgMesh} bgMesh
 * @property {Mesh} blockMesh
 * @property {Mesh} tetris2000Mesh
 * @property {number} offsetBuffer
 *
 * @param {TetrisContext} ctx
 * @param {DOMHighResTimeStamp} ts
 */
function tetrisLoop(ctx, ts) {
    const gl = ctx.gl;

    const res = runtime.updateGame(ctx.tetris, ts);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (res.paused) {
        drawIntro(ctx, ts);
    } else {
        drawInGame(ctx, res);
    }
}

/**
 * loads a background mesh to a vao, given a shader with attr 'vec2 aTexCoord'
 *
 * @typedef {Object} BgMesh
 * @property {number} vao
 *
 * @param {WebGL2RenderingContext} gl
 * @param {number} aTexCoordLoc
 * @returns {BgMesh}
 */
function loadBgMesh(gl, aTexCoordLoc) {
    const vao = gl.createVertexArray();
    console.assert(vao != null);
    gl.bindVertexArray(vao);

    const texCoordBuffer = gl.createBuffer();
    console.assert(texCoordBuffer != null);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);

    const texcoords = [
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aTexCoordLoc);
    gl.vertexAttribPointer(aTexCoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    return { vao };
}

/**
 * loads a 3d model mesh to a vao, given a shader with attrs 'vec3 aVertex' and
 * 'vec3 aNormal'
 *
 * @typedef {Object} Mesh
 * @property {parseObj.Model} model
 * @property {number} vao
 *
 * @param {WebGL2RenderingContext} gl
 * @param {utils.ShaderAttrs} attrs
 * @param {string} objText
 * @returns {Mesh}
 */
function loadMesh(gl, attrs, objText) {
    const model = parseObj.parseObj(objText);
    const vertices = model.faces.flatMap((face) => face.flatMap((fv) => model.vertices[fv.vertex - 1]));
    const normals = model.faces.flatMap((face) => face.flatMap((fv) => model.normals[fv.normal - 1]));

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

    const normalBuffer = gl.createBuffer();
    console.assert(normalBuffer != null);
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    const aNormalLoc = attrs.get('aNormal');
    gl.enableVertexAttribArray(aNormalLoc);
    gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    return { model, vao };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} imageSource
 */
export async function initTetris(canvas) {
    const gl = utils.setupWebGLContext(canvas);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    const modelVertSource = await utils.loadTextFromUrl('/resources/tetris-model.vert');
    const modelFragSource = await utils.loadTextFromUrl('/resources/tetris-model.frag');
    const modelShader = utils.loadShader(
        gl,
        [
            [gl.VERTEX_SHADER, modelVertSource],
            [gl.FRAGMENT_SHADER, modelFragSource],
        ],
        ['aVertex', 'aNormal', 'aOffset'],
        ['matNormal', 'mvp', 'color', 'lightPos']
    );

    const bgVertSource = await utils.loadTextFromUrl('/resources/tetris-intro-bg.vert');
    const bgFragSource = await utils.loadTextFromUrl('/resources/tetris-intro-bg.frag');
    const bgShader = utils.loadShader(
        gl,
        [
            [gl.VERTEX_SHADER, bgVertSource],
            [gl.FRAGMENT_SHADER, bgFragSource],
        ],
        ['aTexCoord'],
        ['timestamp', 'resolution', 'colorA', 'colorB']
    );

    const bgMesh = loadBgMesh(gl, bgShader.attributes.get('aTexCoord'));

    const blockObj = await utils.loadTextFromUrl('/resources/tetromino-block.obj');
    const tetris2000Obj = await utils.loadTextFromUrl('/resources/tetris2000.obj');
    const blockMesh = loadMesh(gl, modelShader.attributes, blockObj);
    const tetris2000Mesh = loadMesh(gl, modelShader.attributes, tetris2000Obj);

    const offsetBuffer = gl.createBuffer();

    const tetris = await runtime.setupGame(canvas);
    const context = {
        gl,
        bgShader,
        modelShader,
        offsetBuffer,
        bgMesh,
        blockMesh,
        tetris2000Mesh,

        tetris,
    };
    utils.requestAnimationFrame(context, tetrisLoop);
}
