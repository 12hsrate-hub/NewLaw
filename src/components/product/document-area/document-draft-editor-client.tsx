"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { applyOgpRewriteSuggestion, getOgpRewriteSectionText } from "@/document-ai/sections";
import { DocumentFieldRewritePanel } from "@/components/product/document-area/document-field-rewrite-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createOgpComplaintDraftAction,
  generateOgpComplaintBbcodeAction,
  publishOgpComplaintCreateAction,
  publishOgpComplaintUpdateAction,
  rewriteDocumentFieldAction,
  saveDocumentDraftAction,
  updateDocumentPublicationMetadataAction,
} from "@/server/actions/documents";
import type {
  OgpForumSyncState,
  OgpComplaintDraftPayload,
  OgpComplaintEvidenceGroup,
  OgpComplaintEvidenceRow,
  OgpComplaintTrustorSnapshot,
} from "@/schemas/document";
import type { DocumentFieldRewriteUsageMeta, OgpDocumentRewriteSectionKey } from "@/schemas/document-ai";
import type { ForumConnectionSummary } from "@/schemas/forum-integration";

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
  initialLastGeneratedBbcode: string | null;
  generatedAt: string | null;
  generatedLawVersion: string | null;
  generatedTemplateVersion: string | null;
  generatedFormSchemaVersion: string | null;
  initialPublicationUrl: string | null;
  initialIsSiteForumSynced: boolean;
  initialIsModifiedAfterGeneration: boolean;
  initialForumSyncState: OgpForumSyncState;
  initialForumThreadId: string | null;
  initialForumPostId: string | null;
  initialForumPublishedBbcodeHash: string | null;
  initialForumLastPublishedAt: string | null;
  initialForumLastSyncError: string | null;
  status: "draft" | "generated" | "published";
  forumConnection: ForumConnectionSummary;
  updatedAt: string;
};

type OgpComplaintEditorState = {
  title: string;
  payload: OgpComplaintDraftPayload;
};

type OgpComplaintGenerationState = {
  status: "draft" | "generated" | "published";
  lastGeneratedBbcode: string | null;
  generatedAt: string | null;
  generatedLawVersion: string | null;
  generatedTemplateVersion: string | null;
  generatedFormSchemaVersion: string | null;
  publicationUrl: string | null;
  isSiteForumSynced: boolean;
  isModifiedAfterGeneration: boolean;
  forumSyncState: OgpForumSyncState;
  forumThreadId: string | null;
  forumPostId: string | null;
  forumPublishedBbcodeHash: string | null;
  forumLastPublishedAt: string | null;
  forumLastSyncError: string | null;
};

