"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createOgpComplaintDraftAction,
  saveDocumentDraftAction,
} from "@/server/actions/documents";
import type {
  OgpComplaintDraftPayload,
  OgpComplaintEvidenceGroup,
  OgpComplaintEvidenceRow,
  OgpComplaintTrustorSnapshot,
} from "@/schemas/document";

type SharedCharacterContext = {
  fullName: string;
  passportNumber: string;
  isProfileComplete: boolean;
  canUseRepresentative: boolean;
};

type CreateCharacterOption = SharedCharacterContext & {
  id: string;
};

type OgpComplaintDraftCreateClientProps = {
  server: {
    code: string;
    name: string;
  };
  characters: CreateCharacterOption[];
  selectedCharacter: CreateCharacterOption & {
    source: "last_used" | "first_available";
  };
  initialTitle: string;
  initialPayload: OgpComplaintDraftPayload;
};

type OgpComplaintDraftEditorClientProps = {
  documentId: string;
  server: {
    code: string;
    name: string;
  };
  authorSnapshot: SharedCharacterContext;
  initialTitle: string;
  initialPayload: OgpComplaintDraftPayload;
  status: "draft" | "generated" | "published";
  updatedAt: string;
};

type OgpComplaintEditorState = {
  title: string;
  payload: OgpComplaintDraftPayload;
};

function createEditorState(input: {
  title: string;
  payload: OgpComplaintDraftPayload;
}): OgpComplaintEditorState {
  return {
    title: input.title,
    payload: {
      ...input.payload,
      trustorSnapshot:
        input.payload.filingMode === "representative"
          ? (input.payload.trustorSnapshot ?? {
              sourceType: "inline_manual",
              fullName: "",
              passportNumber: "",
              note: "",
            })
          : null,
    },
  };
}

function createLocalId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function areStatesEqual(left: OgpComplaintEditorState, right: OgpComplaintEditorState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function filingModeLabel(mode: OgpComplaintDraftPayload["filingMode"]) {
  return mode === "representative" ? "Representative" : "Self";
}

function buildEmptyEvidenceGroup(): OgpComplaintEvidenceGroup {
  return {
    id: createLocalId("evidence_group"),
    title: "",
    rows: [],
  };
}

function buildEmptyEvidenceRow(): OgpComplaintEvidenceRow {
  return {
    id: createLocalId("evidence_row"),
    label: "",
    url: "",
    note: "",
  };
}

function buildEmptyTrustorSnapshot(): OgpComplaintTrustorSnapshot {
  return {
    sourceType: "inline_manual",
    fullName: "",
    passportNumber: "",
    note: "",
  };
}

function ComplaintFieldHint(props: { children: string }) {
  return <p className="text-xs leading-5 text-[var(--muted)]">{props.children}</p>;
}

function EvidenceGroupsEditor(props: {
  evidenceGroups: OgpComplaintDraftPayload["evidenceGroups"];
  onChange: (groups: OgpComplaintDraftPayload["evidenceGroups"]) => void;
}) {
  const groups = props.evidenceGroups;

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
          Пока нет evidence groups. Можно сохранить черновик без них и добавить ссылки позже.
        </div>
      ) : null}

      {groups.map((group, groupIndex) => (
        <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4" key={group.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Evidence group {groupIndex + 1}
              </p>
              <ComplaintFieldHint>
                Группа нужна, чтобы позже BBCode generation можно было строить по стабильной структуре.
              </ComplaintFieldHint>
            </div>
            <Button
              onClick={() => {
                props.onChange(groups.filter((entry) => entry.id !== group.id));
              }}
              type="button"
              variant="secondary"
            >
              Удалить группу
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`group-title-${group.id}`}>
              Заголовок группы
            </label>
            <Input
              id={`group-title-${group.id}`}
              onChange={(event) => {
                props.onChange(
                  groups.map((entry) =>
                    entry.id === group.id ? { ...entry, title: event.target.value } : entry,
                  ),
                );
              }}
              placeholder="Например: Ссылки на видеозаписи"
              value={group.title}
            />
          </div>

          <div className="space-y-3">
            {group.rows.map((row, rowIndex) => (
              <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/80 p-4" key={row.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Evidence row {rowIndex + 1}
                  </p>
                  <Button
                    onClick={() => {
                      props.onChange(
                        groups.map((entry) =>
                          entry.id === group.id
                            ? {
                                ...entry,
                                rows: entry.rows.filter((existingRow) => existingRow.id !== row.id),
                              }
                            : entry,
                        ),
                      );
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Удалить row
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`row-label-${row.id}`}>
                      Название / label
                    </label>
                    <Input
                      id={`row-label-${row.id}`}
                      onChange={(event) => {
                        props.onChange(
                          groups.map((entry) =>
                            entry.id === group.id
                              ? {
                                  ...entry,
                                  rows: entry.rows.map((existingRow) =>
                                    existingRow.id === row.id
                                      ? { ...existingRow, label: event.target.value }
                                      : existingRow,
                                  ),
                                }
                              : entry,
                          ),
                        );
                      }}
                      placeholder="Например: Запись с бодикамеры"
                      value={row.label}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`row-url-${row.id}`}>
                      Ссылка
                    </label>
                    <Input
                      id={`row-url-${row.id}`}
                      onChange={(event) => {
                        props.onChange(
                          groups.map((entry) =>
                            entry.id === group.id
                              ? {
                                  ...entry,
                                  rows: entry.rows.map((existingRow) =>
                                    existingRow.id === row.id
                                      ? { ...existingRow, url: event.target.value }
                                      : existingRow,
                                  ),
                                }
                              : entry,
                          ),
                        );
                      }}
                      placeholder="https://..."
                      value={row.url}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`row-note-${row.id}`}>
                    Комментарий к ссылке
                  </label>
                  <Textarea
                    id={`row-note-${row.id}`}
                    onChange={(event) => {
                      props.onChange(
                        groups.map((entry) =>
                          entry.id === group.id
                            ? {
                                ...entry,
                                rows: entry.rows.map((existingRow) =>
                                  existingRow.id === row.id
                                    ? { ...existingRow, note: event.target.value }
                                    : existingRow,
                                ),
                              }
                            : entry,
                        ),
                      );
                    }}
                    placeholder="Короткое пояснение, что именно подтверждает эта ссылка."
                    value={row.note}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={() => {
              props.onChange(
                groups.map((entry) =>
                  entry.id === group.id
                    ? {
                        ...entry,
                        rows: [...entry.rows, buildEmptyEvidenceRow()],
                      }
                    : entry,
                ),
              );
            }}
            type="button"
            variant="secondary"
          >
            Добавить evidence row
          </Button>
        </div>
      ))}

      <Button
        onClick={() => {
          props.onChange([...groups, buildEmptyEvidenceGroup()]);
        }}
        type="button"
        variant="secondary"
      >
        Добавить evidence group
      </Button>
    </div>
  );
}

