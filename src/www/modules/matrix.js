export class Matrix {
    /**
     * @param {number[][]} data
     */
    constructor(data) {
        const rows = data.length;
        console.assert(data.length > 0);
        const columns = data[0].length;
        const sameRowLength =
            data.map((x) => x.length == columns)
                .reduce((a, b) => a && b);
        console.assert(sameRowLength);
        if (!sameRowLength) throw new Error();

        this.columns = columns;
        this.data = new Array(columns * rows).fill(0);

        for (let y = 0; y < rows; ++y) {
            for (let x = 0; x < columns; ++x) {
                this.set(x, y, data[y][x]);
            }
        }
    }

    /**
     * @param {number} columns
     * @param {number} rows
     * @returns {Matrix}
     */
    static zeroes(columns, rows) {
        return new Matrix(new Array(rows).fill(0).map(_ => {
            return new Array(columns).fill(0);
        }));
    }

    /** @returns {number} */
    get rows() {
        return this.data.length / this.columns;
    }

    /**
     * @param {number} row
     * @param {number} col
     * @returns {number}
     */
    get(col, row) {
        if (row < 0 || row >= this.rows ||
            col < 0 || col >= this.columns)
        {
            throw new Error(`matrix coordinate (${col}, ${row}) out of bounds (${this.columns}, ${this.rows})`);
        }

        return this.data[col * this.rows + row];
    }

    /**
     * @param {number} row
     * @param {number} col
     * @param {number} value
     */
    set(col, row, value) {
        if (row < 0 || row >= this.rows ||
            col < 0 || col >= this.columns)
        {
            throw new Error(`matrix coordinate (${col}, ${row}) out of bounds (${this.columns}, ${this.rows})`);
        }

        this.data[col * this.rows + row] = value;
    }

    /** @returns {string} */
    text() {
        let text = "";
        for (let y = 0; y < this.rows; ++y) {
            for (let x = 0; x < this.columns; ++x) {
                if (x > 0) text += ", ";
                text += `${this.get(x, y)}`;
            }
            text += "\n";
        }
        return text;
    }

    /**
     * map an operation over all data values
     *
     * @param {(value: number, col: number, row: number) => number} f
     * @returns {Matrix}
     */
    map(f) {
        const mappedData = this.data.map((x, i) => {
            return f(x, Math.floor(i / this.columns), i % this.columns);
        });
        return new Matrix(this.columns, mappedData);
    }

    /**
     * map an operation over all data values of two matrices
     *
     * @param {Matrix} other
     * @param {(a: number, b: number, col: number, row: number) => number} f
     * @returns {Matrix}
     */
    zip(other, f) {
        const mappedData = this.data.map((x, i) => {
            return f(x, other.data[i], Math.floor(i / this.columns), i % this.columns);
        });
        return new Matrix(this.columns, mappedData);
    }

    /** @returns {Matrix} */
    transpose() {
        const t = Matrix.zeroes(this.columns, this.rows);
        for (let col = 0; col < this.columns; ++col) {
            for (let row = 0; row < this.rows; ++row) {
                t.set(row, col, this.get(col, row));
            }
        }
        return t;
    }

    /**
     * @param {number} value
     * @returns {Matrix}
     */
    mulScalar(value) {
        return this.map((x) => x * value);
    }

    /**
     * @param {number} value
     * @returns {Matrix}
     */
    divScalar(value) {
        return this.map((x) => x / value);
    }

    /**
     * @param {Matrix} other
     * @returns {Matrix}
     */
    add(other) {
        return this.zip(other, (a, b) => a + b);
    }

    /**
     * @param {Matrix} other
     * @returns {Matrix}
     */
    sub(other) {
        return this.zip(other, (a, b) => a - b);
    }

    /**
     * @param {Matrix} other
     * @returns {Matrix}
     */
    mul(other) {
        const prod = Matrix.zeroes(other.columns, this.rows);
        console.assert(this.columns == other.rows);
        for (let col = 0; col < prod.columns; ++col) {
            for (let row = 0; row < prod.rows; ++row) {
                let value = 0;
                for (let i = 0; i < this.columns; ++i) {
                    value += this.get(i, row) * other.get(col, i);
                }

                prod.set(col, row, value);
            }
        }

        return prod;
    }
}

/** mat4 transformation constructors */
export class Mat4 {
    /**
     * apply a transformation to a vec3
     *
     * @param {Matrix} transform
     * @param {Array<number>} v
     * @returns {Array<number>}
     */
    static apply(transform, [x, y, z]) {
        const v4 = new Matrix([[x], [y], [z], [1.0]]);
        const res = transform.mul(v4);
        return res.data.slice(0, 3).map((x) => x / res.data[3]);
    }

    /** @returns {Matrix} */
    static identity() {
        return new Matrix([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ]);
    }

    /**
     * @param {...Matrix} matrices
     * @returns {Matrix}
     */
    static chain(...matrices) {
        return matrices.reduceRight((a, b) => b.mul(a), Mat4.identity())
    }

