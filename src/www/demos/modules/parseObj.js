/**
 * a super stupid obj loader.
 */

/**
 * @typedef {Object} FaceVertex
 * @property {number} vertex
 * @property {number} normal
 *
 * @typedef {Object} Model
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
            vertices.push(rest.map(parseFloat));
            break;
        case 'vn':
            console.assert(rest.length == 3);
            normals.push(rest.map(parseFloat));
            break;
        case 'f':
            console.assert(rest.length == 3);

            faces.push(rest.map((s) => {
                const indices = s.split('/').map((s) => s.trim());
                console.assert(indices.length == 3);

                const vertex = parseInt(indices[0]);
                const normal = indices[2].length > 0 ? parseInt(indices[2]) : 0

                return { vertex, normal };
            }));
            break;
        default:
            throw new Error(`unknown obj operator: '${values[0]}'`);
        }
    }

    return { vertices, normals, faces };
}
