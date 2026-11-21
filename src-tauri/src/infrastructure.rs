use rusqlite::{
    functions::FunctionFlags, params, Connection, OptionalExtension, Row, TransactionBehavior,
};
use sha2::{Digest, Sha256};

use crate::domain::{
    CatalogDetail, CatalogEntry, CatalogPage, CatalogQuery, CatalogSort, CatalogSummary, DemoEntry,
    DemoLimit, Severity, SortDirection, SourceKind, SourceRecord,
};

const MIGRATIONS: [&str; 2] = [
    include_str!("../migrations/demo/001_create_demo_catalog.sql"),
    include_str!("../migrations/demo/002_create_catalog.sql"),
];

const KEV: &str = "EXISTS (SELECT 1 FROM catalog_source_records s
    WHERE s.entry_id = e.id AND s.kind = 'cisa_kev')";
const ENTRY_COLUMNS: &str = "e.id, e.title, e.severity,
    (SELECT max(s.cvss) FROM catalog_source_records s WHERE s.entry_id = e.id), e.updated_at,
    (SELECT group_concat(DISTINCT s.kind) FROM catalog_source_records s WHERE s.entry_id = e.id)";

pub(crate) struct DemoRepository(Connection);

impl DemoRepository {
    pub fn in_memory() -> rusqlite::Result<Self> {
        Self::migrate(Connection::open_in_memory()?)
    }

    fn migrate(mut connection: Connection) -> rusqlite::Result<Self> {
        connection.pragma_update(None, "foreign_keys", true)?;
        connection.create_scalar_function(
            "catalog_fold",
            1,
            FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC,
            |context| Ok(context.get::<String>(0)?.to_lowercase()),
        )?;

        let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS demo_migrations (
                version INTEGER PRIMARY KEY,
                checksum TEXT NOT NULL
            ) STRICT;",
        )?;

