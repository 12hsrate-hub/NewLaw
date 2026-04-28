"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  applyOgpRewriteSuggestion,
  getOgpRewriteSectionText,
  isGroundedRewriteSectionSupportedForDocumentType,
} from "@/document-ai/sections";
import { ComplaintNarrativeImprovementPanel } from "@/components/product/document-area/complaint-narrative-improvement-panel";
import {
  formatComplaintNarrativeUnavailableMessage,
  formatDocumentRewriteBlockedMessage,
  formatDocumentRewriteUnavailableMessage,
  formatGroundedRewriteInsufficientCorpusMessage,
} from "@/components/product/document-area/document-ai-review-copy";
import { DocumentFieldRewritePanel } from "@/components/product/document-area/document-field-rewrite-panel";
import { DocumentTrustorRegistryPrefill } from "@/components/product/document-area/document-trustor-registry-prefill";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { PanelCard } from "@/components/ui/panel-card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { WarningNotice } from "@/components/ui/warning-notice";
import { type OgpChecklistIssue } from "@/lib/ogp/generation-contract";
import {
  applyTrustorRegistryPrefill,
  type TrustorRegistryPrefillOption,
} from "@/lib/trustors/registry-prefill";
import {
  createOgpComplaintDraftAction,
  generateOgpComplaintBbcodeAction,
  improveComplaintNarrativeAction,
  publishOgpComplaintCreateAction,
  publishOgpComplaintUpdateAction,
  refreshOgpComplaintAuthorSnapshotAction,
  rewriteDocumentFieldAction,
  rewriteGroundedDocumentFieldAction,
  saveDocumentDraftAction,
  updateDocumentPublicationMetadataAction,
} from "@/server/actions/documents";
import type {
  GroundedOgpDocumentRewriteSectionKey,
  OgpDocumentRewriteSectionKey,
} from "@/schemas/document-ai";
import {
  ogpComplaintEvidenceTemplateKeys,
  type OgpComplaintDraftPayload,
  type OgpComplaintEvidenceItem,
} from "@/schemas/document";
import {
  areStatesEqual,
  applyComplaintNarrativeImprovementSuggestion,
  buildEmptyEvidenceItem,
  buildEmptyOgpComplaintPayload,
  buildEmptyTrustorSnapshot,
  buildGenerationBlockState,
  formatComplaintNarrativeBlockedMessage,
  createEditorState,
  createGenerationState,
  evidenceTemplateLabels,
  filingModeLabel,
  formatDraftStatus,
  formatForumConnectionState,
  formatForumSyncState,
  formatGenerationReadyState,
  formatGroundedSupportSummary,
  type OgpComplaintDraftCreateClientProps,
  type OgpComplaintDraftEditorClientProps,
  type OgpComplaintEditorState,
  type OgpComplaintGenerationState,
  type OgpComplaintNarrativeImprovementSuggestionState,
  type OgpGroundedRewriteSuggestionState,
  type OgpRewriteSuggestionState,
} from "@/components/product/document-area/document-draft-editor-shared";




function ComplaintFieldHint(props: { children: string }) {
  return <p className="text-xs leading-5 text-[var(--muted)]">{props.children}</p>;
}

function ComplaintSection(props: {
  title: string;
  description: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div id={props.id}>
      <PanelCard className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{props.title}</h3>
          <ComplaintFieldHint>{props.description}</ComplaintFieldHint>
        </div>
        {props.children}
      </PanelCard>
    </div>
  );
}

function GenerationChecklistSection(props: {
  title: string;
  issues: OgpChecklistIssue[];
  href?: string;
  hrefLabel?: string;
}) {
  if (!props.issues.length) {
    return null;
  }

  return (
    <PanelCard className="space-y-2 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-[var(--foreground)]">{props.title}</h4>
        {props.href && props.hrefLabel ? (
          <ButtonLink className="rounded-xl px-3 py-1.5 text-xs" href={props.href} variant="ghost">
            {props.hrefLabel}
          </ButtonLink>
        ) : null}
      </div>
      <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
        {props.issues.map((item) => (
          <li key={`${props.title}-${item.fieldKey}`}>
            <span className="font-medium text-[var(--foreground)]">{item.label}:</span> {item.message}
          </li>
        ))}
      </ul>
    </PanelCard>
  );
}

