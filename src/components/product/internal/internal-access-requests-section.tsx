import {
  approveCharacterAccessRequestAction,
  rejectCharacterAccessRequestAction,
} from "@/server/actions/character-access-requests";
import type { InternalAccessRequestsContext } from "@/server/internal/access-requests";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const statusLabels: Record<string, string> = {
  "character-access-request-approved": "Заявка одобрена. Персонажу выданы lawyer и advocate.",
  "character-access-request-rejected": "Заявка отклонена. Роли и access flags персонажа не изменялись.",
  "character-access-request-review-forbidden":
    "Это действие доступно только super_admin и не может использоваться для self-review.",
  "character-access-request-review-error":
    "Не удалось обработать заявку. Проверь актуальный статус и попробуй снова.",
};

export function InternalAccessRequestsSection(props: {
  context: InternalAccessRequestsContext;
  status?: string | null;
}) {
  return (
    <section className="space-y-6">
      <Card className="space-y-4 border-[#d7c4b6] bg-white/80">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Access requests</p>
          <h2 className="text-3xl font-semibold">Character Access Requests</h2>
          <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
            Здесь рассматриваются заявки на адвокатский доступ. Одобрение не зависит от account zone
            UI и всегда проходит через server-side admin guard.
          </p>
        </div>

        {props.status && statusLabels[props.status] ? (
          <p className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6">
            {statusLabels[props.status]}
          </p>
        ) : null}
      </Card>

      {props.context.pendingRequests.length === 0 ? (
        <Card className="space-y-3 border-[#d7c4b6] bg-white/80">
          <h3 className="text-2xl font-semibold">Pending-заявок нет</h3>
          <p className="text-sm leading-6 text-[#6f6258]">
            Сейчас нет заявок, которые ожидают approve/reject в internal contour.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {props.context.pendingRequests.map((request) => (
            <Card className="space-y-5 border-[#d7c4b6] bg-white/80" key={request.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Pending</Badge>
                <Badge className="bg-white/70 text-[#1e1916]">{request.server.name}</Badge>
                <span className="text-xs uppercase tracking-[0.18em] text-[#6f6258]">
                  {request.server.code}
                </span>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2 text-sm leading-6 text-[#6f6258]">
                  <p>
                    Аккаунт:{" "}
                    <span className="font-medium text-[#1e1916]">
                      {request.account.login} ({request.account.email})
                    </span>
                  </p>
                  <p>
                    Персонаж:{" "}
                    <span className="font-medium text-[#1e1916]">
                      {request.character.fullName}
                    </span>
                  </p>
                  <p>
                    Паспорт:{" "}
                    <span className="font-medium text-[#1e1916]">
                      {request.character.passportNumber}
                    </span>
                  </p>
                  <p>
                    Тип заявки:{" "}
                    <span className="font-medium text-[#1e1916]">{request.requestType}</span>
                  </p>
                  <p>
                    Дата заявки:{" "}
                    <span className="font-medium text-[#1e1916]">{request.createdAt}</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm leading-6 text-[#6f6258]">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8c5a36]">
                    Комментарий пользователя
                  </p>
                  <p className="mt-2">
                    {request.requestComment?.trim().length
                      ? request.requestComment
                      : "Пользователь не добавил комментарий к заявке."}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <form
                  action={approveCharacterAccessRequestAction}
                  className="space-y-3 rounded-2xl border border-[#c9d8c3] bg-[#eef7ea] p-4"
                >
                  <input name="returnPath" type="hidden" value="/internal/access-requests" />
                  <input name="requestId" type="hidden" value={request.id} />
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[#254d1d]">Одобрить</h3>
                    <p className="text-sm leading-6 text-[#4c6642]">
                      Действие добавит персонажу `lawyer` и `advocate`, если их ещё нет.
                    </p>
                  </div>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium text-[#254d1d]">Комментарий администратора</span>
                    <textarea
                      className="min-h-24 rounded-2xl border border-[#c9d8c3] bg-white px-4 py-3 outline-none transition focus:border-[#7ca46c]"
                      name="reviewComment"
                      placeholder="Почему заявка одобрена"
                    />
                  </label>
                  <button
                    className="inline-flex items-center rounded-2xl bg-[#285c2d] px-4 py-2.5 text-sm font-medium text-white"
                    type="submit"
                  >
                    Одобрить
                  </button>
                </form>

                <form
                  action={rejectCharacterAccessRequestAction}
                  className="space-y-3 rounded-2xl border border-[#e0c0bd] bg-[#fff4f2] p-4"
                >
                  <input name="returnPath" type="hidden" value="/internal/access-requests" />
                  <input name="requestId" type="hidden" value={request.id} />
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[#8a3f36]">Отклонить</h3>
                    <p className="text-sm leading-6 text-[#7a4e49]">
                      Действие переведёт заявку в `rejected` и не будет менять роли или access flags.
                    </p>
                  </div>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium text-[#8a3f36]">Комментарий администратора</span>
                    <textarea
                      className="min-h-24 rounded-2xl border border-[#e0c0bd] bg-white px-4 py-3 outline-none transition focus:border-[#c8837a]"
                      name="reviewComment"
                      placeholder="Почему заявка отклонена"
                    />
                  </label>
                  <button
                    className="inline-flex items-center rounded-2xl bg-[#8a3f36] px-4 py-2.5 text-sm font-medium text-white"
                    type="submit"
                  >
                    Отклонить
                  </button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
