// Frontend drafts only. These types are not an API or authorization contract.
export type CacheLocation = "none" | "local" | "server";
export type ProfileDraft = {
  id: string;
  name: string;
  revision: number;
  cacheLocation: CacheLocation;
  matching: "exact" | "semantic";
  similarity: number;
  ttlSeconds: number;
};

export const cacheLabels: Record<CacheLocation, string> = {
  none: "Không cache",
  local: "Secure local cache",
  server: "Secure server cache",
};

export const initialProfiles: readonly ProfileDraft[] = [
  {
    id: "baseline",
    name: "Baseline",
    revision: 1,
    cacheLocation: "none",
    matching: "exact",
    similarity: 0.9,
    ttlSeconds: 3600,
  },
  {
    id: "local",
    name: "Secure local",
    revision: 1,
    cacheLocation: "local",
    matching: "semantic",
    similarity: 0.9,
    ttlSeconds: 3600,
  },
  {
    id: "server",
    name: "Secure server",
    revision: 1,
    cacheLocation: "server",
    matching: "semantic",
    similarity: 0.9,
    ttlSeconds: 3600,
  },
];

export function validateProfile(profile: ProfileDraft): string | null {
  if (!profile.name.trim() || profile.name.trim().length > 60)
    return "Tên profile cần từ 1 đến 60 ký tự.";
  if (
    !Object.hasOwn(cacheLabels, profile.cacheLocation) ||
    !["exact", "semantic"].includes(profile.matching)
  )
    return "Lựa chọn cache không hợp lệ.";
  if (
    !Number.isFinite(profile.similarity) ||
    profile.similarity < 0 ||
    profile.similarity > 1
  )
    return "Ngưỡng similarity cần nằm trong khoảng 0 đến 1.";
  if (
    !Number.isInteger(profile.ttlSeconds) ||
    profile.ttlSeconds < 60 ||
    profile.ttlSeconds > 86400
  )
    return "TTL cần là số nguyên từ 60 đến 86.400 giây.";
  return null;
}

export const sampleQuestions = [
  {
    id: "leave",
    label: "Chính sách nghỉ phép",
    question: "Nhân viên chính thức có bao nhiêu ngày nghỉ phép mỗi năm?",
    answer:
      "Trong bộ tài liệu giả lập, nhân viên chính thức có 12 ngày nghỉ phép mỗi năm. Đơn nghỉ phép được gửi cho quản lý trực tiếp trước ít nhất 3 ngày làm việc.",
    source: "Quy chế nhân sự · tài liệu giả lập",
    section: "Mục 3.1 / Nghỉ phép năm",
  },
  {
    id: "equipment",
    label: "Cấp thiết bị",
    question: "Quy trình đề nghị cấp máy tính làm việc như thế nào?",
    answer:
      "Trong quy trình giả lập, nhân viên gửi yêu cầu thiết bị tới bộ phận IT, kèm xác nhận của quản lý. IT kiểm tra thiết bị sẵn có trước khi lập đề nghị mua mới.",
    source: "Hướng dẫn IT · tài liệu giả lập",
    section: "Mục 2 / Cấp phát thiết bị",
  },
  {
    id: "paraphrase",
    label: "Câu hỏi gần nghĩa",
    question: "Một năm tôi được nghỉ phép bao nhiêu ngày?",
    answer:
      "Trong bộ tài liệu giả lập, nhân viên chính thức có 12 ngày nghỉ phép mỗi năm. Đơn nghỉ phép được gửi cho quản lý trực tiếp trước ít nhất 3 ngày làm việc.",
    source: "Quy chế nhân sự · tài liệu giả lập",
    section: "Mục 3.1 / Nghỉ phép năm",
  },
] as const;

export function createComparisonPreview(
  question: string,
  profiles: readonly [ProfileDraft, ProfileDraft],
) {
  const text = question.trim();
  const fixture = sampleQuestions.find((item) => item.question === text);
  return {
    question: text,
    profiles: profiles.map((profile) => ({ ...profile })) as [
      ProfileDraft,
      ProfileDraft,
    ],
    answer: fixture?.answer ?? null,
    source: fixture
      ? { title: fixture.source, section: fixture.section }
      : null,
    // No fabricated timing, token usage, cache outcome or permission result.
    measurements: null,
    authorization: "not-verified" as const,
  };
}

export type ComparisonPreview = ReturnType<typeof createComparisonPreview>;

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
