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
                    value += this.get(row, i) * other.get(i, col);
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
        return matrices.reduceRight((a, b) => a.mul(b), Mat4.identity())
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
}
