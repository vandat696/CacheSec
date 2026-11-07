"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  initialProfiles,
  validateProfile,
  type ProfileDraft,
} from "./cacheProfileModel.ts";
import { type ExperimentPlan } from "./experimentPlanModel.ts";
import { type SetupPlan } from "./setupPlanModel.ts";

type ExperimentConfigState = {
  profiles: ProfileDraft[];
  plans: ExperimentPlan[];
  saveProfile: (profile: ProfileDraft) => void;
  addPlan: (plan: ExperimentPlan) => void;
  setupPlan: SetupPlan | null;
  saveSetupPlan: (plan: SetupPlan) => void;
};
const ExperimentConfigContext = createContext<ExperimentConfigState | null>(
  null,
);

export function ExperimentConfigProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [profiles, setProfiles] = useState(() =>
    initialProfiles.map((profile) => ({ ...profile })),
  );
  const [plans, setPlans] = useState<ExperimentPlan[]>([]);
  const [setupPlan, saveSetupPlan] = useState<SetupPlan | null>(null);
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
    <ExperimentConfigContext.Provider
      value={{
        profiles,
        plans,
        saveProfile,
        addPlan: (plan) => setPlans((current) => [plan, ...current]),
        setupPlan,
        saveSetupPlan,
      }}
    >
      {children}
    </ExperimentConfigContext.Provider>
  );
}

export function useExperimentConfig() {
  const workspace = useContext(ExperimentConfigContext);
  if (!workspace)
    throw new Error("useExperimentConfig cần ExperimentConfigProvider.");
  return workspace;
}
