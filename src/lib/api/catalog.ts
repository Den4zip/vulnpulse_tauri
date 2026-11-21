import { invoke } from '@tauri-apps/api/core';
import type {
  CatalogDetailDto, CatalogDetailRequest, CatalogPageDto, CatalogQueryRequest,
} from '../../generated/contracts';

export function queryCatalog(request: CatalogQueryRequest): Promise<CatalogPageDto> {
  return invoke<CatalogPageDto>('query_catalog', { request });
}

export function getCatalogDetail(request: CatalogDetailRequest): Promise<CatalogDetailDto> {
  return invoke<CatalogDetailDto>('get_catalog_detail', { request });
}
