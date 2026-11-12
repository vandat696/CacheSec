import type { Metadata } from "next";
import { DeveloperWorkspace } from "@/features/developer/DeveloperWorkspace";

export const metadata: Metadata = {
  title: "Workspace · CacheSec",
  description: "Workspace sửa mã, kiểm thử và Agent cho CacheSec.",
};

export default function WorkspacePage() {
  return <DeveloperWorkspace />;
}
