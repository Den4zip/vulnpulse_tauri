use rusqlite::Connection;
use sha2::{Digest, Sha256};

use crate::domain::{DemoEntry, DemoLimit};

const INITIAL_MIGRATION: &str = include_str!("../migrations/demo/001_create_demo_catalog.sql");

pub(crate) struct DemoRepository(Connection);

impl DemoRepository {
    pub fn in_memory() -> rusqlite::Result<Self> {
        Self::migrate(Connection::open_in_memory()?)
    }

    fn migrate(mut connection: Connection) -> rusqlite::Result<Self> {
        use rusqlite::{OptionalExtension, TransactionBehavior};

        let checksum = format!("{:x}", Sha256::digest(INITIAL_MIGRATION.as_bytes()));
        let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS demo_migrations (
                version INTEGER PRIMARY KEY,
                checksum TEXT NOT NULL
            ) STRICT;",
        )?;

        let applied = tx
            .query_row(
                "SELECT version, checksum FROM demo_migrations ORDER BY version DESC LIMIT 1",
                [],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
            )
            .optional()?;

        match applied {
            None => {
                tx.execute_batch(INITIAL_MIGRATION)?;
                tx.execute(
                    "INSERT INTO demo_migrations (version, checksum) VALUES (1, ?1)",
                    [&checksum],
                )?;
            }
            Some((1, applied_checksum)) if applied_checksum == checksum => {}
            Some(_) => return Err(rusqlite::Error::InvalidQuery),
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
}

#[cfg(test)]
mod tests {
    use super::*;

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
