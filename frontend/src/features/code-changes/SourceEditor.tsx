"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { basicSetup, EditorView } from "codemirror";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab, redo } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { indentUnit } from "@codemirror/language";

type Props = { value: string; readOnly: boolean; active: boolean; label: string;
  onChange?: (text: string) => void; onSave?: () => void };

export function SourceEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const initial = useRef(props);
  const callbacks = useRef(props);
  const permission = useRef(new Compartment());
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [scrollbarsVisible, setScrollbarsVisible] = useState(false);
  function revealScrollbars(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const bounds = view.current?.scrollDOM.getBoundingClientRect();
    if (!bounds) return;
    const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    setScrollbarsVisible(inside && (bounds.right - event.clientX <= 24 || bounds.bottom - event.clientY <= 24));
  }
  useEffect(() => { callbacks.current = props; }, [props]);
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({ parent: host.current, state: EditorState.create({
      doc: initial.current.value,
      extensions: [basicSetup, python(), EditorState.tabSize.of(4), indentUnit.of("    "),
        permission.current.of([EditorState.readOnly.of(initial.current.readOnly),
          EditorView.editable.of(!initial.current.readOnly)]),
        keymap.of([{ key: "Mod-s", preventDefault: true, run: () => { callbacks.current.onSave?.(); return true; } },
          { key: "Mod-Shift-z", run: redo, preventDefault: true }, indentWithTab]),
        EditorView.contentAttributes.of({ "aria-label": initial.current.label }),
        EditorView.updateListener.of(update => {
          if (update.docChanged) callbacks.current.onChange?.(update.state.doc.toString());
          if (update.selectionSet || update.docChanged) {
            const position = update.state.selection.main.head;
            const line = update.state.doc.lineAt(position);
            setCursor({ line: line.number, column: position - line.from + 1 });
          }
        }),
        EditorView.theme({ "&": { height: "100%", fontSize: "13px" },
          ".cm-scroller": { overflow: "auto", fontFamily: 'Consolas, "Cascadia Code", monospace' },
          ".cm-content": { padding: "12px 0" }, ".cm-line": { padding: "0 12px" },
          ".cm-gutters": { backgroundColor: "#f8fafc", borderRight: "1px solid #e5eaf1", color: "#94a3b8" },
          "&.cm-focused": { outline: "none" } }),
      ],
    }) });
    view.current = editor;
    return () => { view.current = null; editor.destroy(); };
  }, []);
  useEffect(() => {
    view.current?.dispatch({ effects: permission.current.reconfigure([
      EditorState.readOnly.of(props.readOnly), EditorView.editable.of(!props.readOnly),
    ]) });
  }, [props.readOnly]);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== props.value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: props.value },
        annotations: Transaction.addToHistory.of(false) });
    }
  }, [props.value]);
  useEffect(() => {
    if (props.active) { view.current?.requestMeasure(); view.current?.focus(); }
  }, [props.active]);
  return <div className="source-editor" hidden={!props.active}>
    <div className="source-editor-host" ref={host} data-scrollbars-visible={props.active && scrollbarsVisible}
      onPointerMoveCapture={revealScrollbars} onPointerLeave={() => setScrollbarsVisible(false)} />
    <div className="source-editor-status">{props.readOnly && <span className="source-editor-access">Chỉ đọc</span>}
      <span>Ln {cursor.line}, Col {cursor.column}</span><span>UTF-8</span><span>Python</span></div>
  </div>;
}