function EvidenceItemsEditor(props: {
  evidenceItems: OgpComplaintDraftPayload["evidenceItems"];
  onChange: (items: OgpComplaintDraftPayload["evidenceItems"]) => void;
}) {
  const items = props.evidenceItems;

  const updateItem = (itemId: string, nextItem: Partial<OgpComplaintEvidenceItem>) => {
    props.onChange(
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...nextItem,
            }
          : item,
      ),
    );
  };

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
          Доказательства пока не добавлены. Добавьте хотя бы одну ссылку перед сборкой текста для форума.
        </div>
      ) : null}

      {items.map((item, itemIndex) => (
        <div
          className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4"
          key={item.id}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Доказательство {itemIndex + 1}
              </p>
              <ComplaintFieldHint>
                В итоговом тексте для форума будет использован сохранённый текст и ссылка из этой строки.
              </ComplaintFieldHint>
            </div>
            <Button
              onClick={() => {
                props.onChange(items.filter((entry) => entry.id !== item.id));
              }}
              type="button"
              variant="secondary"
            >
              Удалить доказательство
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`evidence-mode-${item.id}`}>
                Тип текста
              </label>
              <Select
                id={`evidence-mode-${item.id}`}
                onChange={(event) => {
                  const mode = event.target.value as OgpComplaintEvidenceItem["mode"];
                  const firstTemplateKey = ogpComplaintEvidenceTemplateKeys[0];

                  updateItem(
                    item.id,
                    mode === "template"
                      ? {
                          mode,
                          templateKey: firstTemplateKey,
                          labelSnapshot: evidenceTemplateLabels[firstTemplateKey],
                        }
                      : {
                          mode,
                          templateKey: null,
                          labelSnapshot: "",
                        },
                  );
                }}
                value={item.mode}
              >
                <option value="template">Из списка</option>
                <option value="custom">Свой текст</option>
              </Select>
            </div>

            {item.mode === "template" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`evidence-template-${item.id}`}>
                  Название доказательства
                </label>
                <Select
                  id={`evidence-template-${item.id}`}
                  onChange={(event) => {
                    const templateKey = event.target.value as (typeof ogpComplaintEvidenceTemplateKeys)[number];

                    updateItem(item.id, {
                      templateKey,
                      labelSnapshot: evidenceTemplateLabels[templateKey],
                    });
                  }}
                  value={item.templateKey ?? ogpComplaintEvidenceTemplateKeys[0]}
                >
                  {ogpComplaintEvidenceTemplateKeys.map((templateKey) => (
                    <option key={templateKey} value={templateKey}>
                      {evidenceTemplateLabels[templateKey]}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`evidence-label-${item.id}`}>
                  Название доказательства
                </label>
                <Input
                  id={`evidence-label-${item.id}`}
                  onChange={(event) => {
                    updateItem(item.id, {
                      labelSnapshot: event.target.value,
                    });
                  }}
                  placeholder="Например: Запись с бодикамеры"
                  value={item.labelSnapshot}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`evidence-url-${item.id}`}>
              Ссылка
            </label>
            <Input
              id={`evidence-url-${item.id}`}
              onChange={(event) => {
                updateItem(item.id, {
                  url: event.target.value,
                });
              }}
              placeholder="https://..."
              value={item.url}
            />
          </div>
        </div>
      ))}

      <Button
        onClick={() => {
          props.onChange([...items, buildEmptyEvidenceItem(items.length)]);
        }}
        type="button"
        variant="secondary"
      >
        Добавить доказательство
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
  serverCode: string;
  trustorRegistry: TrustorRegistryPrefillOption[];
  routeStatus?: string | null;
  draftStatusLabel?: OgpComplaintGenerationState["status"];
  updatedAtLabel?: string;
  renderRewriteControls?: (input: {
    sectionKey: OgpDocumentRewriteSectionKey;
    sectionLabel: string;
  }) => ReactNode;
}) {
  const payload = props.state.payload;

  return (
    <div className="space-y-6">
      <PanelCard className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="info">
            {props.mode === "create" ? "Новый черновик" : "Черновик жалобы"}
          </StatusBadge>
          <StatusBadge tone="neutral">Подача: {filingModeLabel(payload.filingMode)}</StatusBadge>
          {props.draftStatusLabel ? (
            <StatusBadge
              tone={
                props.draftStatusLabel === "draft"
                  ? "neutral"
                  : props.draftStatusLabel === "generated"
                    ? "success"
                    : "info"
              }
            >
              Статус: {formatDraftStatus(props.draftStatusLabel)}
            </StatusBadge>
          ) : null}
          {props.updatedAtLabel ? (
            <StatusBadge tone="neutral">Последнее сохранение: {props.updatedAtLabel}</StatusBadge>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Персонаж для этой жалобы: {props.characterLabel}.
          {props.routeStatus ? ` Состояние экрана: ${props.routeStatus}.` : ""}
        </p>
        {!props.profileComplete ? (
          <WarningNotice
            description="Профиль персонажа заполнен не полностью. Черновик можно редактировать, но генерация будет доступна только после заполнения обязательных полей."
            title="Заполните профиль персонажа"
          />
        ) : null}
        {!props.representativeAllowed ? (
          <WarningNotice
            description="Этот персонаж не отмечен как адвокат, поэтому подача как представитель недоступна."
            title="Представительский режим недоступен"
          />
        ) : null}
      </PanelCard>

      <ComplaintSection
        description="Укажите служебное название документа, способ подачи и номер обращения."
        id="document-required-fields-section"
        title="Данные обращения"
      >
        <div className="space-y-4">
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
                Способ подачи
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
                <option value="self">От своего имени</option>
                <option disabled={!props.representativeAllowed} value="representative">
                  Как представитель
                </option>
              </Select>
              <ComplaintFieldHint>
                Подача как представитель доступна только персонажу с ролью адвоката.
              </ComplaintFieldHint>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-appeal-number`}>
                Номер обращения
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
                placeholder="Например: 2026001"
                value={payload.appealNumber}
              />
            </div>
          </div>
        </div>
      </ComplaintSection>

      <ComplaintSection
        description="Укажите организацию, объект заявления и момент события так, как это должно отразиться в жалобе."
        title="Организация и объект заявления"
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-object-organization`}>
                Организация объекта жалобы
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
                Объект жалобы
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
              Дата и время события
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
        </div>
      </ComplaintSection>

      <ComplaintSection
        description="Опишите последовательность событий, участников и контекст так, чтобы текст было удобно проверить перед генерацией."
        title="Описание ситуации"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-situation-description`}>
            Подробное описание ситуации
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
            placeholder="Опишите, что произошло, где и при каких обстоятельствах."
            value={payload.situationDescription}
          />
          {props.renderRewriteControls?.({
            sectionKey: "situation_description",
            sectionLabel: "Описание ситуации",
          })}
        </div>
      </ComplaintSection>

      <ComplaintSection
        description="Сформулируйте ключевое нарушение коротко и по существу. Эта часть используется при итоговой сборке текста."
        title="Краткая формулировка нарушения"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-violation-summary`}>
            Суть нарушения
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
            placeholder="Коротко сформулируйте, в чём именно состоит нарушение."
            value={payload.violationSummary}
          />
          {props.renderRewriteControls?.({
            sectionKey: "violation_summary",
            sectionLabel: "Суть нарушения",
          })}
        </div>
      </ComplaintSection>

      {payload.filingMode === "representative" ? (
        <ComplaintSection
          description="Данные потерпевшего фиксируются в жалобе. Если вы подставили доверителя из списка, дальнейшие изменения карточки не изменят уже заполненный документ."
          id="trustor-snapshot-section"
          title="Потерпевший и ксерокопия паспорта"
        >
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
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-trustor-full-name`}>
                ФИО доверителя
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
                Паспорт доверителя
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
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-trustor-address`}>
              Адрес доверителя
            </label>
            <Input
              id={`${props.mode}-trustor-address`}
              onChange={(event) => {
                props.onStateChange({
                  ...props.state,
                  payload: {
                    ...payload,
                    trustorSnapshot: {
                      ...(payload.trustorSnapshot ?? buildEmptyTrustorSnapshot()),
                      address: event.target.value,
                    },
                  },
                });
              }}
              value={payload.trustorSnapshot?.address ?? ""}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-trustor-phone`}>
                Телефон доверителя
              </label>
              <Input
                id={`${props.mode}-trustor-phone`}
                onChange={(event) => {
                  props.onStateChange({
                    ...props.state,
                    payload: {
                      ...payload,
                      trustorSnapshot: {
                        ...(payload.trustorSnapshot ?? buildEmptyTrustorSnapshot()),
                        phone: event.target.value,
                      },
                    },
                  });
                }}
                placeholder="123-45-67"
                value={payload.trustorSnapshot?.phone ?? ""}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-trustor-ic-email`}>
                Игровая почта доверителя
              </label>
              <Input
                id={`${props.mode}-trustor-ic-email`}
                onChange={(event) => {
                  props.onStateChange({
                    ...props.state,
                    payload: {
                      ...payload,
                      trustorSnapshot: {
                        ...(payload.trustorSnapshot ?? buildEmptyTrustorSnapshot()),
                        icEmail: event.target.value,
                      },
                    },
                  });
                }}
                placeholder="name@sa.com"
                value={payload.trustorSnapshot?.icEmail ?? ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-trustor-passport-image-url`}>
              Ссылка на скрин паспорта доверителя
            </label>
            <Input
              id={`${props.mode}-trustor-passport-image-url`}
              onChange={(event) => {
                props.onStateChange({
                  ...props.state,
                  payload: {
                    ...payload,
                    trustorSnapshot: {
                      ...(payload.trustorSnapshot ?? buildEmptyTrustorSnapshot()),
                      passportImageUrl: event.target.value,
                    },
                  },
                });
              }}
              placeholder="https://..."
              type="url"
              value={payload.trustorSnapshot?.passportImageUrl ?? ""}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-trustor-note`}>
              Примечание по доверителю
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
        </ComplaintSection>
      ) : null}

      <ComplaintSection
        description="Добавьте ссылки на материалы, которые подтверждают обстоятельства жалобы и пригодятся перед генерацией."
        id="evidence-links-section"
        title="Доказательства"
      >
        <EvidenceItemsEditor
          evidenceItems={payload.evidenceItems}
          onChange={(items) => {
            props.onStateChange({
              ...props.state,
              payload: {
                ...payload,
                evidenceItems: items,
              },
            });
          }}
        />
      </ComplaintSection>

      <ComplaintSection
        description="Эти пометки не участвуют в обязательной проверке, но помогают сохранить рабочий контекст по жалобе."
        title="Рабочие заметки"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`${props.mode}-working-notes`}>
            Рабочие заметки
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
      </ComplaintSection>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <ComplaintSection
            description="До первого сохранения персонажа можно сменить. После сохранения жалоба продолжит использовать выбранный профиль."
            title="Персонаж для жалобы"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="create-character-id">
                Персонаж для жалобы
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
            </div>
          </ComplaintSection>

          <ComplaintFormFields
            characterLabel={`${selectedCharacter.fullName} (${selectedCharacter.passportNumber})`}
            mode="create"
            onStateChange={setEditorState}
            profileComplete={selectedCharacter.isProfileComplete}
            representativeAllowed={selectedCharacter.canUseRepresentative}
            serverCode={props.server.code}
            state={editorState}
            trustorRegistry={props.trustorRegistry}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <PanelCard className="space-y-3">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Состояние</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="info">Сервер: {props.server.name}</StatusBadge>
              <StatusBadge tone="success">Персонаж: {selectedCharacter.fullName}</StatusBadge>
              <StatusBadge
                tone={selectedCharacter.canUseRepresentative ? "success" : "neutral"}
              >
                Представитель: {selectedCharacter.canUseRepresentative ? "доступен" : "недоступен"}
              </StatusBadge>
            </div>
            <div className="space-y-2 text-sm leading-6 text-[var(--muted)]">
              <p>
                Паспорт:{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {selectedCharacter.passportNumber}
                </span>
              </p>
              <p>
                Профиль персонажа:{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {selectedCharacter.isProfileComplete ? "готов" : "нужно дополнить"}
                </span>
              </p>
            </div>
          </PanelCard>

          {!selectedCharacter.isProfileComplete ? (
            <WarningNotice
              description="Заполните обязательные поля профиля персонажа до генерации. Черновик жалобы при этом можно создать уже сейчас."
              title="Нужно дополнить профиль"
            />
          ) : null}

          <WarningNotice
            description="Перед созданием проверьте номер обращения, объект заявления и хотя бы одно доказательство. После сохранения данные будут зафиксированы в черновике."
            title="Что проверить перед сохранением"
          />

          <PanelCard className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Действия</h3>
              <ComplaintFieldHint>
                Сначала создайте черновик. Проверка обязательных полей и сборка BBCode откроются уже в сохранённом документе.
              </ComplaintFieldHint>
            </div>
            <Button type="submit">Создать черновик жалобы</Button>
          </PanelCard>
        </aside>
      </div>
    </form>
  );
}

