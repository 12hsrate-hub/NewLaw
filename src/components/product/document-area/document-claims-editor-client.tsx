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
        serverCode={props.server.code}
        state={editorState}
        trustorRegistry={props.trustorRegistry}
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

  const handleRewriteRequest = useCallback(
    async (sectionKey: ClaimsDocumentRewriteSectionKey, sectionLabel: string) => {
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
      payload: applyClaimsRewriteSuggestion(
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

  const handleGroundedRewriteRequest = useCallback(
    async (sectionKey: GroundedClaimsDocumentRewriteSectionKey, sectionLabel: string) => {
      if (isDirty) {
        setGroundedRewriteFeedback({
          sectionKey,
          message:
            "Сначала сохраните черновик. Grounded AI suggestion всегда строится из persisted документа.",
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
              message: result.reasons.join(" "),
            });
            setGroundedRewriteSuggestion(null);
            return;
          }

          if (result.error === "insufficient-corpus" || result.error === "rewrite-unavailable") {
            setGroundedRewriteFeedback({
              sectionKey,
              message: result.message,
            });
            setGroundedRewriteSuggestion(null);
            return;
          }

          setGroundedRewriteFeedback({
            sectionKey,
            message:
              "Получить grounded AI-предложение не удалось. Проверь доступ к документу и попробуй ещё раз.",
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
        "Grounded AI-предложение применено локально. Сохраните черновик или дождитесь autosave.",
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
        message: "Grounded AI-предложение скопировано в буфер обмена.",
      });
    } catch {
      setGroundedRewriteFeedback({
        sectionKey: groundedRewriteSuggestion.sectionKey,
        message: "Не удалось скопировать grounded AI-предложение автоматически.",
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
              {rewritePendingSectionKey === input.sectionKey ? "AI обрабатывает..." : "Улучшить текст"}
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
                  ? "AI обрабатывает..."
                  : "Улучшить с опорой на нормы"}
              </Button>
            ) : null}
            <span className="text-xs leading-5 text-[var(--muted)]">
              AI использует только последнее persisted состояние секции.
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
              titlePrefix="Grounded AI-предложение"
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
