"use client";

import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { NumberInput, Select, TextInput } from "@/components/ui/fields";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import { createExperimentPlan, initialProfiles, validateProfile, workloads } from "@/features/workspace/workspace-model";

export function SetupWorkspace() {
  const { plans, addPlan } = useWorkspace();
  const latest = plans[0];
  const profile = latest?.profiles[1] ?? initialProfiles[1];
  const [location, setLocation] = useState(profile.cacheLocation === "server" ? "server" : "local");
  const [matching, setMatching] = useState(profile.matching);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(!!latest);

  return (
    <div className="content-page setup-workspace">
      <PageHeading title="Thiết lập thí nghiệm" />
      <p className="setup-intro">So sánh Không cache với một cấu hình cache trên cùng bộ câu hỏi.</p>
      <form onChange={() => { setSaved(false); setError(""); }} onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const candidate = {
          ...profile, id: "setup-cache", name: location === "local" ? "Secure local" : "Secure server",
          revision: (latest?.profiles[1].revision ?? 0) + 1,
          cacheLocation: location as "local" | "server", matching,
          similarity: matching === "semantic" ? Number(data.get("similarity")) : profile.similarity,
          ttlSeconds: Number(data.get("ttl")),
        };
        try {
          const invalid = validateProfile(candidate);
          if (invalid) throw new Error(invalid);
          addPlan(createExperimentPlan({
            name: String(data.get("name") ?? ""), workloadId: String(data.get("workload")),
            repeats: Number(data.get("repeats")), phase: data.get("phase") as "cold" | "warm",
            seed: Number(data.get("seed")), profileIds: ["baseline", candidate.id],
          }, [initialProfiles[0], candidate], crypto.randomUUID(), new Date().toISOString()));
          setError("");
          setSaved(true);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Không lưu được thiết lập.");
        }
      }}>
        <TextInput id="setup-name" name="name" label="Tên thí nghiệm" required maxLength={80}
          defaultValue={latest?.name ?? "So sánh Không cache và Cache"} />
        <section className="setup-section" aria-labelledby="setup-cache-title">
          <h2 id="setup-cache-title">Cấu hình cache</h2>
          <div className="setup-fields">
            <Select id="setup-location" label="Vị trí cache" value={location} onChange={(event) => setLocation(event.target.value)}
              options={[{ value: "local", label: "Local · trên thiết bị" }, { value: "server", label: "Server · trên máy chủ" }]} />
            <Select id="setup-matching" label="Cách khớp câu hỏi" value={matching} onChange={(event) => setMatching(event.target.value as "exact" | "semantic")}
              options={[{ value: "exact", label: "Exact · trùng khớp" }, { value: "semantic", label: "Semantic · gần nghĩa" }]} />
            {matching === "semantic" && <NumberInput id="setup-similarity" name="similarity" label="Ngưỡng tương đồng" required min={0} max={1} step={0.01}
              defaultValue={profile.similarity} help="Giá trị nháp; cần hiệu chỉnh theo embedding và bộ dữ liệu." />}
            <NumberInput id="setup-ttl" name="ttl" label="Thời gian lưu cache (giây)" required min={60} max={86400} step={1} defaultValue={profile.ttlSeconds} />
          </div>
          <p className="setup-note">Phạm vi dự kiến: riêng người dùng. Xác minh quyền và tính hợp lệ trước khi trả cache là bắt buộc.</p>
        </section>
        <section className="setup-section" aria-labelledby="setup-run-title">
          <h2 id="setup-run-title">Điều kiện thí nghiệm</h2>
          <div className="setup-fields">
            <Select id="setup-workload" name="workload" label="Bộ câu hỏi giả lập" defaultValue={latest?.workloadId ?? "basic"}
              options={workloads.map((item) => ({ value: item.id, label: `${item.name} · ${item.caseIds.length} câu` }))} />
            <NumberInput id="setup-repeats" name="repeats" label="Số lần lặp" required min={1} max={100} step={1} defaultValue={latest?.repeats ?? 3} />
            <Select id="setup-phase" name="phase" label="Trạng thái cache ban đầu" defaultValue={latest?.phase ?? "cold"}
              options={[{ value: "cold", label: "Cold · cache rỗng" }, { value: "warm", label: "Warm · cache được nạp trước" }]} />
            <NumberInput id="setup-seed" name="seed" label="Seed tái lập" required min={0} max={4294967295} step={1} defaultValue={latest?.seed ?? 42} />
          </div>
        </section>
        <div className="setup-footer">
          <p>Lưu trong phiên, tải lại sẽ mất. Chưa kết nối bộ chạy thí nghiệm.</p>
          <Button type="submit">Lưu thiết lập</Button>
        </div>
        {error && <p className="nui-error" role="alert">{error}</p>}
        {saved && latest && <p className="setup-saved" role="status">Đã lưu bản v{latest.profiles[1].revision} · {latest.plannedQueries} lượt dự kiến cho hai nhánh. Chưa chạy.</p>}
      </form>
    </div>
  );
}
