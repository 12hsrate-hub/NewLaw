# Production Access

Локальный доступ к прод-серверу для проекта `NewLaw` настроен через отдельный SSH-алиас:

- `Host`: `newlaw-prod`
- `HostName`: `185.46.11.89`
- `User`: `root`
- `IdentityFile`: `C:/Users/12hs/.ssh/newlaw_prod_ed25519`

Быстрая проверка подключения:

```bash
ssh newlaw-prod
```

Или короткая smoke-check без интерактива:

```bash
ssh -o BatchMode=yes newlaw-prod "hostname && whoami"
```

Быстрый деплой текущей заглушки:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-prod.ps1
```

Публичный ключ уже добавлен на сервер в `/root/.ssh/authorized_keys`.
Пароль для обычной работы больше не нужен: вход проверен по ключу.

Что делает `deploy-prod.ps1`:

1. Копирует файлы из `site/` в `/srv/newlaw/site`.
2. Обновляет `nginx`-конфиг из `deploy/nginx/newlaw.conf`.
3. Проверяет конфигурацию и перезапускает `nginx`.
4. Делает smoke-check по `https://lawyer5rp.ru`.

Что важно дальше:

1. Для первого деплоя можно использовать `root`, но для постоянной эксплуатации лучше завести отдельного пользователя, например `deploy`.
2. Перед выкладкой приложения стоит подготовить директорию проекта на сервере, systemd unit и reverse proxy.
3. Если этот сервер будет использоваться ещё и для старого проекта, изоляцию лучше сделать через отдельного пользователя и отдельный каталог приложения.
