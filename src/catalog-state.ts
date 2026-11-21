import { create } from 'zustand';
import type { CatalogQueryRequest, CatalogSort } from './generated/contracts';

const defaultFilters = { search: '', severity: null, source: null, kev: null } as const;
type Filters = Pick<CatalogQueryRequest, keyof typeof defaultFilters>;

type CatalogControls = {
  query: CatalogQueryRequest;
  selectedId: string | null;
  updateFilters: (filters: Partial<Filters>) => void;
  resetFilters: () => void;
  setSort: (sortBy: CatalogSort) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  selectEntry: (id: string | null) => void;
};

export const useCatalogControls = create<CatalogControls>()((set) => ({
  query: { ...defaultFilters, sortBy: 'updated', direction: 'desc', page: 1, pageSize: 10 },
  selectedId: null,
  updateFilters: (filters) => set(({ query }) => ({ query: { ...query, ...filters, page: 1 } })),
  resetFilters: () => set(({ query }) => ({ query: { ...query, ...defaultFilters, page: 1 } })),
  setSort: (sortBy) => set(({ query }) => ({
    query: {
      ...query, sortBy, page: 1,
      direction: query.sortBy === sortBy
        ? (query.direction === 'asc' ? 'desc' : 'asc')
        : (sortBy === 'updated' || sortBy === 'severity' ? 'desc' : 'asc'),
    },
  })),
  setPage: (page) => set(({ query }) => ({ query: { ...query, page } })),
  setPageSize: (pageSize) => set(({ query }) => ({ query: { ...query, pageSize, page: 1 } })),
  selectEntry: (selectedId) => set({ selectedId }),
}));
