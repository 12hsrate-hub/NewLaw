"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClaimDraftAction, saveDocumentDraftAction } from "@/server/actions/documents";
import type { ClaimDocumentType, ClaimsDraftPayload } from "@/schemas/document";

type SharedCharacterContext = {
  fullName: string;
  passportNumber: string;
  isProfileComplete: boolean;
};

type CreateCharacterOption = SharedCharacterContext & {
  id: string;
};

type ClaimsDraftCreateClientProps = {
  server: {
    code: string;
    name: string;
  };
  documentType: ClaimDocumentType;
  characters: CreateCharacterOption[];
  selectedCharacter: CreateCharacterOption & {
    source: "last_used" | "first_available";
  };
  initialTitle: string;
  initialPayload: ClaimsDraftPayload;
};

type ClaimsDraftEditorClientProps = {
  documentId: string;
  documentType: ClaimDocumentType;
  server: {
    code: string;
    name: string;
  };
  authorSnapshot: SharedCharacterContext;
  initialTitle: string;
  initialPayload: ClaimsDraftPayload;
  status: "draft" | "generated" | "published";
  updatedAt: string;
};

type ClaimsEditorState = {
  title: string;
  payload: ClaimsDraftPayload;
};

function createEditorState(input: {
  title: string;
  payload: ClaimsDraftPayload;
}): ClaimsEditorState {
  return {
    title: input.title,
    payload: {
      ...input.payload,
    },
  };
}

function areStatesEqual(left: ClaimsEditorState, right: ClaimsEditorState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatSubtypeLabel(documentType: ClaimDocumentType) {
  return documentType === "rehabilitation" ? "Rehabilitation" : "Lawsuit";
}

function ClaimsFieldHint(props: { children: string }) {
  return <p className="text-xs leading-5 text-[var(--muted)]">{props.children}</p>;
}

function ClaimsFormFields(props: {
  mode: "create" | "edit";
  documentType: ClaimDocumentType;
  state: ClaimsEditorState;
  onStateChange: (nextState: ClaimsEditorState) => void;
  characterLabel: string;
  profileComplete: boolean;
  routeStatus?: string | null;
  draftStatusLabel?: string;
  updatedAtLabel?: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{props.mode === "create" ? "pre-draft entry" : "persisted draft editor"}</Badge>
        <Badge>Subtype: {formatSubtypeLabel(props.documentType)}</Badge>
        {props.draftStatusLabel ? <Badge>Status: {props.draftStatusLabel}</Badge> : null}
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
        <p>Сервер и персонаж уже показаны явно. Персонаж: {props.characterLabel}.</p>
        {!props.profileComplete ? (
          <p className="mt-2 text-[var(--accent)]">
            Профиль персонажа неполный. Вход в claims flow разрешён, но после появления full
            payload/generation могут понадобиться дополнительные blocking rules.
          </p>
        ) : null}
        <p className="mt-2">
          После first save server, author snapshot и subtype станут immutable для этого
          `documentId`.
        </p>
        {props.routeStatus ? <p className="mt-2">Route status: {props.routeStatus}</p> : null}
        {props.updatedAtLabel ? <p className="mt-2">Последнее сохранение: {props.updatedAtLabel}</p> : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-title`}>
          Название документа
        </label>
        <Input
          id={`${props.mode}-claim-title`}
          maxLength={160}
          onChange={(event) => {
            props.onStateChange({
              ...props.state,
              title: event.target.value,
            });
          }}
          value={props.state.title}
        />
      </div>

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Claims persistence foundation</h3>
          <ClaimsFieldHint>
            На этом шаге claims editor ещё не раскрывает subtype-specific payload. Сохраняется
            только минимальная persisted foundation, чтобы не ломать snapshot lifecycle и family
            routes.
          </ClaimsFieldHint>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-working-notes`}>
            Working notes
          </label>
          <Textarea
            id={`${props.mode}-claim-working-notes`}
            onChange={(event) => {
              props.onStateChange({
                ...props.state,
                payload: {
                  ...props.state.payload,
                  workingNotes: event.target.value,
                },
              });
            }}
            placeholder="Минимальные рабочие заметки по claim. Подробный subtype-specific payload появится следующим шагом."
            value={props.state.payload.workingNotes}
          />
        </div>
      </div>
    </div>
  );
}

export function ClaimsDraftCreateClient(props: ClaimsDraftCreateClientProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState(props.selectedCharacter.id);
  const [editorState, setEditorState] = useState(() =>
    createEditorState({
      title: props.initialTitle,
      payload: props.initialPayload,
    }),
  );
  const selectedCharacter = useMemo(
    () =>
      props.characters.find((character) => character.id === selectedCharacterId) ?? props.characters[0],
    [props.characters, selectedCharacterId],
  );

  return (
    <form action={createClaimDraftAction} className="space-y-6">
      <input name="serverSlug" type="hidden" value={props.server.code} />
      <input name="characterId" type="hidden" value={selectedCharacter.id} />
      <input name="documentType" type="hidden" value={props.documentType} />
      <input name="title" type="hidden" value={editorState.title} />
      <input name="payloadJson" type="hidden" value={JSON.stringify(editorState.payload)} />

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="create-claim-character-id">
          Персонаж для first save
        </label>
        <Select
          id="create-claim-character-id"
          onChange={(event) => {
            setSelectedCharacterId(event.target.value);
          }}
          value={selectedCharacterId}
        >
          {props.characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.fullName} ({character.passportNumber})
            </option>
          ))}
        </Select>
        <ClaimsFieldHint>
          До первого сохранения персонажа можно сменить. После first save subtype и snapshot уже
          не меняются.
        </ClaimsFieldHint>
      </div>

      <ClaimsFormFields
        characterLabel={`${selectedCharacter.fullName} (${selectedCharacter.passportNumber})`}
        documentType={props.documentType}
        mode="create"
        onStateChange={setEditorState}
        profileComplete={selectedCharacter.isProfileComplete}
        state={editorState}
      />

      <div className="flex flex-wrap gap-3">
        <Button type="submit">Создать persisted claim draft</Button>
      </div>
    </form>
  );
}

