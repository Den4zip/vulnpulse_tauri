use std::sync::{Arc, Mutex};

use tauri::State;
use tokio::sync::Semaphore;

use crate::{
    application::DemoCatalog,
    contracts::{CommandError, CommandErrorCode, ListDemoCatalogRequest, ListDemoCatalogResponse},
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
    let permit = Arc::clone(&state.slots)
        .try_acquire_owned()
        .map_err(|_| CommandErrorCode::Busy)?;
    let catalog = Arc::clone(&state.catalog);

    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        catalog
            .lock()
            .map_err(|_| CommandErrorCode::Unavailable)?
            .list(limit)
            .map_err(|_| CommandErrorCode::Unavailable.into())
    })
    .await
    .map_err(|_| CommandErrorCode::Unavailable)?
}
