import type { Metadata } from "next";
import { QuotationWorkspace } from "@/features/quotations/QuotationWorkspace";

export const metadata: Metadata = { title: "Báo giá · CacheSec" };

export default function QuotationsPage() {
  return <QuotationWorkspace />;
}
