import type { Metadata } from "next";
import { SetupWorkspace } from "@/features/setup/setup-workspace";

export const metadata: Metadata = { title: "Thiết lập · CacheSec" };

export default function SetupPage() {
  return <SetupWorkspace />;
}
