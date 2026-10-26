"use client";

import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { NumberInput, Select, TextInput } from "@/components/ui/fields";
import { Tabs } from "@/components/ui/navigation";
import { useToast } from "@/components/ui/feedback";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import {
  createExperimentPlan,
  workloads,
  type ExperimentPlan,
} from "@/features/workspace/workspace-model";

function PlanForm() {
  const { profiles, addPlan } = useWorkspace();
  const toast = useToast();
  const [workloadId, setWorkloadId] = useState("basic");
  const [repeats, setRepeats] = useState("3");
  const [profileA, setProfileA] = useState("baseline");
  const [profileB, setProfileB] = useState("local");
  const [error, setError] = useState("");
  const workload = workloads.find((item) => item.id === workloadId)!;
  const count = Number(repeats);
  const planned =
    Number.isInteger(count) && count >= 1 && count <= 100
      ? workload.caseIds.length * count * 2
      : null;
  const options = profiles.map((profile) => ({
    value: profile.id,
    label: profile.name,
  }));
  return (
    <form
      className="experiment-layout"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          addPlan(
            createExperimentPlan(
              {
                name: String(data.get("name") ?? ""),
                workloadId,
                repeats: count,
                phase: data.get("phase") as "cold" | "warm",
                seed: Number(data.get("seed")),
                profileIds: [profileA, profileB],
              },
              profiles,
              crypto.randomUUID(),
              new Date().toISOString(),
            ),
          );
          setError("");
          toast("Đã lưu kế hoạch trong phiên.");
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : "Không lưu được kế hoạch.",
          );
        }
      }}
    >
      <section className="surface experiment-form">
        <TextInput
          label="Tên kế hoạch"
          name="name"
          required
          maxLength={80}
          defaultValue="So sánh baseline và secure local"
        />
        <Select
          label="Bộ câu hỏi"
          value={workloadId}
          onChange={(event) => setWorkloadId(event.target.value)}
          options={workloads.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
        <div className="settings-fields">
          <Select
            label="Profile A"
            value={profileA}
            options={options}
            onChange={(event) => setProfileA(event.target.value)}
          />
          <Select
            label="Profile B"
            value={profileB}
            options={options}
            onChange={(event) => setProfileB(event.target.value)}
          />
          <NumberInput
            label="Số lần lặp"
            required
            min={1}
            max={100}
            step={1}
            value={repeats}
            onChange={(event) => setRepeats(event.target.value)}
          />
        </div>
        <details
          className="advanced-settings"
          onInvalidCapture={(event) => {
            event.currentTarget.open = true;
          }}
        >
          <summary>Nâng cao</summary>
          <div className="settings-fields">
            <Select
              label="Trạng thái cache"
              name="phase"
              defaultValue="cold"
              options={[
                { value: "cold", label: "Cold" },
                { value: "warm", label: "Warm" },
              ]}
            />
            <NumberInput
              label="Seed"
              name="seed"
              required
              min={0}
              max={4294967295}
              step={1}
              defaultValue={42}
            />
          </div>
        </details>
        {error && (
          <p className="nui-error" role="alert">
            {error}
          </p>
        )}
        <div className="experiment-summary form-footer">
          <div className="planned-count">
            <strong>{planned ?? "—"}</strong>
            <span>lượt dự kiến</span>
          </div>
          <Button type="submit">Lưu kế hoạch</Button>
        </div>
      </section>
    </form>
  );
}

function exportPlan(plan: ExperimentPlan) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cachesec-plan-${plan.id}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PlansAndResults() {
  const { plans } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0];
  return (
    <div className="results-layout">
      <section className="surface">
        <div className="surface-heading">
          <h2>
            Kế hoạch <span className="count-tag">{plans.length}</span>
          </h2>
        </div>
        {plans.length === 0 ? (
          <p className="quiet-empty">Chưa có kế hoạch.</p>
        ) : (
          <div className="plan-list">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                aria-pressed={selected?.id === plan.id}
                onClick={() => setSelectedId(plan.id)}
              >
                <span>
                  <strong>{plan.name}</strong>
                  <small>
                    {plan.plannedQueries} lượt · {plan.phase}
                  </small>
                </span>
                <span className="subtle-tag">Chưa chạy</span>
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="plan-snapshot">
            <dl className="definition-list">
              {selected.profiles.map((profile, index) => (
                <div key={index}>
                  <dt>Profile {index === 0 ? "A" : "B"}</dt>
                  <dd>
                    {profile.name} · v{profile.revision}
                  </dd>
                </div>
              ))}
            </dl>
            <Button variant="secondary" onClick={() => exportPlan(selected)}>
              Xuất kế hoạch JSON
            </Button>
          </div>
        )}
      </section>
      <section className="surface results-empty">
        <div className="surface-heading">
          <h2>Kết quả</h2>
        </div>
        <p className="quiet-empty">Chưa có kết quả đo.</p>
        <p className="field-note">Bộ chạy chưa kết nối.</p>
      </section>
    </div>
  );
}

export function ExperimentsWorkspace() {
  return (
    <div className="research-page">
      <PageHeading title="Thí nghiệm" />
      <Tabs
        label="Thí nghiệm"
        items={[
          { id: "setup", label: "Thiết lập", content: <PlanForm /> },
          { id: "results", label: "Đã lưu", content: <PlansAndResults /> },
        ]}
      />
    </div>
  );
}
