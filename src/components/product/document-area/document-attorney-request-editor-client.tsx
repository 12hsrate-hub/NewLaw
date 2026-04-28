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
  attorneyRequestAddresseePresetKeys,
  attorneyRequestAddresseePresets,
} from "@/features/documents/attorney-request/presets";
import type {
  AttorneyRequestDraftPayload,
  AttorneyRequestRenderedArtifact,
} from "@/features/documents/attorney-request/schemas";
import {
  createAttorneyRequestDraftAction,
  generateAttorneyRequestAction,
  saveDocumentDraftAction,
} from "@/server/actions/documents";
import type { DocumentTrustorRegistrySummary } from "@/server/document-area/context";

type AttorneyRequestCreateCharacterOption = {
  id: string;
  fullName: string;
  passportNumber: string;
  isProfileComplete: boolean;
  canCreateAttorneyRequest?: boolean;
  hasActiveSignature: boolean;
};

type AttorneyRequestCreateClientProps = {
  server: {
    code: string;
    name: string;
  };
  characters: AttorneyRequestCreateCharacterOption[];
  selectedCharacter: AttorneyRequestCreateCharacterOption & {
    source: "last_used" | "first_available";
  };
  trustorRegistry: DocumentTrustorRegistrySummary[];
  initialTitle: string;
  initialTrustorId?: string | null;
};

type AttorneyRequestEditorClientProps = {
  documentId: string;
  server: {
    code: string;
    name: string;
  };
  initialTitle: string;
  initialPayload: AttorneyRequestDraftPayload;
  status: "draft" | "generated" | "published";
  updatedAt: string;
  generatedAt: string | null;
  generatedOutputFormat: string | null;
  generatedRendererVersion: string | null;
  generatedArtifact: AttorneyRequestRenderedArtifact | null;
  isModifiedAfterGeneration: boolean;
  hasActiveCharacterSignature: boolean;
  hasSignatureSnapshot: boolean;
};

type AttorneyRequestEditorState = {
  title: string;
  payload: AttorneyRequestDraftPayload;
};