        let applied = {
            let mut statement =
                tx.prepare("SELECT version, checksum FROM demo_migrations ORDER BY version")?;
            let rows = statement.query_map([], |row| {
                Ok((row.get::<_, usize>(0)?, row.get::<_, String>(1)?))
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>()?
        };
        if applied.len() > MIGRATIONS.len() {
            return Err(rusqlite::Error::InvalidQuery);
        }
        for (index, migration) in MIGRATIONS.iter().enumerate() {
            let version = index + 1;
            let checksum = format!("{:x}", Sha256::digest(migration.as_bytes()));
            match applied.get(index) {
                Some((saved_version, saved_checksum))
                    if *saved_version == version && *saved_checksum == checksum => {}
                Some(_) => return Err(rusqlite::Error::InvalidQuery),
                None => {
                    tx.execute_batch(migration)?;
                    tx.execute(
                        "INSERT INTO demo_migrations (version, checksum) VALUES (?1, ?2)",
                        params![version, checksum],
                    )?;
                }
            }
        }

        tx.commit()?;
        Ok(Self(connection))
    }

    pub fn list(&self, limit: DemoLimit) -> rusqlite::Result<Vec<DemoEntry>> {
        let mut statement = self
            .0
            .prepare_cached("SELECT id, title FROM demo_entries ORDER BY id LIMIT ?1")?;
        let entries = statement.query_map([limit.get()], |row| {
            Ok(DemoEntry {
                id: row.get(0)?,
                title: row.get(1)?,
            })
        })?;
        entries.collect()
    }

    pub fn query(&self, query: &CatalogQuery) -> rusqlite::Result<CatalogPage> {
        let summary = self.0.query_row(
            &format!("SELECT count(*), count(*) FILTER (WHERE severity = ?1),
             count(*) FILTER (WHERE severity = ?2), count(*) FILTER (WHERE {KEV}) FROM catalog_entries e"),
            params![Severity::Critical as u32, Severity::High as u32],
            |row| Ok(CatalogSummary {
                total: row.get(0)?,
                critical: row.get(1)?,
                high: row.get(2)?,
                kev: row.get(3)?,
            }),
        )?;
        let filters = format!(
            "WHERE (?1 = '' OR instr(catalog_fold(e.id || ' ' || e.title), ?1) > 0)
            AND (?2 IS NULL OR e.severity = ?2)
            AND (?3 IS NULL OR EXISTS (
                SELECT 1 FROM catalog_source_records s WHERE s.entry_id = e.id AND s.kind = ?3
            ))
            AND (?4 IS NULL OR {KEV} = ?4)"
        );
        let severity = query.severity.map(|value| value as u32);
        let source = query.source.map(SourceKind::key);
        let filtered_total: u32 = self.0.query_row(
            &format!("SELECT count(*) FROM catalog_entries e {filters}"),
            params![query.search, severity, source, query.kev],
            |row| row.get(0),
        )?;
        let page = query
            .page
            .min(filtered_total.div_ceil(query.page_size).max(1));
        let order = match query.sort_by {
            CatalogSort::Id => "e.id",
            CatalogSort::Title => "catalog_fold(e.title)",
            CatalogSort::Severity => "NULLIF(e.severity, 0)",
            CatalogSort::Updated => "e.updated_at",
        };
        let direction = match query.direction {
            SortDirection::Asc => "ASC",
            SortDirection::Desc => "DESC",
        };
        let mut statement = self.0.prepare_cached(&format!(
            "SELECT {ENTRY_COLUMNS} FROM catalog_entries e {filters}
             ORDER BY {order} {direction} NULLS LAST, e.id ASC LIMIT ?5 OFFSET ?6"
        ))?;
        let entries = statement
            .query_map(
                params![
                    query.search,
                    severity,
                    source,
                    query.kev,
                    query.page_size,
                    (page - 1) * query.page_size
                ],
                read_entry,
            )?
            .collect::<rusqlite::Result<_>>()?;
        Ok(CatalogPage {
            entries,
            summary,
            filtered_total,
            page,
            page_size: query.page_size,
        })
    }

    pub fn detail(&self, id: &str) -> rusqlite::Result<Option<CatalogDetail>> {
        let item = self.0.query_row(
            &format!("SELECT {ENTRY_COLUMNS}, e.description, e.published_at FROM catalog_entries e WHERE e.id = ?1"),
            [id],
            |row| Ok((read_entry(row)?, row.get(6)?, row.get(7)?)),
        ).optional()?;
        let Some((entry, description, published_at)) = item else {
            return Ok(None);
        };
        let mut statement = self.0.prepare_cached(
            "SELECT kind, reference, retrieved_at, cvss FROM catalog_source_records
             WHERE entry_id = ?1 ORDER BY kind, reference",
        )?;
        let records = statement
            .query_map([id], |row| {
                let key: String = row.get(0)?;
                let kind = SourceKind::ALL
                    .into_iter()
                    .find(|source| source.key() == key)
                    .ok_or(rusqlite::Error::InvalidQuery)?;
                Ok(SourceRecord {
                    kind,
                    reference: row.get(1)?,
                    retrieved_at: row.get(2)?,
                    cvss: row.get(3)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(Some(CatalogDetail {
            entry,
            description,
            published_at,
            records,
        }))
    }
}

fn read_entry(row: &Row<'_>) -> rusqlite::Result<CatalogEntry> {
    let rank: usize = row.get(2)?;
    let kinds: Option<String> = row.get(5)?;
    let kinds = kinds.as_deref().unwrap_or_default();
    Ok(CatalogEntry {
        id: row.get(0)?,
        title: row.get(1)?,
        severity: *Severity::BY_RANK
            .get(rank)
            .ok_or(rusqlite::Error::InvalidQuery)?,
        cvss: row.get(3)?,
        updated_at: row.get(4)?,
        sources: SourceKind::ALL
            .into_iter()
            .filter(|source| kinds.split(',').any(|kind| kind == source.key()))
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_pages_cyrillic_search_with_stable_ties_and_source_provenance() {
        let repo = DemoRepository::in_memory().unwrap();
        let mut query = CatalogQuery {
            search: "шлюз".into(),
            severity: None,
            source: Some(SourceKind::Osv),
            kev: None,
            sort_by: CatalogSort::Updated,
            direction: SortDirection::Desc,
            page: 1,
            page_size: 1,
        };
        let first = repo.query(&query).unwrap();
        assert_eq!(first.summary.total, 24);
        assert_eq!(first.filtered_total, 2);
        assert_eq!(first.entries[0].id, "DEMO-003");

        query.page = 2;
        let second = repo.query(&query).unwrap();
        assert_eq!(second.entries[0].id, "DEMO-004");
        let detail = repo.detail("DEMO-003").unwrap().unwrap();
        assert_eq!(detail.records.len(), 3);
        assert_eq!(detail.entry.cvss, Some(98));
        let scored = detail
            .records
            .iter()
            .find(|record| record.cvss.is_some())
            .unwrap();
        assert_eq!(scored.reference, "DEMO-NVD-003");
        assert_eq!(scored.cvss, Some(98));
        assert!(detail
            .records
            .iter()
            .any(|record| record.kind == SourceKind::CisaKev));

        query.search = "%".into();
        let empty = repo.query(&query).unwrap();
        assert_eq!(empty.summary.total, 24);
        assert_eq!(empty.filtered_total, 0);
        assert!(empty.entries.is_empty());
    }

    #[test]
    fn migrated_catalog_reads_sorted_and_limited_rows() {
        let repo = DemoRepository::in_memory().unwrap();
        let entries = repo.list(DemoLimit::new(1).unwrap()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, "DEMO-001");
    }

    #[test]
    fn reopening_preserves_rows_and_verifies_checksum() {
        let folder = tempfile::tempdir().unwrap();
        let database = folder.path().join("demo.sqlite3");
        let repo = DemoRepository::migrate(Connection::open(&database).unwrap()).unwrap();
        assert_eq!(repo.list(DemoLimit::new(20).unwrap()).unwrap().len(), 2);
        drop(repo);

        let repo = DemoRepository::migrate(Connection::open(&database).unwrap()).unwrap();
        assert_eq!(repo.list(DemoLimit::new(20).unwrap()).unwrap().len(), 2);
        repo.0
            .execute("UPDATE demo_migrations SET checksum = 'mismatch'", [])
            .unwrap();
        drop(repo);

        assert!(DemoRepository::migrate(Connection::open(database).unwrap()).is_err());
    }

    #[test]
    fn upgrades_the_original_catalog_without_losing_legacy_rows() {
        let mut connection = Connection::open_in_memory().unwrap();
        let previous = connection.transaction().unwrap();
        previous.execute_batch(MIGRATIONS[0]).unwrap();
        previous.execute_batch(
            "CREATE TABLE demo_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL) STRICT",
        ).unwrap();
        let checksum = format!("{:x}", Sha256::digest(MIGRATIONS[0].as_bytes()));
        previous
            .execute("INSERT INTO demo_migrations VALUES (1, ?1)", [checksum])
            .unwrap();
        previous.commit().unwrap();

        let repo = DemoRepository::migrate(connection).unwrap();
        let legacy = repo.list(DemoLimit::new(20).unwrap()).unwrap();
        assert_eq!(legacy.len(), 2);
        let migrated = repo.detail("DEMO-001").unwrap().unwrap();
        assert_eq!(migrated.entry.title, legacy[0].title);
        assert!(repo.detail("DEMO-024").unwrap().is_some());
        assert!(repo.detail("DEMO-999").unwrap().is_none());
    }

    #[test]
    fn query_distinguishes_an_empty_catalog_from_a_filter_miss() {
        let repo = DemoRepository::in_memory().unwrap();
        repo.0
            .execute("DELETE FROM catalog_source_records", [])
            .unwrap();
        repo.0.execute("DELETE FROM catalog_entries", []).unwrap();
        let query = CatalogQuery {
            search: String::new(),
            severity: None,
            source: None,
            kev: None,
            sort_by: CatalogSort::Severity,
            direction: SortDirection::Asc,
            page: u32::MAX,
            page_size: 100,
        };
        let empty = repo.query(&query).unwrap();
        assert_eq!(empty.summary.total, 0);
        assert_eq!(empty.filtered_total, 0);
        assert_eq!(empty.page, 1);
        assert!(empty.entries.is_empty());
    }

    #[test]
    fn failed_migration_rolls_back_and_can_be_retried() {
        let folder = tempfile::tempdir().unwrap();
        let database = folder.path().join("demo.sqlite3");
        let connection = Connection::open(&database).unwrap();
        connection
            .execute("CREATE TABLE demo_entries (id TEXT)", [])
            .unwrap();
        assert!(DemoRepository::migrate(connection).is_err());

        let connection = Connection::open(database).unwrap();
        // Creating this table again proves the failed migration rolled it back.
        connection.execute("CREATE TABLE demo_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL)", []).unwrap();
        connection.execute("DROP TABLE demo_entries", []).unwrap();
        let repo = DemoRepository::migrate(connection).unwrap();
        assert_eq!(repo.list(DemoLimit::new(20).unwrap()).unwrap().len(), 2);
    }
}
