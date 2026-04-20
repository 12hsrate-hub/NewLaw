export function getPersistenceStatus() {
  return {
    database: "not-configured-yet",
    prisma: "prepared",
  } as const;
}
