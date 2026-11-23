export const editableSource = '.source-editor:not([hidden]) .cm-content[aria-label="Mã bản sửa"]';

export async function editorShortcut(cdp, key, shift = false) {
  const upper = key.toUpperCase();
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: shift ? upper : key, code: `Key${upper}`,
    windowsVirtualKeyCode: upper.charCodeAt(0), modifiers: 2 | (shift ? 8 : 0) });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code: `Key${upper}`,
    windowsVirtualKeyCode: upper.charCodeAt(0), modifiers: 0 });
}

export async function replaceEditor({ cdp, evaluate }, value) {
  await evaluate(`document.querySelector(${JSON.stringify(editableSource)}).focus()`);
  await editorShortcut(cdp, "a");
  await cdp("Input.insertText", { text: value });
}

export const visibleEditorText = "[...document.querySelectorAll('.source-editor:not([hidden]) .cm-line')].map(line => line.textContent).join('\\n')";

// CodeMirror virtualizes offscreen lines. Read the document by scrolling its
// viewport, without accessing editor internals or changing the document.
export async function readEditorText({ evaluate }) {
  return evaluate(`(async () => {
    const editor = document.querySelector('.source-editor:not([hidden])');
    const scroller = editor?.querySelector('.cm-scroller');
    if (!scroller || !scroller.clientHeight) throw new Error('Editor is not visible');
    const original = scroller.scrollTop;
    const lines = new Map();
    const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      scroller.scrollTop = 0;
      await settle();
      for (let step = 0; step < 10000; step++) {
        const bounds = scroller.getBoundingClientRect();
        for (const line of editor.querySelectorAll('.cm-line')) {
          const position = Math.round(line.getBoundingClientRect().top - bounds.top + scroller.scrollTop);
          const text = line.textContent;
          if (lines.has(position) && lines.get(position) !== text) throw new Error('Editor changed while reading');
          lines.set(position, text);
        }
        const previous = scroller.scrollTop;
        if (previous + scroller.clientHeight >= scroller.scrollHeight - 1) {
          return [...lines].sort((a, b) => a[0] - b[0]).map(item => item[1]).join('\\n');
        }
        scroller.scrollTop += Math.max(1, Math.floor(scroller.clientHeight / 2));
        await settle();
        if (scroller.scrollTop <= previous) throw new Error('Editor did not scroll');
      }
      throw new Error('Editor read exceeded scroll limit');
    } finally {
      scroller.scrollTop = original;
      await settle();
    }
  })()`);
}
