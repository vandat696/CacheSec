import type { Metadata } from "next";
import { DeveloperWorkspace } from "@/features/developer/DeveloperWorkspace";

export const metadata: Metadata = {
  title: "Developer Workspace · CacheSec",
  description: "Bản xem trước workflow phát triển phần mềm với Secure Local Semantic Cache.",
};

export default function WorkspacePage() {
  return <DeveloperWorkspace />;
}
