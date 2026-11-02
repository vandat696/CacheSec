// UI simulation only. No identity, authorization, tests or deployment are executed here.
export type PreviewRole = "reviewer" | "developer";
export type CacheScenario = "hit" | "miss" | "rejected";
export type PreviewEvent = { id: number; revision: number; text: string };
export type DeveloperPreview = {
  revision: number;
  testRevision: number | null;
  acknowledgedRevision: number | null;
  approval: "pending" | "approved" | "changes-requested";
  role: PreviewRole;
  cacheScenario: CacheScenario;
  notice: string;
  events: PreviewEvent[];
};

export type PreviewAction =
  | { type: "tests" }
  | { type: "acknowledge"; checked: boolean }
  | { type: "approve" | "request-changes"; revision: number }
  | { type: "role"; role: PreviewRole }
  | { type: "cache"; scenario: CacheScenario }
  | { type: "revise" }
  | { type: "reset" };

export function initialDeveloperPreview(): DeveloperPreview {
  return {
    revision: 1,
    testRevision: null,
    acknowledgedRevision: null,
    approval: "pending",
    role: "reviewer",
    cacheScenario: "hit",
    notice: "",
    events: [{ id: 1, revision: 1, text: "Mở đề xuất minh họa: bổ sung cờ kiểm tra ngày hết hạn." }],
  };
}

function record(state: DeveloperPreview, text: string): DeveloperPreview {
  return {
    ...state,
    notice: text,
    events: [...state.events, { id: state.events.length + 1, revision: state.revision, text }],
  };
}

export function canPreviewApproval(state: DeveloperPreview): boolean {
  return state.role === "reviewer" && state.testRevision === state.revision &&
    state.acknowledgedRevision === state.revision && state.approval === "pending";
}

export function developerPreviewReducer(state: DeveloperPreview, action: PreviewAction): DeveloperPreview {
  switch (action.type) {
    case "reset": return initialDeveloperPreview();
    case "tests":
      if (state.testRevision === state.revision) return state;
      return record({ ...state, testRevision: state.revision }, `Đã mở kết quả kiểm thử mẫu cho demo-r${state.revision}; chưa chạy test thật.`);
    case "acknowledge":
      return { ...state, acknowledgedRevision: action.checked ? state.revision : null };
    case "role":
      if (state.role === action.role) return state;
      return record({ ...state, role: action.role, approval: "pending", acknowledgedRevision: null }, "Đổi vai trò mô phỏng; quyết định duyệt mẫu được đặt lại.");
    case "cache":
      return record({ ...state, cacheScenario: action.scenario }, `Xem kịch bản cache ${action.scenario.toUpperCase()} minh họa; chưa thực hiện lookup.`);
    case "approve":
      if (action.revision !== state.revision || !canPreviewApproval(state)) {
        return record(state, "Chưa đủ điều kiện duyệt mẫu: cần đúng phiên bản, vai trò reviewer, kết quả mẫu và xác nhận đã xem diff.");
      }
      return record({ ...state, approval: "approved" }, `Reviewer mẫu đã duyệt demo-r${state.revision}. Đây không phải quyền triển khai.`);
    case "request-changes":
      if (action.revision !== state.revision || state.role !== "reviewer" || state.approval !== "pending") return state;
      return record({ ...state, approval: "changes-requested", acknowledgedRevision: null }, `Yêu cầu chỉnh sửa demo-r${state.revision} trong bản mẫu.`);
    case "revise": {
      const revision = state.revision + 1;
      return record({ ...state, revision, testRevision: null, approval: "pending", acknowledgedRevision: null }, `Đổi sang demo-r${revision}; kết quả mẫu và phê duyệt cũ không còn áp dụng.`);
    }
  }
}
