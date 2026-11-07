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
