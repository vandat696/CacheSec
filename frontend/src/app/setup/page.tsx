import type { Metadata } from "next";
import { SetupWorkspace } from "@/features/setup/SetupWorkspace";
import { RuntimeSettings } from "@/features/runtime-settings/RuntimeSettings";

export const metadata: Metadata = { title: "Thiết lập · CacheSec" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  return (await searchParams).view === "preview" ? <SetupWorkspace /> : <RuntimeSettings />;
}
