import type { Metadata } from "next";
import { UiLibrary } from "@/features/ui-library/UiLibrary";

export const metadata: Metadata = { title: "Thư viện UI · CacheSec" };

export default function UiLibraryPage() {
  return <UiLibrary />;
}
