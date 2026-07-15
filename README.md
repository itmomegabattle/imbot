# IMBot — бот участников ITMO Megabattle

Telegram-бот участников и пиксельная Mini App. Production-данные получает из [`itmomegabattle/imb_backend`](https://github.com/itmomegabattle/imb_backend); локальный JSON-режим сохранён только для автономной разработки интерфейса.

## Возможности

- `/app` — пиксельная Mini App с профилем, XP, уровнем, балансом, событиями и историей;
- `/me` — профиль и прогресс уровня;
- `/balance` — внутренняя валюта;
- `/top` — рейтинг по XP;
- `/events` — мероприятия и регистрация;
- `/freshman` — справка для первокурсников;
- одноразовые коды посещения, валюты и достижений;
- новости и базовые команды организатора.

## Связь с backend

В `BACKEND_MODE=remote` бот:

1. регистрирует Telegram identity через сервисный API;
2. получает профиль, XP, валюту, события и рейтинг из PostgreSQL;
3. открывает Mini App без доверия к `tgId` в URL;
4. передаёт подписанный Telegram `initData` в backend для HMAC-проверки;
5. использует отдельный `SERVICE_TOKEN`, который можно отозвать независимо от бота организаторов.

Ключ Supabase и ключ YouGile в этот репозиторий не добавляются.

## Локальный запуск с backend

Сначала запустите `imb_backend` на порту `4000`, затем:

```bash
cp .env.example .env
npm install
npm run dev
```

Минимальная конфигурация:

```env
BOT_TOKEN=токен-от-BotFather
BACKEND_MODE=remote
API_BASE_URL=http://localhost:4000
SERVICE_TOKEN=тот-же-секрет-что-PARTICIPANT_BOT_SERVICE_TOKEN-на-backend
MINI_APP_PORT=3000
MINI_APP_HOST=0.0.0.0
MINI_APP_URL=https://публичный-https-url-mini-app
```

Проверка Mini App-сервера: `GET http://localhost:3000/health`.

## Автономный режим

Для работы без БД установите `BACKEND_MODE=local`. Тогда состояние создаётся в `data/*.json`. Эти файлы исключены из Git и не предназначены для production.

## Развёртывание

Текущий бот работает в режиме Telegram long polling, поэтому ему нужен постоянно запущенный Node-процесс: VPS, ITMO-сервер, Render/Fly/Railway или аналогичная платформа. Vercel подходит для статической Mini App и serverless webhook, но не для постоянно работающего long polling-процесса.

Docker-образ запускает и бота, и Mini App одним процессом. Для перехода на Vercel Functions потребуется отдельно включить Telegram webhook-режим.

## Проверка перед релизом

```bash
npm run check
```
