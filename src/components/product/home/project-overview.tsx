import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
import { bootstrapStatusItems } from "@/server/bootstrap/status";

export function ProjectOverview() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-5xl space-y-6">
        <SectionTitle
          eyebrow="Lawyer5RP MVP"
          title="Bootstrap проекта готов"
          description="В репозитории подготовлен базовый full-stack каркас на Next.js с App Router, Tailwind, Prisma, Zod и согласованной структурой каталогов."
        />

        <div className="grid gap-4 md:grid-cols-2">
          {bootstrapStatusItems.map((item) => (
            <Card key={item.title}>
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
