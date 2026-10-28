import type { Metadata } from "next";
import { MetricsWorkspace } from "@/features/metrics/metrics-workspace";

export const metadata: Metadata = { title: "Số liệu · CacheSec" };

export default function MetricsPage() {
  return <MetricsWorkspace />;
}
