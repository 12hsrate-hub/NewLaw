# Production DB Stability Baseline

Дата baseline: `2026-04-24`
Рабочая ветка: `feature/production-db-stability`

## Git baseline

- исходная ветка: `main`
- tracked-незакоммиченных изменений на момент старта нет
- локально остаётся только untracked `.tmp/`, она не входит в hotfix и не коммитится

## Production env snapshot

Важно:

- этот snapshot исторический и относится к состоянию до local Postgres cutover
- current production runtime DB уже не использует этот Supabase pooler path

Secrets в репозиторий не публикуются. Ниже зафиксирован только безопасный redacted snapshot.

- `DATABASE_URL`: `postgresql://postgres.spzdskokmenvfgnxliea:***@aws-1-us-east-1.pooler.supabase.com:****/postgres`
- `DIRECT_URL`: `postgresql://postgres.spzdskokmenvfgnxliea:***@aws-1-us-east-1.pooler.supabase.com:****/postgres`
- `NEXT_PUBLIC_SUPABASE_URL`: `https://spzdskokmenvfgnxliea.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `set`
- `SUPABASE_SERVICE_ROLE_KEY`: `set`

Отдельное замечание:

- `DIRECT_URL` сейчас совпадает с pooled `DATABASE_URL`
- это operational risk для Prisma и отдельный post-fix review item

## Production log snapshot

Подтверждённые digest и ошибки:

- `170711255` -> `P2024` на auth/account path через `syncAccountFromSupabaseUser`
- `138891581` -> `P1001` на trustors document query

Дополнительно в свежих логах встречались:

- `P2024` на `/account/documents`
- `P2024` на `/account/trustors`
- `P2024` на `/account/characters`
- `P1001` на editor route `legal-services-agreements/[documentId]`

## Rough route frequency snapshot

Снимок по `journalctl -u newlaw-app --since 2026-04-23`:

- `syncAccountFromSupabaseUser` / auth-account path: `7`
- `/account/trustors`: `6`
- `/account`: `4`
- `/account/documents`: `2`
- `/account/characters`: `2`
- `/servers/[serverSlug]/documents/legal-services-agreements/[documentId]`: `1`

Это rough snapshot для приоритизации hotfix, а не точная telemetry-метрика.

## Current working hypothesis

Сейчас есть две независимые группы проблем:

1. runtime/DB instability
   - `P2024`
   - `P1001`
   - внешний Supabase pooler / connection pressure

2. read-path brittleness
   - strict parse старых `formPayloadJson`
   - strict parse `authorSnapshotJson`
   - strict parse `signatureSnapshotJson`
   - один битый документ может уронить list/editor route

Hotfix должен уменьшить query pressure и одновременно сделать document read-path устойчивым к старым/битым данным без ослабления write-path validation.
