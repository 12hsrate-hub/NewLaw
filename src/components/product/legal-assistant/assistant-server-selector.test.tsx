import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantServerSelector } from "@/components/product/legal-assistant/assistant-server-selector";

describe("AssistantServerSelector", () => {
  it("показывает empty state, если для помощника пока нет доступных серверов", () => {
    const html = renderToStaticMarkup(<AssistantServerSelector servers={[]} />);

    expect(html).toContain("Пока нет доступных серверов");
    expect(html).toContain("Для юридического помощника сейчас нет доступных серверов.");
    expect(html).toContain("/servers");
    expect(html).toContain("Открыть серверы");
  });

  it("показывает список серверов и отмечает текущий сервер", () => {
    const html = renderToStaticMarkup(
      <AssistantServerSelector
        currentServerCode="blackberry"
        servers={[
          {
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
            hasCurrentLawCorpus: true,
            currentPrimaryLawCount: 2,
            hasUsablePrecedentCorpus: true,
            currentPrecedentCount: 1,
            hasUsableAssistantCorpus: true,
          },
        ]}
      />,
    );

    expect(html).toContain("Blackberry");
    expect(html).toContain("Текущий сервер");
    expect(html).toContain("/assistant/blackberry");
  });
});
