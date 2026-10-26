"use client";

import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import {
  createComparisonPreview,
  sampleQuestions,
  type ComparisonPreview,
} from "@/features/workspace/workspace-model";
import { ComparisonPanel } from "./comparison-panel";

const suggestionLabels = ["Nghỉ phép", "Thiết bị", "Gần nghĩa"];

export function ComparisonWorkspace() {
  const { profiles } = useWorkspace();
  const [profileA, setProfileA] = useState("baseline");
  const [profileB, setProfileB] = useState("local");
  const [question, setQuestion] = useState("");
  const [preview, setPreview] = useState<ComparisonPreview | null>(null);
  const [invalid, setInvalid] = useState(false);

  function editQuestion(text: string) {
    setQuestion(text);
    setInvalid(false);
    setPreview(null);
  }
  function changeProfile(slot: "A" | "B", id: string) {
    if (slot === "A") setProfileA(id);
    else setProfileB(id);
    setPreview(null);
  }
  function submit() {
    if (!question.trim()) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setPreview(
      createComparisonPreview(question, [
        profiles.find((profile) => profile.id === profileA)!,
        profiles.find((profile) => profile.id === profileB)!,
      ]),
    );
  }

  return (
    <div className="research-page comparison-workspace">
      <PageHeading title="So sánh" />
      <form
        className="comparison-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor="comparison-question">Câu hỏi</label>
        <textarea
          id="comparison-question"
          value={question}
          maxLength={4000}
          rows={2}
          placeholder="Nhập câu hỏi cho cả hai khung…"
          aria-invalid={invalid}
          aria-describedby="comparison-error"
          onChange={(event) => editQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <p
          id="comparison-error"
          className="nui-error"
          role="alert"
          hidden={!invalid}
        >
          Nhập câu hỏi để tiếp tục.
        </p>
        <div className="composer-actions">
          <div className="question-suggestions" aria-label="Câu hỏi mẫu">
            {sampleQuestions.map((sample, index) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => editQuestion(sample.question)}
              >
                {suggestionLabels[index]}
              </button>
            ))}
          </div>
          <Button type="submit">Xem mẫu</Button>
        </div>
      </form>
      <div className="comparison-grid">
        <ComparisonPanel
          slot="A"
          selectedId={profileA}
          profiles={profiles}
          onSelect={(id) => changeProfile("A", id)}
          preview={preview}
        />
        <ComparisonPanel
          slot="B"
          selectedId={profileB}
          profiles={profiles}
          onSelect={(id) => changeProfile("B", id)}
          preview={preview}
        />
      </div>
    </div>
  );
}
