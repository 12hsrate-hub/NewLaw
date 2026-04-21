"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createClaimDraftAction,
  generateClaimsStructuredCheckpointAction,
  generateClaimsStructuredPreviewAction,
  saveDocumentDraftAction,
} from "@/server/actions/documents";
import type {
  ClaimDocumentType,
  ClaimsDraftPayload,
  ClaimsRenderedOutput,
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
  generatedAt: string | null;
  generatedFormSchemaVersion: string | null;
  generatedOutputFormat: string | null;
  generatedRendererVersion: string | null;
  generatedArtifact: ClaimsRenderedOutput | null;
  isModifiedAfterGeneration: boolean;
};

type ClaimsPreviewState = ClaimsRenderedOutput | null;

type ClaimsGenerationState = {
  status: "draft" | "generated" | "published";
  generatedAt: string | null;
  generatedFormSchemaVersion: string | null;
  generatedOutputFormat: string | null;
  generatedRendererVersion: string | null;
  isModifiedAfterGeneration: boolean;
};

type ClaimsEditorState = {
  title: string;
  payload: ClaimsDraftPayload;
};

function createLocalId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildEmptyEvidenceGroup(): OgpComplaintEvidenceGroup {
  return {
    id: createLocalId("claim_evidence_group"),
    title: "",
    rows: [],
  };
}

