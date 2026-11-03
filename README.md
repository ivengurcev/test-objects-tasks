# Мини-CRM «Объекты и задачи»

Проект тестового задания для строительной компании: система для учёта строительных объектов, назначения задач исполнителям и контроля их выполнения постановщиками.

## Реализовано

- Вход по email и паролю через Supabase Auth.
- Восстановление сессии после перезагрузки, обновление состояния при входе и выходе.
- Загрузка профиля пользователя из `public.profiles`; доступ без профиля или с некорректной ролью не предоставляется.
- Список доступных активных объектов со счётчиками задач на проверке, выполненных и незакрытых задач; отдельные экраны объекта и задачи, отдельные формы создания и редактирования, логическое удаление для менеджера.
- Постановщик работает со списком объектов и задач объекта; исполнитель после входа видит только свои активные задачи, сгруппированные по объектам.
- Менеджер может создавать задачи, а редактировать и логически удалять их из карточки задачи, назначая исполнителей.
- Карточка задачи с деталями и историей статусов; разрешённые переходы выполняются через `transition_task_status`.
- Исполнитель видит только назначенные ему задачи и доступные по RLS объекты. Действия и история ограничены ролью, статусом и политиками базы данных.

## Стек

React, TypeScript, esbuild, Yarn Berry с Plug'n'Play, CSS Modules, Supabase Cloud, Supabase Auth, PostgreSQL, RLS и Supabase JavaScript SDK. Отдельный Node.js backend не планируется.

## Документация

- [Бизнес-требования](docs/requirements.md)
- [Технические требования и ограничения](docs/arch-rules.md)
- [Предлагаемая архитектура](docs/architecture.md)

## Требования

- Node.js 24 или новее.
- Yarn 4.18.1 через Corepack.

## Установка и локальный запуск

```sh
corepack enable
yarn install
```

Создай `.env.local` в корне проекта по примеру `.env.example` и укажи URL проекта Supabase и его publishable key:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Запусти локальный сервер:

```sh
yarn dev
```

Сервер разработки доступен по адресу http://127.0.0.1:3000. Без заполненных настроек Supabase приложение запускается и показывает сообщение о необходимости подключения. Значения Supabase подставляются в браузерную сборку; используй только публичный publishable key, никогда не помещай `service_role` или secret key во frontend.

Вход доступен только для учётных записей, созданных администратором Supabase. Открытая регистрация и восстановление пароля в интерфейсе не предусмотрены. Для доступа пользователю также нужен профиль в `public.profiles` с совпадающим Auth UUID, `display_name` и ролью `manager` или `executor`; управление профилями выполняется административно.

## Production-сборка

```sh
yarn build
```

Сборка с минификацией записывается в `dist/`. Если нужен Supabase в production, переменные окружения должны быть заданы в среде сборки.

## Docker

Production-образ собирается в два этапа: Node.js 24 и Yarn 4 выполняют установку зависимостей, проверку типов и сборку, а Nginx Alpine раздаёт только содержимое `dist/` на внутреннем порту `8080`. Отдельный backend не запускается. Docker-сборка требует `SUPABASE_URL` и `SUPABASE_PUBLISHABLE_KEY`; это публичные настройки frontend, не передавай сюда `service_role`, пароли или другие секреты.

Убедись, что Docker доступен, затем передай настройки из `.env.local` как build arguments. Файлы `.env*` исключены из Docker build context и образа.

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

Сохранить образ в архив и перенести его на VPS:

```sh
docker save --output test-objects-tasks.tar test-objects-tasks:latest
scp test-objects-tasks.tar <user>@<server>:/tmp/
```

На сервере загрузить образ и запустить контейнер, доступный только локально на VPS:

```sh
docker load --input /tmp/test-objects-tasks.tar
docker run --detach \
  --name mini-crm \
  --restart unless-stopped \
  --publish 127.0.0.1:8080:8080 \
  test-objects-tasks:latest
```

Порт `8080` здесь привязан только к loopback-интерфейсу VPS и предназначен для существующего Nginx. Если он занят, выбери свободный локальный порт и измени upstream Nginx. Внутри существующего HTTPS `server` block добавь location, не меняя его внешний порт и TLS-настройки:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

TLS остаётся на внешнем Nginx; прямой внешний порт контейнеру не открывается.

Проверить ответ, статические файлы и SPA fallback:

```sh
curl --fail --head http://127.0.0.1:8080/
curl --fail --head http://127.0.0.1:8080/main.js
curl --fail --head http://127.0.0.1:8080/main.css
curl --fail --head http://127.0.0.1:8080/example/client/path
```

Для обновления замени образ архивом новой сборки, загрузи его через `docker load`, затем пересоздай контейнер:

```sh
docker stop mini-crm
docker rm mini-crm
docker run --detach \
  --name mini-crm \
  --restart unless-stopped \
  --publish 127.0.0.1:8080:8080 \
  test-objects-tasks:latest
```

Просмотр логов:

```sh
docker logs --follow --tail 100 mini-crm
```

Публикация на VPS в рамках этой инструкции не выполняется; этап 6 останется открытым до фактического развёртывания и проверки приложения.

## Проверка типов

```sh
yarn typecheck
```

## Локальная база Supabase

Для локальной базы нужны Docker и Supabase CLI, установленный как зависимость проекта.

```sh
corepack yarn supabase start
corepack yarn db:reset
corepack yarn db:test
```

`db:reset` пересоздаёт только локальную базу и применяет миграции из `supabase/migrations/`. `db:test` запускает SQL-тесты pgTAP из `supabase/tests/`. Остановить локальные службы можно командой `corepack yarn db:stop`.

Открытая регистрация Supabase Auth выключена. Для ручного создания пользователей используй локальную панель Supabase Studio или Dashboard: создай пользователей в разделе Authentication, затем административно добавь их профили в `public.profiles`, указав UUID соответствующей записи `auth.users`, роль `manager` или `executor` и отображаемое имя. Клиентские запросы не могут создавать или изменять профили.

Чтобы впоследствии применить миграции к облачному проекту, отдельно выполни `corepack yarn supabase login`, свяжи нужный проект командой `corepack yarn supabase link --project-ref <project-ref>`, проверь цель и затем запусти `corepack yarn supabase db push`. Эти команды не выполнялись; миграции в облако не применялись.

Не добавляй реальные пароли, ключи, UUID пользователей или `.env.local` в Git. Секретные ключи Supabase нельзя помещать во frontend.
