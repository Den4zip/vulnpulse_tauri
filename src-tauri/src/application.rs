use crate::{
    contracts::{DemoEntryDto, ListDemoCatalogResponse},
    domain::DemoLimit,
    infrastructure::DemoRepository,
};

#[derive(Default)]
pub(crate) struct DemoCatalog {
    repository: Option<DemoRepository>,
}

pub(crate) struct CatalogUnavailable;

impl DemoCatalog {
    pub fn list(
        &mut self,
        limit: DemoLimit,
    ) -> Result<ListDemoCatalogResponse, CatalogUnavailable> {
        if self.repository.is_none() {
            self.repository = Some(DemoRepository::in_memory().map_err(|_| CatalogUnavailable)?);
        }
        let entries = self
            .repository
            .as_ref()
            .expect("demo repository initialized")
            .list(limit)
            .map_err(|_| CatalogUnavailable)?
            .into_iter()
            .map(|entry| DemoEntryDto {
                id: entry.id,
                title: entry.title,
            })
            .collect();
        Ok(ListDemoCatalogResponse { entries })
    }
}
