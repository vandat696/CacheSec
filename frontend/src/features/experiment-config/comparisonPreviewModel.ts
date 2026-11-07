import type { ProfileDraft } from "./cacheProfileModel.ts";

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
