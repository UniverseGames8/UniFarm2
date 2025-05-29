# Neon DB Unified Setup for UniFarm

This guide explains how to use the unified Neon DB configuration for UniFarm, which includes automatic database partitioning.

## Background

UniFarm requires a PostgreSQL database and supports two configurations:
1. Replit's native PostgreSQL (for development)
2. Neon DB (for production)

This unified setup ensures that Neon DB is always prioritized over Replit PostgreSQL, regardless of the environment variables in the `.replit` file, providing a consistent database experience across environments.

## Features

- **Forced Neon DB Usage**: Always uses Neon DB regardless of `.replit` file settings
- **Automatic Partitioning**: Handles the partitioning of the `transactions` table automatically
- **Partition Maintenance**: Creates partitions for future dates on startup
- **Error Resilience**: Gracefully handles errors without crashing the application

## Usage

### Quick Start

To launch UniFarm with Neon DB and automatic partitioning:

```bash
node start-unified.cjs
```

This script will:
1. Force Neon DB usage by setting environment variables
2. Check database connection
3. Verify/create table partitioning
4. Launch the application

### Checking Partition Status

To check the current status of partitioning:

```bash
node check-partition-status.cjs
```

### Manual Partitioning

If for any reason you need to manually create partitioning:

```bash
node create-partition-quick.cjs
```

## Configuration Details

### Environment Variables

The unified setup sets the following environment variables:

```
DATABASE_PROVIDER=neon
FORCE_NEON_DB=true
DISABLE_REPLIT_DB=true
OVERRIDE_DB_PROVIDER=neon
```

### Partitioning Design

The `transactions` table uses range partitioning by `created_at` date with:
- A default partition for historical data
- Daily partitions for the current day and the next 6 days
- A future partition for data beyond the 7-day window

This design optimizes query performance for recent transactions while maintaining good performance for historical queries.

### Directory Structure

- `start-unified.cjs` - Main startup script
- `check-partition-status.cjs` - Tool to check partitioning status
- `create-partition-quick.cjs` - Tool to manually create partitioning
- `server/db.ts` - Core database module with enhanced partitioning support

## Integration with Replit

When using Replit's Run button, create a new Run configuration that executes:

```
node start-unified.cjs
```

## Troubleshooting

### Database Connection Issues

If you encounter database connection issues:

1. Verify your `DATABASE_URL` environment variable is correctly set
2. Check network connectivity to Neon DB
3. Verify database credentials

### Partitioning Issues

If partitioning fails:

1. Run `node check-partition-status.cjs` to verify the status
2. If needed, run `node create-partition-quick.cjs` to recreate partitioning

If issues persist, check the Neon DB dashboard for database size limits or connection issues.