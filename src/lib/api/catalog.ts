import { invoke } from '@tauri-apps/api/core';
import type { ListDemoCatalogRequest, ListDemoCatalogResponse } from '../../generated/contracts';

export function listDemoCatalog(request: ListDemoCatalogRequest): Promise<ListDemoCatalogResponse> {
  return invoke<ListDemoCatalogResponse>('list_demo_catalog', { request });
}
