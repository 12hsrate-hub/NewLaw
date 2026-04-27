"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createLegalServicesAgreementDraftAction,
  generateLegalServicesAgreementPreviewAction,
  saveDocumentDraftAction,
} from "@/server/actions/documents";
import type { DocumentTrustorRegistrySummary } from "@/server/document-area/context";
import { normalizeLegalServicesAgreementNumber } from "@/features/documents/legal-services-agreement/formatting";
import { legalServicesAgreementManualFieldSpecs } from "@/features/documents/legal-services-agreement/template-definition";
import type {
  LegalServicesAgreementDraftPayload,
  LegalServicesAgreementRenderedArtifact,
} from "@/features/documents/legal-services-agreement/schemas";
import { LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION } from "@/features/documents/legal-services-agreement/types";

type CharacterOption = {
  id: string;
  fullName: string;
  passportNumber: string;
  isProfileComplete: boolean;
};

type LegalServicesAgreementDraftCreateClientProps = {
  server: {
    code: string;
    name: string;
  };
  characters: CharacterOption[];
  selectedCharacter: CharacterOption & {
    source: "last_used" | "first_available";
  };
  trustorRegistry: DocumentTrustorRegistrySummary[];
  initialTitle: string;
};

type LegalServicesAgreementEditorClientProps = {
  documentId: string;
  server: {
    code: string;
    name: string;
  };
  initialTitle: string;
  initialPayload: LegalServicesAgreementDraftPayload;
  status: "draft" | "generated" | "published";
  updatedAt: string;
  generatedAt: string | null;
  generatedOutputFormat: string | null;
  generatedRendererVersion: string | null;
  generatedArtifact: LegalServicesAgreementRenderedArtifact | null;
  isModifiedAfterGeneration: boolean;
};

type EditorState = {
  title: string;
  payload: LegalServicesAgreementDraftPayload;
};

function buildInitialPayloadJson() {
  return JSON.stringify({
    formSchemaVersion: LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION,
    manualFields: {
      agreementNumber: "",
      registerNumber: "",
      agreementDate: "",
      servicePeriodStart: "",
      servicePeriodEnd: "",
      priceAmount: "",
    },
    workingNotes: "",
  });
}

