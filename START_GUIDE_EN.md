# UniFarm - Startup and Configuration Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Detailed Configuration](#detailed-configuration)
   - [Environment Setup](#environment-setup)
   - [Database](#database)
   - [Telegram Integration](#telegram-integration)
3. [Health Check](#health-check)
4. [Troubleshooting](#troubleshooting)

## Quick Start

For a quick start in Replit:

1. Press the "Run" button in Replit
2. The server will automatically start via the `start.cjs` script
3. After loading, the application will be available at the Replit Preview URL

## Detailed Configuration

### Environment Setup

The application uses the following environment variables:

```
APP_URL=https://<your-replit-url>
MINI_APP_URL=https://<your-replit-url>
TELEGRAM_WEBHOOK_URL=https://<your-replit-url>/api/telegram/webhook
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
DATABASE_URL=<your-database-url>
```

All these variables can be configured in the `.env` file or through Replit environment variables.

### Database

UniFarm uses a three-tier storage system:

1. **Neon PostgreSQL** (primary database)
2. **Replit PostgreSQL** (backup database)
3. **In-memory Storage** (emergency storage when the database is unavailable)

The system automatically switches between storage options when connection errors occur.

#### Neon DB Setup

1. Create a database in Neon (https://neon.tech)
2. Add the connection string to the `DATABASE_URL` variable

#### Replit PostgreSQL Setup

The Replit PostgreSQL database is configured automatically. To check its status:

```bash
curl https://uni-farm-connect-x-lukyanenkolawfa.replit.app/api/health
```

### Telegram Integration

#### Bot Setup

1. Create a bot with @BotFather in Telegram
2. Get the bot token and add it to the `TELEGRAM_BOT_TOKEN` variable
3. Set up the bot menu with the `/setmenubutton` command in @BotFather:
   - URL: `https://<your-replit-url>`
   - Button text: `Open UniFarm`

#### Webhook Setup

The webhook is set up automatically when the application starts. The webhook URL is:
```
https://<your-replit-url>/api/telegram/webhook
```

## Health Check

After startup, you can check the application status through the API:

```bash
curl https://<your-replit-url>/api/health
```

The response should contain:
```json
{
  "status": "ok",
  "server": "up",
  "db": "connected", 
  "telegram": "initialized",
  "timestamp": "2025-05-22T...",
  "uptime": 123.45,
  "memoryUsage": {
    "rss": "123MB",
    "heapTotal": "45MB",
    "heapUsed": "23MB"
  }
}
```

## Troubleshooting

### Server Restart

If the server is not responding, use the `start.cjs` script:

```bash
node start.cjs
```

### Database Issues

If the database status in `/api/health` shows `"db": "error"`:

1. Check your internet connection
2. Verify the database connection string in the `DATABASE_URL` variable
3. Make sure the Replit IP address is not blocked on the Neon side

### Telegram Issues

If the status in `/api/health` shows `"telegram": "not_initialized"`:

1. Check the bot token in `TELEGRAM_BOT_TOKEN`
2. Verify the application URL is accessible from outside
3. Restart the server

### Workflow Start Issues

If the server doesn't start via the Run button in Replit:

1. Check the configuration in `workflows/stable-server.toml`
2. Make sure the `start.cjs` file exists and is not corrupted
3. Start the server manually with the command `node start.cjs`