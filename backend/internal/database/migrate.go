package database

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const advisoryLockKey = 715267358 // arbitrary constant: "concord-migrations"

var createTablePattern = regexp.MustCompile(`(?i)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)`)

type migrationFile struct {
	version  int
	fileName string
	upSQL    string
}

// Migrate applies pending SQL migrations at startup. It follows the same
// schema_migrations contract as golang-migrate (single row tracking the
// current version), so databases migrated manually or via the CLI are
// adopted seamlessly.
func Migrate(db *pgxpool.Pool, dir string) error {
	ctx := context.Background()

	if _, err := os.Stat(dir); err != nil {
		return fmt.Errorf("migrations directory %q not found: %w", dir, err)
	}

	// Serialize concurrent instances (e.g. multiple app replicas in prod).
	if _, err := db.Exec(ctx, `SELECT pg_advisory_lock($1)`, advisoryLockKey); err != nil {
		return fmt.Errorf("failed to acquire migration lock: %w", err)
	}
	defer db.Exec(ctx, `SELECT pg_advisory_unlock($1)`, advisoryLockKey)

	if _, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version BIGINT NOT NULL,
			dirty   BOOLEAN NOT NULL DEFAULT FALSE
		)
	`); err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	migrations, err := loadMigrations(dir)
	if err != nil {
		return err
	}

	current, err := currentVersion(ctx, db)
	if err != nil {
		return err
	}

	for _, migration := range migrations {
		if migration.version <= current {
			continue
		}

		applied, err := applyIfNeeded(ctx, db, migration)
		if err != nil {
			return err
		}

		current = migration.version
		if err := setCurrentVersion(ctx, db, current); err != nil {
			return err
		}

		if applied {
			fmt.Printf("applied migration %06d\n", migration.version)
		} else {
			fmt.Printf("baselined migration %06d (already applied)\n", migration.version)
		}
	}

	return nil
}

// applyIfNeeded executes the migration, unless it is already applied:
// either its table already exists (manual/CLI migration) or the database
// reports an already-applied error. Returns whether the SQL actually ran.
func applyIfNeeded(ctx context.Context, db *pgxpool.Pool, migration migrationFile) (bool, error) {
	// CREATE TABLE migrations: check if the table already exists.
	if tableName := extractTableName(migration.upSQL); tableName != "" {
		exists, err := tableExists(ctx, db, tableName)
		if err != nil {
			return false, err
		}
		if exists {
			return false, nil
		}
		if err := applyMigration(ctx, db, migration.version, migration.upSQL); err != nil {
			return false, err
		}
		return true, nil
	}

	// Other statements (ALTER TABLE etc.): run them and treat
	// "already exists/already present" errors as baseline.
	if err := applyMigration(ctx, db, migration.version, migration.upSQL); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && (pgErr.Code == "42P07" || pgErr.Code == "42701") {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func loadMigrations(dir string) ([]migrationFile, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var migrations []migrationFile
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".up.sql") {
			continue
		}
		version, err := parseVersion(entry.Name())
		if err != nil {
			return nil, err
		}
		upSQL, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("failed to read migration %s: %w", entry.Name(), err)
		}
		migrations = append(migrations, migrationFile{
			version:  version,
			fileName: entry.Name(),
			upSQL:    string(upSQL),
		})
	}

	sort.Slice(migrations, func(i, j int) bool { return migrations[i].version < migrations[j].version })

	return migrations, nil
}

func parseVersion(fileName string) (int, error) {
	prefix := fileName
	if idx := strings.Index(prefix, "_"); idx != -1 {
		prefix = prefix[:idx]
	}
	version, err := strconv.Atoi(prefix)
	if err != nil {
		return 0, fmt.Errorf("invalid migration filename %q: version prefix is not a number", fileName)
	}
	return version, nil
}

func extractTableName(upSQL string) string {
	match := createTablePattern.FindStringSubmatch(upSQL)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

func tableExists(ctx context.Context, db *pgxpool.Pool, tableName string) (bool, error) {
	var exists bool
	err := db.QueryRow(
		ctx,
		`SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = current_schema() AND table_name = $1
		)`,
		tableName,
	).Scan(&exists)
	return exists, err
}

func currentVersion(ctx context.Context, db *pgxpool.Pool) (int, error) {
	var version int
	err := db.QueryRow(ctx, `SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&version)
	if err != nil {
		return 0, fmt.Errorf("failed to query current migration version: %w", err)
	}
	return version, nil
}

func setCurrentVersion(ctx context.Context, db *pgxpool.Pool, version int) error {
	tag, err := db.Exec(ctx, `UPDATE schema_migrations SET version = $1, dirty = FALSE`, version)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		_, err = db.Exec(ctx, `INSERT INTO schema_migrations (version, dirty) VALUES ($1, FALSE)`, version)
	}
	return err
}

func applyMigration(ctx context.Context, db *pgxpool.Pool, version int, upSQL string) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, upSQL); err != nil {
		return err
	}

	return tx.Commit(ctx)
}