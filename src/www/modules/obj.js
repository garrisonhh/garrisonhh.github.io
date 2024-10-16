/**
 * a super stupid obj loader.
 */

import { Parser } from "./Parser.js";

/**
 * @param {Parser} p
 * @returns {number}
 */
function expectNumber(p) {
    const res = p.parseNumber();
    if (res == null) {
        throw new Error("expected number");
    }
    return res;
}

/**
 * @param {Parser} p
 * @returns {Array<number>?}
 */
function expectVec3(p) {
    const v = [];
    for (let i = 0; i < 3; ++i) {
        p.skipSpaces();
        v.push(expectNumber(p));
    }
    return v;
}

/**
 * @param {Parser} p
 * @returns {FaceVertex[]}
 */
function expectFaceVertex(p) {
    p.skipSpaces();
    const vertex = p.parseNumber() ?? 0;
    if (p.next() != '/') throw new Error("expected '/'");
    const texcoord = p.parseNumber() ?? 0;
    if (p.next() != '/') throw new Error("expected '/'");
    const normal = p.parseNumber() ?? 0;
    return { vertex, texcoord, normal };
}

/**
 * @param {Parser} p
 * @returns {FaceVertex[]}
 */
function expectFace(p) {
    const face = [];
    for (let i = 0; i < 3; ++i) {
        p.skipSpaces();
        face.push(expectFaceVertex(p));
    }
    return face;
}

/**
 * @typedef {Object} FaceVertex
 * @property {number} vertex
 * @property {number} texcoord
 * @property {number} normal
 *
 * @typedef {Object} Mesh
 * @property {number[][]} vertices flat vec3 array
 * @property {number[][]} normals flat vec3 array
 * @property {FaceVertex[][]} faces
 *
 * @param {string} text
 */
export function parseObj(text) {
    const vertices = [];
    const normals = [];
    const faces = [];

    const parser = new Parser(text);

    while (true) {
        parser.skipSpaces();
        if (parser.done()) break;

        const op = parser.parseSeq(Parser.matches(/\S/));
        switch (op) {
        case '':
        case '#':
        case 'o':
        case 's':
            break;
        case 'v':
            vertices.push(expectVec3(parser));
            break;
        case 'vn':
            normals.push(expectVec3(parser));
            break;
        case 'f':
            faces.push(expectFace(parser));
            break;
        default:
            throw new Error(`unknown obj operator: '${op}'`);
        }

        parser.parseLine();
    }

    return { vertices, normals, faces };
}
