/**
 * slightly patches {@link window.requestAnimationFrame} to allow usage of a
 * context object without creating an awkward global variable
 *
 * @typedef {(ctx: any, ts: DOMHighResTimeStamp) => void} FrameCallback
 * @param {any} context
 * @param {FrameCallback} callback
 */
export function requestAnimationFrame(context, callback) {
    const closure = (ts) => {
        callback(context, ts);
    };
    window.requestAnimationFrame(closure);
}
