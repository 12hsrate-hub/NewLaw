import { removeActiveCharacterSignatureAction, uploadCharacterSignatureAction } from "@/server/actions/characters";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CharacterSignatureCardProps = {
  characterId: string;
  redirectTo: string;
  activeSignature: {
    id: string;
    previewUrl: string | null;
    mimeType: string;
    width: number;
    height: number;
    fileSize: number;
  } | null;
};

function formatFileSize(bytes: number) {
  if (bytes < 1_024) {
    return `${bytes} Б`;
  }

  return `${(bytes / 1_024).toFixed(1)} КБ`;
}

export function CharacterSignatureCard(props: CharacterSignatureCardProps) {
  const hasSignature = props.activeSignature !== null;

  return (
    <Card className="space-y-4 border border-[var(--border)] bg-white/50">
      <div className="space-y-2">
        <h4 className="text-lg font-semibold">Подпись для документов</h4>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Эта подпись будет использоваться при генерации документов от имени выбранного персонажа.
          После первого сохранения черновика подпись фиксируется в документе и не меняется
          автоматически при изменении профиля.
        </p>
        <p className="text-xs leading-5 text-[var(--muted)]">
          Поддерживаются PNG, JPG/JPEG и WEBP до 1 МБ. Лучше всего использовать PNG с прозрачным
          фоном размером около 600×200 px.
        </p>
      </div>

      {hasSignature ? (
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 p-4">
          <p className="text-sm font-medium">Активная подпись</p>
          {props.activeSignature?.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Предпросмотр подписи персонажа"
              className="max-h-24 w-full rounded-xl border border-[var(--border)] bg-white object-contain p-3"
              src={props.activeSignature.previewUrl}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-white/80 px-4 py-6 text-sm leading-6 text-[var(--muted)]">
              Предпросмотр сейчас недоступен, но сама подпись остаётся привязанной к персонажу.
            </div>
          )}
          <p className="text-xs leading-5 text-[var(--muted)]">
            Формат: {props.activeSignature?.mimeType}. Размер: {props.activeSignature?.width}×
            {props.activeSignature?.height} px, {formatFileSize(props.activeSignature?.fileSize ?? 0)}.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/70 px-4 py-4 text-sm leading-6 text-[var(--muted)]">
          Подпись пока не загружена. Черновики документов можно создавать без неё, но финальная
          генерация шаблонных документов будет недоступна.
        </div>
      )}

      <form action={uploadCharacterSignatureAction} className="space-y-3" encType="multipart/form-data">
        <input name="characterId" type="hidden" value={props.characterId} />
        <input name="redirectTo" type="hidden" value={props.redirectTo} />
        <label className="block space-y-2 text-sm">
          <span className="font-medium">{hasSignature ? "Заменить подпись" : "Загрузить подпись"}</span>
          <input
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-sm text-[var(--foreground)] file:mr-4 file:rounded-xl file:border-0 file:bg-[var(--accent)]/15 file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--accent)]"
            name="signatureFile"
            type="file"
          />
        </label>
        <Button type="submit">{hasSignature ? "Сохранить новую подпись" : "Загрузить подпись"}</Button>
      </form>

      {hasSignature ? (
        <form action={removeActiveCharacterSignatureAction}>
          <input name="characterId" type="hidden" value={props.characterId} />
          <input name="redirectTo" type="hidden" value={props.redirectTo} />
          <Button type="submit" variant="secondary">
            Удалить подпись
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