function ComplaintFormFields(props: {
  mode: "create" | "edit";
  state: OgpComplaintEditorState;
  onStateChange: (nextState: OgpComplaintEditorState) => void;
  representativeAllowed: boolean;
  characterLabel: string;
  profileComplete: boolean;
  routeStatus?: string | null;
  draftStatusLabel?: string;
  updatedAtLabel?: string;
}) {
  const payload = props.state.payload;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{props.mode === "create" ? "pre-draft entry" : "persisted draft editor"}</Badge>
        <Badge>Filing mode: {filingModeLabel(payload.filingMode)}</Badge>
        {props.draftStatusLabel ? <Badge>Status: {props.draftStatusLabel}</Badge> : null}
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
        <p>Сервер и персонаж уже показаны явно. Персонаж: {props.characterLabel}.</p>
        {!props.profileComplete ? (
          <p className="mt-2 text-[var(--accent)]">
            Профиль персонажа неполный. Редактирование жалобы доступно, но future generation позже
            должна будет блокироваться до заполнения обязательных profile fields.
          </p>
        ) : null}
        {!props.representativeAllowed ? (
          <p className="mt-2">
            У этого персонажа нет access flag `advocate`, поэтому representative filing недоступен.
          </p>
        ) : null}
        {props.routeStatus ? <p className="mt-2">Route status: {props.routeStatus}</p> : null}
        {props.updatedAtLabel ? <p className="mt-2">Последнее сохранение: {props.updatedAtLabel}</p> : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-document-title`}>
          Название документа
        </label>
        <Input
          id={`${props.mode}-document-title`}
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-filing-mode`}>
            Filing mode
          </label>
          <Select
            id={`${props.mode}-filing-mode`}
            onChange={(event) => {
              const nextFilingMode = event.target.value as OgpComplaintDraftPayload["filingMode"];
              props.onStateChange({
                ...props.state,
                payload: {
                  ...payload,
                  filingMode: nextFilingMode,
                  trustorSnapshot:
                    nextFilingMode === "representative"
                      ? (payload.trustorSnapshot ?? buildEmptyTrustorSnapshot())
                      : null,
                },
              });
            }}
            value={payload.filingMode}
          >
            <option value="self">Self</option>
            <option disabled={!props.representativeAllowed} value="representative">
              Representative
            </option>
          </Select>
          <ComplaintFieldHint>
            Ветка representative доступна только персонажу с `advocate`.
          </ComplaintFieldHint>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-appeal-number`}>
            Appeal number
          </label>
          <Input
            id={`${props.mode}-appeal-number`}
            maxLength={120}
            onChange={(event) => {
              props.onStateChange({
                ...props.state,
                payload: {
                  ...payload,
                  appealNumber: event.target.value,
                },
              });
            }}
            placeholder="Например: OGP-2026-001"
            value={payload.appealNumber}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-object-organization`}>
            Object organization
          </label>
          <Input
            id={`${props.mode}-object-organization`}
            maxLength={160}
            onChange={(event) => {
              props.onStateChange({
                ...props.state,
                payload: {
                  ...payload,
                  objectOrganization: event.target.value,
                },
              });
            }}
            placeholder="Например: LSPD"
            value={payload.objectOrganization}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-object-full-name`}>
            Object full name
          </label>
          <Input
            id={`${props.mode}-object-full-name`}
            maxLength={160}
            onChange={(event) => {
              props.onStateChange({
                ...props.state,
                payload: {
                  ...payload,
                  objectFullName: event.target.value,
                },
              });
            }}
            placeholder="ФИО сотрудника или полное наименование органа"
            value={payload.objectFullName}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-incident-at`}>
          Incident date-time
        </label>
        <Input
          id={`${props.mode}-incident-at`}
          onChange={(event) => {
            props.onStateChange({
              ...props.state,
              payload: {
                ...payload,
                incidentAt: event.target.value,
              },
            });
          }}
          type="datetime-local"
          value={payload.incidentAt}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-situation-description`}>
          Situation description
        </label>
        <Textarea
          id={`${props.mode}-situation-description`}
          onChange={(event) => {
            props.onStateChange({
              ...props.state,
              payload: {
                ...payload,
                situationDescription: event.target.value,
              },
            });
          }}
          placeholder="Опиши, что произошло и в каком контексте."
          value={payload.situationDescription}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-violation-summary`}>
          Violation summary
        </label>
        <Textarea
          id={`${props.mode}-violation-summary`}
          onChange={(event) => {
            props.onStateChange({
              ...props.state,
              payload: {
                ...payload,
                violationSummary: event.target.value,
              },
            });
          }}
          placeholder="Коротко сформулируй, в чём именно состоит нарушение."
          value={payload.violationSummary}
        />
      </div>

      {payload.filingMode === "representative" ? (
        <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Trustor snapshot</h3>
            <ComplaintFieldHint>
              На этом шаге trustor сохраняется прямо внутри документа как snapshot. Отдельный trustor
              registry потом можно подключить отдельно, не ломая этот flow.
            </ComplaintFieldHint>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-trustor-full-name`}>
                Trustor full name
              </label>
              <Input
                id={`${props.mode}-trustor-full-name`}
                onChange={(event) => {
                  props.onStateChange({
                    ...props.state,
                    payload: {
                      ...payload,
                      trustorSnapshot: {
                        ...(payload.trustorSnapshot ?? buildEmptyTrustorSnapshot()),
                        fullName: event.target.value,
                      },
                    },
                  });
                }}
                value={payload.trustorSnapshot?.fullName ?? ""}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-trustor-passport`}>
                Trustor passport number
              </label>
              <Input
                id={`${props.mode}-trustor-passport`}
                onChange={(event) => {
                  props.onStateChange({
                    ...props.state,
                    payload: {
                      ...payload,
                      trustorSnapshot: {
                        ...(payload.trustorSnapshot ?? buildEmptyTrustorSnapshot()),
                        passportNumber: event.target.value,
                      },
                    },
                  });
                }}
                value={payload.trustorSnapshot?.passportNumber ?? ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-trustor-note`}>
              Trustor note
            </label>
            <Textarea
              id={`${props.mode}-trustor-note`}
              onChange={(event) => {
                props.onStateChange({
                  ...props.state,
                  payload: {
                    ...payload,
                    trustorSnapshot: {
                      ...(payload.trustorSnapshot ?? buildEmptyTrustorSnapshot()),
                      note: event.target.value,
                    },
                  },
                });
              }}
              placeholder="Дополнительная пометка по доверителю."
              value={payload.trustorSnapshot?.note ?? ""}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Evidence links</h3>
          <ComplaintFieldHint>
            Только ссылки и текстовые rows. File uploads и forum automation в этот шаг не входят.
          </ComplaintFieldHint>
        </div>
        <EvidenceGroupsEditor
          evidenceGroups={payload.evidenceGroups}
          onChange={(groups) => {
            props.onStateChange({
              ...props.state,
              payload: {
                ...payload,
                evidenceGroups: groups,
              },
            });
          }}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-working-notes`}>
          Working notes
        </label>
        <Textarea
          id={`${props.mode}-working-notes`}
          onChange={(event) => {
            props.onStateChange({
              ...props.state,
              payload: {
                ...payload,
                workingNotes: event.target.value,
              },
            });
          }}
          placeholder="Внутренние рабочие пометки по жалобе."
          value={payload.workingNotes}
        />
      </div>
    </div>
  );
}

