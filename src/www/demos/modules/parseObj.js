/**
 * a super stupid obj loader.
 */

/**
 * @typedef {Object} Model
 * @property {Float32Array} vertices flat vec3 array
 * @property {Uint16Array} faces flat triangle index array
 *
 * @param {string} text
 */
export function parseObj(text) {
    const vertices = [];
    const faces = [];

    for (const line of text.split('\n')) {
        const values = [...line.trim().matchAll(/\S+/g)].flatMap((x) => x);
        if (values.length == 0) continue;
        const rest = values.slice(1);

        switch (values[0]) {
        case '#':
        case 'o':
        case 's':
            break;
        case 'v':
            console.assert(rest.length == 3);
            vertices.push(...rest.map(parseFloat));
            break;
        case 'f':
            console.assert(rest.length == 3);
            faces.push(...rest.map(parseInt));
            break;
        default:
            throw new Error(`unknown obj operator: '${values[0]}'`);
        }
    }

    return {
        vertices: new Float32Array(vertices),
        faces: new Uint16Array(faces),
    };
}
