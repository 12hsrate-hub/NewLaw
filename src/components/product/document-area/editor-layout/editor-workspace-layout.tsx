import type { PropsWithChildren, ReactNode } from "react";

import { cn } from "@/utils/cn";

export function EditorWorkspaceLayout(props: {
  main: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-8",
        props.className,
      )}
      data-editor-workspace-layout="true"
    >
      {props.main}
      {props.aside ? props.aside : null}
    </div>
  );
}

export function EditorMainColumn({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("min-w-0 space-y-6", className)} data-editor-main-column="true">
      {children}
    </div>
  );
}

export function EditorContextAside({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <aside
      className={cn("min-w-0 space-y-4 xl:sticky xl:top-28 xl:self-start", className)}
      data-editor-context-aside="true"
    >
      {children}
    </aside>
  );
}
