use crate::{
    contracts::{
        CatalogDetailDto, CatalogEntryDto, CatalogPageDto, CatalogSummaryDto, DemoEntryDto,
        ListDemoCatalogResponse, SourceRecordDto,
    },
    domain::{CatalogEntry, CatalogQuery, DemoLimit, SourceKind},
    infrastructure::DemoRepository,
};

#[derive(Default)]
pub(crate) struct DemoCatalog {
    repository: Option<DemoRepository>,
}

pub(crate) struct CatalogUnavailable;

impl DemoCatalog {
    fn repository(&mut self) -> Result<&DemoRepository, CatalogUnavailable> {
        if self.repository.is_none() {
            self.repository = Some(DemoRepository::in_memory().map_err(|_| CatalogUnavailable)?);
        }
        self.repository.as_ref().ok_or(CatalogUnavailable)
    }

    pub fn list(
        &mut self,
        limit: DemoLimit,
    ) -> Result<ListDemoCatalogResponse, CatalogUnavailable> {
        let entries = self
            .repository()?
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

    pub fn query(&mut self, query: CatalogQuery) -> Result<CatalogPageDto, CatalogUnavailable> {
        let page = self
            .repository()?
            .query(&query)
            .map_err(|_| CatalogUnavailable)?;
        Ok(CatalogPageDto {
            entries: page.entries.into_iter().map(entry_dto).collect(),
            summary: CatalogSummaryDto {
                total: page.summary.total,
                critical: page.summary.critical,
                high: page.summary.high,
                kev: page.summary.kev,
            },
            filtered_total: page.filtered_total,
            page: page.page,
            page_size: page.page_size,
        })
    }

    pub fn detail(&mut self, id: &str) -> Result<Option<CatalogDetailDto>, CatalogUnavailable> {
        let detail = self
            .repository()?
            .detail(id)
            .map_err(|_| CatalogUnavailable)?;
        Ok(detail.map(|detail| CatalogDetailDto {
            entry: entry_dto(detail.entry),
            description: detail.description,
            published_at: detail.published_at,
            records: detail
                .records
                .into_iter()
                .map(|record| SourceRecordDto {
                    kind: record.kind,
                    reference: record.reference,
                    retrieved_at: record.retrieved_at,
                    cvss: record.cvss.map(cvss_score),
                })
                .collect(),
        }))
    }
}

fn entry_dto(entry: CatalogEntry) -> CatalogEntryDto {
    CatalogEntryDto {
        id: entry.id,
        title: entry.title,
        severity: entry.severity,
        cvss: entry.cvss.map(cvss_score),
        kev: entry.sources.contains(&SourceKind::CisaKev),
        updated_at: entry.updated_at,
        sources: entry.sources,
    }
}

fn cvss_score(tenths: u32) -> f64 {
    f64::from(tenths) / 10.0
}
