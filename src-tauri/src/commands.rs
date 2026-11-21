use std::sync::{Arc, Mutex};

use tauri::State;
use tokio::sync::Semaphore;

use crate::{
    application::DemoCatalog,
    contracts::{
        CatalogDetailDto, CatalogDetailRequest, CatalogPageDto, CatalogQueryRequest, CommandError,
        CommandErrorCode, ListDemoCatalogRequest, ListDemoCatalogResponse,
    },
    domain::DemoLimit,
};

pub(crate) struct DemoState {
    catalog: Arc<Mutex<DemoCatalog>>,
    slots: Arc<Semaphore>,
}

impl Default for DemoState {
    fn default() -> Self {
        Self {
            catalog: Arc::default(),
            slots: Arc::new(Semaphore::new(1)),
        }
    }
}

#[tauri::command]
pub(crate) async fn list_demo_catalog(
    request: ListDemoCatalogRequest,
    state: State<'_, DemoState>,
) -> Result<ListDemoCatalogResponse, CommandError> {
    let limit = DemoLimit::new(request.limit).ok_or(CommandErrorCode::InvalidRequest)?;
    with_catalog(&state, move |catalog| {
        catalog
            .list(limit)
            .map_err(|_| CommandErrorCode::Unavailable)
    })
    .await
}

#[tauri::command]
pub(crate) async fn query_catalog(
    request: CatalogQueryRequest,
    state: State<'_, DemoState>,
) -> Result<CatalogPageDto, CommandError> {
    let query = request.try_into()?;
    with_catalog(&state, move |catalog| {
        catalog
            .query(query)
            .map_err(|_| CommandErrorCode::Unavailable)
    })
    .await
}

#[tauri::command]
pub(crate) async fn get_catalog_detail(
    request: CatalogDetailRequest,
    state: State<'_, DemoState>,
) -> Result<CatalogDetailDto, CommandError> {
    let id = request.id;
    if id.is_empty()
        || id.len() > 64
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
    {
        return Err(CommandErrorCode::InvalidRequest.into());
    }
    with_catalog(&state, move |catalog| {
        catalog
            .detail(&id)
            .map_err(|_| CommandErrorCode::Unavailable)?
            .ok_or(CommandErrorCode::NotFound)
    })
    .await
}

async fn with_catalog<T: Send + 'static>(
    state: &DemoState,
    operation: impl FnOnce(&mut DemoCatalog) -> Result<T, CommandErrorCode> + Send + 'static,
) -> Result<T, CommandError> {
    let permit = Arc::clone(&state.slots)
        .try_acquire_owned()
        .map_err(|_| CommandErrorCode::Busy)?;
    let catalog = Arc::clone(&state.catalog);

    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        let mut catalog = catalog.lock().map_err(|_| CommandErrorCode::Unavailable)?;
        operation(&mut catalog).map_err(CommandError::from)
    })
    .await
    .map_err(|_| CommandErrorCode::Unavailable)?
}
