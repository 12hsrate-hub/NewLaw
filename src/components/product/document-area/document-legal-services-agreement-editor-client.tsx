"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelCard } from "@/components/ui/panel-card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { WarningNotice } from "@/components/ui/warning-notice";
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
  hasActiveSignature?: boolean;
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

function AgreementSection(props: {
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <PanelCard className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">{props.title}</h3>
          {props.badge ? <Badge>{props.badge}</Badge> : null}
        </div>
        <p className="text-sm leading-6 text-[var(--muted)]">{props.description}</p>
      </div>
      {props.children}
    </PanelCard>
  );
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

      <AgreementSection
        badge="черновик"
        description="Задайте рабочее название документа. После первого сохранения договор перейдёт в обычный редактор с сохранёнными снимками данных."
        title="Данные договора"
      >
        <label className="space-y-2">
          <span className="text-sm font-medium">Название черновика</span>
          <Input name="title" onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
      </AgreementSection>

      <AgreementSection
        description="Выберите персонажа и доверителя. Этот контекст закрепится за документом после первого сохранения."
        title="Представитель и доверитель"
      >
        <div className="grid gap-4 md:grid-cols-2">
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
      </AgreementSection>

      <PanelCard className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">Состояние перед сохранением</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Проверьте, что выбран нужный доверитель, а у персонажа заполнен профиль и доступна подпись
            для дальнейшей сборки страниц договора.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <StatusBadge tone="info">Сервер: {props.server.name}</StatusBadge>
          {selectedCharacter ? (
            <StatusBadge tone="neutral">Персонаж: {selectedCharacter.fullName}</StatusBadge>
          ) : null}
          <StatusBadge tone={props.trustorRegistry.length > 0 ? "success" : "warning"}>
            {props.trustorRegistry.length > 0
              ? "доверитель: выбран существующий"
              : "доверитель: требуется"}
          </StatusBadge>
          {selectedCharacter ? (
            <StatusBadge tone={selectedCharacter.isProfileComplete ? "success" : "warning"}>
              {selectedCharacter.isProfileComplete ? "профиль готов" : "профиль нужно проверить"}
            </StatusBadge>
          ) : null}
          {selectedCharacter?.hasActiveSignature !== undefined ? (
            <StatusBadge tone={selectedCharacter.hasActiveSignature ? "success" : "warning"}>
              {selectedCharacter.hasActiveSignature ? "подпись загружена" : "подпись не загружена"}
            </StatusBadge>
          ) : null}
        </div>

        {selectedCharacter && !selectedCharacter.isProfileComplete ? (
          <WarningNotice
            description="Профиль персонажа заполнен не полностью. Черновик можно создать, но перед сборкой страниц договора лучше проверить обязательные данные представителя."
            title="Проверьте профиль персонажа"
          />
        ) : null}

        {selectedCharacter?.hasActiveSignature === false ? (
          <WarningNotice
            description="Без активной подписи договор сохранится как черновик, но итоговые страницы не будут полностью готовы к проверке и скачиванию."
            title="Подпись понадобится для сборки"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={props.trustorRegistry.length === 0} type="submit">
            Создать черновик договора
          </Button>
          <FieldHint>
            После сохранения можно будет заполнить ручные поля договора и собрать страницы по серверному шаблону.
          </FieldHint>
        </div>
      </PanelCard>
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
      <PanelCard className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">Состояние договора</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Основной текст договора формируется по утверждённому шаблону. Подписи персонажа и
            доверителя подставляются автоматически по сохранённым данным документа.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={status === "published" ? "success" : status === "generated" ? "info" : "neutral"}>
            {formatDocumentStatus(status)}
          </StatusBadge>
          <StatusBadge tone={isDirty ? "warning" : "success"}>
            {isDirty ? "есть несохранённые изменения" : "изменения сохранены"}
          </StatusBadge>
          {isModifiedAfterGeneration ? (
            <StatusBadge tone="warning">изменено после генерации</StatusBadge>
          ) : (
            <StatusBadge tone="success">результат актуален</StatusBadge>
          )}
          <StatusBadge tone={generatedArtifact ? "success" : "neutral"}>
            {generatedArtifact ? "страницы готовы" : "страницы не собраны"}
          </StatusBadge>
        </div>

        {isModifiedAfterGeneration ? (
          <WarningNotice
            description="После последней сборки договор менялся. Перед использованием лучше заново собрать страницы, чтобы предпросмотр и файлы совпадали с текущими ручными полями."
            title="Результат нужно обновить"
          />
        ) : null}

        {generationErrors.length > 0 ? (
          <WarningNotice
            description={generationErrors.join(" ")}
            title="Сборка пока недоступна"
          />
        ) : null}
      </PanelCard>

      <AgreementSection
        description="Здесь хранятся ручные поля договора. Шаблон и эталонный текст остаются прежними, вы обновляете только разрешённые значения."
        title="Данные договора"
      >
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
      </AgreementSection>

      <AgreementSection
        description="Доверитель уже зафиксирован внутри документа. После первого сохранения эти сведения больше не подтягиваются автоматически из внешнего реестра."
        title="Зафиксированный доверитель"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{editorState.payload.trustorSnapshot.fullName}</Badge>
          <Badge>паспорт {editorState.payload.trustorSnapshot.passportNumber}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Телефон</p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
              {editorState.payload.trustorSnapshot.phone || "не указан"}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">IC email</p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
              {editorState.payload.trustorSnapshot.icEmail || "не указан"}
            </p>
          </div>
        </div>
      </AgreementSection>

      <AgreementSection
        description="Рабочие заметки остаются внутри черновика и помогают фиксировать внутренние комментарии перед следующей сборкой."
        title="Рабочие заметки"
      >
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
      </AgreementSection>

      <PanelCard className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">Действия с договором</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Сначала сохраните изменения, затем при необходимости соберите обновлённые страницы договора для проверки и скачивания.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={performSave} type="button">
            Сохранить черновик
          </Button>
          <Button onClick={performGenerate} type="button" variant="secondary">
            Собрать страницы договора
          </Button>
        </div>

        {saveMessage ? <p className="text-sm leading-6 text-[var(--muted)]">{saveMessage}</p> : null}
        {generationMessage ? (
          <p className="text-sm leading-6 text-[var(--muted)]">{generationMessage}</p>
        ) : null}
      </PanelCard>

      <PanelCard className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">Результат генерации</h3>
          {generatedAt ? (
            <StatusBadge tone="success">
              {new Date(generatedAt).toLocaleString("ru-RU")}
            </StatusBadge>
          ) : null}
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
              className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-sm leading-6"
              dangerouslySetInnerHTML={{ __html: generatedArtifact.previewHtml }}
            />
          </div>
        ) : (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Сборка ещё не запускалась. После неё здесь появятся страницы договора для проверки и
            скачивания.
          </p>
        )}
      </PanelCard>
    </div>
  );
}
