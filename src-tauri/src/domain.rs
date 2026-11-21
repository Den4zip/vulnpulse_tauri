use serde::{Deserialize, Serialize};

#[cfg(test)]
use ts_rs::TS;

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(TS))]
#[repr(u32)]
pub(crate) enum Severity {
    Unknown,
    None,
    Low,
    Medium,
    High,
    Critical,
}

impl Severity {
    pub const BY_RANK: [Self; 6] = [
        Self::Unknown,
        Self::None,
        Self::Low,
        Self::Medium,
        Self::High,
        Self::Critical,
    ];
}

#[derive(Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(TS))]
pub(crate) enum SourceKind {
    Nvd,
    Osv,
    CisaKev,
    Fstec,
}

impl SourceKind {
    pub const ALL: [Self; 4] = [Self::Nvd, Self::Osv, Self::CisaKev, Self::Fstec];

    pub fn key(self) -> &'static str {
        match self {
            Self::Nvd => "nvd",
            Self::Osv => "osv",
            Self::CisaKev => "cisa_kev",
            Self::Fstec => "fstec",
        }
    }
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(TS))]
pub(crate) enum CatalogSort {
    Id,
    Title,
    Severity,
    Updated,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(TS))]
pub(crate) enum SortDirection {
    Asc,
    Desc,
}

pub(crate) struct CatalogQuery {
    pub search: String,
    pub severity: Option<Severity>,
    pub source: Option<SourceKind>,
    pub kev: Option<bool>,
    pub sort_by: CatalogSort,
    pub direction: SortDirection,
    pub page: u32,
    pub page_size: u32,
}

pub(crate) struct CatalogEntry {
    pub id: String,
    pub title: String,
    pub severity: Severity,
    pub cvss: Option<u32>,
    pub updated_at: Option<String>,
    pub sources: Vec<SourceKind>,
}

pub(crate) struct CatalogSummary {
    pub total: u32,
    pub critical: u32,
    pub high: u32,
    pub kev: u32,
}

pub(crate) struct CatalogPage {
    pub entries: Vec<CatalogEntry>,
    pub summary: CatalogSummary,
    pub filtered_total: u32,
    pub page: u32,
    pub page_size: u32,
}

pub(crate) struct SourceRecord {
    pub kind: SourceKind,
    pub reference: String,
    pub retrieved_at: String,
    pub cvss: Option<u32>,
}

pub(crate) struct CatalogDetail {
    pub entry: CatalogEntry,
    pub description: String,
    pub published_at: Option<String>,
    pub records: Vec<SourceRecord>,
}

pub(crate) struct DemoEntry {
    pub id: String,
    pub title: String,
}

pub(crate) struct DemoLimit(u32);

impl DemoLimit {
    pub fn new(value: u32) -> Option<Self> {
        (1..=20).contains(&value).then_some(Self(value))
    }

    pub fn get(&self) -> u32 {
        self.0
    }
}

#[cfg(test)]
mod tests {
    use super::DemoLimit;

    #[test]
    fn demo_limit_checks_both_bounds() {
        for limit in [1, 20] {
            assert_eq!(DemoLimit::new(limit).map(|value| value.get()), Some(limit));
        }
        for limit in [0, 21, u32::MAX] {
            assert!(DemoLimit::new(limit).is_none());
        }
    }
}
