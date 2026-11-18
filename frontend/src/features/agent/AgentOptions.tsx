import { useEffect, type ReactNode, type RefObject } from "react";
import { Icon } from "@/components/ui/Icon";
import { agentModels, type AgentConfig, type AgentModelId } from "./agentApi";

export function AgentOptions({ optionsRef, config, model, disabled, onModel, children }: {
  optionsRef: RefObject<HTMLDetailsElement | null>;
  config: AgentConfig | null;
  model: AgentModelId | undefined;
  disabled: boolean;
  onModel: (model: AgentModelId) => void;
  children?: ReactNode;
}) {
  const models = config?.models ?? (config ? [config.model] : []);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      const options = optionsRef.current;
      if (options?.open && event.target instanceof Node && !options.contains(event.target)) options.open = false;
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [optionsRef]);
  return <details ref={optionsRef} className="agent-options" onKeyDown={event => {
    if (event.key !== "Escape" || !event.currentTarget.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.open = false;
    event.currentTarget.querySelector("summary")?.focus();
  }}>
    <summary aria-label="Tùy chọn Agent" title={model ? `Tùy chọn Agent · ${agentModels[model].label}` : "Tùy chọn Agent"}>
      <Icon name="gear" />
    </summary>
    <div>
      <label>Model<select value={model ?? ""} disabled={disabled || models.length < 2}
        onChange={event => {
          const choice = models.find(id => id === event.target.value);
          if (choice) onModel(choice);
        }}>
        {!models.length && <option value="">Chưa tải cấu hình</option>}
        {models.map(id => <option key={id} value={id}>{agentModels[id].label}{id === config?.model ? " · Mặc định" : ""}</option>)}
      </select></label>
      {children}
    </div>
  </details>;
}
