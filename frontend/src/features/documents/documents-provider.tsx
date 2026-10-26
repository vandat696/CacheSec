"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";
import {
  isDocumentCategory,
  queueDocuments,
  type DocumentCategory,
  type DocumentIssue,
  type QueuedDocument,
} from "./document-model";

type State = { documents: QueuedDocument[]; issues: DocumentIssue[] };
type Action =
  | {
      type: "add";
      entries: { file: File; id: string }[];
      category: DocumentCategory;
    }
  | { type: "categorize"; id: string; category: DocumentCategory }
  | { type: "remove"; id: string }
  | { type: "dismiss-issues" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add": {
      const ids = new Map(
        action.entries.map((entry) => [entry.file, entry.id]),
      );
      return queueDocuments(
        state.documents,
        action.entries.map((entry) => entry.file),
        action.category,
        (file) => ids.get(file)!,
      );
    }
    case "categorize":
      if (!isDocumentCategory(action.category)) return state;
      return {
        ...state,
        documents: state.documents.map((document) =>
          document.id === action.id
            ? { ...document, category: action.category }
            : document,
        ),
      };
    case "remove":
      return {
        ...state,
        documents: state.documents.filter(
          (document) => document.id !== action.id,
        ),
      };
    case "dismiss-issues":
      return { ...state, issues: [] };
  }
}

type DocumentsContextValue = State & {
  addFiles: (files: readonly File[], category: DocumentCategory) => void;
  categorize: (id: string, category: DocumentCategory) => void;
  remove: (id: string) => void;
  dismissIssues: () => void;
};
const DocumentsContext = createContext<DocumentsContextValue | null>(null);

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { documents: [], issues: [] });
  return (
    <DocumentsContext.Provider
      value={{
        ...state,
        addFiles: (files, category) =>
          dispatch({
            type: "add",
            entries: files.map((file) => ({ file, id: crypto.randomUUID() })),
            category,
          }),
        categorize: (id, category) =>
          dispatch({ type: "categorize", id, category }),
        remove: (id) => dispatch({ type: "remove", id }),
        dismissIssues: () => dispatch({ type: "dismiss-issues" }),
      }}
    >
      {children}
    </DocumentsContext.Provider>
  );
}

export function useDocuments() {
  const context = useContext(DocumentsContext);
  if (!context) throw new Error("useDocuments cần DocumentsProvider.");
  return context;
}