type OgpRewriteSuggestionState = {
  sectionKey: OgpDocumentRewriteSectionKey;
  sectionLabel: string;
  sourceText: string;
  suggestionText: string;
  basedOnUpdatedAt: string;
  usageMeta: DocumentFieldRewriteUsageMeta;
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

function formatForumConnectionState(state: ForumConnectionSummary["state"]) {
  if (state === "not_connected") {
    return "not_connected";
  }

  if (state === "connected_unvalidated") {
    return "connected_unvalidated";
  }

  if (state === "valid") {
    return "valid";
  }

  if (state === "invalid") {
    return "invalid";
  }

  return "disabled";
}

function formatForumSyncState(state: OgpForumSyncState) {
  if (state === "not_published") {
    return "not_published";
  }

  if (state === "current") {
    return "current";
  }

  if (state === "outdated") {
    return "outdated";
  }

  if (state === "failed") {
    return "failed";
  }

  return "manual_untracked";
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

function createGenerationState(input: {
  status: "draft" | "generated" | "published";
  lastGeneratedBbcode: string | null;
  generatedAt: string | null;
  generatedLawVersion: string | null;
  generatedTemplateVersion: string | null;
  generatedFormSchemaVersion: string | null;
  publicationUrl: string | null;
  isSiteForumSynced: boolean;
  isModifiedAfterGeneration: boolean;
  forumSyncState: OgpForumSyncState;
  forumThreadId: string | null;
  forumPostId: string | null;
  forumPublishedBbcodeHash: string | null;
  forumLastPublishedAt: string | null;
  forumLastSyncError: string | null;
}): OgpComplaintGenerationState {
  return {
    status: input.status,
    lastGeneratedBbcode: input.lastGeneratedBbcode,
    generatedAt: input.generatedAt,
    generatedLawVersion: input.generatedLawVersion,
    generatedTemplateVersion: input.generatedTemplateVersion,
    generatedFormSchemaVersion: input.generatedFormSchemaVersion,
    publicationUrl: input.publicationUrl,
    isSiteForumSynced: input.isSiteForumSynced,
    isModifiedAfterGeneration: input.isModifiedAfterGeneration,
    forumSyncState: input.forumSyncState,
    forumThreadId: input.forumThreadId,
    forumPostId: input.forumPostId,
    forumPublishedBbcodeHash: input.forumPublishedBbcodeHash,
    forumLastPublishedAt: input.forumLastPublishedAt,
    forumLastSyncError: input.forumLastSyncError,
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
  renderRewriteControls?: (input: {
    sectionKey: OgpDocumentRewriteSectionKey;
    sectionLabel: string;
  }) => ReactNode;
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
        {props.renderRewriteControls?.({
          sectionKey: "situation_description",
          sectionLabel: "Situation description",
        })}
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
        {props.renderRewriteControls?.({
          sectionKey: "violation_summary",
          sectionLabel: "Violation summary",
        })}
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
  const [generationState, setGenerationState] = useState(() =>
    createGenerationState({
      status: props.status,
      lastGeneratedBbcode: props.initialLastGeneratedBbcode,
      generatedAt: props.generatedAt,
      generatedLawVersion: props.generatedLawVersion,
      generatedTemplateVersion: props.generatedTemplateVersion,
      generatedFormSchemaVersion: props.generatedFormSchemaVersion,
      publicationUrl: props.initialPublicationUrl,
      isSiteForumSynced: props.initialIsSiteForumSynced,
      isModifiedAfterGeneration: props.initialIsModifiedAfterGeneration,
      forumSyncState: props.initialForumSyncState,
      forumThreadId: props.initialForumThreadId,
      forumPostId: props.initialForumPostId,
      forumPublishedBbcodeHash: props.initialForumPublishedBbcodeHash,
      forumLastPublishedAt: props.initialForumLastPublishedAt,
      forumLastSyncError: props.initialForumLastSyncError,
    }),
  );
  const [savedUpdatedAt, setSavedUpdatedAt] = useState(props.updatedAt);
  const [publicationUrlInput, setPublicationUrlInput] = useState(props.initialPublicationUrl ?? "");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [publicationMessage, setPublicationMessage] = useState<string | null>(null);
  const [rewriteSuggestion, setRewriteSuggestion] = useState<OgpRewriteSuggestionState | null>(null);
  const [rewriteFeedback, setRewriteFeedback] = useState<{
    sectionKey: OgpDocumentRewriteSectionKey;
    message: string;
  } | null>(null);
  const [rewritePendingSectionKey, setRewritePendingSectionKey] =
    useState<OgpDocumentRewriteSectionKey | null>(null);
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

  useEffect(() => {
    if (!rewriteSuggestion) {
      return;
    }

    const currentSectionText = getOgpRewriteSectionText(editorState.payload, rewriteSuggestion.sectionKey);

    if (currentSectionText !== rewriteSuggestion.sourceText) {
      setRewriteSuggestion(null);
    }
  }, [editorState.payload, rewriteSuggestion]);

  const isDirty = !areStatesEqual(editorState, savedState);
  const canGenerateFromPersistedState = !isDirty;
  const hasAutomationOwnedIdentity = Boolean(
    generationState.forumThreadId && generationState.forumPostId,
  );
  const canPublishCreate =
    !hasAutomationOwnedIdentity && generationState.forumSyncState !== "manual_untracked";
  const canPublishUpdate =
    hasAutomationOwnedIdentity &&
    (generationState.forumSyncState === "outdated" || generationState.forumSyncState === "failed");
  const publicationReadinessLabel = useMemo(() => {
    if (!generationState.generatedAt || !generationState.lastGeneratedBbcode) {
      return "не готово к публикации";
    }

    if (generationState.forumSyncState === "manual_untracked") {
      return "manual publication url without automation tracking";
    }

    if (generationState.forumSyncState === "failed" && hasAutomationOwnedIdentity) {
      return "ошибка публикации, можно повторить sync";
    }

    if (generationState.forumSyncState === "outdated" && hasAutomationOwnedIdentity) {
      return "требуется update/resync";
    }

    if (generationState.forumSyncState === "current" && hasAutomationOwnedIdentity) {
      return "опубликовано и актуально";
    }

    if (generationState.isModifiedAfterGeneration) {
      return "нужна регенерация перед публикацией";
    }

    if (props.forumConnection.state === "valid") {
      return "готово к публикации";
    }

    return "нужна валидная forum session";
  }, [
    generationState.forumSyncState,
    generationState.generatedAt,
    generationState.isModifiedAfterGeneration,
    generationState.lastGeneratedBbcode,
    hasAutomationOwnedIdentity,
    props.forumConnection.state,
  ]);

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
      setGenerationState((current) => ({
        ...current,
        status: result.status,
        isModifiedAfterGeneration: result.isModifiedAfterGeneration,
        isSiteForumSynced: result.isModifiedAfterGeneration ? false : current.isSiteForumSynced,
        forumSyncState: result.isModifiedAfterGeneration
          ? current.publicationUrl && !current.forumThreadId && !current.forumPostId
            ? "manual_untracked"
            : current.forumThreadId && current.forumPostId
              ? "outdated"
              : current.forumSyncState
          : current.forumSyncState,
      }));
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

  const handleGenerate = useCallback(async () => {
    if (!canGenerateFromPersistedState) {
      setGenerationMessage("Сначала сохраните черновик. Генерация всегда берёт уже persisted payload.");
      return;
    }

    const result = await generateOgpComplaintBbcodeAction({
      documentId: props.documentId,
    });

    if (!result.ok) {
      if (result.error === "generation-blocked") {
        setGenerationMessage(result.reasons.join(" "));
        return;
      }

      setGenerationMessage("Сгенерировать BBCode не удалось. Проверь доступ и попробуй ещё раз.");
      return;
    }

    setSavedUpdatedAt(result.updatedAt);
    setGenerationState({
      status: result.status,
      lastGeneratedBbcode: result.lastGeneratedBbcode,
      generatedAt: result.generatedAt,
      generatedLawVersion: result.generatedLawVersion,
      generatedTemplateVersion: result.generatedTemplateVersion,
      generatedFormSchemaVersion: result.generatedFormSchemaVersion,
      publicationUrl: result.publicationUrl,
      isSiteForumSynced: result.isSiteForumSynced,
      isModifiedAfterGeneration: result.isModifiedAfterGeneration,
      forumSyncState:
        result.publicationUrl && !generationState.forumThreadId && !generationState.forumPostId
          ? "manual_untracked"
          : generationState.forumThreadId && generationState.forumPostId
            ? "outdated"
            : generationState.forumSyncState,
      forumThreadId: generationState.forumThreadId,
      forumPostId: generationState.forumPostId,
      forumPublishedBbcodeHash: generationState.forumPublishedBbcodeHash,
      forumLastPublishedAt: generationState.forumLastPublishedAt,
      forumLastSyncError: null,
    });
    setPublicationUrlInput(result.publicationUrl ?? "");
    setGenerationMessage(
      `BBCode сгенерирован: ${result.generatedAt ? new Date(result.generatedAt).toLocaleString("ru-RU") : "время недоступно"}.`,
    );
  }, [
    canGenerateFromPersistedState,
    generationState.forumLastPublishedAt,
    generationState.forumPostId,
    generationState.forumPublishedBbcodeHash,
    generationState.forumSyncState,
    generationState.forumThreadId,
    props.documentId,
  ]);

  const handleCopyBbcode = useCallback(async () => {
    if (!generationState.lastGeneratedBbcode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generationState.lastGeneratedBbcode);
      setGenerationMessage("BBCode скопирован в буфер обмена.");
    } catch {
      setGenerationMessage("Не удалось скопировать BBCode автоматически. Можно скопировать его вручную из блока ниже.");
    }
  }, [generationState.lastGeneratedBbcode]);

  const handleRewriteRequest = useCallback(
    async (sectionKey: OgpDocumentRewriteSectionKey, sectionLabel: string) => {
      if (isDirty) {
        setRewriteFeedback({
          sectionKey,
          message: "Сначала сохраните черновик. AI suggestion всегда строится из persisted документа.",
        });
        setRewriteSuggestion(null);
        return;
      }

      setRewritePendingSectionKey(sectionKey);
      setRewriteFeedback(null);

      try {
        const result = await rewriteDocumentFieldAction({
          documentId: props.documentId,
          sectionKey,
        });

        if (!result.ok) {
          if (result.error === "rewrite-blocked") {
            setRewriteFeedback({
              sectionKey,
              message: result.reasons.join(" "),
            });
            setRewriteSuggestion(null);
            return;
          }

          if (result.error === "rewrite-unavailable") {
            setRewriteFeedback({
              sectionKey,
              message: result.message,
            });
            setRewriteSuggestion(null);
            return;
          }

          setRewriteFeedback({
            sectionKey,
            message: "Получить AI-предложение не удалось. Проверь доступ к документу и попробуй ещё раз.",
          });
          setRewriteSuggestion(null);
          return;
        }

        setRewriteSuggestion({
          sectionKey,
          sectionLabel,
          sourceText: result.sourceText,
          suggestionText: result.suggestionText,
          basedOnUpdatedAt: result.basedOnUpdatedAt,
          usageMeta: result.usageMeta,
        });
      } finally {
        setRewritePendingSectionKey(null);
      }
    },
    [isDirty, props.documentId],
  );

  const handleRewriteApply = useCallback(() => {
    if (!rewriteSuggestion) {
      return;
    }

    setEditorState((current) => ({
      ...current,
      payload: applyOgpRewriteSuggestion(
        current.payload,
        rewriteSuggestion.sectionKey,
        rewriteSuggestion.suggestionText,
      ),
    }));
    setRewriteFeedback({
      sectionKey: rewriteSuggestion.sectionKey,
      message: "AI-предложение применено локально. Сохраните черновик или дождитесь autosave.",
    });
    setRewriteSuggestion(null);
  }, [rewriteSuggestion]);

  const handleRewriteCopy = useCallback(async () => {
    if (!rewriteSuggestion) {
      return;
    }

    try {
      await navigator.clipboard.writeText(rewriteSuggestion.suggestionText);
      setRewriteFeedback({
        sectionKey: rewriteSuggestion.sectionKey,
        message: "AI-предложение скопировано в буфер обмена.",
      });
    } catch {
      setRewriteFeedback({
        sectionKey: rewriteSuggestion.sectionKey,
        message: "Не удалось скопировать AI-предложение автоматически.",
      });
    }
  }, [rewriteSuggestion]);

  const renderRewriteControls = useCallback(
    (input: {
      sectionKey: OgpDocumentRewriteSectionKey;
      sectionLabel: string;
    }) => {
      const sectionFeedback =
        rewriteFeedback?.sectionKey === input.sectionKey ? rewriteFeedback.message : null;
      const activeSuggestion =
        rewriteSuggestion?.sectionKey === input.sectionKey ? rewriteSuggestion : null;

      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={rewritePendingSectionKey !== null}
              onClick={() => {
                void handleRewriteRequest(input.sectionKey, input.sectionLabel);
              }}
              type="button"
              variant="secondary"
            >
              {rewritePendingSectionKey === input.sectionKey ? "AI обрабатывает..." : "Улучшить текст"}
            </Button>
            <span className="text-xs leading-5 text-[var(--muted)]">
              AI использует только последнее persisted состояние секции.
            </span>
          </div>
          {sectionFeedback ? <p className="text-sm text-[var(--muted)]">{sectionFeedback}</p> : null}
          {activeSuggestion ? (
            <DocumentFieldRewritePanel
              basedOnUpdatedAt={activeSuggestion.basedOnUpdatedAt}
              onApply={handleRewriteApply}
              onCopy={() => {
                void handleRewriteCopy();
              }}
              onDismiss={() => {
                setRewriteSuggestion(null);
              }}
              sectionLabel={activeSuggestion.sectionLabel}
              sourceText={activeSuggestion.sourceText}
              suggestionText={activeSuggestion.suggestionText}
            />
          ) : null}
        </div>
      );
    },
    [
      handleRewriteApply,
      handleRewriteCopy,
      handleRewriteRequest,
      rewriteFeedback,
      rewritePendingSectionKey,
      rewriteSuggestion,
    ],
  );

  const handlePublicationSave = useCallback(async () => {
    const result = await updateDocumentPublicationMetadataAction({
      documentId: props.documentId,
      publicationUrl: publicationUrlInput,
      isSiteForumSynced: generationState.isSiteForumSynced && publicationUrlInput.trim().length > 0,
    });

    if (!result.ok) {
      if (result.error === "publication-before-generation") {
        setPublicationMessage("Сначала сгенерируйте BBCode, а уже потом указывайте publication URL.");
        return;
      }

      if (result.error === "invalid-publication-url") {
        setPublicationMessage("Publication URL должен быть пустым или вести на https://forum.gta5rp.com/.");
        return;
      }

      setPublicationMessage("Сохранить publication metadata не удалось.");
      return;
    }

    setSavedUpdatedAt(result.updatedAt);
    setGenerationState((current) => ({
      ...current,
      status: result.status,
      publicationUrl: result.publicationUrl,
      isSiteForumSynced: result.isSiteForumSynced,
      forumSyncState:
        result.publicationUrl && !current.forumThreadId && !current.forumPostId
          ? "manual_untracked"
          : result.publicationUrl
            ? current.forumSyncState
            : current.forumThreadId && current.forumPostId
              ? current.forumSyncState
              : "not_published",
      forumLastSyncError:
        result.publicationUrl && !current.forumThreadId && !current.forumPostId
          ? null
          : current.forumLastSyncError,
    }));
    setPublicationUrlInput(result.publicationUrl ?? "");
    setPublicationMessage("Publication metadata обновлены.");
  }, [generationState.isSiteForumSynced, props.documentId, publicationUrlInput]);

  const handlePublishCreate = useCallback(async () => {
    if (isDirty) {
      setPublicationMessage(
        "Сначала сохраните черновик. Publish create всегда использует latest persisted generated BBCode.",
      );
      return;
    }

    const result = await publishOgpComplaintCreateAction({
      documentId: props.documentId,
    });

    if (!result.ok) {
      if (result.error === "publication-blocked") {
        setPublicationMessage(result.reasons.join(" "));
        return;
      }

      if (result.error === "publication-failed") {
        setGenerationState((current) => ({
          ...current,
          forumSyncState: "failed",
          forumLastSyncError: result.message,
          isSiteForumSynced: false,
        }));
        setPublicationMessage(result.message);
        return;
      }

      setPublicationMessage("Выполнить publish create не удалось. Проверьте доступ к документу.");
      return;
    }

    setSavedUpdatedAt(result.updatedAt);
    setGenerationState((current) => ({
      ...current,
      status: result.status,
      publicationUrl: result.publicationUrl,
      isSiteForumSynced: result.isSiteForumSynced,
      isModifiedAfterGeneration: result.isModifiedAfterGeneration,
      generatedAt: result.generatedAt,
      forumSyncState: result.forumSyncState,
      forumThreadId: result.forumThreadId,
      forumPostId: result.forumPostId,
      forumPublishedBbcodeHash: result.forumPublishedBbcodeHash,
      forumLastPublishedAt: result.forumLastPublishedAt,
      forumLastSyncError: result.forumLastSyncError,
    }));
    setPublicationUrlInput(result.publicationUrl ?? "");
    setPublicationMessage("Документ опубликован на форуме через automation create-step.");
  }, [isDirty, props.documentId]);

  const handlePublishUpdate = useCallback(async () => {
    if (isDirty) {
      setPublicationMessage(
        "Сначала сохраните черновик. Update/resync всегда использует latest persisted generated BBCode.",
      );
      return;
    }

    const result = await publishOgpComplaintUpdateAction({
      documentId: props.documentId,
    });

    if (!result.ok) {
      if (result.error === "publication-blocked") {
        setPublicationMessage(result.reasons.join(" "));
        return;
      }

      if (result.error === "publication-failed") {
        setGenerationState((current) => ({
          ...current,
          forumSyncState: "failed",
          forumLastSyncError: result.message,
          isSiteForumSynced: false,
        }));
        setPublicationMessage(result.message);
        return;
      }

      setPublicationMessage("Выполнить publish update не удалось. Проверьте доступ к документу.");
      return;
    }

    setSavedUpdatedAt(result.updatedAt);
    setGenerationState((current) => ({
      ...current,
      status: result.status,
      publicationUrl: result.publicationUrl,
      isSiteForumSynced: result.isSiteForumSynced,
      isModifiedAfterGeneration: result.isModifiedAfterGeneration,
      generatedAt: result.generatedAt,
      forumSyncState: result.forumSyncState,
      forumThreadId: result.forumThreadId,
      forumPostId: result.forumPostId,
      forumPublishedBbcodeHash: result.forumPublishedBbcodeHash,
      forumLastPublishedAt: result.forumLastPublishedAt,
      forumLastSyncError: result.forumLastSyncError,
    }));
    setPublicationUrlInput(result.publicationUrl ?? "");
    setPublicationMessage("Forum publication обновлена через automation update/resync.");
  }, [isDirty, props.documentId]);

  return (
    <div className="space-y-6">
      <ComplaintFormFields
        characterLabel={`${props.authorSnapshot.fullName} (${props.authorSnapshot.passportNumber})`}
        draftStatusLabel={generationState.status}
        mode="edit"
        onStateChange={setEditorState}
        profileComplete={props.authorSnapshot.isProfileComplete}
        representativeAllowed={representativeAllowed}
        renderRewriteControls={renderRewriteControls}
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
        <Button
          disabled={!canGenerateFromPersistedState}
          onClick={() => {
            startTransition(() => {
              void handleGenerate();
            });
          }}
          type="button"
          variant="secondary"
        >
          Сгенерировать BBCode
        </Button>
      </div>

      {saveMessage ? <p className="text-sm text-[var(--muted)]">{saveMessage}</p> : null}
      {generationMessage ? <p className="text-sm text-[var(--muted)]">{generationMessage}</p> : null}

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Generation metadata</h3>
          <ComplaintFieldHint>
            Генерация использует только уже persisted complaint payload и не подменяет server/character snapshot.
          </ComplaintFieldHint>
        </div>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Status: {generationState.status}</li>
          <li>
            Generated at:{" "}
            {generationState.generatedAt
              ? new Date(generationState.generatedAt).toLocaleString("ru-RU")
              : "ещё не генерировалось"}
          </li>
          <li>Generated law version: {generationState.generatedLawVersion ?? "ещё не заполнено"}</li>
          <li>
            Generated template version: {generationState.generatedTemplateVersion ?? "ещё не заполнено"}
          </li>
          <li>
            Generated form schema version: {generationState.generatedFormSchemaVersion ?? "ещё не заполнено"}
          </li>
          <li>
            Modified after generation: {generationState.isModifiedAfterGeneration ? "да" : "нет"}
          </li>
          <li>Forum sync state: {formatForumSyncState(generationState.forumSyncState)}</li>
          <li>
            Forum last published at:{" "}
            {generationState.forumLastPublishedAt
              ? new Date(generationState.forumLastPublishedAt).toLocaleString("ru-RU")
              : "ещё не публиковался"}
          </li>
        </ul>
      </div>

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">BBCode preview</h3>
            <ComplaintFieldHint>
              Здесь показывается deterministic результат generation. Publish create использует только этот persisted generated BBCode.
            </ComplaintFieldHint>
          </div>
          <Button
            disabled={!generationState.lastGeneratedBbcode}
            onClick={() => {
              startTransition(() => {
                void handleCopyBbcode();
              });
            }}
            type="button"
            variant="secondary"
          >
            Копировать BBCode
          </Button>
        </div>
        <Textarea
          className="min-h-[320px] font-mono text-xs"
          readOnly
          value={generationState.lastGeneratedBbcode ?? "BBCode ещё не сгенерирован."}
        />
      </div>

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Publication metadata</h3>
          <ComplaintFieldHint>
            Publication URL и forum sync marker относятся только к `ogp_complaint`. Здесь уже есть
            create/update automation для forum publication, но claims этот workflow не наследуют.
          </ComplaintFieldHint>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          <p>
            Forum session state:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {formatForumConnectionState(props.forumConnection.state)}
            </span>
          </p>
          <p>
            Forum identity:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {props.forumConnection.forumUsername ?? "ещё не извлечена"}
              {props.forumConnection.forumUserId ? ` (${props.forumConnection.forumUserId})` : ""}
            </span>
          </p>
          <p>
            Validate status:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {props.forumConnection.validatedAt
                ? new Date(props.forumConnection.validatedAt).toLocaleString("ru-RU")
                : "ещё не подтверждалась"}
            </span>
          </p>
          {props.forumConnection.lastValidationError ? (
            <p className="mt-2 text-[#8a2d1d]">
              Требуется переподключение: {props.forumConnection.lastValidationError}
            </p>
          ) : null}
          <p className="mt-2">Само подключение session управляется отдельно через `/account/security`.</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          <p>
            Publication readiness:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {publicationReadinessLabel}
            </span>
          </p>
          <p>
            Forum sync state:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {formatForumSyncState(generationState.forumSyncState)}
            </span>
          </p>
          <p>
            Automation-owned identity:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {generationState.forumThreadId && generationState.forumPostId
                ? `${generationState.forumThreadId} / ${generationState.forumPostId}`
                : "ещё не сохранена"}
            </span>
          </p>
          <p>
            Published at:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {generationState.forumLastPublishedAt
                ? new Date(generationState.forumLastPublishedAt).toLocaleString("ru-RU")
                : "ещё не публиковался"}
            </span>
          </p>
          {generationState.forumLastSyncError ? (
            <p className="mt-2 text-[#8a2d1d]">
              Последняя ошибка forum sync: {generationState.forumLastSyncError}
            </p>
          ) : null}
          <p className="mt-2">
            Automation доступна только для `ogp_complaint`: create работает для first publish, а update/resync
            возвращает automation-owned публикацию из `outdated` или `failed` обратно в `current`.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="publication-url">
            Publication URL
          </label>
          <Input
            id="publication-url"
            onChange={(event) => {
              setPublicationUrlInput(event.target.value);
            }}
            placeholder="https://forum.gta5rp.com/..."
            value={publicationUrlInput}
          />
        </div>
        <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
          <input
            checked={generationState.isSiteForumSynced}
            disabled={publicationUrlInput.trim().length === 0}
            onChange={(event) => {
              setGenerationState((current) => ({
                ...current,
                isSiteForumSynced: event.target.checked,
              }));
            }}
            type="checkbox"
          />
          Пометить как вручную синхронизированный с форумом
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {canPublishCreate ? (
            <Button
              disabled={isDirty}
              onClick={() => {
                startTransition(() => {
                  void handlePublishCreate();
                });
              }}
              type="button"
            >
              Опубликовать на форуме
            </Button>
          ) : null}
          {canPublishUpdate ? (
            <Button
              disabled={isDirty}
              onClick={() => {
                startTransition(() => {
                  void handlePublishUpdate();
                });
              }}
              type="button"
            >
              Обновить публикацию
            </Button>
          ) : null}
          <Button
            onClick={() => {
              startTransition(() => {
                void handlePublicationSave();
              });
            }}
            type="button"
            variant="secondary"
          >
            Сохранить publication metadata
          </Button>
          <span className="text-sm text-[var(--muted)]">
            Текущий forum sync: {generationState.isSiteForumSynced ? "да" : "нет"} /{" "}
            {formatForumSyncState(generationState.forumSyncState)}
          </span>
        </div>
        {publicationMessage ? <p className="text-sm text-[var(--muted)]">{publicationMessage}</p> : null}
      </div>
    </div>
  );
}
