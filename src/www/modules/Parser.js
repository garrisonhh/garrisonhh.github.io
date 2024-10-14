export class Parser {
    /**
     * @param {string} text
     */
    constructor(text) {
        this.text = text;
        this.index = 0;
    }

    /**
     * @param {number?} offset
     * @returns {string?}
     */
    peek(offset) {
        const i = this.index + (offset ?? 0);
        return i > this.text.length ? null : this.text[i];
    }

    /** @param {number?} count */
    advance(count) {
        this.index = Math.min(this.index + (count ?? 1), this.text.length);
    }

    /** @returns {string?} */
    next() {
        const res = this.peek();
        if (res != null) this.advance();
        return res;
    }

    /** @returns {boolean} */
    done() {
        return this.index >= this.text.length;
    }

    /** @typedef {(ch: string) => boolean} Predicate */

    /**
     * @param {RegExp} re
     * @returns {Predicate}
     */
    static matches(re) {
        return (ch) => {
            if (ch == null) return false;
            return ch.match(re) != null;
        }
    }

    /** @type {Predicate} */
    static isSpace = Parser.matches(/\s/);

    /** @type {Predicate} */
    static isAlpha = Parser.matches(/[a-zA-Z]/);

    /** @type {Predicate} */
    static isWord = Parser.matches(/\w/);

    /**
     * if next character matches pred, advance and return true. otherwise
     * return false.
     *
     * @param {Predicate} pred
     * @returns {boolean}
     */
    parseChar(pred) {
        const ch = this.peek();
        if (ch == null) return;
        const res = pred(ch);
        if (res) this.advance();
        return res;
    }

    /**
     * advance while next character matches pred.
     *
     * @param {Predicate} pred
     * @returns {string}
     */
    parseSeq(pred) {
        const start = this.index;
        while (this.parseChar(pred))
            ;
        return this.text.slice(start, this.index);
    }

    /**
     * parse until a newline
     *
     * @returns {string}
     */
    parseLine() {
        const start = this.index;
        while (true) {
            const ch = this.next();
            if (ch == null || ch == '\n') break;
        }

        return this.text.slice(start, this.index);
    }

    /**
     * skip spaces, optionally including newline
     *
     * @param {boolean?} includeNewline not included by default
     */
    skipSpaces(includeNewline) {
        const included = includeNewline ?? false;
        this.parseSeq((ch) => {
            if (ch == '\n') return included;
            return Parser.isSpace(ch);
        });
    }

    /** @returns {string} */
    parseWord() {
        return this.parseSeq(Parser.isWord);
    }

    /** @returns {number?} */
    parseNumber() {
        const slice = this.text.slice(this.index);
        const match = slice.match(/^[-+]?\d+\.?\d*/);
        if (match == null) return null;
        this.advance(match[0].length);
        return parseFloat(match[0]);
    }

    /**
     * attempt to parse a c-style string literal
     *
     * @returns {string?}
     */
    parseString() {
        const fst = this.peek();
        if (fst != '"') return null;
        this.advance();

        let str = "";

        let esc = false;
        while (true) {
            const ch = this.next();
            if (ch == null) {
                throw new Error("unterminated string");
            } else if (esc) {
                esc = false;
            } else if (ch == '\\') {
                esc = true;
                continue;
            } else if (ch == '"') {
                break;
            }

            str += ch;
        }

        return str;
    }
}