    /**
     * [mostly built from this](http://webgl.brown37.net/09_projections/04_projections_perspective_math.html)
     *
     * @typedef {Object} PerspectiveConfig
     * @property {number} near
     * @property {number} far
     * @property {number} width
     * @property {number} height
     *
     * @param {PerspectiveConfig} cfg
     * @returns {Matrix}
     */
    static perspective(cfg) {
        const {near, far, width, height} = cfg;

        // properly scale depth to ndc with w value
        const c1 = (far + near) / (near - far);
        const c2 = (2 * far * near) / (near - far);

        // scale x and y to screen ratio
        let sx = 1.0;
        let sy = 1.0;
        if (width > height) {
            sx = height / width;
        } else {
            sy = width / height;
        }

        return new Matrix([
            [sx, 0, 0, 0],
            [0, sy, 0, 0],
            [0, 0, c1, c2],
            [0, 0, -1, 0],
        ]);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {Matrix}
     */
    static scale(x, y, z) {
        return new Matrix([
            [x, 0, 0, 0],
            [0, y, 0, 0],
            [0, 0, z, 0],
            [0, 0, 0, 1],
        ]);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {Matrix}
     */
    static translate(x, y, z) {
        return new Matrix([
            [1, 0, 0, x],
            [0, 1, 0, y],
            [0, 0, 1, z],
            [0, 0, 0, 1],
        ]);
    }

    /**
     * @param {number} angle
     * @returns {Matrix}
     */
    static rotateX(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Matrix([
            [1, 0, 0, 0],
            [0, c, -s, 0],
            [0, s, c, 0],
            [0, 0, 0, 1],
        ]);
    }

    /**
     * @param {number} angle
     * @returns {Matrix}
     */
    static rotateY(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Matrix([
            [c, 0, -s, 0],
            [0, 1, 0, 0],
            [s, 0, c, 0],
            [0, 0, 0, 1],
        ]);
    }

    /**
     * @param {number} angle
     * @returns {Matrix}
     */
    static rotateZ(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Matrix([
            [c, -s, 0, 0],
            [s, c, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ]);
    }

    /**
     * @param {Matrix} mat
     * @returns {Matrix}
     */
    static invert(mat) {
        // translated from raymath.h, so super ugly
        const res = Matrix.zeroes(mat.columns, mat.rows);

        const b00 = mat.get(0, 0)*mat.get(1, 1) - mat.get(0, 1)*mat.get(1, 0);
        const b01 = mat.get(0, 0)*mat.get(1, 2) - mat.get(0, 2)*mat.get(1, 0);
        const b02 = mat.get(0, 0)*mat.get(1, 3) - mat.get(0, 3)*mat.get(1, 0);
        const b03 = mat.get(0, 1)*mat.get(1, 2) - mat.get(0, 2)*mat.get(1, 1);
        const b04 = mat.get(0, 1)*mat.get(1, 3) - mat.get(0, 3)*mat.get(1, 1);
        const b05 = mat.get(0, 2)*mat.get(1, 3) - mat.get(0, 3)*mat.get(1, 2);
        const b06 = mat.get(2, 0)*mat.get(3, 1) - mat.get(2, 1)*mat.get(3, 0);
        const b07 = mat.get(2, 0)*mat.get(3, 2) - mat.get(2, 2)*mat.get(3, 0);
        const b08 = mat.get(2, 0)*mat.get(3, 3) - mat.get(2, 3)*mat.get(3, 0);
        const b09 = mat.get(2, 1)*mat.get(3, 2) - mat.get(2, 2)*mat.get(3, 1);
        const b10 = mat.get(2, 1)*mat.get(3, 3) - mat.get(2, 3)*mat.get(3, 1);
        const b11 = mat.get(2, 2)*mat.get(3, 3) - mat.get(2, 3)*mat.get(3, 2);

        const invDet = 1.0 / (b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06);

        res.data[0] = (mat.get(1, 1)*b11 - mat.get(1, 2)*b10 + mat.get(1, 3)*b09)*invDet;
        res.data[1] = (-mat.get(0, 1)*b11 + mat.get(0, 2)*b10 - mat.get(0, 3)*b09)*invDet;
        res.data[2] = (mat.get(3, 1)*b05 - mat.get(3, 2)*b04 + mat.get(3, 3)*b03)*invDet;
        res.data[3] = (-mat.get(2, 1)*b05 + mat.get(2, 2)*b04 - mat.get(2, 3)*b03)*invDet;
        res.data[4] = (-mat.get(1, 0)*b11 + mat.get(1, 2)*b08 - mat.get(1, 3)*b07)*invDet;
        res.data[5] = (mat.get(0, 0)*b11 - mat.get(0, 2)*b08 + mat.get(0, 3)*b07)*invDet;
        res.data[6] = (-mat.get(3, 0)*b05 + mat.get(3, 2)*b02 - mat.get(3, 3)*b01)*invDet;
        res.data[7] = (mat.get(2, 0)*b05 - mat.get(2, 2)*b02 + mat.get(2, 3)*b01)*invDet;
        res.data[8] = (mat.get(1, 0)*b10 - mat.get(1, 1)*b08 + mat.get(1, 3)*b06)*invDet;
        res.data[9] = (-mat.get(0, 0)*b10 + mat.get(0, 1)*b08 - mat.get(0, 3)*b06)*invDet;
        res.data[10] = (mat.get(3, 0)*b04 - mat.get(3, 1)*b02 + mat.get(3, 3)*b00)*invDet;
        res.data[11] = (-mat.get(2, 0)*b04 + mat.get(2, 1)*b02 - mat.get(2, 3)*b00)*invDet;
        res.data[12] = (-mat.get(1, 0)*b09 + mat.get(1, 1)*b07 - mat.get(1, 2)*b06)*invDet;
        res.data[13] = (mat.get(0, 0)*b09 - mat.get(0, 1)*b07 + mat.get(0, 2)*b06)*invDet;
        res.data[14] = (-mat.get(3, 0)*b03 + mat.get(3, 1)*b01 - mat.get(3, 2)*b00)*invDet;
        res.data[15] = (mat.get(2, 0)*b03 - mat.get(2, 1)*b01 + mat.get(2, 2)*b00)*invDet;

        return res;
    }

}
