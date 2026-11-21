CREATE TABLE catalog_entries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 5),
    published_at TEXT,
    updated_at TEXT
) STRICT;

CREATE TABLE catalog_source_records (
    entry_id TEXT NOT NULL REFERENCES catalog_entries(id),
    kind TEXT NOT NULL CHECK (kind IN ('nvd', 'osv', 'cisa_kev', 'fstec')),
    reference TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    cvss INTEGER CHECK (cvss BETWEEN 0 AND 100),
    PRIMARY KEY (entry_id, kind, reference),
    UNIQUE (kind, reference)
) STRICT;

CREATE INDEX catalog_by_updated ON catalog_entries (updated_at DESC, id);

CREATE TEMP TABLE demo_catalog_samples (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity INTEGER NOT NULL,
    cvss INTEGER,
    published_at TEXT,
    updated_at TEXT
) STRICT;

INSERT INTO demo_catalog_samples
SELECT id, title, 'Учебная запись для знакомства с каталогом VulnPulse.',
       CASE id WHEN 'DEMO-001' THEN 3 ELSE 2 END,
       CASE id WHEN 'DEMO-001' THEN 58 ELSE 34 END,
       '2026-10-24', '2026-11-12'
FROM demo_entries;

WITH samples (number, title, severity, score, changed) AS (
    VALUES
    ( 3, 'Шлюз централизованного доступа', 5, 98, 20),
    ( 4, 'Шлюз синхронизации конфигураций', 4, 81, 20),
    ( 5, 'Модуль обработки входящих документов', 5, 96, 19),
    ( 6, 'Компонент управления длительными пользовательскими сессиями в распределённой системе документооборота', 4, 75, 18),
    ( 7, 'Библиотека преобразования изображений', 3, 65, 18),
    ( 8, 'Служба обмена системными сообщениями', 4, 86, 17),
    ( 9, 'Контроллер хранения архивных копий', 5, 91, 17),
    (10, 'Модуль чтения параметров запуска', 2, 37, 16),
    (11, 'Адаптер журнала событий', 0, NULL, 16),
    (12, 'Панель мониторинга состояния сервисов', 3, 53, 15),
    (13, 'Агент резервного копирования', 4, 78, 15),
    (14, 'Индексатор внутреннего поиска', 3, 61, 14),
    (15, 'Клиент уведомлений о состоянии задач', 2, 28, 14),
    (16, 'Средство проверки доступности сервисов', 1, 0, 13),
    (17, 'Служба маршрутизации очередей', 5, 95, 13),
    (18, 'Обработчик табличных документов', 3, 47, 12),
    (19, 'Библиотека разбора форматов конфигурации', 4, 72, 11),
    (20, 'Планировщик мероприятий обслуживания', 2, 31, 10),
    (21, 'Компонент загрузки локальных шаблонов', 3, 57, 9),
    (22, 'Служба каталогизации общих ресурсов', 4, 83, 8),
    (23, 'Консоль обслуживания тестовых сред', 1, 0, 7),
    (24, 'Модуль проверки совместимости компонентов', 0, NULL, NULL)
)
INSERT INTO demo_catalog_samples
SELECT printf('DEMO-%03d', number), title,
       'Учебная карточка вымышленного компонента. Оценка и даты заданы для демонстрации фильтров и происхождения данных.',
       severity, score,
       CASE WHEN changed IS NOT NULL THEN '2026-10-24' END,
       CASE WHEN changed IS NOT NULL THEN printf('2026-11-%02d', changed) END
FROM samples;

INSERT INTO catalog_entries
SELECT id, title, description, severity, published_at, updated_at FROM demo_catalog_samples;

INSERT INTO catalog_source_records (entry_id, kind, reference, retrieved_at, cvss)
SELECT id, kind, printf('DEMO-%s-%s', upper(kind), substr(id, 6)), '2026-11-21', cvss
FROM (
    SELECT id, CASE CAST(substr(id, 6) AS INTEGER) % 3
        WHEN 0 THEN 'nvd' WHEN 1 THEN 'osv' ELSE 'fstec' END AS kind, cvss
    FROM demo_catalog_samples
    UNION ALL SELECT 'DEMO-003', 'osv', NULL
    UNION ALL SELECT 'DEMO-003', 'cisa_kev', NULL
    UNION ALL SELECT 'DEMO-005', 'cisa_kev', NULL
    UNION ALL SELECT 'DEMO-017', 'cisa_kev', NULL
);

DROP TABLE demo_catalog_samples;
