"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  applyClaimsRewriteSuggestion,
  getClaimsRewriteSectionText,
  isGroundedRewriteSectionSupportedForDocumentType,
} from "@/document-ai/sections";
import {
  ClaimsFieldHint,
  ClaimsFormFields,
} from "@/components/product/document-area/document-claims-editor-form";
import {
  ClaimsEditorActionBar,
  ClaimsEditorPreviewPanels,
} from "@/components/product/document-area/document-claims-editor-panels";
import {
  formatDocumentRewriteBlockedMessage,
  formatDocumentRewriteUnavailableMessage,
  formatGroundedRewriteInsufficientCorpusMessage,
} from "@/components/product/document-area/document-ai-review-copy";
import { DocumentFieldRewritePanel } from "@/components/product/document-area/document-field-rewrite-panel";
import {
  areStatesEqual,
  createEditorState,
  createGenerationState,
  formatGroundedSupportSummary,
  type ClaimsDraftCreateClientProps,
  type ClaimsDraftEditorClientProps,
  type ClaimsGroundedRewriteSuggestionState,
  type ClaimsPreviewState,
  type ClaimsRewriteSuggestionState,
} from "@/components/product/document-area/document-claims-editor-shared";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  createClaimDraftAction,
  generateClaimsStructuredCheckpointAction,
  generateClaimsStructuredPreviewAction,
  rewriteDocumentFieldAction,
  rewriteGroundedDocumentFieldAction,
  saveDocumentDraftAction,
} from "@/server/actions/documents";
import type {
  ClaimsDocumentRewriteSectionKey,
  GroundedClaimsDocumentRewriteSectionKey,
} from "@/schemas/document-ai";

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
          Персонаж для первого сохранения
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
          До первого сохранения персонажа можно сменить. После этого вид документа и данные
          автора фиксируются в черновике.
        </ClaimsFieldHint>
      </div>

      <ClaimsFormFields
        characterLabel={`${selectedCharacter.fullName} (${selectedCharacter.passportNumber})`}
        documentType={props.documentType}
        mode="create"
        onStateChange={setEditorState}
        profileComplete={selectedCharacter.isProfileComplete}
        representativeAllowed={selectedCharacter.canUseRepresentative}
        serverCode={props.server.code}
        state={editorState}
        trustorRegistry={props.trustorRegistry}
      />

      <div className="flex flex-wrap gap-3">
        <Button type="submit">Создать черновик</Button>
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
  const [rewriteSuggestion, setRewriteSuggestion] = useState<ClaimsRewriteSuggestionState | null>(null);
  const [rewriteFeedback, setRewriteFeedback] = useState<{
    sectionKey: ClaimsDocumentRewriteSectionKey;
    message: string;
  } | null>(null);
  const [rewritePendingSectionKey, setRewritePendingSectionKey] =
    useState<ClaimsDocumentRewriteSectionKey | null>(null);
  const [groundedRewriteSuggestion, setGroundedRewriteSuggestion] =
    useState<ClaimsGroundedRewriteSuggestionState | null>(null);
  const [groundedRewriteFeedback, setGroundedRewriteFeedback] = useState<{
    sectionKey: GroundedClaimsDocumentRewriteSectionKey;
    message: string;
  } | null>(null);
  const [groundedRewritePendingSectionKey, setGroundedRewritePendingSectionKey] =
    useState<GroundedClaimsDocumentRewriteSectionKey | null>(null);
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

  useEffect(() => {
    if (!rewriteSuggestion) {
      return;
    }

    const currentSectionText = getClaimsRewriteSectionText(editorState.payload, rewriteSuggestion.sectionKey);

    if (currentSectionText !== rewriteSuggestion.sourceText) {
      setRewriteSuggestion(null);
    }
  }, [editorState.payload, rewriteSuggestion]);

  useEffect(() => {
    if (!groundedRewriteSuggestion) {
      return;
    }

    const currentSectionText = getClaimsRewriteSectionText(
      editorState.payload,
      groundedRewriteSuggestion.sectionKey,
    );

    if (currentSectionText !== groundedRewriteSuggestion.sourceText) {
      setGroundedRewriteSuggestion(null);
    }
  }, [editorState.payload, groundedRewriteSuggestion]);

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
          setSaveMessage("Не удалось сохранить изменения. Проверьте обязательные поля и ссылки на доказательства, затем повторите попытку.");
          return;
        }

        setSaveMessage("Не удалось сохранить черновик. Проверьте заполненные поля и повторите попытку.");
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
          ? `Черновик автосохранён: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`
          : `Черновик сохранён: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`,
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
      setPreviewMessage("Сначала сохраните черновик, чтобы предпросмотр строился по сохранённой версии документа.");
      return;
    }

    if (isDirty) {
      setPreviewMessage("Сначала сохраните черновик. Предпросмотр всегда строится только по сохранённой версии документа.");
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

      setPreviewMessage("Не удалось собрать предпросмотр. Проверьте доступ к документу и попробуйте снова.");
      return;
    }

    setPreviewState(result.output);
    setIsPreviewStale(generationState.isModifiedAfterGeneration);
      setPreviewMessage("Предпросмотр документа обновлён.");
  }, [generationState.isModifiedAfterGeneration, isDirty, previewState, props.documentId, savedUpdatedAt]);

  const handleGenerateCheckpoint = useCallback(async () => {
    if (!savedUpdatedAt || isDirty) {
      setPreviewMessage(
        "Сначала сохраните черновик. Итоговая версия фиксируется только по сохранённым данным документа.",
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

      setPreviewMessage("Не удалось сохранить итоговую версию документа. Проверьте доступ и попробуйте снова.");
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
      `Итоговая версия документа сохранена: ${
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
      setPreviewMessage("Текст для копирования скопирован в буфер обмена.");
    } catch {
      setPreviewMessage("Не удалось скопировать текст автоматически. Можно скопировать его вручную из блока ниже.");
    }
  }, [previewState]);

  const handleRewriteRequest = useCallback(
    async (sectionKey: ClaimsDocumentRewriteSectionKey, sectionLabel: string) => {
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
      payload: applyClaimsRewriteSuggestion(
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
    async (sectionKey: GroundedClaimsDocumentRewriteSectionKey, sectionLabel: string) => {
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
      payload: applyClaimsRewriteSuggestion(
        current.payload,
        groundedRewriteSuggestion.sectionKey,
        groundedRewriteSuggestion.suggestionText,
      ),
    }));
    setGroundedRewriteFeedback({
      sectionKey: groundedRewriteSuggestion.sectionKey,
      message:
        "Предложение с опорой на нормы применено в редакторе. Сохраните черновик или дождитесь автосохранения.",
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
        message: "Предложение с опорой на нормы скопировано в буфер обмена.",
      });
    } catch {
      setGroundedRewriteFeedback({
        sectionKey: groundedRewriteSuggestion.sectionKey,
        message: "Не удалось автоматически скопировать предложение с опорой на нормы.",
      });
    }
  }, [groundedRewriteSuggestion]);

  const renderRewriteControls = useCallback(
    (input: {
      sectionKey: ClaimsDocumentRewriteSectionKey;
      sectionLabel: string;
    }) => {
      const sectionFeedback =
        rewriteFeedback?.sectionKey === input.sectionKey ? rewriteFeedback.message : null;
      const activeSuggestion =
        rewriteSuggestion?.sectionKey === input.sectionKey ? rewriteSuggestion : null;
      const supportsGrounded = isGroundedRewriteSectionSupportedForDocumentType(
        props.documentType,
        input.sectionKey as GroundedClaimsDocumentRewriteSectionKey,
      );
      const groundedSectionFeedback =
        groundedRewriteFeedback?.sectionKey === input.sectionKey
          ? groundedRewriteFeedback.message
          : null;
      const activeGroundedSuggestion =
        groundedRewriteSuggestion?.sectionKey === input.sectionKey ? groundedRewriteSuggestion : null;

      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={rewritePendingSectionKey !== null || groundedRewritePendingSectionKey !== null}
              onClick={() => {
                void handleRewriteRequest(input.sectionKey, input.sectionLabel);
              }}
              type="button"
              variant="secondary"
            >
              {rewritePendingSectionKey === input.sectionKey ? "Готовим вариант..." : "Улучшить текст"}
            </Button>
            {supportsGrounded ? (
              <Button
                disabled={rewritePendingSectionKey !== null || groundedRewritePendingSectionKey !== null}
                onClick={() => {
                  void handleGroundedRewriteRequest(
                    input.sectionKey as GroundedClaimsDocumentRewriteSectionKey,
                    input.sectionLabel,
                  );
                }}
                type="button"
                variant="secondary"
              >
                {groundedRewritePendingSectionKey === input.sectionKey
                  ? "Готовим вариант..."
                  : "Улучшить с опорой на нормы"}
              </Button>
            ) : null}
            <span className="text-xs leading-5 text-[var(--muted)]">
              Вариант строится по последней сохранённой версии этого раздела.
            </span>
          </div>
          {sectionFeedback ? <p className="text-sm text-[var(--muted)]">{sectionFeedback}</p> : null}
          {groundedSectionFeedback ? (
            <p className="text-sm text-[var(--muted)]">{groundedSectionFeedback}</p>
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
      groundedRewriteFeedback,
      groundedRewritePendingSectionKey,
      groundedRewriteSuggestion,
      handleGroundedRewriteApply,
      handleGroundedRewriteCopy,
      handleGroundedRewriteRequest,
      handleRewriteApply,
      handleRewriteCopy,
      handleRewriteRequest,
      props.documentType,
      rewriteFeedback,
      rewritePendingSectionKey,
      rewriteSuggestion,
    ],
  );

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
        renderRewriteControls={renderRewriteControls}
        serverCode={props.server.code}
        state={editorState}
        trustorRegistry={props.trustorRegistry}
        updatedAtLabel={new Date(savedUpdatedAt).toLocaleString("ru-RU")}
      />

      <ClaimsEditorActionBar
        hasPreview={previewState !== null}
        isDirty={isDirty}
        onCopyPreview={() => {
          startTransition(() => {
            void handleCopyPreview();
          });
        }}
        onGenerateCheckpoint={() => {
          startTransition(() => {
            void handleGenerateCheckpoint();
          });
        }}
        onGeneratePreview={() => {
          startTransition(() => {
            void handleGeneratePreview();
          });
        }}
        onSave={() => {
          startTransition(() => {
            void performSave("manual");
          });
        }}
      />

      {saveMessage ? <p className="text-sm text-[var(--muted)]">{saveMessage}</p> : null}
      {previewMessage ? <p className="text-sm text-[var(--muted)]">{previewMessage}</p> : null}

      <ClaimsEditorPreviewPanels
        generationState={generationState}
        isPreviewStale={isPreviewStale}
        previewState={previewState}
      />
    </div>
  );
}
