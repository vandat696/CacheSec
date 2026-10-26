"use client";

import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { TextInput, NumberInput, Select } from "@/components/ui/fields";
import { Tabs } from "@/components/ui/navigation";
import { useToast } from "@/components/ui/feedback";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import {
  cacheLabels,
  type CacheLocation,
  type ProfileDraft,
} from "@/features/workspace/workspace-model";

function ProfileEditor({ profile }: { profile: ProfileDraft }) {
  const { saveProfile } = useWorkspace();
  const toast = useToast();
  const [location, setLocation] = useState(profile.cacheLocation);
  const [matching, setMatching] = useState(profile.matching);
  const [error, setError] = useState("");
  return (
    <form
      className="profile-editor surface"
      aria-label={`Profile ${profile.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          saveProfile({
            ...profile,
            name: String(data.get("name") ?? ""),
            cacheLocation: location,
            matching,
            similarity:
              location !== "none" && matching === "semantic"
                ? Number(data.get("similarity"))
                : profile.similarity,
            ttlSeconds:
              location !== "none"
                ? Number(data.get("ttl"))
                : profile.ttlSeconds,
          });
          toast("Đã lưu nháp trong phiên.");
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : "Không lưu được bản nháp.",
          );
        }
      }}
    >
      <div className="settings-fields">
        <TextInput
          label="Tên profile"
          name="name"
          required
          maxLength={60}
          defaultValue={profile.name}
        />
        <Select
          label="Cache"
          value={location}
          onChange={(event) => setLocation(event.target.value as CacheLocation)}
          options={Object.entries(cacheLabels).map(([value, label]) => ({
            value,
            label,
          }))}
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
            label="Matching"
            disabled={location === "none"}
            value={matching}
            onChange={(event) =>
              setMatching(event.target.value as "exact" | "semantic")
            }
            options={[
              { value: "exact", label: "Exact match" },
              { value: "semantic", label: "Semantic similarity" },
            ]}
          />
          <NumberInput
            name="similarity"
            label="Ngưỡng similarity"
            min={0}
            max={1}
            step={0.01}
            required
            disabled={location === "none" || matching !== "semantic"}
            defaultValue={profile.similarity}
          />
          <NumberInput
            name="ttl"
            label="TTL (giây)"
            min={60}
            max={86400}
            step={1}
            required
            disabled={location === "none"}
            defaultValue={profile.ttlSeconds}
          />
        </div>
        <p className="field-note">Phạm vi dự kiến: riêng người dùng.</p>
      </details>
      {error && (
        <p role="alert" className="nui-error">
          {error}
        </p>
      )}
      <div className="form-footer">
        <span className="profile-revision">Nháp · v{profile.revision}</span>
        <Button type="submit">Lưu nháp</Button>
      </div>
    </form>
  );
}

function Profiles() {
  const { profiles } = useWorkspace();
  const [selectedId, setSelectedId] = useState("local");
  const selected = profiles.find((profile) => profile.id === selectedId)!;
  return (
    <div className="profile-layout">
      <aside className="profile-list" aria-label="Chọn profile">
        {profiles.map((profile) => (
          <button
            type="button"
            key={profile.id}
            className={selectedId === profile.id ? "selected" : ""}
            aria-pressed={selectedId === profile.id}
            onClick={() => setSelectedId(profile.id)}
          >
            {profile.name}
          </button>
        ))}
      </aside>
      <ProfileEditor
        key={`${selected.id}-${selected.revision}`}
        profile={selected}
      />
    </div>
  );
}

function Models() {
  return (
    <section className="surface">
      <dl className="definition-list">
        {["LLM", "Embedding", "RAG"].map((label) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>Chưa kết nối</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Permissions() {
  return (
    <section className="surface">
      <p className="quiet-empty">Chưa kết nối xác thực và phân quyền.</p>
    </section>
  );
}

export function SettingsWorkspace() {
  return (
    <div className="research-page">
      <PageHeading title="Cấu hình" />
      <Tabs
        label="Nhóm cấu hình"
        items={[
          { id: "profiles", label: "Profiles", content: <Profiles /> },
          { id: "models", label: "Model & RAG", content: <Models /> },
          { id: "permissions", label: "Quyền", content: <Permissions /> },
        ]}
      />
    </div>
  );
}
