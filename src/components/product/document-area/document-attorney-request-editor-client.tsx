"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium">Название черновика</span>
          <Input
            name="title"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>

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

      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
        <Badge>Сервер: {props.server.name}</Badge>
        {selectedCharacter ? (
          <Badge>{selectedCharacter.canCreateAttorneyRequest ? "роль адвоката есть" : "нет роли адвоката"}</Badge>
        ) : null}
        <Badge>{props.trustorRegistry.length > 0 ? "доверитель выбран" : "нужен доверитель"}</Badge>
        {selectedCharacter ? (
          <Badge>{selectedCharacter.hasActiveSignature ? "подпись загружена" : "подпись не загружена"}</Badge>
        ) : null}
      </div>

      {selectedCharacter && !selectedCharacter.hasActiveSignature ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          У выбранного персонажа не загружена подпись. Черновик можно создать, но финальная
          генерация документа будет недоступна.
        </div>
      ) : null}

      <Button
        disabled={!selectedCharacter?.canCreateAttorneyRequest || props.trustorRegistry.length === 0}
        type="submit"
      >
        Создать черновик адвокатского запроса
      </Button>
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
        <div className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          У выбранного персонажа не загружена подпись. Черновик можно редактировать и сохранять,
          но финальная генерация документа будет недоступна.
        </div>
      ) : null}

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
            После сохранения номер будет приведён к формату вроде BAR-2112.
            Сейчас сохранённое значение: {editorState.payload.requestNumberNormalized || "ещё не рассчитано"}.
          </FieldHint>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Номер договора</span>
          <Input
            onChange={(event) => updatePayload({ contractNumber: event.target.value })}
            value={editorState.payload.contractNumber}
          />
        </label>

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

      <section className="space-y-3 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold">Раздел 1</h3>
          <Badge>предзаполнен, можно редактировать</Badge>
        </div>
        {editorState.payload.section1Items.map((item, index) => (
          <label className="block space-y-2" key={item.id}>
            <span className="text-sm font-medium">Пункт {index + 1}</span>
            <Textarea
              onChange={(event) => updateSection1Item(item.id, event.target.value)}
              value={item.text}
            />
          </label>
        ))}
      </section>

      <section className="space-y-3 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold">Раздел 2</h3>
          <Badge>автоматически</Badge>
        </div>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Срок ответа рассчитывается приложением: {editorState.payload.responseDueAtMsk || "появится после сохранения"}.
        </p>
      </section>

      <section className="space-y-3 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold">Раздел 3</h3>
          <Badge>предзаполнен, можно редактировать</Badge>
        </div>
        <Textarea
          onChange={(event) => updatePayload({ section3Text: event.target.value })}
          value={editorState.payload.section3Text}
        />
        <FieldHint>Выбранный адресат: {formatPresetLabel(editorState.payload.addresseePreset)}.</FieldHint>
      </section>

      <section className="space-y-3 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold">Раздел 4</h3>
          <Badge>автоматически</Badge>
        </div>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Заключительный блок, дата и подпись формируются из сохранённого снимка персонажа.
        </p>
      </section>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Рабочие заметки</span>
        <Textarea
          onChange={(event) => updatePayload({ workingNotes: event.target.value })}
          value={editorState.payload.workingNotes}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={performSave} type="button">
          Сохранить черновик
        </Button>
        <Button onClick={performGenerate} type="button" variant="secondary">
          Собрать предпросмотр и файлы
        </Button>
        <Badge>{formatDocumentStatus(status)}</Badge>
        {isDirty ? <Badge>есть несохранённые изменения</Badge> : null}
        {isModifiedAfterGeneration ? <Badge>изменено после генерации</Badge> : null}
      </div>

      {saveMessage ? <p className="text-sm leading-6 text-[var(--muted)]">{saveMessage}</p> : null}
      {generationMessage ? (
        <p className="text-sm leading-6 text-[var(--muted)]">{generationMessage}</p>
      ) : null}

      <section className="space-y-3 rounded-3xl border border-[var(--border)] bg-white/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold">Результат генерации</h3>
          {generatedAt ? <Badge>{new Date(generatedAt).toLocaleString("ru-RU")}</Badge> : null}
        </div>
        {generatedArtifact ? (
          <div className="space-y-3">
            <div
              className="rounded-2xl border border-[var(--border)] bg-white p-4 text-sm leading-6"
              dangerouslySetInnerHTML={{ __html: generatedArtifact.previewHtml }}
            />
            <div className="flex flex-wrap gap-3">
              <a
                className="inline-flex rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm font-medium"
                download="attorney-request.pdf"
                href={generatedArtifact.pdfDataUrl}
              >
                Скачать PDF
              </a>
              <a
                className="inline-flex rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm font-medium"
                download="attorney-request.png"
                href={generatedArtifact.pngDataUrl}
              >
                Скачать PNG
              </a>
              <a
                className="inline-flex rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm font-medium"
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
      </section>
    </div>
  );
}
