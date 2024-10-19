import { Parser } from './Parser.js';
import * as utils from './utils.js';

/**
 * YAYYY FUCKASSS TYPEDEF
 *
 * @typedef {{
 *     face: string;
 *     size: number;
 *     bold: number;
 *     italic: number;
 *     charset: string;
 *     unicode: number;
 *     stretchH: number;
 *     smooth: number;
 *     aa: number;
 *     padding: number[];
 *     spacing: number[];
 *     outline: number;
 *}} BmFontInfo
 *
 * @typedef {{
 *     lineHeight: number;
 *     base: number;
 *     scaleW: number;
 *     scaleH: number;
 *     pages: number;
 *     packed: number;
 *     alphaChnl: number;
 *     redChnl: number;
 *     greenChnl: number;
 *     blueChnl: number;
 * }} BmFontCommon
 *
 * @typedef {{
 *     id: number;
 *     x: number;
 *     y: number;
 *     width: number;
 *     height: number;
 *     xoffset: number;
 *     yoffset: number;
 *     xadvance: number;
 *     page: number;
 *     chnl: number;
 * }} BmFontChar
 *
 * @typedef {{
 *     first: number;
 *     second: number;
 *     amount: number;
 * }} BmFontKerning
 *
 * @typedef {{
 *    info: BmFontInfo;
 *    common: BmFontCommon;
 *    pages: string[];
 *    chars: BmFontChar[];
 *    kernings: BmFontKerning[];
 * }} BmFont
 */

/**
 * @param {Parser} p
 * @returns {string | number | number[] | null}
 */
function parseValue(p) {
    if (p.peek() == '"') {
        return p.parseString();
    }

    const n = p.parseNumber();
    if (n == null || p.peek() != ',') {
        return n;
    }

    const arr = [n];
    while (p.parseChar((ch) => ch == ',')) {
        const next = p.parseNumber();
        if (next == null) return arr;
        arr.push(next);
    }

    return arr;
}

/**
 * parse a set of key/value pairs, which is basically the entire `.fnt` file
 *
 * @param {Parser} p
 */
function parseKv(p) {
    const obj = {};
    while (true) {
        p.skipSpaces();
        if (p.parseChar((ch) => ch == '\n')) {
            break;
        }

        const key = p.parseSeq(Parser.matches(/[a-zA-Z0-9]/));
        console.assert(key.length > 0);
        const res = p.parseChar((ch) => ch == '=');
        console.assert(res);
        const value = parseValue(p);
        console.assert(value != null);

        obj[key] = value;
    }

    return obj;
}

/**
 * parses a bitmap font from its text (the `.fnt` file)
 *
 * @param {string} text
 * @returns {BmFont}
 */
export function parseBmFont(text) {
    const p = new Parser(text);

    let info = undefined;
    let common = undefined;
    const pages = [];
    const chars = [];
    const kernings = [];

    while (!p.done()) {
        p.skipSpaces(true);

        const op = p.parseWord();
        const kv = parseKv(p);
        switch (op) {
        case 'chars':
        case 'kernings':
            break;
        case 'page':
            pages[kv.id] = kv.file;
            break;
        case 'info':
            info = kv;
            break;
        case 'common':
            common = kv;
            break;
        case 'char':
            chars.push(kv);
            break;
        case 'kerning':
            kernings.push(kv);
            break;
        default:
            throw new Error(`unknown bmfont operator: '${op}'`);
        }
    }

    return { info, common, pages, chars, kernings };
}

export class Font {
    /**
     * @param {BmFont} bmfont
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
     * @returns {{ data: BmFontChar; rect: number[]; }}
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

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} path path to `.fnt` file, pages should be in the same folder
 * @returns {Promise<Font>}
 */
export async function loadFont(gl, path) {
    const bmfontSource = await utils.loadTextFromUrl(path);
    const bmfont = parseBmFont(bmfontSource);

    const pageDir = path.split('/').slice(0, -1).join('/');
    const pageTextures = await Promise.all(bmfont.pages.map((pageName) => {
        return utils.loadTextureFromUrl(gl, `${pageDir}/${pageName}`);
    }));

    const vertSource = await utils.loadTextFromUrl('/resources/bmfont.vert');
    const fragSource = await utils.loadTextFromUrl('/resources/bmfont.frag');
    const shader = utils.loadShader(gl, [
        [gl.VERTEX_SHADER, vertSource],
        [gl.FRAGMENT_SHADER, fragSource],
    ], [], ['mvp', 'fontPage']);

    return new Font(bmfont, pageTextures, shader);
}
