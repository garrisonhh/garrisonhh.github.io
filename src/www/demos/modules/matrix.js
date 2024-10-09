export class Matrix {
    /**
     * @param {number} columns number of columns
     * @param {number[]} data column-major data
     */
    constructor(columns, data) {
        if (data.length % columns != 0) {
            throw new Error(
                `matrix elements (${data.length}) is not evenly divisible by `
                `columns (${columns})`
            );
        }

        this.columns = columns;
        this.data = data;
    }

    /**
     * @param {number} columns
     * @param {number} rows
     * @returns {Matrix}
     */
    static zeroes(columns, rows) {
        return new Matrix(columns, new Array(columns * rows).fill(0));
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
    get(row, col) {
        if (row < 0 || row >= this.rows ||
            col < 0 || col >= this.columns)
        {
            throw new Error(`matrix coordinate (${row}, ${col}) out of bounds (${this.rows}, ${this.columns})`);
        }

        return this.data[row * this.columns + col];
    }

    /**
     * @param {number} row
     * @param {number} col
     * @param {number} value
     */
    set(row, col, value) {
        if (this.row < 0 || this.row >= this.rows ||
            this.col < 0 || this.col >= this.columns)
        {
            throw new Error("matrix coordinate out of bounds");
        }

        this.data[row * this.columns + col] = value;
    }

    /** @returns {string} */
    text() {
        let text = "";
        for (let y = 0; y < this.rows; ++y) {
            for (let x = 0; x < this.rows; ++x) {
                if (x > 0) text += ", ";
                text += `${this.get(y, x)}`;
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
        const t = new Matrix(this.rows, new Array(this.data.length));
        for (let col = 0; col < this.columns; ++col) {
            for (let row = 0; row < this.rows; ++row) {
                t.set(col, row, this.get(row, col));
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
        const prod = Matrix.zeroes(this.columns, other.rows);
        console.assert(other.columns == this.rows);
        for (let col = 0; col < prod.columns; ++col) {
            for (let row = 0; row < prod.rows; ++row) {
                let value = 0;
                for (let i = 0; i < other.columns; ++i) {
                    value += other.get(row, i) * this.get(i, col);
                }

                prod.set(row, col, value);
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
     * @param {Array<number, 3>} v
     * @returns {Array<number, 3>}
     */
    static apply(transform, v) {
        const v4 = new Matrix(1, [...v, 1.0]);
        const res = transform.mul(v4);
        return res.data.slice(0, 3);
    }

    /** @returns {Matrix} */
    static identity() {
        return new Matrix(4, [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
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
        const c1 = (far + near) / (far - near);
        const c2 = (2 * far * near) / (far - near);

        // scale x and y to screen ratio
        let sx = 1.0;
        let sy = 1.0;
        if (width > height) {
            sx = height / width;
        } else {
            sy = width / height;
        }

        return new Matrix(4, [
            sx, 0, 0, 0,
            0, sy, 0, 0,
            0, 0, c1, 1,
            0, 0, c2, 1
        ]);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {Matrix}
     */
    static scale(x, y, z) {
        return new Matrix(4, [
            x, 0, 0, 0,
            0, y, 0, 0,
            0, 0, z, 0,
            0, 0, 0, 1,
        ]);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {Matrix}
     */
    static translate(x, y, z) {
        return new Matrix(4, [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, z, 1,
        ]);
    }

    /**
     * @param {number} angle
     * @returns {Matrix}
     */
    static rotateX(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Matrix(4, [
            1, 0, 0, 0,
            0, c, s, 0,
            0, -s, c, 0,
            0, 0, 0, 1,
        ]);
    }

    /**
     * @param {number} angle
     * @returns {Matrix}
     */
    static rotateY(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Matrix(4, [
            c, 0, s, 0,
            0, 1, 0, 0,
            -s, 0, c, 0,
            0, 0, 0, 1,
        ]);
    }

    /**
     * @param {number} angle
     * @returns {Matrix}
     */
    static rotateZ(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Matrix(4, [
            c, s, 0, 0,
            -s, c, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ]);
    }

    /**
     * @param {Matrix} mat
     * @returns {Matrix}
     */
    static invert(mat) {
        // translated from raymath.h, so super ugly
        const res = new Matrix(mat.columns, new Array(mat.data.length));

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
