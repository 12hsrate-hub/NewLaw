"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveDocumentDraftAction } from "@/server/actions/documents";

type DocumentDraftEditorClientProps = {
  documentId: string;
  initialTitle: string;
  initialWorkingNotes: string;
  status: "draft" | "generated" | "published";
  updatedAt: string;
};

async function saveDraft(documentId: string, title: string, workingNotes: string) {
  return saveDocumentDraftAction({
    documentId,
    title,
    workingNotes,
  });
}

export function DocumentDraftEditorClient(props: DocumentDraftEditorClientProps) {
  const [title, setTitle] = useState(props.initialTitle);
  const [workingNotes, setWorkingNotes] = useState(props.initialWorkingNotes);
  const [savedState, setSavedState] = useState({
    title: props.initialTitle,
    workingNotes: props.initialWorkingNotes,
    updatedAt: props.updatedAt,
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const lastAutoSaveKeyRef = useRef<string | null>(null);

  const isDirty = title !== savedState.title || workingNotes !== savedState.workingNotes;

  const performSave = useCallback(async (mode: "autosave" | "manual") => {
    const result = await saveDraft(props.documentId, title, workingNotes);

    if (!result.ok) {
      setSaveMessage("Сохранить черновик не удалось. Проверь доступ и попробуй ещё раз.");
      return;
    }

    setSavedState({
      title,
      workingNotes,
      updatedAt: result.updatedAt,
    });
    setSaveMessage(
      mode === "autosave"
        ? `Черновик автосохранён: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`
        : `Черновик сохранён вручную: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`,
    );
  }, [props.documentId, title, workingNotes]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const nextAutoSaveKey = `${title}::${workingNotes}`;

    if (lastAutoSaveKeyRef.current === nextAutoSaveKey) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastAutoSaveKeyRef.current = nextAutoSaveKey;
      startTransition(() => {
        void performSave("autosave");
      });
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isDirty, performSave, title, workingNotes]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="document-title">
          Название черновика
        </label>
        <Input
          id="document-title"
          maxLength={160}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          value={title}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="working-notes">
          Рабочие заметки foundation
        </label>
        <Textarea
          id="working-notes"
          onChange={(event) => {
            setWorkingNotes(event.target.value);
          }}
          placeholder="Здесь пока только минимальный persisted payload foundation. Полный OGP wizard появится позже."
          value={workingNotes}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!isDirty}
          onClick={() => {
            startTransition(() => {
              void performSave("manual");
            });
          }}
          type="button"
        >
          Сохранить черновик
        </Button>
        <span className="text-sm text-[var(--muted)]">
          Status: {props.status}. Последнее server-side сохранение:{" "}
          {new Date(savedState.updatedAt).toLocaleString("ru-RU")}
        </span>
      </div>

      {saveMessage ? <p className="text-sm text-[var(--muted)]">{saveMessage}</p> : null}
    </div>
  );
}
