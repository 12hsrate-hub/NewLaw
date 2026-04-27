"use client";

import type { ReactNode } from "react";

import { DocumentTrustorRegistryPrefill } from "@/components/product/document-area/document-trustor-registry-prefill";
import {
  buildEmptyEvidenceGroup,
  buildEmptyEvidenceRow,
  buildEmptyTrustorSnapshot,
  filingModeLabel,
  formatSubtypeLabel,
  type ClaimsEditorState,
} from "@/components/product/document-area/document-claims-editor-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  applyTrustorRegistryPrefill,
  type TrustorRegistryPrefillOption,
} from "@/lib/trustors/registry-prefill";
import type {
  ClaimDocumentType,
  ClaimsDraftPayload,
  OgpComplaintEvidenceGroup,
} from "@/schemas/document";
import type { ClaimsDocumentRewriteSectionKey } from "@/schemas/document-ai";

export function ClaimsFieldHint(props: { children: string }) {
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
          Пока нет групп доказательств. Черновик можно сохранить и без них, а ссылки добавить позже.
        </div>
      ) : null}

      {groups.map((group, groupIndex) => (
        <div
          className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4"
          key={group.id}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--foreground)]">Группа доказательств {groupIndex + 1}</p>
              <ClaimsFieldHint>
                Сюда можно объединять ссылки на материалы по смысловым блокам, чтобы с ними было проще работать дальше.
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
              <div
                className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4"
                key={row.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--foreground)]">Ссылка {rowIndex + 1}</p>
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
                      Название ссылки
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
            Добавить ссылку
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
        Добавить группу доказательств
      </Button>
    </div>
  );
}

export function ClaimsFormFields(props: {
  mode: "create" | "edit";
  documentType: ClaimDocumentType;
  state: ClaimsEditorState;
  onStateChange: (nextState: ClaimsEditorState) => void;
  representativeAllowed: boolean;
  characterLabel: string;
  profileComplete: boolean;
  serverCode: string;
  trustorRegistry: TrustorRegistryPrefillOption[];
  routeStatus?: string | null;
  draftStatusLabel?: string;
  updatedAtLabel?: string;
  renderRewriteControls?: (input: {
    sectionKey: ClaimsDocumentRewriteSectionKey;
    sectionLabel: string;
  }) => ReactNode;
}) {
  const payload = props.state.payload;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{props.mode === "create" ? "Новый черновик" : "Сохранённый документ"}</Badge>
        <Badge>Вид документа: {formatSubtypeLabel(props.documentType)}</Badge>
        <Badge>Способ подачи: {filingModeLabel(payload.filingMode)}</Badge>
        {props.draftStatusLabel ? <Badge>Статус: {props.draftStatusLabel}</Badge> : null}
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-sm leading-6 text-[var(--muted)]">
        <p>Сервер и персонаж уже показаны явно. Персонаж: {props.characterLabel}.</p>
        {!props.profileComplete ? (
          <p className="mt-2 text-[var(--accent)]">
            Профиль персонажа заполнен не полностью. Черновик можно продолжать, но перед использованием документа лучше проверить недостающие данные.
          </p>
        ) : null}
        {!props.representativeAllowed ? (
          <p className="mt-2">У этого персонажа нет доступа для подачи через представителя, поэтому жалоба доступна только от своего имени.</p>
        ) : null}
        <p className="mt-2">После первого сохранения вид документа и данные автора фиксируются для этого черновика.</p>
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
            Способ подачи
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
            <option value="self">От своего имени</option>
            <option disabled={!props.representativeAllowed} value="representative">
              Через представителя
            </option>
          </Select>
          <ClaimsFieldHint>Подача через представителя доступна только персонажу с нужным доступом.</ClaimsFieldHint>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-respondent-name`}>
            Ответчик или орган
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
          Предмет требования
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
        <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Поля для реабилитации</h3>
            <ClaimsFieldHint>
              Эти поля относятся только к документу о реабилитации и после первого сохранения не меняются на другой вид документа.
            </ClaimsFieldHint>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-rehabilitation-case-reference`}>
                Номер дела или решения
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
                Основание для реабилитации
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
              {"rehabilitationBasis" in payload
                ? props.renderRewriteControls?.({
                    sectionKey: "rehabilitation_basis",
                    sectionLabel: "Основание для реабилитации",
                  })
                : null}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-rehabilitation-harm-summary`}>
              Описание причинённого вреда
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
            {"harmSummary" in payload
              ? props.renderRewriteControls?.({
                  sectionKey: "harm_summary",
                  sectionLabel: "Описание причинённого вреда",
                })
              : null}
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Поля для искового заявления</h3>
            <ClaimsFieldHint>
              Эти поля относятся только к исковому заявлению и не смешиваются с реабилитацией.
            </ClaimsFieldHint>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-lawsuit-court-name`}>
                Суд
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
                Ответчик
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
                Сумма требований
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
                Досудебные действия
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
              {"pretrialSummary" in payload
                ? props.renderRewriteControls?.({
                    sectionKey: "pretrial_summary",
                    sectionLabel: "Досудебные действия",
                  })
                : null}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-factual-background`}>
          Фактические обстоятельства
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
        {props.renderRewriteControls?.({
          sectionKey: "factual_background",
          sectionLabel: "Фактические обстоятельства",
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-legal-basis-summary`}>
            Правовые основания
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
          {props.renderRewriteControls?.({
            sectionKey: "legal_basis_summary",
            sectionLabel: "Правовые основания",
          })}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-requested-relief`}>
            Требования заявителя
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
          {props.renderRewriteControls?.({
            sectionKey: "requested_relief",
            sectionLabel: "Требования заявителя",
          })}
        </div>
      </div>

      {payload.filingMode === "representative" ? (
        <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Данные доверителя</h3>
            <ClaimsFieldHint>
              Данные доверителя сохраняются внутри документа. Список доверителей используется только для быстрого заполнения и не меняет уже сохранённый черновик автоматически.
            </ClaimsFieldHint>
          </div>

          <DocumentTrustorRegistryPrefill
            items={props.trustorRegistry}
            onApply={(trustor) => {
              props.onStateChange({
                ...props.state,
                payload: {
                  ...payload,
                  trustorSnapshot: applyTrustorRegistryPrefill(
                    trustor,
                    payload.trustorSnapshot ?? buildEmptyTrustorSnapshot(),
                  ),
                },
              });
            }}
            serverCode={props.serverCode}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-claim-trustor-full-name`}>
                ФИО доверителя
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
                Паспорт доверителя
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
              Примечание по доверителю
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

      <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
        <div className="space-y-1">
            <h3 className="text-lg font-semibold">Доказательства и ссылки</h3>
            <ClaimsFieldHint>
            Здесь можно собрать ссылки на документы, материалы и публикации, которые пригодятся при подготовке текста.
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
          Рабочие заметки
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
          placeholder="Внутренние рабочие заметки по документу"
          value={payload.workingNotes}
        />
      </div>
    </div>
  );
}
