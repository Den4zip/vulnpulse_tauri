import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DemoEntryDto } from './generated/contracts';
import { listDemoCatalog } from './lib/api/catalog';
import { commandErrorMessage } from './lib/api/errors';
import './style.css';

type CatalogState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; entries: DemoEntryDto[] }
  | { status: 'error'; message: string };

function App() {
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'idle' });

  async function loadCatalog() {
    setCatalog({ status: 'loading' });
    try {
      const { entries } = await listDemoCatalog({ limit: 10 });
      setCatalog({ status: 'ready', entries });
    } catch (error) {
      setCatalog({ status: 'error', message: commandErrorMessage(error) });
    }
  }

  return (
    <main>
      <div className="brand">Vuln<span>Pulse</span></div>
      <section aria-labelledby="catalog-heading">
        <h1 id="catalog-heading">Демонстрационный каталог</h1>
        <p>Примеры записей загружаются из локальной SQLite. Данные хранятся до закрытия приложения.</p>
        <button type="button" disabled={catalog.status === 'loading'} onClick={loadCatalog}>
          {catalog.status === 'error' ? 'Повторить загрузку' : 'Загрузить примеры'}
        </button>
        <div role="status">
          {catalog.status === 'loading' && <p>Загрузка каталога…</p>}
          {catalog.status === 'ready' && catalog.entries.length === 0 && <p>Каталог пуст.</p>}
          {catalog.status === 'ready' && catalog.entries.length > 0 && (
            <ul aria-label="Примеры записей">
              {catalog.entries.map((entry) => (
                <li key={entry.id}><strong>{entry.id}</strong> {entry.title}</li>
              ))}
            </ul>
          )}
        </div>
        {catalog.status === 'error' && <p role="alert">{catalog.message}</p>}
      </section>
      <footer>Дизайн вдохновлён Mint от Ali · CC BY 4.0 · figma.com/community/file/1244293267600418871</footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
