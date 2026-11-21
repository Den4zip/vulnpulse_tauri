# Проверки каталога на Windows

«Начало работы» открывает локальный каталог с 24 синтетическими записями. SQLite создаётся в памяти при первом запросе. Миграция 002 сохраняет демонстрационные строки этапа 0 и добавляет карточки и исходные записи с учебными оценками CVSS. Даты публикации, изменения и получения показываются отдельно. Сводка и выдача вычисляются в SQLite.

Подготовка Windows, Node.js, Rust и Edge WebDriver описана в [заметках этапа 0](windows-stage-0.md).

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run coverage
npm run docs:check
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
npm run contracts:check
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --locked --lib
npm run tauri -- build --bundles nsis -- --locked
```

Сценарий smoke открывает каталог через Welcome Hub. Он проверяет сортировку, переход между страницами, поиск по кириллице, фильтр CISA KEV, состояние пустой выдачи, исходные записи и происхождение оценки, повторное чтение, клавиатуру и валидацию IPC. Rust-тесты отдельно проверяют пустой каталог, переход с миграции 001, контрольные суммы и откат миграции. В отдельной debug-сборке сценарий проверяет отказ всех трёх catalog-команд при отсутствии capability.

```powershell
$env:VULNPULSE_SCREENSHOTS = (Join-Path $PWD '.tools/catalog-screenshots')
npm run desktop:smoke -- src-tauri/target/release/vulnpulse.exe allowed
npm run tauri -- build --debug --no-bundle --config (Resolve-Path tests/desktop/denied.conf.json).Path -- --locked
npm run desktop:smoke -- src-tauri/target/debug/vulnpulse.exe denied
```

Windows CI запускает положительный сценарий на экземпляре, установленном NSIS, и сохраняет PNG в артефакте `vulnpulse-catalog-webview`. Снимки показывают каталог в WebView2 при 1280×800 и моделировании 100/125/150%, а также при 1024×768. Сценарий задаёт размеры viewport и `deviceScaleFactor` при текущем системном DPI Windows. Дополнительные снимки показывают полноширинную карточку и проверку вёрстки при шестизначном счётчике. Для сравнения используются [сохранённые материалы VulnPulse](../references/README.md). Уведомления о компонентах доступны в разделе «О дизайне» и [в исходниках](ui-notices.txt).
