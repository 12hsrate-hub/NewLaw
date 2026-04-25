import { Card } from "@/components/ui/card";
import {
  InternalAccessDeniedState,
  InternalOverviewCard,
  InternalOverviewGrid,
} from "@/components/product/internal/internal-shell";
import { getInternalAccessContext } from "@/server/internal/access";

export default async function InternalLandingPage() {
  const accessContext = await getInternalAccessContext("/internal");

  if (accessContext.status === "denied") {
    return <InternalAccessDeniedState accountLogin={accessContext.viewer.login} />;
  }

  return (
    <section className="space-y-6">
      <Card className="space-y-3 border-[#d7c4b6] bg-white/80">
        <p className="text-xs uppercase tracking-[0.24em] text-[#8c5a36]">Overview</p>
        <h2 className="text-3xl font-semibold">Internal admin contour</h2>
        <p className="max-w-3xl text-sm leading-6 text-[#6f6258]">
          Это foundation-level entry point для `super_admin`. На этом шаге здесь уже есть единый
          контур `/internal/...`, но migration feature content из transitional `/app/admin-*`
          маршрутов пойдёт отдельными подшагами.
        </p>
      </Card>

      <InternalOverviewGrid>
        <InternalOverviewCard
          href="/internal/laws"
          title="Laws"
          description="Target route для law corpus management, retrieval preview и server-scoped corpus review."
        />
        <InternalOverviewCard
          href="/internal/precedents"
          title="Precedents"
          description="Target route для precedent source topics, import workflow и current/validity review."
        />
        <InternalOverviewCard
          href="/internal/security"
          title="Security"
          description="Target route для admin actions над чужими аккаунтами, отдельно от self-service /account/security."
        />
        <InternalOverviewCard
          href="/internal/access-requests"
          title="Access Requests"
          description="Рассмотрение pending-заявок на адвокатский доступ и выдача `lawyer + advocate` только через super_admin contour."
        />
        <InternalOverviewCard
          href="/internal/ai-review"
          title="AI Review"
          description="Очередь спорных AI-кейсов, repo-managed AI Behavior Rules и шаблон fix_instruction для шага 17."
        />
        <InternalOverviewCard
          href="/internal/health"
          title="Health"
          description="Target route для internal health summary по corpus, assistant status и runtime readiness."
        />
      </InternalOverviewGrid>
    </section>
  );
}
