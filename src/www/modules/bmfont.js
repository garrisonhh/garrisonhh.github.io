import * as parseBmFont from "./parseBmfont.js";
import * as utils from "./utils.js";
import { Matrix, Mat4 } from "./matrix.js";

export class Font {
    /**
     * @param {parseBmFont.BmFont} bmfont
     * @param {WebGLTexture[]} pageTextures
     * @param {utils.Shader} shader
     */
    constructor(bmfont, pageTextures, shader) {
        this.info = bmfont.info;
        this.common = bmfont.common;
        this.pageTextures = pageTextures;
        this.shader = shader;

        this.chars = new Map(bmfont.chars.map((char) => {
            return [String.fromCharCode(char.id), char];
        }));
        this.kernings = new Map(bmfont.kernings.map((kerning) => {
            return [`${kerning.first},${kerning.second}`, kerning.amount];
        }));
    }

    getKerning(a, b) {
        const aId = a.charCodeAt(0);
        const bId = b.charCodeAt(0);
        return this.kernings.get(`${aId},${bId}`);
    }

    /**
     * get char source in texcoords
     *
     * @param {string} ch
     * @returns {{ data: parseBmFont.BmFontChar; rect: number[]; }}
     */
    getChar(ch) {
        const data = this.chars.get(ch);
        if (data === undefined) {
            throw new Error(`can't render char \`${ch}\``);
        }
        const rect = [
            data.x / this.common.scaleW,
            data.y / this.common.scaleH,
            data.width / this.common.scaleW,
            data.height / this.common.scaleH,
        ];
        return { data, rect };
    }
}

export class TextBatcher {
    /**
     * @typedef {Object} BatchChar
     * @property {string} char
     * @property {number[]} pos
     */

    /**
     * @param {WebGL2RenderingContext} gl
     * @param {Font} font
     */
    constructor(gl, font) {
        this.font = font;
        /** @type {BatchChar[]} */
        this.batch = [];

        this.vertexBuffer = gl.createBuffer();
        this.texCoordBuffer = gl.createBuffer();
    }

    /**
     * @param {string} text
     * @param {number[]} pos 3d position, text will be drawn towards +x
     */
    draw(text, pos) {
        let trav = pos;

        for (const char of text) {
            if (char == '\n') {
                trav[0] = pos[0];
                trav[1] += this.font.common.lineHeight;
                continue;
            }

            const charInfo = this.font.getChar(char);
            const dst = [
                trav[0] + charInfo.data.xoffset,
                trav[1] + charInfo.data.yoffset,
                trav[2],
            ];

            this.batch.push({ char, pos: dst });

            trav[0] += charInfo.data.xadvance;
        }
    }

    /**
     * @param {WebGL2RenderingContext} gl
     * @param {Matrix} mvp
     */
    flush(gl, mvp) {
        const shader = this.font.shader;

        const vertices = [
            0.0, 0.0, 0.0,
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            1.0, 1.0, 0.0,
        ];
        const texcoords = [
            0.0, 1.0,
            1.0, 1.0,
            0.0, 0.0,
            1.0, 0.0,
        ];

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
        const aVertexLoc = shader.attributes.get('aVertex');
        gl.enableVertexAttribArray(aVertexLoc);
        gl.vertexAttribPointer(aVertexLoc, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STREAM_DRAW);
        const aTexCoordLoc = shader.attributes.get('aTexCoord');
        gl.enableVertexAttribArray(aTexCoordLoc);
        gl.vertexAttribPointer(aTexCoordLoc, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.useProgram(shader.program);

        // TODO this should be vao state (if this can be vao state?)
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.font.pageTextures[0]);
        gl.uniform1i(shader.uniforms.get('page'), 0);

        gl.uniformMatrix4fv(shader.uniforms.get('mvp'), false, new Float32Array(mvp.data));

        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
    }
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} path path to `.fnt` file, pages should be in the same folder
 * @returns {Promise<Font>}
 */
export async function loadFont(gl, path) {
    const bmfontSource = await utils.loadTextFromUrl(path);
    const bmfont = parseBmFont.parseBmFont(bmfontSource);

    const pageDir = path.split('/').slice(0, -1).join('/');
    const pageImages = await Promise.all(bmfont.pages.map((pageName) => {
        return utils.loadImageDataFromUrl(`${pageDir}/${pageName}`);
    }));
    const pageTextures = pageImages.map((img) => {
        const texture = gl.createTexture();
        console.assert(texture != null);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    });

    const vertSource = await utils.loadTextFromUrl('/resources/bmfont.vert');
    const fragSource = await utils.loadTextFromUrl('/resources/bmfont.frag');
    const shader = utils.loadShader(gl, [
        [gl.VERTEX_SHADER, vertSource],
        [gl.FRAGMENT_SHADER, fragSource],
    ], ['aVertex', 'aTexCoord'], ['mvp', 'page']);

    return new Font(bmfont, pageTextures, shader);
}
