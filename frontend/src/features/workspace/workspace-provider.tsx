"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  initialProfiles,
  validateProfile,
  type ExperimentPlan,
  type ProfileDraft,
} from "./workspace-model";

type Workspace = {
  profiles: ProfileDraft[];
  plans: ExperimentPlan[];
  saveProfile: (profile: ProfileDraft) => void;
  addPlan: (plan: ExperimentPlan) => void;
};
const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState(() =>
    initialProfiles.map((profile) => ({ ...profile })),
  );
  const [plans, setPlans] = useState<ExperimentPlan[]>([]);
  function saveProfile(draft: ProfileDraft) {
    const error = validateProfile(draft);
    if (error) throw new Error(error);
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === draft.id
          ? {
              ...draft,
              name: draft.name.trim(),
              revision: profile.revision + 1,
            }
          : profile,
      ),
    );
  }
  return (
    <WorkspaceContext.Provider
      value={{
        profiles,
        plans,
        saveProfile,
        addPlan: (plan) => setPlans((current) => [plan, ...current]),
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace cần WorkspaceProvider.");
  return workspace;
}
