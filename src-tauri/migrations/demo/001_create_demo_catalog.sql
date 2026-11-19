CREATE TABLE demo_entries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL
) STRICT;

INSERT INTO demo_entries (id, title) VALUES
    ('DEMO-002', 'Пример записи для проверки обновления ПО'),
    ('DEMO-001', 'Пример записи для проверки конфигурации');