function buildEmptyEvidenceRow(): OgpComplaintEvidenceRow {
  return {
    id: createLocalId("claim_evidence_row"),
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

function createEditorState(input: {
  title: string;
  payload: ClaimsDraftPayload;
}): ClaimsEditorState {
  return {
    title: input.title,
    payload: {
      ...input.payload,
      trustorSnapshot:
        input.payload.filingMode === "representative"
          ? (input.payload.trustorSnapshot ?? buildEmptyTrustorSnapshot())
          : null,
    },
  };
}

function areStatesEqual(left: ClaimsEditorState, right: ClaimsEditorState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createGenerationState(input: {
  status: "draft" | "generated" | "published";
  generatedAt: string | null;
  generatedFormSchemaVersion: string | null;
  generatedOutputFormat: string | null;
  generatedRendererVersion: string | null;
  isModifiedAfterGeneration: boolean;
}): ClaimsGenerationState {
  return {
    status: input.status,
    generatedAt: input.generatedAt,
    generatedFormSchemaVersion: input.generatedFormSchemaVersion,
    generatedOutputFormat: input.generatedOutputFormat,
    generatedRendererVersion: input.generatedRendererVersion,
    isModifiedAfterGeneration: input.isModifiedAfterGeneration,
  };
}

function formatSubtypeLabel(documentType: ClaimDocumentType) {
  return documentType === "rehabilitation" ? "Rehabilitation" : "Lawsuit";
}

function filingModeLabel(mode: ClaimsDraftPayload["filingMode"]) {
  return mode === "representative" ? "Representative" : "Self";
}

function ClaimsFieldHint(props: { children: string }) {
  return <p className="text-xs leading-5 text-[var(--muted)]">{props.children}</p>;
}

function EvidenceGroupsEditor(props: {
  evidenceGroups: OgpComplaintEvidenceGroup[];
  onChange: (groups: OgpComplaintEvidenceGroup[]) => void;
}) {
  const groups = props.evidenceGroups;

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
          Пока нет evidence groups. Claims editor можно сохранить и без них, а ссылки добавить позже.
        </div>
      ) : null}

      {groups.map((group, groupIndex) => (
        <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4" key={group.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Evidence group {groupIndex + 1}
              </p>
              <ClaimsFieldHint>
                Используем тот же evidence pattern, что и в OGP, чтобы не плодить вторую несовместимую модель.
              </ClaimsFieldHint>
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
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`claim-group-title-${group.id}`}>
              Заголовок группы
            </label>
            <Input
              id={`claim-group-title-${group.id}`}
              onChange={(event) => {
                props.onChange(
                  groups.map((entry) =>
                    entry.id === group.id ? { ...entry, title: event.target.value } : entry,
                  ),
                );
              }}
              placeholder="Например: Ссылки на материалы дела"
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
                    <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`claim-row-label-${row.id}`}>
                      Название / label
                    </label>
                    <Input
                      id={`claim-row-label-${row.id}`}
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
                      placeholder="Например: Ссылка на решение суда"
                      value={row.label}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`claim-row-url-${row.id}`}>
                      Ссылка
                    </label>
                    <Input
                      id={`claim-row-url-${row.id}`}
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
                  <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`claim-row-note-${row.id}`}>
                    Комментарий к ссылке
                  </label>
                  <Textarea
                    id={`claim-row-note-${row.id}`}
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
                    placeholder="Короткое пояснение, что подтверждает эта ссылка."
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

function ClaimsFormFields(props: {
  mode: "create" | "edit";
  documentType: ClaimDocumentType;
  state: ClaimsEditorState;
  onStateChange: (nextState: ClaimsEditorState) => void;
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
        <Badge>{props.mode === "create" ? "pre-draft entry" : "persisted claims editor"}</Badge>
        <Badge>Subtype: {formatSubtypeLabel(props.documentType)}</Badge>
        <Badge>Filing mode: {filingModeLabel(payload.filingMode)}</Badge>
        {props.draftStatusLabel ? <Badge>Status: {props.draftStatusLabel}</Badge> : null}
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
        <p>Сервер и персонаж уже показаны явно. Персонаж: {props.characterLabel}.</p>
        {!props.profileComplete ? (
          <p className="mt-2 text-[var(--accent)]">
            Профиль персонажа неполный. Вход в claims flow разрешён, но этот статус нужно будет учитывать в future output/generation logic.
          </p>
        ) : null}
        {!props.representativeAllowed ? (
          <p className="mt-2">
            У этого персонажа нет access flag `advocate`, поэтому representative filing недоступен.
          </p>
        ) : null}
        <p className="mt-2">
          После first save server, author snapshot и subtype становятся immutable для этого `documentId`.
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-filing-mode`}>
            Filing mode
          </label>
          <Select
            id={`${props.mode}-claim-filing-mode`}
            onChange={(event) => {
              const nextFilingMode = event.target.value as ClaimsDraftPayload["filingMode"];
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
          <ClaimsFieldHint>
            Ветка representative доступна только персонажу с `advocate`.
          </ClaimsFieldHint>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-respondent-name`}>
            Respondent name
          </label>
          <Input
            id={`${props.mode}-claim-respondent-name`}
            maxLength={160}
            onChange={(event) => {
              props.onStateChange({
                ...props.state,
                payload: {
                  ...payload,
                  respondentName: event.target.value,
                },
              });
            }}
            placeholder="Наименование ответчика или органа"
            value={payload.respondentName}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-subject`}>
          Claim subject
        </label>
        <Input
          id={`${props.mode}-claim-subject`}
          maxLength={240}
          onChange={(event) => {
            props.onStateChange({
              ...props.state,
              payload: {
                ...payload,
                claimSubject: event.target.value,
              },
            });
          }}
          placeholder="О чём именно требование или предмет спора"
          value={payload.claimSubject}
        />
      </div>

      {props.documentType === "rehabilitation" ? (
        <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Rehabilitation-specific fields</h3>
            <ClaimsFieldHint>
              Эти поля относятся только к subtype `rehabilitation` и не могут быть заменены на `lawsuit` после first save.
            </ClaimsFieldHint>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-rehabilitation-case-reference`}>
                Case reference
              </label>
              <Input
                id={`${props.mode}-rehabilitation-case-reference`}
                maxLength={160}
                onChange={(event) => {
                  props.onStateChange({
                    ...props.state,
                    payload: {
                      ...payload,
                      caseReference: event.target.value,
                    } as ClaimsDraftPayload,
                  });
                }}
                placeholder="Номер дела, постановления или решения"
                value={"caseReference" in payload ? payload.caseReference : ""}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-rehabilitation-basis`}>
                Rehabilitation basis
              </label>
              <Textarea
                id={`${props.mode}-rehabilitation-basis`}
                onChange={(event) => {
                  props.onStateChange({
                    ...props.state,
                    payload: {
                      ...payload,
                      rehabilitationBasis: event.target.value,
                    } as ClaimsDraftPayload,
                  });
                }}
                placeholder="Основание для реабилитации"
                value={"rehabilitationBasis" in payload ? payload.rehabilitationBasis : ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-rehabilitation-harm-summary`}>
              Harm summary
            </label>
            <Textarea
              id={`${props.mode}-rehabilitation-harm-summary`}
              onChange={(event) => {
                props.onStateChange({
                  ...props.state,
                  payload: {
                    ...payload,
                    harmSummary: event.target.value,
                  } as ClaimsDraftPayload,
                });
              }}
              placeholder="Краткое описание причинённого вреда"
              value={"harmSummary" in payload ? payload.harmSummary : ""}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Lawsuit-specific fields</h3>
            <ClaimsFieldHint>
              Эти поля относятся только к subtype `lawsuit` и не смешиваются с `rehabilitation`.
            </ClaimsFieldHint>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-lawsuit-court-name`}>
                Court name
              </label>
              <Input
                id={`${props.mode}-lawsuit-court-name`}
                maxLength={200}
                onChange={(event) => {
                  props.onStateChange({
                    ...props.state,
                    payload: {
                      ...payload,
                      courtName: event.target.value,
                    } as ClaimsDraftPayload,
                  });
                }}
                placeholder="Суд, в который планируется обращение"
                value={"courtName" in payload ? payload.courtName : ""}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-lawsuit-defendant-name`}>
                Defendant name
              </label>
              <Input
                id={`${props.mode}-lawsuit-defendant-name`}
                maxLength={160}
                onChange={(event) => {
                  props.onStateChange({
                    ...props.state,
                    payload: {
                      ...payload,
                      defendantName: event.target.value,
                    } as ClaimsDraftPayload,
                  });
                }}
                placeholder="Ответчик по иску"
                value={"defendantName" in payload ? payload.defendantName : ""}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-lawsuit-claim-amount`}>
                Claim amount
              </label>
              <Input
                id={`${props.mode}-lawsuit-claim-amount`}
                maxLength={80}
                onChange={(event) => {
                  props.onStateChange({
                    ...props.state,
                    payload: {
                      ...payload,
                      claimAmount: event.target.value,
                    } as ClaimsDraftPayload,
                  });
                }}
                placeholder="Опционально"
                value={"claimAmount" in payload ? payload.claimAmount : ""}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-lawsuit-pretrial-summary`}>
                Pretrial summary
              </label>
              <Textarea
                id={`${props.mode}-lawsuit-pretrial-summary`}
                onChange={(event) => {
                  props.onStateChange({
                    ...props.state,
                    payload: {
                      ...payload,
                      pretrialSummary: event.target.value,
                    } as ClaimsDraftPayload,
                  });
                }}
                placeholder="Что уже делалось до обращения в суд"
                value={"pretrialSummary" in payload ? payload.pretrialSummary : ""}
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-factual-background`}>
          Factual background
        </label>
        <Textarea
          id={`${props.mode}-claim-factual-background`}
          onChange={(event) => {
            props.onStateChange({
              ...props.state,
              payload: {
                ...payload,
                factualBackground: event.target.value,
              },
            });
          }}
          placeholder="Фактические обстоятельства и хронология"
          value={payload.factualBackground}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-legal-basis-summary`}>
            Legal basis summary
          </label>
          <Textarea
            id={`${props.mode}-claim-legal-basis-summary`}
            onChange={(event) => {
              props.onStateChange({
                ...props.state,
                payload: {
                  ...payload,
                  legalBasisSummary: event.target.value,
                },
              });
            }}
            placeholder="Ключевые правовые основания и аргументы"
            value={payload.legalBasisSummary}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-requested-relief`}>
            Requested relief
          </label>
          <Textarea
            id={`${props.mode}-claim-requested-relief`}
            onChange={(event) => {
              props.onStateChange({
                ...props.state,
                payload: {
                  ...payload,
                  requestedRelief: event.target.value,
                },
              });
            }}
            placeholder="Что именно просит заявитель"
            value={payload.requestedRelief}
          />
        </div>
      </div>

      {payload.filingMode === "representative" ? (
        <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Trustor snapshot</h3>
            <ClaimsFieldHint>
              Trustor живёт внутри claims document как snapshot и не зависит от отдельного trustor module.
            </ClaimsFieldHint>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-trustor-full-name`}>
                Trustor full name
              </label>
              <Input
                id={`${props.mode}-claim-trustor-full-name`}
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
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-trustor-passport`}>
                Trustor passport number
              </label>
              <Input
                id={`${props.mode}-claim-trustor-passport`}
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
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-trustor-note`}>
              Trustor note
            </label>
            <Textarea
              id={`${props.mode}-claim-trustor-note`}
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
              placeholder="Дополнительная пометка по доверителю"
              value={payload.trustorSnapshot?.note ?? ""}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Evidence links</h3>
          <ClaimsFieldHint>
            Используется тот же evidence pattern, что и в OGP. File uploads и output/publication сюда не входят.
          </ClaimsFieldHint>
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
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-working-notes`}>
          Working notes
        </label>
        <Textarea
          id={`${props.mode}-claim-working-notes`}
          onChange={(event) => {
            props.onStateChange({
              ...props.state,
              payload: {
                ...payload,
                workingNotes: event.target.value,
              },
            });
          }}
          placeholder="Внутренние рабочие заметки по claim"
          value={payload.workingNotes}
        />
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
          До первого сохранения персонажа можно сменить. После first save subtype и snapshot уже не меняются.
        </ClaimsFieldHint>
      </div>

      <ClaimsFormFields
        characterLabel={`${selectedCharacter.fullName} (${selectedCharacter.passportNumber})`}
        documentType={props.documentType}
        mode="create"
        onStateChange={setEditorState}
        profileComplete={selectedCharacter.isProfileComplete}
        representativeAllowed={selectedCharacter.canUseRepresentative}
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
  const [generationState, setGenerationState] = useState(() =>
    createGenerationState({
      status: props.status,
      generatedAt: props.generatedAt,
      generatedFormSchemaVersion: props.generatedFormSchemaVersion,
      generatedOutputFormat: props.generatedOutputFormat,
      generatedRendererVersion: props.generatedRendererVersion,
      isModifiedAfterGeneration: props.isModifiedAfterGeneration,
    }),
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<ClaimsPreviewState>(props.generatedArtifact);
  const [isPreviewStale, setIsPreviewStale] = useState(
    props.generatedArtifact ? props.isModifiedAfterGeneration : false,
  );
  const lastAutoSaveKeyRef = useRef<string | null>(null);
  const representativeAllowed = props.authorSnapshot.canUseRepresentative;
  const isDirty = !areStatesEqual(editorState, savedState);

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
          setSaveMessage("Claims draft не прошёл валидацию. Проверь обязательные поля, subtype section и evidence ссылки.");
          return;
        }

        setSaveMessage("Сохранить claims draft не удалось. Проверь доступ и попробуй ещё раз.");
        return;
      }

      setSavedState(editorState);
      setSavedUpdatedAt(result.updatedAt);
      setGenerationState((current) => ({
        ...current,
        status: result.status,
        isModifiedAfterGeneration: result.isModifiedAfterGeneration,
      }));
      setIsPreviewStale((current) => current || previewState !== null || result.isModifiedAfterGeneration);
      setSaveMessage(
        mode === "autosave"
          ? `Claims draft автосохранён: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`
          : `Claims draft сохранён вручную: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`,
      );
    },
    [editorState, previewState, props.documentId],
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

  const handleGeneratePreview = useCallback(async () => {
    if (!isDirty && !savedUpdatedAt) {
      setPreviewMessage("Сначала сохраните claims draft, чтобы preview строился из persisted документа.");
      return;
    }

    if (isDirty) {
      setPreviewMessage("Сначала сохраните claims draft. Structured preview всегда строится только из persisted документа.");
      return;
    }

    const result = await generateClaimsStructuredPreviewAction({
      documentId: props.documentId,
    });

    if (!result.ok) {
      if (result.error === "preview-blocked") {
        setIsPreviewStale(previewState !== null || generationState.isModifiedAfterGeneration);
        setPreviewMessage(result.reasons.join(" "));
        return;
      }

      setPreviewMessage("Не удалось построить structured preview. Проверь доступ и попробуй ещё раз.");
      return;
    }

    setPreviewState(result.output);
    setIsPreviewStale(generationState.isModifiedAfterGeneration);
    setPreviewMessage(
      `Structured preview собран из persisted claims document. Format: ${result.output.format}.`,
    );
  }, [generationState.isModifiedAfterGeneration, isDirty, previewState, props.documentId, savedUpdatedAt]);

  const handleGenerateCheckpoint = useCallback(async () => {
    if (!savedUpdatedAt || isDirty) {
      setPreviewMessage(
        "Сначала сохраните claims draft. Generated checkpoint всегда фиксируется только из persisted документа.",
      );
      return;
    }

    const result = await generateClaimsStructuredCheckpointAction({
      documentId: props.documentId,
    });

    if (!result.ok) {
      if (result.error === "generation-blocked") {
        setPreviewMessage(result.reasons.join(" "));
        return;
      }

      setPreviewMessage("Не удалось зафиксировать generated checkpoint. Проверь доступ и попробуй ещё раз.");
      return;
    }

    setPreviewState(result.output);
    setGenerationState({
      status: result.status,
      generatedAt: result.generatedAt,
      generatedFormSchemaVersion: result.generatedFormSchemaVersion,
      generatedOutputFormat: result.generatedOutputFormat,
      generatedRendererVersion: result.generatedRendererVersion,
      isModifiedAfterGeneration: result.isModifiedAfterGeneration,
    });
    setSavedUpdatedAt(result.updatedAt);
    setIsPreviewStale(false);
    setPreviewMessage(
      `Claims generated checkpoint сохранён: ${
        result.generatedAt ? new Date(result.generatedAt).toLocaleString("ru-RU") : "время недоступно"
      }.`,
    );
  }, [isDirty, props.documentId, savedUpdatedAt]);

  const handleCopyPreview = useCallback(async () => {
    if (!previewState) {
      return;
    }

    try {
      await navigator.clipboard.writeText(previewState.copyText);
      setPreviewMessage("Copy-friendly text скопирован в буфер обмена.");
    } catch {
      setPreviewMessage("Не удалось скопировать preview автоматически. Можно скопировать текст вручную из блока ниже.");
    }
  }, [previewState]);

  return (
    <div className="space-y-6">
      <ClaimsFormFields
        characterLabel={`${props.authorSnapshot.fullName} (${props.authorSnapshot.passportNumber})`}
        documentType={props.documentType}
        draftStatusLabel={generationState.status}
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
          Сохранить claims draft
        </Button>
        <Button
          disabled={isDirty}
          onClick={() => {
            startTransition(() => {
              void handleGeneratePreview();
            });
          }}
          type="button"
          variant="secondary"
        >
          Собрать structured preview
        </Button>
        <Button
          disabled={isDirty}
          onClick={() => {
            startTransition(() => {
              void handleGenerateCheckpoint();
            });
          }}
          type="button"
          variant="secondary"
        >
          Зафиксировать generated checkpoint
        </Button>
        <Button
          disabled={!previewState}
          onClick={() => {
            startTransition(() => {
              void handleCopyPreview();
            });
          }}
          type="button"
          variant="secondary"
        >
          Копировать текст preview
        </Button>
      </div>

      {saveMessage ? <p className="text-sm text-[var(--muted)]">{saveMessage}</p> : null}
      {previewMessage ? <p className="text-sm text-[var(--muted)]">{previewMessage}</p> : null}

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Claims output preview</h3>
          <ClaimsFieldHint>
            Это отдельный claims structured renderer. Он не использует OGP BBCode и не включает publication workflow.
          </ClaimsFieldHint>
        </div>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Document status: {generationState.status}</li>
          <li>Preview format: {previewState?.format ?? generationState.generatedOutputFormat ?? "ещё не собран"}</li>
          <li>Renderer version: {previewState?.rendererVersion ?? generationState.generatedRendererVersion ?? "ещё не собран"}</li>
          <li>
            Generated at:{" "}
            {generationState.generatedAt
              ? new Date(generationState.generatedAt).toLocaleString("ru-RU")
              : "checkpoint ещё не фиксировался"}
          </li>
          <li>
            Generated form schema version: {generationState.generatedFormSchemaVersion ?? "ещё не зафиксирована"}
          </li>
          <li>
            Modified after generation: {generationState.isModifiedAfterGeneration ? "да" : "нет"}
          </li>
          <li>Publication / forum sync для claims на этом шаге не активируются.</li>
          {previewState ? (
            <li>
              Blocking reasons: {previewState.blockingReasons.length > 0 ? previewState.blockingReasons.join(", ") : "нет"}
            </li>
          ) : null}
          {isPreviewStale ? (
            <li>Текущий preview устарел после последнего сохранения. Можно собрать preview заново или перезаписать generated checkpoint.</li>
          ) : null}
        </ul>
      </div>

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Structured preview</h3>
          <ClaimsFieldHint>
            Preview и copyText строятся из одного и того же deterministic output shape.
          </ClaimsFieldHint>
        </div>
        {previewState ? (
          <div className="space-y-4">
            {previewState.sections.map((section) => (
              <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-white/80 p-4" key={section.key}>
                <h4 className="text-sm font-semibold text-[var(--foreground)]">{section.title}</h4>
                <pre className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{section.body}</pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
            Structured preview ещё не собран. Сначала сохрани draft, затем запусти Generate preview.
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Copy-friendly text</h3>
          <ClaimsFieldHint>
            Это не BBCode и не publication artifact. Текст только для просмотра и копирования.
          </ClaimsFieldHint>
        </div>
        <Textarea
          className="min-h-[320px] font-mono text-xs"
          readOnly
          value={previewState?.copyText ?? "Preview ещё не собран."}
        />
      </div>
    </div>
  );
}
