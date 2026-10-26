import type { Metadata } from "next";
import { UiLibrary } from "@/features/ui-library/ui-library";

export const metadata: Metadata = { title: "Thư viện UI · CacheSec" };

export default function UiLibraryPage() {
  return <UiLibrary />;
}