export function OgpComplaintDraftCreateClient(props: OgpComplaintDraftCreateClientProps) {
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

  useEffect(() => {
    if (!selectedCharacter.canUseRepresentative && editorState.payload.filingMode === "representative") {
      setEditorState((current) => ({
        ...current,
        payload: {
          ...current.payload,
          filingMode: "self",
          trustorSnapshot: null,
        },
      }));
    }
  }, [editorState.payload.filingMode, selectedCharacter.canUseRepresentative]);

  return (
    <form action={createOgpComplaintDraftAction} className="space-y-6">
      <input name="serverSlug" type="hidden" value={props.server.code} />
      <input name="characterId" type="hidden" value={selectedCharacter.id} />
      <input name="title" type="hidden" value={editorState.title} />
      <input name="payloadJson" type="hidden" value={JSON.stringify(editorState.payload)} />

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="create-character-id">
          Персонаж для first save
        </label>
        <Select
          id="create-character-id"
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
        <ComplaintFieldHint>
          До первого сохранения персонажа можно сменить. После first save server и author snapshot станут immutable.
        </ComplaintFieldHint>
      </div>

      <ComplaintFormFields
        characterLabel={`${selectedCharacter.fullName} (${selectedCharacter.passportNumber})`}
        mode="create"
        onStateChange={setEditorState}
        profileComplete={selectedCharacter.isProfileComplete}
        representativeAllowed={selectedCharacter.canUseRepresentative}
        state={editorState}
      />

      <div className="flex flex-wrap gap-3">
        <Button type="submit">Создать persisted complaint draft</Button>
      </div>
    </form>
  );
}

