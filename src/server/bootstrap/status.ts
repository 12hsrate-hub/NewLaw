export const bootstrapStatusItems = [
  {
    title: "App Router",
    description:
      "Подготовлены корневой layout, стартовая страница и технический route handler `/api/health`.",
  },
  {
    title: "Структура кода",
    description:
      "Каталоги разложены по зонам ответственности: app, components, server, schemas, db, utils.",
  },
  {
    title: "Инфраструктурная база",
    description:
      "Добавлены Prisma schema, env.example для local/staging/production и pnpm-ориентированные scripts.",
  },
  {
    title: "UI baseline",
    description:
      "Подключены Tailwind CSS, база для shadcn/ui и разделение базовых UI-компонентов от продуктовых.",
  },
] as const;
