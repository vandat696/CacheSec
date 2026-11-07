import type { ProfileDraft } from "./cacheProfileModel.ts";

export const workloads = [
  {
    id: "basic",
    name: "Câu hỏi cơ bản",
    description: "Nghỉ phép, cấp thiết bị và cách diễn đạt gần nghĩa.",
    caseIds: ["leave", "equipment", "paraphrase"],
  },
  {
    id: "repeat",
    name: "Câu hỏi lặp lại",
    description:
      "Cùng một câu hỏi xuất hiện hai lần; chưa thực hiện cache lookup.",
    caseIds: ["leave", "leave-repeat"],
  },
] as const;

export type PlanInput = {
  name: string;
  workloadId: string;
  repeats: number;
  phase: "cold" | "warm";
  seed: number;
  profileIds: [string, string];
};
export type ExperimentPlan = {
  id: string;
  createdAt: string;
  kind: "experiment-plan";
  previewOnly: true;
  name: string;
  workloadId: string;
  caseIds: string[];
  repeats: number;
  phase: "cold" | "warm";
  seed: number;
  profiles: [ProfileDraft, ProfileDraft];
  plannedQueries: number;
  results: null;
};

export function createExperimentPlan(
  input: PlanInput,
  profiles: readonly ProfileDraft[],
  id: string,
  createdAt: string,
): ExperimentPlan {
  const workload = workloads.find((item) => item.id === input.workloadId);
  const selected = input.profileIds.map((profileId) =>
    profiles.find((profile) => profile.id === profileId),
  );
  if (!input.name.trim() || input.name.trim().length > 80)
    throw new Error("Tên kế hoạch cần từ 1 đến 80 ký tự.");
  if (
    !workload ||
    selected.some((profile) => !profile) ||
    selected[0]?.id === selected[1]?.id
  )
    throw new Error("Chọn workload và hai profile khác nhau.");
  if (
    !Number.isInteger(input.repeats) ||
    input.repeats < 1 ||
    input.repeats > 100
  )
    throw new Error("Số lần lặp cần từ 1 đến 100.");
  if (
    !Number.isInteger(input.seed) ||
    input.seed < 0 ||
    input.seed > 4294967295
  )
    throw new Error("Seed cần là số nguyên từ 0 đến 4.294.967.295.");
  if (input.phase !== "cold" && input.phase !== "warm")
    throw new Error("Chọn cold hoặc warm.");
  return {
    id,
    createdAt,
    kind: "experiment-plan",
    previewOnly: true,
    name: input.name.trim(),
    workloadId: workload.id,
    caseIds: [...workload.caseIds],
    repeats: input.repeats,
    phase: input.phase,
    seed: input.seed,
    profiles: selected.map((profile) => ({ ...profile! })) as [
      ProfileDraft,
      ProfileDraft,
    ],
    plannedQueries: workload.caseIds.length * input.repeats * selected.length,
    results: null,
  };
}
