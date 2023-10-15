const HIGHLIGHTS = [...`
    linux
    ubuntu arch nixos
    c89 c2x gcc clang make binutils
    x86
    bash python
    ai ml llms transformers numpy pytorch tensorflow
    html js css react webassembly REST
`.match(/\w+/g)].map((word) => new RegExp(`(.*)\\b(${word})\\b(.*)`));

/**
 * text node content -> a list of strings + highlights. discards whitespace
 * (this is messy, deserves a rewrite at some point)
*/
function highlightedText(text) {
    let nodes = [text];

    for (const hlRegexp of HIGHLIGHTS) {
        const next = []

        for (const node of nodes) {
            if (typeof node !== 'string') {
                next.push(node);
                continue;
            }

            const matches = node.match(hlRegexp);
            if (matches !== null) {
                const [pre, hlWord, post] = matches.slice(1);
                console.log(pre, hlWord, post);

                const hlSpan = document.createElement('span');
                hlSpan.textContent = hlWord;

                next.push(pre, hlSpan, post);
            } else {
                next.push(node);
            }
        }

        console.log(next);
        nodes = next;
    }

    return nodes;
}

/** adds highlight tags to skills */
function highlightSkills() {
    document.querySelectorAll("#skills *").forEach((li) => {
        li.childNodes.forEach((elem) => {
            if (elem.nodeType != Node.TEXT_NODE) return;
            elem.replaceWith(...highlightedText(elem.textContent));
        });
    });
}

addEventListener('load', () => {
    highlightSkills();
});