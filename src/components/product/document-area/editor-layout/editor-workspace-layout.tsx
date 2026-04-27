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
        "grid grid-cols-1 gap-6 lg:gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] xl:items-start xl:gap-8 2xl:grid-cols-[minmax(0,1fr)_380px]",
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
      className={cn(
        "order-last min-w-0 space-y-4 xl:order-none xl:w-full xl:max-w-[380px] xl:space-y-5 xl:self-start xl:sticky xl:top-24 2xl:top-28",
        className,
      )}
      data-editor-context-aside="true"
    >
      {children}
    </aside>
  );
}