function buildCreatePayloadJson() {
  return JSON.stringify({
    requestNumberRawInput: "",
    contractNumber: "",
    addresseePreset: null,
    targetOfficerInput: "",
    requestDate: "",
    timeFrom: "",
    timeTo: "",
    workingNotes: "",
  });
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

function formatPresetLabel(key: string | null) {
  if (!key) {
    return "Не выбрано";
  }

  return attorneyRequestAddresseePresets[key as keyof typeof attorneyRequestAddresseePresets]?.label ?? key;
}

function isStateEqual(left: AttorneyRequestEditorState, right: AttorneyRequestEditorState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function FieldHint(props: { children: ReactNode }) {
  return <p className="text-xs leading-5 text-[var(--muted)]">{props.children}</p>;
}

function AttorneyRequestSection(props: {
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

export function AttorneyRequestDraftCreateClient(props: AttorneyRequestCreateClientProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState(props.selectedCharacter.id);
  const [selectedTrustorId, setSelectedTrustorId] = useState(
    props.initialTrustorId && props.trustorRegistry.some((trustor) => trustor.id === props.initialTrustorId)
      ? props.initialTrustorId
      : (props.trustorRegistry[0]?.id ?? ""),
  );
  const [title, setTitle] = useState(props.initialTitle);
  const selectedCharacter = props.characters.find((character) => character.id === selectedCharacterId);

  return (
    <form action={createAttorneyRequestDraftAction} className="space-y-5">
      <input name="serverSlug" type="hidden" value={props.server.code} />
      <input name="payloadJson" type="hidden" value={buildCreatePayloadJson()} />

      <AttorneyRequestSection
        badge="черновик"
        description="Укажите рабочее название, по которому документ будет отображаться в списке сохранённых запросов."
        title="Данные запроса"
      >
        <label className="space-y-2">
          <span className="text-sm font-medium">Название черновика</span>
          <Input
            name="title"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>
      </AttorneyRequestSection>

      <AttorneyRequestSection
        description="Выберите персонажа с адвокатским доступом и доверителя. После первого сохранения этот контекст закрепляется за документом."
        title="Адвокат и доверитель"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium">Персонаж-адвокат</span>
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
            <FieldHint>
              Создать адвокатский запрос может только персонаж с ролью «адвокат».
            </FieldHint>
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
              Доверитель фиксируется при первом сохранении. Позже сменить сервер, персонажа или
              доверителя в этом документе нельзя.
            </FieldHint>
          </label>
        </div>
      </AttorneyRequestSection>

      <PanelCard className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">Состояние перед сохранением</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Проверьте, что у выбранного персонажа есть адвокатский доступ, а на сервере доступен
            хотя бы один доверитель.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <StatusBadge tone="info">Сервер: {props.server.name}</StatusBadge>
          {selectedCharacter ? (
            <StatusBadge tone={selectedCharacter.canCreateAttorneyRequest ? "success" : "warning"}>
              {selectedCharacter.canCreateAttorneyRequest ? "роль адвоката есть" : "нет роли адвоката"}
            </StatusBadge>
          ) : null}
          <StatusBadge tone={props.trustorRegistry.length > 0 ? "success" : "warning"}>
            {props.trustorRegistry.length > 0 ? "доверитель выбран" : "нужен доверитель"}
          </StatusBadge>
          {selectedCharacter ? (
            <StatusBadge tone={selectedCharacter.hasActiveSignature ? "success" : "warning"}>
              {selectedCharacter.hasActiveSignature ? "подпись загружена" : "подпись не загружена"}
            </StatusBadge>
          ) : null}
        </div>

        {selectedCharacter && !selectedCharacter.hasActiveSignature ? (
          <WarningNotice
            description="У выбранного персонажа не загружена подпись. Черновик можно создать, но финальная генерация документа будет недоступна."
            title="Подпись ещё не загружена"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!selectedCharacter?.canCreateAttorneyRequest || props.trustorRegistry.length === 0}
            type="submit"
          >
            Создать черновик адвокатского запроса
          </Button>
          <FieldHint>
            После сохранения можно будет заполнить разделы запроса, проверить шаблон и собрать файлы.
          </FieldHint>
        </div>
      </PanelCard>
    </form>
  );
}

export function AttorneyRequestEditorClient(props: AttorneyRequestEditorClientProps) {
  const initialState = useMemo(
    () => ({
      title: props.initialTitle,
      payload: props.initialPayload,
    }),
    [props.initialPayload, props.initialTitle],
  );
  const [editorState, setEditorState] = useState<AttorneyRequestEditorState>(initialState);
  const [savedState, setSavedState] = useState<AttorneyRequestEditorState>(initialState);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [generatedArtifact, setGeneratedArtifact] = useState(props.generatedArtifact);
  const [generatedAt, setGeneratedAt] = useState(props.generatedAt);
  const [status, setStatus] = useState(props.status);
  const [isModifiedAfterGeneration, setIsModifiedAfterGeneration] = useState(
    props.isModifiedAfterGeneration,
  );
  const isDirty = !isStateEqual(editorState, savedState);

  const updatePayload = (patch: Partial<AttorneyRequestDraftPayload>) => {
    setEditorState((current) => ({
      ...current,
      payload: {
        ...current.payload,
        ...patch,
      },
    }));
  };

  const updateSection1Item = (id: string, text: string) => {
    updatePayload({
      section1Items: editorState.payload.section1Items.map((item) =>
        item.id === id ? { ...item, text } : item,
      ),
    });
  };

  const performSave = async () => {
    const result = await saveDocumentDraftAction({
      documentId: props.documentId,
      title: editorState.title,
      payload: editorState.payload,
    });

    if (!result.ok) {
      setSaveMessage("Не удалось сохранить черновик адвокатского запроса. Проверьте поля и попробуйте снова.");
      return;
    }

    setSavedState(editorState);
    setStatus(result.status);
    setIsModifiedAfterGeneration(result.isModifiedAfterGeneration);
    setSaveMessage(`Черновик сохранён: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`);
  };

  const performGenerate = async () => {
    const result = await generateAttorneyRequestAction({
      documentId: props.documentId,
    });

    if (!result.ok) {
      if (result.error === "generation-blocked") {
        setGenerationMessage(`Генерация заблокирована: ${result.messages.join(" ")}`);
        return;
      }

      setGenerationMessage("Не удалось собрать документ. Черновик сохранён, можно попробовать ещё раз.");
      return;
    }

    setStatus(result.status);
    setGeneratedAt(result.generatedAt);
    setGeneratedArtifact(result.generatedArtifact);
    setIsModifiedAfterGeneration(result.isModifiedAfterGeneration);
    setGenerationMessage("Документ собран. Проверьте предпросмотр перед использованием.");
  };

  return (
    <div className="space-y-6">
      {!props.hasSignatureSnapshot && !props.hasActiveCharacterSignature ? (
        <WarningNotice
          description="У выбранного персонажа не загружена подпись. Черновик можно редактировать и сохранять, но финальная генерация документа будет недоступна."
          title="Подпись ещё не загружена"
        />
      ) : null}

      <PanelCard className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">Состояние документа</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Проверьте, синхронизированы ли правки с последней сборкой, и только после этого
            переходите к обновлению предпросмотра и скачиванию файлов.
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
            {generatedArtifact ? "файлы готовы" : "файлы не собраны"}
          </StatusBadge>
        </div>

        {isModifiedAfterGeneration ? (
          <WarningNotice
            description="После последней сборки данные запроса менялись. Перед использованием лучше заново собрать документ, чтобы предпросмотр и файлы совпадали с текущими полями."
            title="Результат нужно обновить"
          />
        ) : null}
      </PanelCard>

      <AttorneyRequestSection
        description="Рабочее название и номер запроса помогают быстро найти документ в списке и проверить, как он будет сохранён после обновления."
        title="Данные запроса"
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

          <label className="space-y-2">
            <span className="text-sm font-medium">Номер запроса</span>
            <Input
              onChange={(event) => updatePayload({ requestNumberRawInput: event.target.value })}
              placeholder="2112 или BAR-2112"
              value={editorState.payload.requestNumberRawInput}
            />
            <FieldHint>
              После сохранения номер будет приведён к формату вроде BAR-2112. Сейчас сохранённое
              значение: {editorState.payload.requestNumberNormalized || "ещё не рассчитано"}.
            </FieldHint>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Номер договора</span>
            <Input
              onChange={(event) => updatePayload({ contractNumber: event.target.value })}
              value={editorState.payload.contractNumber}
            />
          </label>
        </div>
      </AttorneyRequestSection>

      <AttorneyRequestSection
        description="Укажите адресата и сотрудника, по которому направляется запрос. Эти данные используются в итоговом шаблоне без изменения самого render-flow."
        title="Адресат и сотрудник"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium">Кому адресуется запрос</span>
            <Select
              onChange={(event) =>
                updatePayload({
                  addresseePreset: event.target.value
                    ? (event.target.value as AttorneyRequestDraftPayload["addresseePreset"])
                    : null,
                })
              }
              value={editorState.payload.addresseePreset ?? ""}
            >
              <option value="">Выберите адресата</option>
              {attorneyRequestAddresseePresetKeys.map((key) => (
                <option key={key} value={key}>
                  {attorneyRequestAddresseePresets[key].label}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Сотрудник / нашивка</span>
            <Input
              onChange={(event) => updatePayload({ targetOfficerInput: event.target.value })}
              value={editorState.payload.targetOfficerInput}
            />
          </label>
        </div>
      </AttorneyRequestSection>

      <AttorneyRequestSection
        badge="автоматически"
        description="Дата документа, период событий и срок ответа остаются в том же server-side расчёте. Здесь вы только управляете исходными полями для этого расчёта."
        title="Дата и период событий"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium">Дата запрашиваемой информации</span>
            <Input
              onChange={(event) => updatePayload({ requestDate: event.target.value })}
              type="date"
              value={editorState.payload.requestDate}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Время с</span>
              <Input
                onChange={(event) => updatePayload({ timeFrom: event.target.value })}
                type="time"
                value={editorState.payload.timeFrom}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Время по</span>
              <Input
                onChange={(event) => updatePayload({ timeTo: event.target.value })}
                type="time"
                value={editorState.payload.timeTo}
              />
            </label>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Срок ответа</p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
              {editorState.payload.responseDueAtMsk || "появится после сохранения"}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Адресат</p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
              {formatPresetLabel(editorState.payload.addresseePreset)}
            </p>
          </div>
        </div>
      </AttorneyRequestSection>

      <AttorneyRequestSection
        badge="предзаполнен"
        description="Первая часть шаблона заполняется автоматически, но при необходимости её можно уточнить перед сборкой итогового документа."
        title="Содержание запроса"
      >
        {editorState.payload.section1Items.map((item, index) => (
          <label className="block space-y-2" key={item.id}>
            <span className="text-sm font-medium">Пункт {index + 1}</span>
            <Textarea
              onChange={(event) => updateSection1Item(item.id, event.target.value)}
              value={item.text}
            />
          </label>
        ))}
      </AttorneyRequestSection>

      <AttorneyRequestSection
        badge="предзаполнен"
        description="Финальный текст запроса можно уточнить, не меняя сам шаблон рендера. Выбранный адресат остаётся видимым для быстрой проверки."
        title="Основание и итоговый текст"
      >
        <Textarea
          onChange={(event) => updatePayload({ section3Text: event.target.value })}
          value={editorState.payload.section3Text}
        />
        <FieldHint>Выбранный адресат: {formatPresetLabel(editorState.payload.addresseePreset)}.</FieldHint>
      </AttorneyRequestSection>

      <AttorneyRequestSection
        badge="автоматически"
        description="Заключительный блок, дата и подпись формируются из сохранённого снимка персонажа и не требуют ручного редактирования."
        title="Подпись и данные адвоката"
      >
        <p className="text-sm leading-6 text-[var(--muted)]">
          Заключительный блок, дата и подпись формируются из сохранённого снимка персонажа.
        </p>
      </AttorneyRequestSection>

      <AttorneyRequestSection
        description="Рабочие заметки остаются внутри черновика и помогают зафиксировать внутренние пометки перед следующей сборкой."
        title="Рабочие заметки"
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium">Рабочие заметки</span>
          <Textarea
            onChange={(event) => updatePayload({ workingNotes: event.target.value })}
            value={editorState.payload.workingNotes}
          />
        </label>
      </AttorneyRequestSection>

      <PanelCard className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">Действия с документом</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Сначала сохраните изменения, затем при необходимости соберите обновлённый предпросмотр и
            файлы для скачивания.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={performSave} type="button">
            Сохранить черновик
          </Button>
          <Button onClick={performGenerate} type="button" variant="secondary">
            Собрать документ и файлы
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
          <div className="space-y-3">
            <div
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-sm leading-6"
              dangerouslySetInnerHTML={{ __html: generatedArtifact.previewHtml }}
            />
            <div className="flex flex-wrap gap-3">
              <a
                className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--surface-embedded)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-subtle)]"
                download="attorney-request.pdf"
                href={generatedArtifact.pdfDataUrl}
              >
                Скачать PDF
              </a>
              <a
                className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--surface-embedded)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-subtle)]"
                download="attorney-request.png"
                href={generatedArtifact.pngDataUrl}
              >
                Скачать PNG
              </a>
              <a
                className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--surface-embedded)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-subtle)]"
                download="attorney-request.jpg"
                href={generatedArtifact.jpgDataUrl}
              >
                Скачать JPG
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Сборка ещё не выполнялась. Черновик можно сохранять неполным, но перед сборкой нужно
            заполнить обязательные поля.
          </p>
        )}
      </PanelCard>
    </div>
  );
}
