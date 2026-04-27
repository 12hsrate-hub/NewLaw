import { StatusBadge } from "@/components/ui/status-badge";

import { EditorContextCard } from "@/components/product/document-area/editor-layout/editor-context-card";

type MetaItem = {
  label: string;
  value: string;
};

export function EditorDocumentMeta(props: {
  title?: string;
  description?: string;
  badges?: Array<{
    label: string;
    tone?: "neutral" | "success" | "warning" | "info";
  }>;
  items: MetaItem[];
}) {
  return (
    <EditorContextCard
      description={props.description}
      meta={
        props.badges?.length ? (
          <>
            {props.badges.map((badge) => (
              <StatusBadge key={`${badge.label}:${badge.tone ?? "neutral"}`} tone={badge.tone}>
                {badge.label}
              </StatusBadge>
            ))}
          </>
        ) : null
      }
      title={props.title ?? "О документе"}
    >
      <dl className="space-y-3 text-sm leading-6">
        {props.items.map((item) => (
          <div className="space-y-1" key={`${item.label}:${item.value}`}>
            <dt className="text-[var(--muted)]">{item.label}</dt>
            <dd className="text-[var(--foreground)]">{item.value}</dd>
          </div>
        ))}
      </dl>
    </EditorContextCard>
  );
}
