import {
  ArrowDown, ArrowDownUp, ArrowUp, ChevronLeft, ChevronRight, CircleAlert, Database,
  Filter, ListChecks, RefreshCw, Search, ShieldAlert, SlidersHorizontal, TriangleAlert, X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCatalogControls } from './catalog-state';
import type {
  CatalogEntryDto, CatalogPageDto, CatalogQueryRequest, CatalogSort, CatalogSummaryDto,
  Severity, SourceKind,
} from './generated/contracts';
import { getCatalogDetail, queryCatalog } from './lib/api/catalog';
import { Badge, Button, Dialog, Input, Select, Table, Toast, severityLabels } from './ui';
import { useCatalogRequest } from './use-catalog-request';

const sourceLabels: Record<SourceKind, string> = {
  nvd: 'NVD', osv: 'OSV', cisa_kev: 'CISA KEV', fstec: 'БДУ ФСТЭК',
};
const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeZone: 'UTC' });
const counts = new Intl.NumberFormat('ru-RU');
const decimal = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function displayDate(value: string | null) {
  return value ? dateFormat.format(new Date(value)) : '—';
}

function Summary({ value }: { value?: CatalogSummaryDto }) {
  const updateFilters = useCatalogControls((state) => state.updateFilters);
  const resetFilters = useCatalogControls((state) => state.resetFilters);
  const tiles = [
    { label: 'Всего записей', number: value?.total, icon: ListChecks, tone: 'total', action: resetFilters },
    { label: 'Критические', number: value?.critical, icon: ShieldAlert, tone: 'critical',
      action: () => updateFilters({ search: '', severity: 'critical', source: null, kev: null }) },
    { label: 'Высокие', number: value?.high, icon: TriangleAlert, tone: 'high',
      action: () => updateFilters({ search: '', severity: 'high', source: null, kev: null }) },
    { label: 'В CISA KEV', number: value?.kev, icon: CircleAlert, tone: 'kev',
      action: () => updateFilters({ search: '', severity: null, source: null, kev: true }) },
  ];
  return (
    <section aria-label="Сводка каталога" className="summary-grid">
      {tiles.map(({ label, number, icon: Icon, tone, action }) => (
        <button type="button" key={label} className="summary-tile panel" onClick={action} disabled={number === undefined}>
          <span>
            <span className="summary-label">{label}</span>
            <strong className="summary-value">{number === undefined ? '—' : counts.format(number)}</strong>
          </span>
          <span className={`summary-icon tone-${tone}`}><Icon aria-hidden="true" /></span>
        </button>
      ))}
    </section>
  );
}

