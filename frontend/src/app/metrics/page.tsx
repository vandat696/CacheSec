import type { Metadata } from "next";
import { Suspense } from "react";
import { MetricsWorkspace } from "@/features/metrics/MetricsWorkspace";

export const metadata: Metadata = { title: "Số liệu · CacheSec" };

export default function MetricsPage() {
  return <Suspense><MetricsWorkspace /></Suspense>;
}