export function DocumentDraftEditorClient(props: OgpComplaintDraftEditorClientProps) {
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

  const representativeAllowed = props.authorSnapshot.canUseRepresentative;

  useEffect(() => {
    if (!representativeAllowed && editorState.payload.filingMode === "representative") {
      setEditorState((current) => ({
        ...current,
        payload: {
          ...current.payload,
          filingMode: "self",
          trustorSnapshot: null,
        },
      }));
    }
  }, [editorState.payload.filingMode, representativeAllowed]);

  const isDirty = !areStatesEqual(editorState, savedState);

  const performSave = useCallback(
    async (mode: "autosave" | "manual") => {
      const result = await saveDocumentDraftAction({
        documentId: props.documentId,
        title: editorState.title,
        payload: editorState.payload,
      });

      if (!result.ok) {
        if (result.error === "representative-not-allowed") {
          setSaveMessage("Representative filing недоступен без access flag advocate.");
          return;
        }

        if (result.error === "invalid-payload") {
          setSaveMessage("Черновик не прошёл валидацию. Проверь поля жалобы и ссылки evidence.");
          return;
        }

        setSaveMessage("Сохранить черновик не удалось. Проверь доступ и попробуй ещё раз.");
        return;
      }

      setSavedState(editorState);
      setSavedUpdatedAt(result.updatedAt);
      setSaveMessage(
        mode === "autosave"
          ? `Черновик автосохранён: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`
          : `Черновик сохранён вручную: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`,
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
      <ComplaintFormFields
        characterLabel={`${props.authorSnapshot.fullName} (${props.authorSnapshot.passportNumber})`}
        draftStatusLabel={props.status}
        mode="edit"
        onStateChange={setEditorState}
        profileComplete={props.authorSnapshot.isProfileComplete}
        representativeAllowed={representativeAllowed}
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
          Сохранить complaint draft
        </Button>
        <span className="text-sm text-[var(--muted)]">
          BBCode generation и forum publication automation в этом шаге ещё не реализованы.
        </span>
      </div>

      {saveMessage ? <p className="text-sm text-[var(--muted)]">{saveMessage}</p> : null}
    </div>
  );
}