function isStateEqual(left: EditorState, right: EditorState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function FieldHint(props: { children: ReactNode }) {
  return <p className="text-xs leading-5 text-[var(--muted)]">{props.children}</p>;
}

function formatDocumentStatus(status: "draft" | "generated" | "published") {
  if (status === "draft") {
    return "Черновик";
  }

  if (status === "generated") {
    return "Документ собран";
  }

  return "Опубликован";
}

export function LegalServicesAgreementDraftCreateClient(
  props: LegalServicesAgreementDraftCreateClientProps,
) {
  const [selectedCharacterId, setSelectedCharacterId] = useState(props.selectedCharacter.id);
  const [selectedTrustorId, setSelectedTrustorId] = useState(props.trustorRegistry[0]?.id ?? "");
  const [title, setTitle] = useState(props.initialTitle);
  const selectedCharacter =
    props.characters.find((character) => character.id === selectedCharacterId) ??
    props.characters[0];

  return (
    <form action={createLegalServicesAgreementDraftAction} className="space-y-5">
      <input name="serverSlug" type="hidden" value={props.server.code} />
      <input name="payloadJson" type="hidden" value={buildInitialPayloadJson()} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium">Название черновика</span>
          <Input name="title" onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Персонаж</span>
          <Select
            name="characterId"
            onChange={(event) => setSelectedCharacterId(event.target.value)}
            value={selectedCharacterId}
          >
            {props.characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.fullName} · паспорт {character.passportNumber}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">Доверитель</span>
          <Select
            disabled={props.trustorRegistry.length === 0}
            name="trustorId"
            onChange={(event) => setSelectedTrustorId(event.target.value)}
            value={selectedTrustorId}
          >
            {props.trustorRegistry.length === 0 ? (
              <option value="">На этом сервере пока нет доверителей</option>
            ) : null}
            {props.trustorRegistry.map((trustor) => (
              <option key={trustor.id} value={trustor.id}>
                {trustor.fullName} · паспорт {trustor.passportNumber}
              </option>
            ))}
          </Select>
          <FieldHint>
            После первого сохранения сервер, персонаж и доверитель фиксируются в документе. Подписи
            в договоре рисуются автоматически шрифтом из снимков персонажа и доверителя.
          </FieldHint>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
        <Badge>Сервер: {props.server.name}</Badge>
        {selectedCharacter ? <Badge>Персонаж: {selectedCharacter.fullName}</Badge> : null}
        <Badge>{props.trustorRegistry.length > 0 ? "доверитель выбран" : "нужен доверитель"}</Badge>
      </div>

      <Button disabled={props.trustorRegistry.length === 0} type="submit">
        Создать черновик договора
      </Button>
    </form>
  );
}

export function LegalServicesAgreementEditorClient(
  props: LegalServicesAgreementEditorClientProps,
) {
  const initialState = useMemo(
    () => ({
      title: props.initialTitle,
      payload: props.initialPayload,
    }),
    [props.initialPayload, props.initialTitle],
  );
  const [editorState, setEditorState] = useState<EditorState>(initialState);
  const [savedState, setSavedState] = useState<EditorState>(initialState);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [generationErrors, setGenerationErrors] = useState<string[]>([]);
  const [generatedArtifact, setGeneratedArtifact] = useState(props.generatedArtifact);
  const [generatedAt, setGeneratedAt] = useState(props.generatedAt);
  const [status, setStatus] = useState(props.status);
  const [isModifiedAfterGeneration, setIsModifiedAfterGeneration] = useState(
    props.isModifiedAfterGeneration,
  );
  const isDirty = !isStateEqual(editorState, savedState);

  const updateField = (
    key: keyof LegalServicesAgreementDraftPayload["manualFields"],
    value: string,
  ) => {
    const normalizedValue =
      key === "agreementNumber" ? normalizeLegalServicesAgreementNumber(value) : value;

    setEditorState((current) => ({
      ...current,
      payload: {
        ...current.payload,
        manualFields: {
          ...current.payload.manualFields,
          [key]: normalizedValue,
        },
      },
    }));
  };

  const performSave = async () => {
    const result = await saveDocumentDraftAction({
      documentId: props.documentId,
      title: editorState.title,
      payload: editorState.payload,
    });

    if (!result.ok) {
      setSaveMessage("Не удалось сохранить черновик договора. Проверьте поля и попробуйте снова.");
      return;
    }

    setSavedState(editorState);
    setStatus(result.status);
    setIsModifiedAfterGeneration(result.isModifiedAfterGeneration);
    setSaveMessage(`Черновик сохранён: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`);
  };

  const performGenerate = async () => {
    setGenerationErrors([]);
    const result = await generateLegalServicesAgreementPreviewAction({
      documentId: props.documentId,
    });

    if (!result.ok) {
      if (result.error === "generation-blocked") {
        setGenerationErrors(result.messages);
        setGenerationMessage(
          "Сборка недоступна, пока не заполнены обязательные данные договора.",
        );
        return;
      }

      setGenerationMessage(
        "Не удалось собрать страницы договора. Черновик сохранён, можно попробовать ещё раз.",
      );
      return;
    }

    setStatus(result.status);
    setGeneratedAt(result.generatedAt);
    setGeneratedArtifact(result.generatedArtifact);
    setIsModifiedAfterGeneration(result.isModifiedAfterGeneration);
    setGenerationMessage(
      "Договор собран. Проверьте страницы и скачайте нужные файлы при необходимости.",
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
        Основной текст договора формируется по утверждённому шаблону. Подписи персонажа и
        доверителя подставляются автоматически по сохранённым данным документа.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">Название документа</span>
          <Input
            onChange={(event) =>
              setEditorState((current) => ({ ...current, title: event.target.value }))
            }
            value={editorState.title}
          />
        </label>

        {legalServicesAgreementManualFieldSpecs.map((field) => (
          <label className="space-y-2" key={field.key}>
            <span className="text-sm font-medium">{field.label}</span>
            <Input
              onChange={(event) =>
                updateField(
                  field.key as keyof LegalServicesAgreementDraftPayload["manualFields"],
                  event.target.value,
                )
              }
              value={
                editorState.payload.manualFields[
                  field.key as keyof LegalServicesAgreementDraftPayload["manualFields"]
                ]
              }
            />
            <FieldHint>{field.hint}</FieldHint>
          </label>
        ))}
      </div>

      <section className="space-y-3 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold">Зафиксированный доверитель</h3>
          <Badge>{editorState.payload.trustorSnapshot.fullName}</Badge>
          <Badge>паспорт {editorState.payload.trustorSnapshot.passportNumber}</Badge>
        </div>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Данные доверителя уже зафиксированы в документе и не меняются автоматически после
          первого сохранения черновика.
        </p>
      </section>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Рабочие заметки</span>
        <Textarea
          onChange={(event) =>
            setEditorState((current) => ({
              ...current,
              payload: {
                ...current.payload,
                workingNotes: event.target.value,
              },
            }))
          }
          value={editorState.payload.workingNotes}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={performSave} type="button">
          Сохранить черновик
        </Button>
        <Button onClick={performGenerate} type="button" variant="secondary">
          Собрать страницы договора
        </Button>
        <Badge>{formatDocumentStatus(status)}</Badge>
        {isDirty ? <Badge>есть несохранённые изменения</Badge> : null}
        {isModifiedAfterGeneration ? <Badge>изменено после генерации</Badge> : null}
      </div>

      {saveMessage ? <p className="text-sm leading-6 text-[var(--muted)]">{saveMessage}</p> : null}
      {generationMessage ? (
        <p className="text-sm leading-6 text-[var(--muted)]">{generationMessage}</p>
      ) : null}
      {generationErrors.length > 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          {generationErrors.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      ) : null}

      <section className="space-y-3 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold">Результат генерации</h3>
          {generatedAt ? <Badge>{new Date(generatedAt).toLocaleString("ru-RU")}</Badge> : null}
        </div>
        {generatedArtifact ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {generatedArtifact.pages.map((page) => (
                <a
                  className="inline-flex items-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--accent-soft)]"
                  download={page.fileName}
                  href={page.pngDataUrl}
                  key={page.fileName}
                >
                  Скачать страницу {page.pageNumber}
                </a>
              ))}
            </div>
            <div
              className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white p-4 text-sm leading-6"
              dangerouslySetInnerHTML={{ __html: generatedArtifact.previewHtml }}
            />
          </div>
        ) : (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Сборка ещё не запускалась. После неё здесь появятся страницы договора для проверки и
            скачивания.
          </p>
        )}
      </section>
    </div>
  );
}
