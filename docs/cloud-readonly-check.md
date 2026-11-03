# Проверка облачного Supabase только для чтения

Скрипт [`scripts/check-cloud-readonly.mjs`](../scripts/check-cloud-readonly.mjs) проверяет доступность данных через обычные Supabase Auth-сессии. Он использует отдельный клиент для постановщика и каждого исполнителя, выполняет вход и запросы чтения; операции создания, изменения, удаления и RPC не вызываются. `service_role` не используется.

Создайте локальный файл `.env.supabase-check` (файлы `.env.*` исключены из Git) и задайте в нём переменные:

```dotenv
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
CRM_MANAGER_EMAIL=
CRM_MANAGER_PASSWORD=
CRM_EXECUTOR_1_EMAIL=
CRM_EXECUTOR_1_PASSWORD=
CRM_EXECUTOR_2_EMAIL=
CRM_EXECUTOR_2_PASSWORD=
```

Запустите из корня проекта:

```sh
yarn node --env-file=.env.supabase-check scripts/check-cloud-readonly.mjs
```

Скрипт печатает результат `PASS` или `FAIL` по сценариям, не печатает значения переменных, пароли или токены и завершается с ненулевым кодом при любой неудачной проверке. Используйте учётные записи тестового проекта. Отчёт о демонстрационных данных относится к активным объектам и задачам, доступным менеджеру.
