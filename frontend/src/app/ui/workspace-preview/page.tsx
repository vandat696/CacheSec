import type { Metadata } from "next";
import { DeveloperPreview } from "@/features/developer/DeveloperPreview";

export const metadata: Metadata = { title: "Workspace mẫu · CacheSec" };
export default function WorkspacePreviewPage() { return <DeveloperPreview />; }