export function ClaimsDraftEditorClient(props: ClaimsDraftEditorClientProps) {
  const [editorState, setEditorState] = useState(() =>
    createEditorState({
      title: props.initialTitle,
      payload: props.initialPayload,
    }),
  );
  const [savedState, setSavedState] = useState(() =>
    createEditorState({
      title: props.initialTitle,
      payload: props.initialPayload,
    }),
  );
  const [savedUpdatedAt, setSavedUpdatedAt] = useState(props.updatedAt);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const lastAutoSaveKeyRef = useRef<string | null>(null);
  const isDirty = !areStatesEqual(editorState, savedState);

  const performSave = useCallback(
    async (mode: "autosave" | "manual") => {
      const result = await saveDocumentDraftAction({
        documentId: props.documentId,
        title: editorState.title,
        payload: editorState.payload,
      });

      if (!result.ok) {
        if (result.error === "invalid-payload") {
          setSaveMessage("Claims draft не прошёл валидацию.");
          return;
        }

        setSaveMessage("Сохранить claims draft не удалось. Проверь доступ и попробуй ещё раз.");
        return;
      }

      setSavedState(editorState);
      setSavedUpdatedAt(result.updatedAt);
      setSaveMessage(
        mode === "autosave"
          ? `Claims draft автосохранён: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`
          : `Claims draft сохранён вручную: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`,
      );
    },
    [editorState, props.documentId],
  );

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const nextAutoSaveKey = JSON.stringify(editorState);

    if (lastAutoSaveKeyRef.current === nextAutoSaveKey) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastAutoSaveKeyRef.current = nextAutoSaveKey;
      startTransition(() => {
        void performSave("autosave");
      });
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [editorState, isDirty, performSave]);

  return (
    <div className="space-y-6">
      <ClaimsFormFields
        characterLabel={`${props.authorSnapshot.fullName} (${props.authorSnapshot.passportNumber})`}
        documentType={props.documentType}
        draftStatusLabel={props.status}
        mode="edit"
        onStateChange={setEditorState}
        profileComplete={props.authorSnapshot.isProfileComplete}
        state={editorState}
        updatedAtLabel={new Date(savedUpdatedAt).toLocaleString("ru-RU")}
      />

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
          Сохранить claims draft
        </Button>
      </div>

      {saveMessage ? <p className="text-sm text-[var(--muted)]">{saveMessage}</p> : null}
    </div>
  );
}