function SortHeader({ label, field, query }: { label: string; field: CatalogSort; query: CatalogQueryRequest }) {
  const setSort = useCatalogControls((state) => state.setSort);
  const active = query.sortBy === field;
  const Icon = active ? (query.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowDownUp;
  return (
    <th scope="col" aria-sort={active ? (query.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button type="button" className={active ? 'sort-button sort-active' : 'sort-button'} onClick={() => setSort(field)}>
        {label}<Icon aria-hidden="true" />
      </button>
    </th>
  );
}

function CatalogTable({ entries, query, open, pending }: {
  entries: CatalogEntryDto[];
  query: CatalogQueryRequest;
  open: (id: string, trigger: HTMLButtonElement) => void;
  pending: boolean;
}) {
  return (
    <Table aria-label="Записи каталога">
      <thead>
        <tr>
          <SortHeader label="Идентификатор" field="id" query={query} />
          <SortHeader label="Название" field="title" query={query} />
          <SortHeader label="Критичность" field="severity" query={query} />
          <th scope="col">CVSS</th>
          <th scope="col">KEV</th>
          <th scope="col">Источники</th>
          <SortHeader label="Изменена" field="updated" query={query} />
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td>
              <button type="button" className="entry-link" aria-haspopup="dialog"
                aria-label={`Открыть ${entry.id}`}
                aria-disabled={pending}
                onClick={(event) => { if (!pending) open(entry.id, event.currentTarget); }}>
                {entry.id}
              </button>
            </td>
            <td className="entry-title">{entry.title}</td>
            <td><Badge tone={entry.severity}><span className="severity-dot" />{severityLabels[entry.severity]}</Badge></td>
            <td className="number-cell">{entry.cvss === null ? '—' : decimal.format(entry.cvss)}</td>
            <td>{entry.kev ? <Badge tone="accent">Да</Badge> : '—'}</td>
            <td className="source-cell">{entry.sources.map((source) => sourceLabels[source]).join(' · ') || '—'}</td>
            <td className="date-cell">{displayDate(entry.updatedAt)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function Pagination({ result, pending }: { result?: CatalogPageDto; pending: boolean }) {
  const { query, setPage, setPageSize } = useCatalogControls();
  const total = result?.filteredTotal ?? 0;
  const page = result?.page ?? 1;
  const pageSize = result?.pageSize ?? query.pageSize;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = first + (result?.entries.length ?? 0) - 1;
  return (
    <div className="pagination">
      <span aria-live="polite">{result ? (
        total ? `${counts.format(first)}–${counts.format(last)} из ${counts.format(total)}` : '0 записей'
      ) : '—'}</span>
      <div className="pagination-controls">
        <label className="page-size">Строк на странице
          <Select aria-label="Строк на странице" value={query.pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}>
            {[10, 20, 50].map((size) => <option value={size} key={size}>{size}</option>)}
          </Select>
        </label>
        <Button aria-label="Предыдущая страница" className="icon-button"
          aria-disabled={pending || page <= 1}
          onClick={() => { if (!pending && page > 1) setPage(page - 1); }}>
          <ChevronLeft />
        </Button>
        <span className="page-indicator" aria-label={result ? `Страница ${page} из ${pages}` : undefined}>
          {result ? `${page} / ${pages}` : '—'}
        </span>
        <Button aria-label="Следующая страница" className="icon-button"
          aria-disabled={pending || page >= pages}
          onClick={() => { if (!pending && page < pages) setPage(page + 1); }}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function DetailDrawer({ id, onDismiss }: { id: string; onDismiss: () => void }) {
  const request = useMemo(() => ({ id }), [id]);
  const [revision, setRevision] = useState(0);
  const { current } = useCatalogRequest(getCatalogDetail, request, revision, 0);
  const detail = current?.data;
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog labelId="detail-heading" onDismiss={onDismiss} drawer>
      <div className="drawer-header">
        <span className="entry-code">{id}</span>
        <h2 id="detail-heading" ref={heading} tabIndex={-1}>{detail?.entry.title ?? 'Карточка записи'}</h2>
        {detail && (
          <div className="flex flex-wrap gap-2">
            <Badge tone={detail.entry.severity}>{severityLabels[detail.entry.severity]}</Badge>
            {detail.entry.kev && <Badge tone="accent">CISA KEV</Badge>}
          </div>
        )}
      </div>
      {!current && <p className="drawer-message" role="status">Загрузка карточки…</p>}
      {current?.error && (
        <div className="drawer-message">
          <p className="error-text" role="alert">{current.error}</p>
          <Button onClick={() => { heading.current?.focus(); setRevision((value) => value + 1); }}>Повторить загрузку</Button>
        </div>
      )}
      {detail && (
        <div className="drawer-content">
          <section aria-labelledby="detail-overview">
            <h3 id="detail-overview">Описание</h3>
            <p>{detail.description}</p>
            <dl className="detail-facts">
              <div><dt>CVSS</dt><dd>{detail.entry.cvss === null ? '—' : decimal.format(detail.entry.cvss)}</dd></div>
              <div><dt>Опубликована</dt><dd>{displayDate(detail.publishedAt)}</dd></div>
              <div><dt>Изменена</dt><dd>{displayDate(detail.entry.updatedAt)}</dd></div>
            </dl>
          </section>
          <section aria-labelledby="detail-sources">
            <h3 id="detail-sources">Записи источников</h3>
            {detail.records.length === 0 && <p>Источники отсутствуют.</p>}
            <ul className="source-list">
              {detail.records.map((record) => (
                <li key={`${record.kind}:${record.reference}`}>
                  <strong>{sourceLabels[record.kind]}</strong>
                  <code>{record.reference}</code>
                  <span>Получена {displayDate(record.retrievedAt)}</span>
                  {record.cvss !== null && <span>CVSS {decimal.format(record.cvss)}</span>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Dialog>
  );
}

export function CatalogView() {
  const { query, selectedId, updateFilters, resetFilters, selectEntry } = useCatalogControls();
  const [revision, setRevision] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<{ query: CatalogQueryRequest; revision: number }>();
  const { current, previous, previousRequest } = useCatalogRequest(queryCatalog, query, revision, 150);
  const searchInput = useRef<HTMLInputElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const tableRegion = useRef<HTMLDivElement>(null);
  const detailTrigger = useRef<HTMLButtonElement>(null);
  const filtered = Boolean(query.search.trim() || query.severity || query.source || query.kev !== null);
  const data = current?.data;

  useLayoutEffect(() => {
    if (tableRegion.current) tableRegion.current.scrollTop = 0;
  }, [query]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (!selectedId && !document.querySelector('dialog[open]') && !event.isComposing
        && event.ctrlKey && !event.altKey && !event.shiftKey
        && (event.code === 'KeyF' || event.key.toLowerCase() === 'f')) {
        event.preventDefault();
        searchInput.current?.focus();
        searchInput.current?.select();
      }
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, [selectedId]);

  useEffect(() => {
    if (!data || refresh?.query !== query || refresh.revision !== revision) return;
    const show = window.setTimeout(() => setToast('Каталог перечитан из локальной базы.'), 0);
    const hide = window.setTimeout(() => setToast(null), 3000);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); setToast(null); };
  }, [data, query, refresh, revision]);

  function loadAgain() {
    if (!current) return;
    refreshButton.current?.focus();
    setRefresh({ query, revision: revision + 1 });
    setRevision(revision + 1);
  }

  function resetAndFocusSearch() {
    resetFilters();
    searchInput.current?.focus();
  }

  function openEntry(id: string, trigger: HTMLButtonElement) {
    detailTrigger.current = trigger;
    selectEntry(id);
  }

  function closeEntry() {
    selectEntry(null);
    requestAnimationFrame(() => {
      if (detailTrigger.current?.isConnected) detailTrigger.current.focus();
      else searchInput.current?.focus();
    });
  }

  return (
    <div className="workspace">
      <header className="workspace-heading">
        <div>
          <h1 tabIndex={-1}>Каталог уязвимостей</h1>
          <p>Учебные записи и их происхождение в локальной базе.</p>
        </div>
        <Button ref={refreshButton} onClick={loadAgain} aria-disabled={!current}>
          <RefreshCw aria-hidden="true" />Обновить
        </Button>
      </header>

      <Summary value={(data ?? previous)?.summary} />

      <section className="panel catalog-panel" aria-labelledby="catalog-title">
        <div className="catalog-tools">
          <div className="catalog-title">
            <h2 id="catalog-title">Записи каталога</h2>
          </div>
          <div className="search-field">
            <Search aria-hidden="true" />
            <Input ref={searchInput} type="search" aria-label="Поиск по идентификатору или названию"
              placeholder="Поиск по идентификатору или названию" value={query.search} maxLength={120}
              onChange={(event) => updateFilters({ search: event.target.value })} />
            <kbd>Ctrl F</kbd>
          </div>
          <div className="filter-row" aria-label="Фильтры" role="group">
            <SlidersHorizontal className="filter-icon" aria-hidden="true" />
            <Select aria-label="Критичность" value={query.severity ?? ''}
              onChange={(event) => updateFilters({ severity: (event.target.value || null) as Severity | null })}>
              <option value="">Любая критичность</option>
              {Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select aria-label="Источник" value={query.source ?? ''}
              onChange={(event) => updateFilters({ source: (event.target.value || null) as SourceKind | null })}>
              <option value="">Все источники</option>
              {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select aria-label="CISA KEV" value={query.kev === null ? '' : String(query.kev)}
              onChange={(event) => updateFilters({ kev: event.target.value === '' ? null : event.target.value === 'true' })}>
              <option value="">Все записи KEV</option>
              <option value="true">В CISA KEV</option>
              <option value="false">Вне CISA KEV</option>
            </Select>
            <Button variant="ghost" onClick={resetAndFocusSearch} disabled={!filtered}><X aria-hidden="true" />Сбросить</Button>
          </div>
        </div>

        <div ref={tableRegion} className="table-region" tabIndex={0} role="region" aria-label="Таблица записей">
          {(data?.entries.length || previous?.entries.length) ? (
            <div hidden={Boolean(data && !data.entries.length) || Boolean(current?.error)} aria-busy={!current}>
              <CatalogTable entries={data?.entries ?? previous?.entries ?? []} query={previousRequest ?? query}
                open={openEntry} pending={!data} />
            </div>
          ) : null}
          {!current && <p className={previous?.entries.length ? 'loading-bar' : 'empty-state'} role="status">Загрузка каталога…</p>}
          {current?.error && (
            <div className="empty-state">
              <CircleAlert aria-hidden="true" />
              <strong>Не удалось загрузить каталог</strong>
              <p className="error-text" role="alert">{current.error}</p>
              <Button onClick={loadAgain}>Повторить загрузку</Button>
            </div>
          )}
          {data?.summary.total === 0 && (
            <div className="empty-state">
              <Database aria-hidden="true" /><strong>Каталог пуст</strong>
              <p>В локальной базе пока нет записей.</p>
            </div>
          )}
          {data && data.summary.total > 0 && data.filteredTotal === 0 && (
            <div className="empty-state">
              <Filter aria-hidden="true" /><strong>Ничего не найдено</strong>
              <p>Измените запрос или сбросьте фильтры.</p>
              <Button onClick={resetAndFocusSearch}>Сбросить фильтры</Button>
            </div>
          )}
        </div>
        <Pagination result={data ?? previous} pending={!data} />
      </section>
      <Toast message={toast} />
      {selectedId && <DetailDrawer id={selectedId} onDismiss={closeEntry} />}
    </div>
  );
}
