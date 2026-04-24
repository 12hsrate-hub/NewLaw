# Обзор продукта

## Краткое описание

`Lawyer5RP MVP` — единое веб-приложение для юридических и околоюридических игровых сценариев внутри GTA5RP.

Изначальный якорный сценарий продукта — жалоба в ОГП с генерацией форумного `BBCode`.
По фактическому состоянию репозитория продукт уже шире этого первого сценария: кроме `OGP complaint` в нём есть claims family, `server legal assistant`, account zone, server hub, internal contour и первые post-MVP template documents.

## Для кого проект

Ключевые группы пользователей:

- обычный игрок, который подаёт документ от своего имени
- адвокат, который может работать и от себя, и как представитель
- `super_admin`, который ведёт internal/platform контур

## Что уже решает текущий repo-state

- хранит account, server, character, trustor и document context в одной системе
- фиксирует document snapshots и generation metadata
- даёт стабильный `OGP complaint` flow с итоговым `BBCode`
- даёт claims family с persisted drafts и structured output
- даёт public/server-scoped `assistant` по law corpus и precedents
- даёт account zone и server-scoped точки входа вместо старого универсального `/app`
- даёт post-MVP template document line поверх той же snapshot-модели

## Как трактовать MVP

Current agreed MVP формально закрыт.

Это не означает, что в repo больше нечего развивать.
Это означает, что:

- обязательных блокеров “чтобы дойти до MVP” больше нет
- дальнейшие линии должны описываться как future expansion, optional capability или post-MVP

## Что остаётся отдельными линиями

- deeper AI expansion beyond current helper scope
- deeper trustors expansion beyond current convenience layer
- дальнейшее развитие template/PDF/JPG documents
- deeper operational maturity

Подробности по границам и статусам лежат в:

- [mvp-scope.md](./mvp-scope.md)
- [mvp-closure.md](./mvp-closure.md)
- [../plans/00-master-plan.md](../plans/00-master-plan.md)
