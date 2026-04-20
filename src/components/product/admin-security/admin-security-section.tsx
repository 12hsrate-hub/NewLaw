import { AdminSecurityActionsPanel } from "@/components/product/admin-security/admin-security-actions-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AdminAccountSearchResult } from "@/server/admin-security/account-search";

type AdminSecuritySectionProps = {
  searchResult: AdminAccountSearchResult;
};

export function AdminSecuritySection({ searchResult }: AdminSecuritySectionProps) {
  return (
    <section className="space-y-6">
      <Card className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Super Admin</p>
          <h1 className="text-3xl font-semibold">Admin Account Security</h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Этот экран не зависит от активного персонажа или серверного контекста и позволяет безопасно использовать уже готовые server-side security actions.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]">
          Поиск работает только по account-level идентификаторам: email, account login и account id. Character identifiers здесь намеренно не используются.
        </div>

        <form action="/app/admin-security" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="identifier">
              Email, login или account id
            </label>
            <input
              className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-white"
              defaultValue={searchResult.identifier}
              id="identifier"
              name="identifier"
              placeholder="user@example.com / lawyer_admin / uuid"
            />
          </div>

          <Button type="submit">Найти аккаунт</Button>
        </form>

        {searchResult.message ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6">
            {searchResult.message}
          </div>
        ) : null}
      </Card>

      {searchResult.status === "found" && searchResult.account ? (
        <>
          <Card className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Target Account</p>
              <h2 className="text-2xl font-semibold">Найденный аккаунт</h2>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Account id</p>
                <p className="mt-2 break-all text-sm font-medium">{searchResult.account.id}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Confirmed email</p>
                <p className="mt-2 text-lg font-medium">{searchResult.account.email}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Login</p>
                <p className="mt-2 text-lg font-medium">{searchResult.account.login}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Pending email</p>
                <p className="mt-2 text-lg font-medium">{searchResult.account.pendingEmail ?? "Нет pending email"}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Must change password</p>
                <p className="mt-2 text-lg font-medium">
                  {searchResult.account.mustChangePassword ? "Да" : "Нет"}
                </p>
              </div>
            </div>
          </Card>

          <AdminSecurityActionsPanel
            accountEmail={searchResult.account.email}
            accountId={searchResult.account.id}
            accountLogin={searchResult.account.login}
            pendingEmail={searchResult.account.pendingEmail}
          />
        </>
      ) : null}
    </section>
  );
}
