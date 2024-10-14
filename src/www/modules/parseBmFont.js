import { Parser } from "./parser.js";

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
