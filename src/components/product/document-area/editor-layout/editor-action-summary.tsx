import { StatusBadge } from "@/components/ui/status-badge";

import { EditorContextCard } from "@/components/product/document-area/editor-layout/editor-context-card";

type ActionItem = {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "info";
};

export function EditorActionSummary(props: {
  title?: string;
  description?: string;
  items: ActionItem[];
  helperText?: string;
}) {
  return (
    <EditorContextCard
      description={props.description}
      footer={props.helperText}
      title={props.title ?? "Состояние документа"}
    >
      <ul className="space-y-3">
        {props.items.map((item) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 text-sm leading-6 text-[var(--foreground)]"
            key={`${item.label}:${item.value}`}
          >
            <span className="text-[var(--muted)]">{item.label}</span>
            <StatusBadge tone={item.tone ?? "neutral"}>{item.value}</StatusBadge>
          </li>
        ))}
      </ul>
    </EditorContextCard>
  );
}
