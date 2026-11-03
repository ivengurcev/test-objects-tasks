# Мини-CRM «Объекты и задачи»

Мини-CRM для строительной компании: постановщики ведут объекты и назначают задачи, исполнители выполняют назначенные задачи, а постановщики принимают работу или возвращают её на доработку.

**Демонстрация:** [http://2.27.120.66:3003/](http://2.27.120.66:3003/) — контейнер опубликован напрямую на внешнем порту `3003`; Nginx внутри контейнера слушает порт `8080`.

## Возможности и роли

- **Постановщик:** видит все активные объекты и задачи; создаёт, редактирует и логически удаляет объекты и задачи; назначает исполнителей; принимает задачи на проверке или возвращает их с комментарием.
- **Исполнитель:** видит только назначенные ему активные задачи и связанные доступные объекты; берёт задачу в работу и отправляет на проверку; не может просматривать задачи других исполнителей.
- Карточка задачи показывает автора, исполнителя, объект, статус и историю переходов.

Доступ к данным и допустимость операций обеспечивает PostgreSQL через RLS и существующие RPC. В браузере используется только Supabase publishable key; `service_role`, пароли и другие секреты не используются.

## Технологии и конфигурация

React, TypeScript, esbuild, CSS Modules, Yarn `4.18.1` с `nodeLinker: pnpm`, Supabase Auth и PostgreSQL.

Миграции применены в Supabase Cloud; список локальных и облачных миграций сверён командой `yarn supabase migration list --linked`. В Cloud находятся четыре тестовых объекта — это принятый демонстрационный набор.

## Локальный запуск

Нужны Node.js 24+ и Docker для локальной базы.

```sh
corepack enable
yarn install --immutable
```

Создай `.env.local` по примеру `.env.example`:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Запусти приложение:

```sh
yarn dev
```

Сервер разработки доступен на `http://127.0.0.1:3000`. Пользователей и профили создаёт администратор Supabase; открытой регистрации в приложении нет.

## Проверки

Выполненные проверки:

- `yarn typecheck` — успешно.
- `yarn build` — успешно.
- Frontend-тесты — **6 пройдено**.
- Локальные pgTAP-тесты — **68/68**.
- `yarn supabase db lint --local` — ошибок схемы нет.
- Cloud Auth/API — read-only проверки с обычными Auth-сессиями постановщика и двух исполнителей прошли; проверены роли, видимость объектов и задач, история, связанные профили и недоступность чужих задач.

Cloud-проверки не изменяют данные. Запрещённые записи и переходы проверялись локально; прямые Cloud-запросы записи для этого не выполнялись.

Запуск frontend-тестов:

```sh
for test_file in src/features/tasks/*.test.mjs; do
  node --experimental-strip-types "$test_file" || exit 1
done
```

Команды для локальной базы и тестов:

```sh
yarn db:start
yarn db:reset
yarn db:test
yarn supabase db lint --local
yarn db:stop
```

`yarn db:reset` пересоздаёт только локальную базу.

## Docker

Образ собирается в два этапа: Node.js 24 и Yarn 4 устанавливают зависимости, запускают typecheck и production-сборку; Nginx Alpine раздаёт `dist/` на внутреннем порту `8080` с SPA fallback. Build arguments `SUPABASE_URL` и `SUPABASE_PUBLISHABLE_KEY` обязательны. Env-файлы исключены из Docker build context.

Собери образ из настроек в `.env.local`:

```sh
set -a
. ./.env.local
set +a
docker build \
  --build-arg SUPABASE_URL \
  --build-arg SUPABASE_PUBLISHABLE_KEY \
  --tag test-objects-tasks:latest \
  .
```

Экспортируй образ и передай его на сервер:

```sh
docker save --output test-objects-tasks.tar test-objects-tasks:latest
scp test-objects-tasks.tar <user>@<server>:/tmp/
```

На VPS загрузи образ и запусти контейнер с прямой публикацией на внешнем порту `3003`:

```sh
docker load --input /tmp/test-objects-tasks.tar
docker run -d \
  --name mini-crm \
  --restart unless-stopped \
  -p 3003:8080 \
  test-objects-tasks:latest
```

Docker направляет внешний порт `3003` прямо на Nginx внутри контейнера, работающий на порту `8080`. Дополнительный Nginx-прокси и HTTPS-терминация не используются.

Проверка главной страницы, статических файлов и SPA fallback:

```sh
curl --fail --head http://2.27.120.66:3003/
curl --fail --head http://2.27.120.66:3003/main.js
curl --fail --head http://2.27.120.66:3003/main.css
curl --fail --head http://2.27.120.66:3003/example/client/path
```

Для обновления образа загрузи его новой версией и пересоздай контейнер:

```sh
docker stop mini-crm
docker rm mini-crm
docker run -d \
  --name mini-crm \
  --restart unless-stopped \
  -p 3003:8080 \
  test-objects-tasks:latest
```

Логи контейнера:

```sh
docker logs --follow --tail 100 mini-crm
```

Подробности требований и архитектуры: [бизнес-требования](docs/requirements.md), [технические ограничения](docs/arch-rules.md), [архитектура](docs/architecture.md), [план реализации](docs/implementation-plan.md).
