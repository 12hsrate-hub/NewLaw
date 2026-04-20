import { bootstrapServers } from "../src/db/seeds/servers";

async function main() {
  // На этапе bootstrap сиды хранятся в репозитории и готовы к дальнейшему
  // подключению к Prisma-моделям, когда схема домена будет реализована.
  console.log("Bootstrap seed prepared:");
  console.table(bootstrapServers);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