export function DocumentDraftEditorClient(props: OgpComplaintDraftEditorClientProps) {
  const [authorSnapshot, setAuthorSnapshot] = useState(props.authorSnapshot);
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
  const [profileSnapshotMessage, setProfileSnapshotMessage] = useState<string | null>(null);
  const [isProfileSnapshotRefreshing, setIsProfileSnapshotRefreshing] = useState(false);
  const [publicationMessage, setPublicationMessage] = useState<string | null>(null);
  const [rewriteSuggestion, setRewriteSuggestion] = useState<OgpRewriteSuggestionState | null>(null);
  const [rewriteFeedback, setRewriteFeedback] = useState<{
    sectionKey: OgpDocumentRewriteSectionKey;
    message: string;
  } | null>(null);
  const [rewritePendingSectionKey, setRewritePendingSectionKey] =
    useState<OgpDocumentRewriteSectionKey | null>(null);
  const [complaintNarrativeSuggestion, setComplaintNarrativeSuggestion] =
    useState<OgpComplaintNarrativeImprovementSuggestionState | null>(null);
  const [complaintNarrativeFeedback, setComplaintNarrativeFeedback] = useState<string | null>(null);
  const [isComplaintNarrativePending, setIsComplaintNarrativePending] = useState(false);
  const [groundedRewriteSuggestion, setGroundedRewriteSuggestion] =
    useState<OgpGroundedRewriteSuggestionState | null>(null);
  const [groundedRewriteFeedback, setGroundedRewriteFeedback] = useState<{
    sectionKey: GroundedOgpDocumentRewriteSectionKey;
    message: string;
  } | null>(null);
  const [groundedRewritePendingSectionKey, setGroundedRewritePendingSectionKey] =
    useState<GroundedOgpDocumentRewriteSectionKey | null>(null);
  const lastAutoSaveKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setAuthorSnapshot(props.authorSnapshot);
  }, [props.authorSnapshot]);

  const representativeAllowed = authorSnapshot.canUseRepresentative;
  const persistedGenerationBlockState = useMemo(
    () =>
      buildGenerationBlockState({
        authorSnapshot,
        payload: savedState.payload,
      }),
    [authorSnapshot, savedState.payload],
  );

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

  useEffect(() => {
    if (!groundedRewriteSuggestion) {
      return;
    }

    const currentSectionText = getOgpRewriteSectionText(
      editorState.payload,
      groundedRewriteSuggestion.sectionKey,
    );

    if (currentSectionText !== groundedRewriteSuggestion.sourceText) {
      setGroundedRewriteSuggestion(null);
    }
  }, [editorState.payload, groundedRewriteSuggestion]);

  useEffect(() => {
    if (!complaintNarrativeSuggestion) {
      return;
    }

    if (editorState.payload.situationDescription !== complaintNarrativeSuggestion.sourceText) {
      setComplaintNarrativeSuggestion(null);
    }
  }, [complaintNarrativeSuggestion, editorState.payload.situationDescription]);

  const isDirty = !areStatesEqual(editorState, savedState);
  const canGenerateFromPersistedState = !isDirty;
  const generationReadinessLabel = useMemo(() => {
    if (isDirty) {
      return "Сначала сохраните черновик, затем генератор проверит сохранённые данные.";
    }

    return formatGenerationReadyState(persistedGenerationBlockState.readyState);
  }, [isDirty, persistedGenerationBlockState.readyState]);
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
      return "ссылка на публикацию указана вручную";
    }

    if (generationState.forumSyncState === "failed" && hasAutomationOwnedIdentity) {
      return "ошибка публикации, можно повторить обновление";
    }

    if (generationState.forumSyncState === "outdated" && hasAutomationOwnedIdentity) {
      return "нужно обновить публикацию";
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

    return "нужно рабочее подключение форума";
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
          setSaveMessage("Подача как представитель доступна только персонажу с ролью адвоката.");
          return;
        }

        if (result.error === "invalid-payload") {
          setSaveMessage("Не удалось сохранить изменения. Проверьте поля жалобы и ссылки на доказательства, затем повторите попытку.");
          return;
        }

        setSaveMessage("Не удалось сохранить изменения. Проверьте заполненные поля и повторите попытку.");
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

  const handleClearComplaintTemplate = useCallback(() => {
    const confirmed = window.confirm(
      "Очистить заполненную форму жалобы? Документ и выбранный персонаж останутся на месте, но поля жалобы будут очищены.",
    );

    if (!confirmed) {
      return;
    }

    setEditorState((current) =>
      createEditorState({
        title: current.title,
        payload: buildEmptyOgpComplaintPayload(current.payload.filingMode),
      }),
    );
    setRewriteSuggestion(null);
    setGroundedRewriteSuggestion(null);
    setGenerationMessage(null);
    setSaveMessage(
      "Форма жалобы очищена в редакторе. Автосохранение применит изменение, либо нажмите «Сохранить черновик».",
    );
  }, []);

  const handleProfileSnapshotRefresh = useCallback(async () => {
    setIsProfileSnapshotRefreshing(true);
    setProfileSnapshotMessage(null);

    try {
      const result = await refreshOgpComplaintAuthorSnapshotAction({
        documentId: props.documentId,
      });

      if (!result.ok) {
        if (result.error === "character-unavailable") {
          setProfileSnapshotMessage(
            "Не удалось обновить данные профиля: выбранный персонаж больше недоступен на этом сервере.",
          );
          return;
        }

        if (result.error === "invalid-profile") {
          setProfileSnapshotMessage("Не удалось обновить данные профиля. Сначала заполните обязательные поля в карточке персонажа.");
          return;
        }

        setProfileSnapshotMessage("Не удалось обновить данные профиля в жалобе. Попробуйте ещё раз немного позже.");
        return;
      }

      setAuthorSnapshot(result.authorSnapshot);
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
      setProfileSnapshotMessage(
        `Данные профиля обновлены из текущей карточки персонажа: ${new Date(result.snapshotCapturedAt).toLocaleString("ru-RU")}.`,
      );
    } finally {
      setIsProfileSnapshotRefreshing(false);
    }
  }, [props.documentId]);

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
      setGenerationMessage("Сначала сохраните черновик. Генерация использует только сохранённые данные жалобы.");
      return;
    }

    const result = await generateOgpComplaintBbcodeAction({
      documentId: props.documentId,
    });

    if (!result.ok) {
      if (result.error === "generation-blocked") {
        setGenerationMessage(
          "Генерация пока недоступна. Ниже показано, какие поля нужно заполнить в профиле персонажа, данных доверителя и самой жалобе.",
        );
        return;
      }

      setGenerationMessage("Не удалось собрать текст для форума. Черновик сохранён, можно попробовать ещё раз.");
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
      `Текст для форума готов: ${result.generatedAt ? new Date(result.generatedAt).toLocaleString("ru-RU") : "время недоступно"}.`,
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
      setGenerationMessage("Текст для форума скопирован в буфер обмена.");
    } catch {
      setGenerationMessage("Не удалось скопировать текст автоматически. Можно скопировать его вручную из блока ниже.");
    }
  }, [generationState.lastGeneratedBbcode]);

  const handleRewriteRequest = useCallback(
    async (sectionKey: OgpDocumentRewriteSectionKey, sectionLabel: string) => {
      if (isDirty) {
        setRewriteFeedback({
          sectionKey,
          message: "Сначала сохраните черновик. Предложение строится только по сохранённой версии документа.",
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
              message: formatDocumentRewriteBlockedMessage("standard", result.reasons),
            });
            setRewriteSuggestion(null);
            return;
          }

          if (result.error === "rewrite-unavailable") {
            setRewriteFeedback({
              sectionKey,
              message: formatDocumentRewriteUnavailableMessage("standard"),
            });
            setRewriteSuggestion(null);
            return;
          }

          setRewriteFeedback({
            sectionKey,
            message: "Не удалось подготовить предложение. Проверьте доступ к документу и попробуйте снова.",
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
      message: "Предложение применено в редакторе. Сохраните черновик или дождитесь автосохранения.",
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
        message: "Предложение скопировано в буфер обмена.",
      });
    } catch {
      setRewriteFeedback({
        sectionKey: rewriteSuggestion.sectionKey,
        message: "Не удалось скопировать предложение автоматически.",
      });
    }
  }, [rewriteSuggestion]);

  const handleGroundedRewriteRequest = useCallback(
    async (sectionKey: GroundedOgpDocumentRewriteSectionKey, sectionLabel: string) => {
      if (isDirty) {
        setGroundedRewriteFeedback({
          sectionKey,
          message:
            "Сначала сохраните черновик. Предложение с опорой на нормы строится только по сохранённой версии документа.",
        });
        setGroundedRewriteSuggestion(null);
        return;
      }

      setGroundedRewritePendingSectionKey(sectionKey);
      setGroundedRewriteFeedback(null);

      try {
        const result = await rewriteGroundedDocumentFieldAction({
          documentId: props.documentId,
          sectionKey,
        });

        if (!result.ok) {
          if (result.error === "rewrite-blocked") {
            setGroundedRewriteFeedback({
              sectionKey,
              message: formatDocumentRewriteBlockedMessage("grounded", result.reasons),
            });
            setGroundedRewriteSuggestion(null);
            return;
          }

          if (result.error === "insufficient-corpus") {
            setGroundedRewriteFeedback({
              sectionKey,
              message: formatGroundedRewriteInsufficientCorpusMessage(),
            });
            setGroundedRewriteSuggestion(null);
            return;
          }

          if (result.error === "rewrite-unavailable") {
            setGroundedRewriteFeedback({
              sectionKey,
              message: formatDocumentRewriteUnavailableMessage("grounded"),
            });
            setGroundedRewriteSuggestion(null);
            return;
          }

          setGroundedRewriteFeedback({
            sectionKey,
            message:
              "Не удалось подготовить предложение с опорой на нормы. Проверьте доступ к документу и попробуйте снова.",
          });
          setGroundedRewriteSuggestion(null);
          return;
        }

        setRewriteSuggestion(null);
        setGroundedRewriteSuggestion({
          sectionKey,
          sectionLabel,
          sourceText: result.sourceText,
          suggestionText: result.suggestionText,
          basedOnUpdatedAt: result.basedOnUpdatedAt,
          groundingMode: result.groundingMode,
          references: result.references,
          usageMeta: result.usageMeta,
        });
      } finally {
        setGroundedRewritePendingSectionKey(null);
      }
    },
    [isDirty, props.documentId],
  );

  const handleGroundedRewriteApply = useCallback(() => {
    if (!groundedRewriteSuggestion) {
      return;
    }

    setEditorState((current) => ({
      ...current,
      payload: applyOgpRewriteSuggestion(
        current.payload,
        groundedRewriteSuggestion.sectionKey,
        groundedRewriteSuggestion.suggestionText,
      ),
    }));
    setGroundedRewriteFeedback({
      sectionKey: groundedRewriteSuggestion.sectionKey,
      message:
        "Предложение применено в редакторе. Сохраните черновик или дождитесь автосохранения.",
    });
    setGroundedRewriteSuggestion(null);
  }, [groundedRewriteSuggestion]);

  const handleGroundedRewriteCopy = useCallback(async () => {
    if (!groundedRewriteSuggestion) {
      return;
    }

    try {
      await navigator.clipboard.writeText(groundedRewriteSuggestion.suggestionText);
      setGroundedRewriteFeedback({
        sectionKey: groundedRewriteSuggestion.sectionKey,
        message: "Предложение скопировано в буфер обмена.",
      });
    } catch {
      setGroundedRewriteFeedback({
        sectionKey: groundedRewriteSuggestion.sectionKey,
        message: "Не удалось скопировать предложение автоматически.",
      });
    }
  }, [groundedRewriteSuggestion]);

  const handleComplaintNarrativeImproveRequest = useCallback(async () => {
    if (isDirty) {
      setComplaintNarrativeFeedback(
        "Сначала сохраните черновик. Улучшение описания строится только по сохранённой версии документа.",
      );
      setComplaintNarrativeSuggestion(null);
      return;
    }

    setIsComplaintNarrativePending(true);
    setComplaintNarrativeFeedback(null);

    try {
      const result = await improveComplaintNarrativeAction({
        documentId: props.documentId,
        lengthMode: "normal",
      });

      if (!result.ok) {
        if (result.error === "rewrite-blocked") {
          setComplaintNarrativeFeedback(
            formatComplaintNarrativeBlockedMessage(result.reasons),
          );
          setComplaintNarrativeSuggestion(null);
          return;
        }

        if (result.error === "unsupported-document-type") {
          setComplaintNarrativeFeedback(
            "Улучшение описания доступно только для жалобы в ОГП.",
          );
          setComplaintNarrativeSuggestion(null);
          return;
        }

        if (result.error === "invalid-draft") {
          setComplaintNarrativeFeedback(
            "Не удалось подготовить описание: в черновике жалобы есть некорректные данные. Проверьте заполненные поля и сохраните документ ещё раз.",
          );
          setComplaintNarrativeSuggestion(null);
          return;
        }

        if (result.error === "rewrite-unavailable") {
          setComplaintNarrativeFeedback(
            formatComplaintNarrativeUnavailableMessage("unavailable"),
          );
          setComplaintNarrativeSuggestion(null);
          return;
        }

        if (result.error === "invalid-output") {
          setComplaintNarrativeFeedback(
            formatComplaintNarrativeUnavailableMessage("invalid-output"),
          );
          setComplaintNarrativeSuggestion(null);
          return;
        }

        setComplaintNarrativeFeedback(
          "Не удалось улучшить описание. Проверьте доступ к черновику и попробуйте снова.",
        );
        setComplaintNarrativeSuggestion(null);
        return;
      }

      setRewriteSuggestion((current) =>
        current?.sectionKey === "situation_description" ? null : current,
      );
      setComplaintNarrativeSuggestion({
        sourceText: result.sourceText,
        improvedText: result.improvedText,
        basedOnUpdatedAt: result.basedOnUpdatedAt,
        legalBasisUsed: result.legalBasisUsed,
        usedFacts: result.usedFacts,
        missingFacts: result.missingFacts,
        reviewNotes: result.reviewNotes,
        riskFlags: result.riskFlags,
        shouldSendToReview: result.shouldSendToReview,
        usageMeta: result.usageMeta,
      });
    } finally {
      setIsComplaintNarrativePending(false);
    }
  }, [isDirty, props.documentId]);

  const handleComplaintNarrativeApply = useCallback(() => {
    if (!complaintNarrativeSuggestion) {
      return;
    }

    setEditorState((current) => ({
      ...current,
      payload: applyComplaintNarrativeImprovementSuggestion(
        current.payload,
        complaintNarrativeSuggestion.improvedText,
      ),
    }));
    setComplaintNarrativeFeedback(
      "Предложенный текст применён в редакторе. Сохраните черновик или дождитесь автосохранения.",
    );
    setComplaintNarrativeSuggestion(null);
  }, [complaintNarrativeSuggestion]);

  const handleComplaintNarrativeCopy = useCallback(async () => {
    if (!complaintNarrativeSuggestion) {
      return;
    }

    try {
      await navigator.clipboard.writeText(complaintNarrativeSuggestion.improvedText);
      setComplaintNarrativeFeedback("Предложенный текст скопирован в буфер обмена.");
    } catch {
      setComplaintNarrativeFeedback("Не удалось скопировать предложенный текст автоматически.");
    }
  }, [complaintNarrativeSuggestion]);

  const renderRewriteControls = useCallback(
    (input: {
      sectionKey: OgpDocumentRewriteSectionKey;
      sectionLabel: string;
    }) => {
      const sectionFeedback =
        rewriteFeedback?.sectionKey === input.sectionKey ? rewriteFeedback.message : null;
      const activeSuggestion =
        rewriteSuggestion?.sectionKey === input.sectionKey ? rewriteSuggestion : null;
      const supportsGrounded =
        input.sectionKey === "violation_summary" &&
        isGroundedRewriteSectionSupportedForDocumentType("ogp_complaint", input.sectionKey);
      const groundedSectionFeedback =
        groundedRewriteFeedback?.sectionKey === input.sectionKey
          ? groundedRewriteFeedback.message
          : null;
      const activeGroundedSuggestion =
        groundedRewriteSuggestion?.sectionKey === input.sectionKey ? groundedRewriteSuggestion : null;
      const supportsNarrativeImprovement = input.sectionKey === "situation_description";
      const activeComplaintNarrativeSuggestion = supportsNarrativeImprovement
        ? complaintNarrativeSuggestion
        : null;
      const complaintNarrativeSectionFeedback = supportsNarrativeImprovement
        ? complaintNarrativeFeedback
        : null;

      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {supportsNarrativeImprovement ? (
              <Button
                disabled={
                  rewritePendingSectionKey !== null ||
                  groundedRewritePendingSectionKey !== null ||
                  isComplaintNarrativePending
                }
                onClick={() => {
                  void handleComplaintNarrativeImproveRequest();
                }}
                type="button"
                variant="secondary"
              >
                {isComplaintNarrativePending ? "Готовим описание..." : "Улучшить описание"}
              </Button>
            ) : null}
            <Button
              disabled={
                rewritePendingSectionKey !== null ||
                groundedRewritePendingSectionKey !== null ||
                isComplaintNarrativePending
              }
              onClick={() => {
                void handleRewriteRequest(input.sectionKey, input.sectionLabel);
              }}
              type="button"
              variant="secondary"
            >
              {rewritePendingSectionKey === input.sectionKey ? "Готовим текст..." : "Улучшить текст"}
            </Button>
            {supportsGrounded ? (
              <Button
                disabled={
                  rewritePendingSectionKey !== null ||
                  groundedRewritePendingSectionKey !== null ||
                  isComplaintNarrativePending
                }
                onClick={() => {
                  void handleGroundedRewriteRequest(
                    input.sectionKey as GroundedOgpDocumentRewriteSectionKey,
                    input.sectionLabel,
                  );
                }}
                type="button"
                variant="secondary"
              >
                {groundedRewritePendingSectionKey === input.sectionKey
                  ? "Готовим текст..."
                  : "Улучшить с опорой на нормы"}
              </Button>
            ) : null}
            <span className="text-xs leading-5 text-[var(--muted)]">
              Вариант строится по последней сохранённой версии этого раздела.
            </span>
          </div>
          {complaintNarrativeSectionFeedback ? (
            <p className="text-sm text-[var(--muted)]">{complaintNarrativeSectionFeedback}</p>
          ) : null}
          {sectionFeedback ? <p className="text-sm text-[var(--muted)]">{sectionFeedback}</p> : null}
          {groundedSectionFeedback ? (
            <p className="text-sm text-[var(--muted)]">{groundedSectionFeedback}</p>
          ) : null}
          {activeComplaintNarrativeSuggestion ? (
            <ComplaintNarrativeImprovementPanel
              onApply={handleComplaintNarrativeApply}
              onCopy={() => {
                void handleComplaintNarrativeCopy();
              }}
              onDismiss={() => {
                setComplaintNarrativeSuggestion(null);
              }}
              suggestion={activeComplaintNarrativeSuggestion}
            />
          ) : null}
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
          {activeGroundedSuggestion ? (
            <DocumentFieldRewritePanel
              basedOnUpdatedAt={activeGroundedSuggestion.basedOnUpdatedAt}
              onApply={handleGroundedRewriteApply}
              onCopy={() => {
                void handleGroundedRewriteCopy();
              }}
              onDismiss={() => {
                setGroundedRewriteSuggestion(null);
              }}
              sectionLabel={activeGroundedSuggestion.sectionLabel}
              sourceText={activeGroundedSuggestion.sourceText}
              suggestionText={activeGroundedSuggestion.suggestionText}
              supportingSummary={formatGroundedSupportSummary(
                activeGroundedSuggestion.groundingMode,
                activeGroundedSuggestion.references,
              )}
              titlePrefix="Предложение с опорой на нормы"
            />
          ) : null}
        </div>
      );
    },
    [
      complaintNarrativeFeedback,
      complaintNarrativeSuggestion,
      groundedRewriteFeedback,
      groundedRewritePendingSectionKey,
      groundedRewriteSuggestion,
      handleComplaintNarrativeApply,
      handleComplaintNarrativeCopy,
      handleComplaintNarrativeImproveRequest,
      handleGroundedRewriteApply,
      handleGroundedRewriteCopy,
      handleGroundedRewriteRequest,
      handleRewriteApply,
      handleRewriteCopy,
      isComplaintNarrativePending,
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
        setPublicationMessage("Сначала соберите текст для форума, а затем укажите ссылку на публикацию.");
        return;
      }

      if (result.error === "invalid-publication-url") {
        setPublicationMessage("Ссылка на публикацию должна быть пустой или вести на https://forum.gta5rp.com/.");
        return;
      }

      setPublicationMessage("Не удалось сохранить данные публикации. Проверьте ссылку и повторите попытку.");
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
    setPublicationMessage("Данные публикации обновлены.");
  }, [generationState.isSiteForumSynced, props.documentId, publicationUrlInput]);

  const handlePublishCreate = useCallback(async () => {
    if (isDirty) {
      setPublicationMessage(
        "Сначала сохраните черновик. Публикация использует последнюю сохранённую версию текста для форума.",
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

      setPublicationMessage("Не удалось опубликовать жалобу на форуме. Проверьте подключение форума и попробуйте снова.");
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
    setPublicationMessage("Жалоба опубликована на форуме.");
  }, [isDirty, props.documentId]);

  const handlePublishUpdate = useCallback(async () => {
    if (isDirty) {
      setPublicationMessage(
        "Сначала сохраните черновик. Обновление публикации использует последнюю сохранённую версию текста для форума.",
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

      setPublicationMessage("Не удалось обновить публикацию на форуме. Проверьте подключение форума и попробуйте снова.");
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
    setPublicationMessage("Публикация на форуме обновлена.");
  }, [isDirty, props.documentId]);

  return (
    <div className="space-y-6">
      <ComplaintFormFields
        characterLabel={`${authorSnapshot.fullName} (${authorSnapshot.passportNumber})`}
        draftStatusLabel={generationState.status}
        mode="edit"
        onStateChange={setEditorState}
        profileComplete={authorSnapshot.isProfileComplete}
        representativeAllowed={representativeAllowed}
        renderRewriteControls={renderRewriteControls}
        serverCode={props.server.code}
        state={editorState}
        trustorRegistry={props.trustorRegistry}
        updatedAtLabel={new Date(savedUpdatedAt).toLocaleString("ru-RU")}
      />

      <PanelCard className="space-y-4">
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
            Собрать текст для форума
          </Button>
          <Button onClick={handleClearComplaintTemplate} type="button" variant="secondary">
            Очистить форму жалобы
          </Button>
          <StatusBadge tone={canGenerateFromPersistedState ? "success" : "warning"}>
            {generationReadinessLabel}
          </StatusBadge>
        </div>

        {saveMessage ? <p className="text-sm text-[var(--muted)]">{saveMessage}</p> : null}
        {generationMessage ? <p className="text-sm text-[var(--muted)]">{generationMessage}</p> : null}
      </PanelCard>

      <PanelCard className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Проверка перед генерацией</h3>
          <ComplaintFieldHint>
            Генератор читает только сохранённые данные жалобы и показывает точный список полей,
            которые нужно заполнить.
          </ComplaintFieldHint>
        </div>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Текущее состояние:{" "}
          <span className="font-medium text-[var(--foreground)]">
            {formatGenerationReadyState(persistedGenerationBlockState.readyState)}
          </span>
        </p>
        {persistedGenerationBlockState.readyState === "generation_ready" ? (
          <div className="rounded-3xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4 text-sm leading-6 text-[var(--status-success-fg)]">
            Сохранённые данные готовы к генерации. Генератор возьмёт данные персонажа,
            доверителя и жалобы из текущего документа.
          </div>
        ) : null}
        <GenerationChecklistSection
          href={`/account/characters?server=${encodeURIComponent(props.server.code)}`}
          hrefLabel="Открыть профиль персонажа"
          issues={persistedGenerationBlockState.characterIssues}
          title="Что исправить в профиле персонажа"
        />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-sm leading-6 text-[var(--muted)]">
          <p>
            Если профиль персонажа уже исправлен в личном кабинете, обновите данные профиля в
            этой жалобе. Генератор всё равно будет использовать только данные, сохранённые в документе.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              disabled={isProfileSnapshotRefreshing}
              onClick={() => {
                startTransition(() => {
                  void handleProfileSnapshotRefresh();
                });
              }}
              type="button"
              variant="secondary"
            >
              {isProfileSnapshotRefreshing ? "Обновляем данные..." : "Обновить данные профиля в жалобе"}
            </Button>
            {profileSnapshotMessage ? (
              <span className="text-[var(--muted)]">{profileSnapshotMessage}</span>
            ) : null}
          </div>
        </div>
        <GenerationChecklistSection
          href={
            savedState.payload.trustorSnapshot?.sourceType === "registry_prefill"
              ? `/account/trustors?server=${encodeURIComponent(props.server.code)}`
              : "#trustor-snapshot-section"
          }
          hrefLabel={
            savedState.payload.trustorSnapshot?.sourceType === "registry_prefill"
              ? "Открыть список доверителей"
              : "Исправить данные доверителя"
          }
          issues={persistedGenerationBlockState.trustorIssues}
          title="Что исправить в данных доверителя"
        />
        <GenerationChecklistSection
          href="#document-required-fields-section"
          hrefLabel="Исправить поля документа"
          issues={persistedGenerationBlockState.documentIssues}
          title="Что исправить в жалобе"
        />
      </PanelCard>

      <PanelCard className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Сведения о сборке</h3>
          <ComplaintFieldHint>
            Здесь видно, когда в последний раз собирался текст для форума и нужно ли обновить его перед публикацией.
          </ComplaintFieldHint>
        </div>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Статус: {formatDraftStatus(generationState.status)}</li>
          <li>
            Последняя сборка:{" "}
            {generationState.generatedAt
              ? new Date(generationState.generatedAt).toLocaleString("ru-RU")
              : "ещё не выполнялась"}
          </li>
          <li>
            {generationState.isModifiedAfterGeneration
              ? "После последней сборки документ менялся. Перед публикацией лучше собрать текст заново."
              : "После последней сборки документ не менялся."}
          </li>
          <li>Статус публикации: {formatForumSyncState(generationState.forumSyncState)}</li>
          <li>
            Последняя публикация:{" "}
            {generationState.forumLastPublishedAt
              ? new Date(generationState.forumLastPublishedAt).toLocaleString("ru-RU")
              : "ещё не публиковался"}
          </li>
        </ul>
      </PanelCard>

      <PanelCard className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Готовый текст для форума</h3>
            <ComplaintFieldHint>
              Здесь показывается итоговый текст для копирования и публикации.
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
            Скопировать текст для форума
          </Button>
        </div>
        <Textarea
          className="min-h-[320px] font-mono text-xs"
          readOnly
          value={generationState.lastGeneratedBbcode ?? "Текст для форума ещё не собран."}
        />
      </PanelCard>

      <PanelCard className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Публикация на форуме</h3>
          <ComplaintFieldHint>
            Здесь можно сохранить ссылку на тему форума или опубликовать жалобу через подключение форума.
          </ComplaintFieldHint>
        </div>
        <div className="rounded-3xl border border-[var(--divider)] bg-[var(--surface-raised)] px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          <p>
            Подключение форума:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {formatForumConnectionState(props.forumConnection.state)}
            </span>
          </p>
          <p>
            Аккаунт форума:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {props.forumConnection.forumUsername ?? "ещё не подтверждён"}
            </span>
          </p>
          <p>
            Последняя проверка:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {props.forumConnection.validatedAt
                ? new Date(props.forumConnection.validatedAt).toLocaleString("ru-RU")
                : "ещё не подтверждалась"}
            </span>
          </p>
          <p className="mt-2">Подключение форума управляется в настройках аккаунта.</p>
        </div>
        {props.forumConnection.lastValidationError ? (
          <WarningNotice
            description="Подключение требует повторной проверки в настройках аккаунта."
            title="Проверьте подключение форума"
          />
        ) : null}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          <p>
            Готовность к публикации:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {publicationReadinessLabel}
            </span>
          </p>
          <p>
            Статус публикации:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {formatForumSyncState(generationState.forumSyncState)}
            </span>
          </p>
          <p>
            Публикация на форуме:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {generationState.forumThreadId && generationState.forumPostId
                ? "опубликована"
                : "ещё не опубликована"}
            </span>
          </p>
          <p>
            Опубликовано:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {generationState.forumLastPublishedAt
                ? new Date(generationState.forumLastPublishedAt).toLocaleString("ru-RU")
                : "ещё не публиковался"}
            </span>
          </p>
          <p className="mt-2">
            Автопубликация доступна только для жалобы в ОГП. Если жалоба изменилась после
            публикации, её можно обновить на форуме.
          </p>
        </div>
        {generationState.forumLastSyncError ? (
          <WarningNotice
            description="Не удалось подтвердить последнюю публикацию. Проверьте подключение форума и попробуйте ещё раз."
            title="Публикация требует повторной проверки"
          />
        ) : null}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="publication-url">
            Ссылка на публикацию
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
            Сохранить данные публикации
          </Button>
          <span className="text-sm text-[var(--muted)]">
            Отмечено как опубликованное вручную: {generationState.isSiteForumSynced ? "да" : "нет"} /{" "}
            {formatForumSyncState(generationState.forumSyncState)}
          </span>
        </div>
        {publicationMessage ? <p className="text-sm text-[var(--muted)]">{publicationMessage}</p> : null}
      </PanelCard>
    </div>
  );
}
