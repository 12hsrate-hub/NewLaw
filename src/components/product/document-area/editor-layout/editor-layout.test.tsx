import Link from "next/link";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EditorActionSummary } from "@/components/product/document-area/editor-layout/editor-action-summary";
import { EditorContextCard } from "@/components/product/document-area/editor-layout/editor-context-card";
import { EditorDocumentMeta } from "@/components/product/document-area/editor-layout/editor-document-meta";
import { EditorProgressSummary } from "@/components/product/document-area/editor-layout/editor-progress-summary";
import {
  EditorContextAside,
  EditorMainColumn,
  EditorWorkspaceLayout,
} from "@/components/product/document-area/editor-layout/editor-workspace-layout";

describe("EditorWorkspaceLayout", () => {
  it("рендерит main и aside без document-specific props", () => {
    const html = renderToStaticMarkup(
      <EditorWorkspaceLayout
        aside={
          <EditorContextAside>
            <div>Aside content</div>
          </EditorContextAside>
        }
        main={
          <EditorMainColumn>
            <div>Main content</div>
          </EditorMainColumn>
        }
      />,
    );

    expect(html).toContain('data-editor-workspace-layout="true"');
    expect(html).toContain('data-editor-main-column="true"');
    expect(html).toContain('data-editor-context-aside="true"');
    expect(html).toContain("xl:grid-cols-[minmax(0,1fr)_360px]");
    expect(html).toContain("xl:sticky");
    expect(html).toContain("Main content");
    expect(html).toContain("Aside content");
  });

  it("рендерит context cards, meta, actions и footer", () => {
    const html = renderToStaticMarkup(
      <EditorContextCard
        actions={[{ href: "/servers/blackberry/documents", label: "Открыть раздел" }]}
        description="Короткое пояснение."
        eyebrow="Контекст"
        footer="Footer text"
        meta={<span>Meta</span>}
        title="Карточка справа"
      >
        <Link href="/account">Перейти в аккаунт</Link>
      </EditorContextCard>,
    );

    expect(html).toContain("Контекст");
    expect(html).toContain("Карточка справа");
    expect(html).toContain("Короткое пояснение.");
    expect(html).toContain("Meta");
    expect(html).toContain("Открыть раздел");
    expect(html).toContain("Перейти в аккаунт");
    expect(html).toContain("Footer text");
  });

  it("рендерит summaries с простыми переданными данными", () => {
    const html = renderToStaticMarkup(
      <>
        <EditorProgressSummary
          helperText="Подсказка по готовности."
          items={[
            { label: "Обязательные поля", tone: "success", value: "Заполнены" },
            { label: "Проверка", tone: "warning", value: "Требует внимания" },
          ]}
        />
        <EditorDocumentMeta
          badges={[
            { label: "Черновик" },
            { label: "Готово к сборке", tone: "success" },
          ]}
          items={[
            { label: "Сервер", value: "Blackberry" },
            { label: "Документ", value: "claim-1" },
          ]}
        />
        <EditorActionSummary
          helperText="Действия выполняются из основной колонки редактора."
          items={[
            { label: "Сохранение", value: "Доступно" },
            { label: "Публикация", tone: "info", value: "Не используется" },
          ]}
        />
      </>,
    );

    expect(html).toContain("Обязательные поля");
    expect(html).toContain("Заполнены");
    expect(html).toContain("Сервер");
    expect(html).toContain("Blackberry");
    expect(html).toContain("Публикация");
    expect(html).toContain("Подсказка по готовности.");
    expect(html).toContain("Действия выполняются из основной колонки редактора.");
  });
});
