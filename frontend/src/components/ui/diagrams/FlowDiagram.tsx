"use client";
import { Fragment } from "react";
export type FlowNode = {
  id: string;
  label: string;
  helper?: string;
  description?: string;
};
export function FlowDiagram({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: readonly FlowNode[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  return (
    <div className="nui nui-theme nui-flow">
      {nodes.length ? (
        <>
          <div className="nui-flow-track">
            {nodes.map((node, index) => (
              <Fragment key={node.id}>
                {index > 0 && (
                  <span className="nui-arrow" aria-hidden="true">
                    →
                  </span>
                )}
                <button
                  className="nui-node"
                  type="button"
                  aria-pressed={selected?.id === node.id}
                  onClick={() => onSelect(node.id)}
                >
                  <strong>{node.label}</strong>
                  <span>{node.helper}</span>
                </button>
              </Fragment>
            ))}
          </div>
          <div className="nui-flow-detail" role="status">
            <strong>{selected?.label}</strong>
            <p className="nui-help">{selected?.description}</p>
          </div>
        </>
      ) : (
        <p className="nui-empty">Chưa có bước xử lý.</p>
      )}
    </div>
  );
}
