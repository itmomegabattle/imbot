# IMBot — бот участников ITMO Megabattle

Telegram-бот участников и пиксельно-стеклянная Mini App. Единственный источник данных — [`itmomegabattle/imb_backend`](https://github.com/itmomegabattle/imb_backend). Локального JSON-состояния и прямого доступа к Supabase нет.

## Возможности

- `/app` — пиксельная Mini App с профилем, XP, уровнем, балансом, событиями и историей;
- `/me` — профиль и прогресс уровня;
- `/balance` — внутренняя валюта;
- `/top` — рейтинг по XP;
- `/setup Имя или ник | Факультет` — обязательные данные участника;
- `/events` — внешняя, индивидуальная и командная регистрация;
- `/team_create`, `/team_join`, `/team`, `/team_complete`, `/team_rotate` — команды;
- `/transfer ник сумма` — перевод целой валюты от 10 единиц;
- `/freshman` — справка для первокурсников;
- одноразовые наградные коды;
- админ-команды рассылок, XP/валюты, ачивок, статистики, справки, событий и ролей.

## Связь с backend

Бот всегда:

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
API_BASE_URL=http://localhost:4000
SERVICE_TOKEN=тот-же-секрет-что-PARTICIPANT_BOT_SERVICE_TOKEN-на-backend
MINI_APP_PORT=3000
MINI_APP_HOST=0.0.0.0
MINI_APP_URL=https://публичный-https-url-mini-app
```

Проверка Mini App-сервера: `GET http://localhost:3000/health`.

## Развёртывание

На VPS `npm start` запускает long polling и Mini App одним процессом. На Vercel используются `api/webhook.ts`, `api/miniapp-session.ts`, статическая папка `public/miniapp` и `vercel.json`; постоянный процесс не нужен.

После Vercel-деплоя задайте `WEBHOOK_BASE_URL`, `WEBHOOK_SECRET`, `BOT_TOKEN`, `API_BASE_URL`, `SERVICE_TOKEN`, `MINI_APP_URL`, соберите проект и один раз выполните `npm run webhook:set`. В BotFather укажите домен Mini App.

## Проверка перед релизом

```bash
npm run check
```
