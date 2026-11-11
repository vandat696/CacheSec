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
