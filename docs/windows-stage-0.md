# Сборка и проверка VulnPulse на Windows

Целевая конфигурация этапа 0 — Windows x64, MSVC и Windows SDK, WebView2 Evergreen, Node.js из [`.nvmrc`](../.nvmrc) и Rust из [`rust-toolchain.toml`](../rust-toolchain.toml). Установщик NSIS включает офлайн-установщик Evergreen WebView2. [Требования Tauri](https://v2.tauri.app/start/prerequisites/), [варианты поставки WebView2](https://v2.tauri.app/distribute/windows-installer/).

```powershell
npm ci
npm run tauri -- dev
npm run tauri -- build --bundles nsis -- --locked
```

Кнопка «Загрузить примеры» вызывает `list_demo_catalog` через типизированный клиент. Команда проверяет лимит от 1 до 20 и передаёт чтение SQLite блокирующему исполнителю Rust с одним слотом. При первом чтении миграция создаёт две синтетические записи в SQLite в памяти. Разрешение на команду выдано локальному окну `main`.

## Проверки

Windows CI использует образ `windows-2022`. На `windows-2025` два прогона остановились до подключения к WebView2. Похожий сбой WebView2 на Windows Server 2025 описан командой runner-images. [Отчёт runner-images](https://github.com/actions/runner-images/issues/14738).

- Frontend — `npm run typecheck`, `npm run lint`, `npm test`, `npm run coverage`, `npm run build`. Покрытие этапа 0 относится к обработчику ошибок IPC. Сценарий интерфейса проверяет desktop smoke.
- Rust — `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --locked`. Для покрытия в CI используется cargo-llvm-cov 0.9.1 с `llvm-tools-preview`. Версия 0.9.1 учитывает расположение тестовых файлов в Cargo 1.100 на Windows. Сводка отражает LLVM regions, строки и функции. IPC через WebView2 выполняется отдельно. [Примечания к выпуску cargo-llvm-cov](https://github.com/taiki-e/cargo-llvm-cov/releases/tag/v0.9.1).
- Контракты — `npm run contracts:generate` экспортирует TypeScript из DTO Rust через ts-rs. `npm run contracts:check` и CI сверяют результат с отслеживаемым файлом.
- Документация — `npm run docs:check` проверяет локальные ссылки, кодировку и блоки кода.
- Desktop — `./tests/desktop/setup-driver.ps1` готовит драйвер соответствующей версии. `npm run desktop:smoke -- src-tauri/target/release/vulnpulse.exe allowed` запускает приложение с временным профилем и системным PATH. Тест ждёт готовности WebView2 и подключает к нему Edge WebDriver на loopback. Параметры отладки передаются только процессу тестового экземпляра. CI проверяет установленный экземпляр, затем выпускает отдельную сборку с [ограниченным capability](../tests/desktop/denied.conf.json) для отрицательного теста IPC. Установочный артефакт берётся из основного билда. [Edge WebDriver для WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/webdriver).

## Методика для замеров

Локальная машина этапа 0 — Windows 11 Pro x64 10.0.26200, Intel Core i5-13500H, 16 ГБ RAM, WebView2 Evergreen 157.0.4341.60. Для воспроизводимости записывать версию WebView2, ревизию кода, конфигурацию питания, размер и ревизию базы. Холодный старт измерять от запуска процесса до доступности первого действия в оболочке. Сценарий каталога измерять от действия пользователя до отображения строки после IPC. Публиковать число повторов, p50/p95, пиковую память и размер тестового набора. Замеры на целевом наборе запланированы на этапе 7.
