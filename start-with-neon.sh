#!/bin/bash

# Set environment variables for Neon DB
export FORCE_NEON_DB=true
export DISABLE_REPLIT_DB=true
export OVERRIDE_DB_PROVIDER=neon
export PGSSLMODE=require

# Output startup message
echo "🔄 Starting UniFarm with Neon DB configuration..."
echo "✓ SSL Mode: require"
echo "✓ Database Provider: Neon DB (forced)"

# Start the server using tsx (TypeScript execution)
NODE_ENV=development tsx server/index.ts