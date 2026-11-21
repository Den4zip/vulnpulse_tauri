# Сохранённые материалы VulnPulse

Создано 2026-11-17 из локального `vulnpulse-desktop`. Это справочная база новой разработки; архивные Electron-инструкции не заменяют [AGENTS.md](../AGENTS.md). Новый продукт описан в [PLAN.md](../PLAN.md).

## Дизайн и происхождение

| Материал | Назначение |
| --- | --- |
| [mint-preview-2.png](design/mint-preview-2.png) | Изученное публичное превью Dashboard Mint |
| [mint-cover.png](design/mint-cover.png) | Обложка исходного набора |
| [legacy-main.css](design/legacy-main.css) | Токены и стили реализованного Electron UI; справочник для адаптации |
| [catalog-1280.png](screenshots/catalog-1280.png) | Каталог и карточная оболочка |
| [dashboard-1280.png](screenshots/dashboard-1280.png) | KPI и графики |
| [stack-1280.png](screenshots/stack-1280.png) | Инвентарь |
| [workflow-1280.png](screenshots/workflow-1280.png) | Заметки и SLA |
| [catalog-150-percent.png](screenshots/catalog-150-percent.png) | Проверка плотного интерфейса при масштабе 150% |

Источник Mint — [Free Admin Dashboard UI Kit](https://www.figma.com/community/file/1244293267600418871/free-admin-dashboard-ui-kit), автор [Ali / @malik_ali](https://www.figma.com/@malik_ali). В исследовании исходного проекта от 2026-11-05 зафиксирована [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). PNG перенесены без изменения. В интерфейсе VulnPulse адаптированы навигация, логотип, данные, таблицы, формы и плотность; автор Mint не заявлен участником или рекомендателем VulnPulse. Атрибуция должна оставаться и в новом приложении. Точные слои Figma недоступны в этом пакете.

Дополнительные токены CSS и снимки приложения принадлежат реализации VulnPulse. Уведомления о лицензиях компонентов новой оболочки доступны в разделе «О дизайне» и [в исходниках](../docs/ui-notices.txt). Лицензия Mint относится к исходному дизайн-набору. Уведомления из старой реализации сохранены в `THIRD_PARTY_NOTICES.md` в архиве истории.

## Архив исходников и истории

`legacy-history.bundle` — полный Git bundle всех локальных refs на момент сохранения, включая исходники, документацию, миграции, fixtures и тесты. Архив хранится локально и исключён из нового репозитория; для восстановления нужна отдельная копия этого файла.

- Ветка `develop`: `c44d73605985dff7b9c8fadc929a06efa3c6c068`.
- Ветка `main`: `280eae5947f6944c918012b4a62af3faf8000f94`.
- Размер: 3 818 670 байт.
- SHA-256: `5a9dcd9bdbf8620fbd136f5f92d616e4a6b30043bc79e4cb44d29f1e242579f5`.
- Контрольные суммы остальных материалов: [manifest.json](manifest.json).

Проверены `git bundle verify`, восстановление в отдельный bare-репозиторий, `git fsck --full` и совпадение HEAD. Git подтвердил, что bundle содержит полную историю. Это проверка сохранности Git-объектов; сборка восстановленного Electron-приложения в этом ходе не выполнялась.

Восстановление исходников из корня новой папки, в **новый отсутствующий** каталог рядом:

```powershell
git clone --branch develop ./references/legacy-history.bundle ../vulnpulse-legacy-restored
git -C ../vulnpulse-legacy-restored log -1 --oneline
```

Восстановленная история остаётся справочным проектом; не смешивать её `.git` с новой реализацией. Remote восстановленного clone указывает на локальный bundle; push в него не является публикацией на GitHub.

### Что искать после восстановления

| Задача | Пути в восстановленном репозитории |
| --- | --- |
| Предметные требования | `CONTEXT.md`, `docs/rbvm-product-vision.md`, `docs/project-domain-design.md`, `docs/project-model-proposal.md` |
| Предыдущая проработка Vault | `docs/project-vault-design.md`; runtime-ограничения Electron исторические |
| Дизайн | `DESIGN.md`, `docs/design/`, `docs/frontend-integration-plan.md`, `THIRD_PARTY_NOTICES.md` |
| Каталог и контракты | `src/main/db/schema.ts`, `src/shared/api.ts`, `src/shared/enums.ts` |
| Источники и импорт | `docs/feed-core.md`, `docs/fstec-import.md`, `src/main/services/`, `examples/` |
| Семантика matcher | `src/main/services/matcher/`, `tests/unit/matcher/` |
| Регрессии и сценарии | `tests/unit/`, `tests/e2e/`, `tests/fixtures/` |
| Учтённая ошибка CI | `scripts/check-electron.cjs`, `.github/workflows/ci.yml` |

**За границей архива:** неотслеживаемые/игнорируемые файлы, настройки Git и hooks, корневая память вне репозитория, зависимости, runtime, пользовательские БД/WAL, секреты и установленные приложения. Чистый `git status` не доказывает отсутствия таких данных. Старую папку пока сохраняем; до её удаления нужен отдельный проверенный backup пользовательских данных.

Материалы `references/` не включать в runtime-бандл. Git bundle нужен для истории; после создания нового remote решить хранение архива отдельно от обычных изменений исходников, сохранив доступную резервную копию.
