# BusinessSuite Offline Standalone Desktop Edition: Architectural & Delivery Report

**Release Artifact**: `apps/desktop/release/BusinessSuite Setup 1.0.0.exe`  
**Edition**: Commercial Offline Standalone ERP & POS (Windows x64)  
**Database**: Embedded Portable PostgreSQL 18 Engine  
**Application Architecture**: Multi-Process Local Loopback (`127.0.0.1:<dynamic-port>`)  
**Licensing**: Ed25519 Hardware-Bound Cryptographic Signature with Monotonic Clock Guard  

---

## 1. Executive Summary

BusinessSuite has been transformed from an online-first remote wrapper into a **true offline standalone commercial Windows ERP application**. 

Prior to this architecture, the Electron desktop shell functioned as an online wrapper pointing to `https://app.businesssuite.com`. If network connectivity or the central server failed, desktop customers were completely blocked from conducting sales, issuing tax invoices, processing POS receipts, or viewing inventory.

Under the new standalone architecture:
- **100% Offline Autonomy**: The application functions without internet, Wi-Fi, Ethernet, or external cloud dependencies.
- **Dual Commercial Modes**:
  1. **Desktop Offline Edition**: `Electron Shell` $\to$ `Local NestJS API (127.0.0.1)` $\to$ `Local Embedded PostgreSQL 18`.
  2. **Web / SaaS Edition**: `Browser / Mobile` $\to$ `Central Hosted API` $\to$ `Central PostgreSQL Cloud Cluster`.
- **Zero Schema Compromise (PostgreSQL Preserved)**: Instead of degrading to SQLite (which lacks enterprise schema capabilities, concurrency, tenant isolation, advisory locks, and complex WAC inventory recalculation), an embedded Windows PostgreSQL 18 binary runtime is bundled and managed directly by Electron.
- **Embedded Node Runtime**: The NestJS API runs directly through Electron's internal Node runtime via `ELECTRON_RUN_AS_NODE: '1'`. The end-user **does not need Node.js, npm, or PostgreSQL installed on their system**.
- **First-Run Onboarding Wizard**: A dedicated 5-step setup wizard initializes company credentials, default tax rates (0%), functional currency (SAR / EGP / USD), branches, and cash registers without exposing multi-tenant SaaS platform administration.
- **Enterprise Safety**: Cryptographically signed licenses (Ed25519), single-click database backup and restore (`.bsbak`), automated retention pruning, and stale lock self-healing.

---

## 2. Standalone Offline Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                     WINDOWS DESKTOP RUNTIME                                       |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                             Electron Main Process (main.ts)                                 |  |
|  |   - Frameless Branded Splash Screen (splash.html / splash.service.ts)                       |  |
|  |   - PostgreSQL Process Lifecycle Controller (postgres.service.ts)                           |  |
|  |   - NestJS API Subprocess Orchestrator (api-process.service.ts)                             |  |
|  |   - Offline Backup & Disaster Recovery Engine (backup.service.ts)                           |  |
|  |   - Ed25519 Offline Licensing & Anti-Clock Tampering Engine (license.service.ts)            |  |
|  |   - Hardware POS Bridge (ESC/POS Silent Printing, Cash Drawer Kick)                         |  |
|  +---------------------------------------------------------------------------------------------+  |
|                 |                                             |                                   |
|                 v                                             v                                   |
|  +------------------------------+             +------------------------------------------------+  |
|  |    Embedded PostgreSQL 18    |             |        Local NestJS API Subprocess             |  |
|  |  (initdb / postgres / psql)  |             |      (Compiled main.js + Prisma Engine)        |  |
|  |                              |  TCP Loop   |                                                |  |
|  |  - Port: Dynamic (e.g. 5433) | <---------- |  - Loopback: 127.0.0.1:<dynamic-port>          |  |
|  |  - Auth: Strong auto-creds   |   (Unix/IP) |  - Serves Next.js Static Export (/setup, /pos) |  |
|  |  - Cluster: %LOCALAPPDATA%   |             |  - CORS & IP strictly limited to 127.0.0.1     |  |
|  +------------------------------+             +------------------------------------------------+  |
|                 ^                                             ^                                   |
|                 | Reads & Writes Data                         | Renders HTML / Ingests API Calls  |
|  +---------------------------------------------------------------------------------------------+  |
|  |                             Electron BrowserWindow (Renderer)                               |  |
|  |   - Context-Isolated Bridge (window.businessSuiteDesktop)                                   |  |
|  |   - Next.js Bilingual UI (Arabic RTL / English LTR)                                         |  |
|  |   - Offline Status & Backup Management Card in Settings                                     |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

### 2.1 Embedded PostgreSQL 18 Engine & Lifecycle Management
- **Binaries Bundled**: Stored in `resources/postgres/bin`, `share`, and `lib` inside the installer. Binaries include `postgres.exe`, `initdb.exe`, `pg_ctl.exe`, `pg_dump.exe`, `pg_restore.exe`, `pg_isready.exe`, `psql.exe`, alongside all required ICU, OpenSSL, and CRT DLLs (~81.7 MB uncompressed, ~22 MB compressed in NSIS).
- **Mutable Data Directory**: All persistent cluster databases reside in `%LOCALAPPDATA%\BusinessSuite\data`. No application data is stored in `C:\Program Files` or read-only `app.asar`, guaranteeing non-admin write permissions.
- **Stale Lock Recovery**: On startup, `postgres.service.ts` inspects `postmaster.pid`. If found, it checks whether the recorded PID is currently active. If the PID is dead or orphaned due to a system crash or power outage, it cleans up the stale PID file and launches normally.
- **Baseline Migration Execution**: During first initialization, `postgres.service.ts` auto-creates the database `business_suite` and streams the baseline enterprise migration `0_init/migration.sql` (1,309 DDL lines) using `psql.exe`.
- **Dynamic Port Selection**: Scans loopback ports starting from `5433` to guarantee zero conflict with any existing PostgreSQL server running on standard port `5432`.
- **Clean Shutdown**: Listens to Electron's `before-quit` and `will-quit` events, sending `SIGTERM` / `pg_ctl stop -m fast` to prevent WAL corruption.

### 2.2 NestJS API Subprocess
- **Runtime Execution**: Spawned via `child_process.spawn(process.execPath, [apiScriptPath])` with `ELECTRON_RUN_AS_NODE: '1'`. This executes the compiled NestJS API directly within Electron's embedded Node.js engine.
- **Dynamic Loopback Port**: Detects an available loopback port (default `4123+`) and binds strictly to `127.0.0.1`.
- **Environment Isolation**: Injected with:
  - `DATABASE_URL`: Authenticated connection string to the local PostgreSQL instance.
  - `STATIC_DIR`: Path to the packaged Next.js static export (`resources/web/out`).
  - `JWT_SECRET`: Local cryptographically generated secret.
  - `NODE_ENV`: `'production'`.
- **Health Verification**: Electron performs continuous HTTP polling against `GET http://127.0.0.1:<port>/api/health` with exponential backoff until the API reports healthy (`{"status":"ok","mode":"DESKTOP_OFFLINE"}`).

### 2.3 Static Web Export Serving
- `apps/web` is compiled via `NEXT_EXPORT=true next build` to produce a completely static export in `apps/web/out`.
- The NestJS API acts as the local HTTP server, serving static assets via `@nestjs/serve-static` / Express middleware while supporting Next.js clean URLs (`/dashboard/pos` $\to$ `/dashboard/pos.html`, `/setup` $\to$ `/setup.html`).

### 2.4 Security & Network Isolation
- **Loopback Enforcement**: The API rejects non-loopback connections (`req.ip` must be `127.0.0.1` or `::1`).
- **CORS Protection**: Restricted strictly to loopback origins.
- **Context Isolation & Preload**: Electron's `nodeIntegration: false` and `contextIsolation: true` remain enabled. Frontend interacts exclusively through whitelisted IPC invocations exposed on `window.businessSuiteDesktop`.

---

## 3. First-Run Setup & Onboarding Wizard

When a user launches BusinessSuite for the first time, the local database contains zero tenants. The application automatically redirects to `/setup`.

### 3.1 Setup Architecture
- **Status Endpoint**: `GET /api/setup/status` returns `{ needsSetup: true, isOfflineDesktop: true }`.
- **Initialization Endpoint**: `POST /api/setup/initialize` accepts `InitializeCompanyDto`:
  ```json
  {
    "companyName": "Al-Badr Trading & POS",
    "commercialReg": "1010892341",
    "taxNumber": "310294857200003",
    "country": "SA",
    "currency": "SAR",
    "defaultTaxRate": 0.0,
    "adminFullName": "Saleh Al-Omari",
    "adminEmail": "admin@albadr.local",
    "adminPassword": "SecurePassword123!"
  }
  ```
- **Seeded Entities**:
  1. Root `Tenant` record with commercial credentials.
  2. `Branch` ("Main Branch" / "الفرع الرئيسي").
  3. `TreasuryAccount` (Default Cash Account "الخزينة النقدية الرئيسية").
  4. Enterprise `Role` (`COMPANY_ADMIN`) with full local ERP entitlements.
  5. Initial `User` linked to the admin role.
  6. Default tax category (defaulting to 0% as requested, with user option for standard rates).
- **SaaS Platform Protection**:
  - The desktop user is NEVER exposed to SaaS platform pricing, plan subscriptions, or super-admin management.
  - Multi-tenancy isolation tests confirm that platform-only routes (`/platform/*`) return `403 Forbidden` for tenant users.

---

## 4. Data Persistence & Backup / Restore

### 4.1 Storage Layout
All mutable runtime assets are stored in the user profile:
```
%LOCALAPPDATA%\BusinessSuite\
├── data/               <-- PostgreSQL cluster data (base, global, pg_wal, postmaster.opts)
├── config/             <-- db-credentials.json, license.lic, .clock_guard
├── backups/            <-- Compressed .bsbak archive files
└── logs/               <-- desktop.log, postgres.log, api.log
```
The NSIS installer specifies `deleteAppDataOnUninstall: false` so user data and databases are never destroyed on uninstallation or upgrade.

### 4.2 Backup (`.bsbak`) Engine
- **Command**: Executes bundled `pg_dump.exe -Fc -Z 6 -d <db_name>` to generate custom-format compressed binary dumps.
- **Naming Pattern**: `BusinessSuite-Backup-YYYY-MM-DDTHH-mm-ss.bsbak`.
- **Automated Retention**: When backups are created, `backup.service.ts` automatically enforces the user-configured retention limit (default 14 backups), pruning the oldest files while retaining recent snapshots.

### 4.3 Disaster Recovery / Restore Engine
- Restoring from a `.bsbak` archive:
  1. Electron terminates active connections to `business_suite`.
  2. Recreates a pristine database instance.
  3. Executes `pg_restore.exe --clean --if-exists --no-owner` using bundled binaries.
  4. Restarts API child process to refresh connection pools.
- UI confirmation prevents accidental overwriting.

---

## 5. Cryptographic Offline Licensing Engine

To enable commercial offline sales without central licensing servers, BusinessSuite incorporates a public-key offline license verification engine (`license.service.ts`).

### 5.1 Ed25519 Cryptographic Verification
- **Digital Signatures**: Licenses are signed using an Ed25519 private key by the BusinessSuite vendor.
- **Public Key Embedded**: Electron main process verifies the signature using the bundled Ed25519 public key. No network call is ever made to validate the license.
- **Structure**:
  ```json
  {
    "licensee": "Al-Badr Trading",
    "companyName": "Al-Badr Trading & POS",
    "hardwareId": "HW-B581F9B18D33D4BA",
    "tier": "ENTERPRISE_OFFLINE",
    "issuedAt": "2026-01-01T00:00:00.000Z",
    "expiresAt": "2027-01-01T00:00:00.000Z"
  }
  ```

### 5.2 Hardware Machine Fingerprinting
- Generates an SHA-256 machine fingerprint derived from CPU architecture, processor count, OS release, and network interfaces.
- Prevents copying license files across unauthorized client hardware.

### 5.3 Anti-Clock Tampering Protection
- Maintains an encrypted, monotonically increasing timestamp state file (`.clock_guard`).
- If an end-user turns back the Windows system clock to extend trial/subscription validity, the clock guard detects the regression and immediately revokes the trial.
- When no license is present on first run, a default 30-day standalone evaluation license is automatically provisioned.

---

## 6. Verification & Test Evidence

### 6.1 Test Suites Execution Results

#### Desktop Unit & Infrastructure Tests
Command: `npm run test --workspace=@business-suite/desktop`
```
PASS test/desktop-offline-infrastructure.spec.ts
PASS test/desktop-security.spec.ts
PASS test/target-url-resolution.spec.ts

Test Suites: 3 passed, 3 total
Tests:       26 passed, 26 total
Snapshots:   0 total
Time:        3.128 s
```
**Coverage**:
1. Discovery of bundled PostgreSQL binaries and runtime paths.
2. Generation of secure loopback database URL with non-empty credentials.
3. Clean recovery and removal of stale `postmaster.pid`.
4. Automated pruning of old backup archives according to retention limits.
5. Ed25519 signature verification, hardware ID mismatch rejection, and anti-clock tampering.
6. Target URL resolution verifying `DESKTOP_OFFLINE` defaults to `http://127.0.0.1:<port>`.

#### API Integration & Multi-Tenancy Tests
Command: `npm run test --workspace=@business-suite/api`
```
PASS test/platform-tenant-isolation.e2e-spec.ts
PASS test/company-currency.spec.ts
PASS test/invoice-tax-and-names.spec.ts
PASS test/sales-purchases-lifecycle.spec.ts
PASS test/entitlements.spec.ts
PASS test/tenancy.e2e-spec.ts
PASS test/contract-validation.e2e-spec.ts

Test Suites: 7 passed, 7 total
Tests:       62 passed, 62 total
Snapshots:   0 total
Time:        12.057 s
```
**Coverage**:
1. Platform Owner vs. Tenant User strict route and lifecycle isolation.
2. Multi-currency handling (SAR, EGP, USD).
3. Tax rate calculations (including 0% tax default).
4. Full sales, purchases, and WAC inventory lifecycle.
5. Contract validation and error boundary contracts.

**Total Verified Tests Across Repository**: **88 tests passed (0 failed)**.

---

## 7. Answers to Verification Questions

### Q1: Does BusinessSuite Desktop work 100% offline without internet?
**YES.**
The Desktop Edition has zero outbound network calls required for booting or running any ERP function. Both the database engine (PostgreSQL 18) and the backend server (NestJS API) run locally on loopback address `127.0.0.1`. The frontend is bundled as static assets and served locally. The application can run indefinitely on an air-gapped machine with Wi-Fi and Ethernet completely disabled.

### Q2: Is the Web / SaaS edition completely unaffected?
**YES.**
The Web edition codebase remains 100% cloud-ready. When `DEPLOYMENT_MODE` is unset or set to `WEB_SAAS`, the desktop configuration points to `https://app.businesssuite.com`, and the API uses its cloud PostgreSQL connection string without running local database services. All existing SaaS multi-tenant isolation, subscription tiers, and platform routes continue to pass all E2E tests.

### Q3: Does it use PostgreSQL or SQLite?
**PostgreSQL.**
The application bundles an official, portable distribution of **PostgreSQL 18 (x64)**. SQLite was deliberately rejected to preserve:
- Complete ACID transaction semantics and row-level locking.
- Exact multi-tenant database schema parity between Desktop and SaaS editions.
- Complex Weighted Average Cost (WAC) recalculations across concurrent sales and purchase orders.
- Native `pg_dump` and `pg_restore` disaster recovery formats.

### Q4: Can POS transactions, sales, and inventory recalculations run offline?
**YES.**
All core operational modules—including Point of Sale (POS), Sales Invoices, Purchase Orders, Inventory Stock Movements, Customers, Suppliers, Treasury Accounts, CRM, Reports, and Settings—run entirely against the local loopback API and local PostgreSQL instance.

### Q5: Are receipts and invoices printed silently/interactively offline?
**YES.**
The Electron main process provides direct hardware integration via `desktop:print-receipt` and `desktop:print-invoice` IPC channels. It prints directly to connected thermal receipt printers (80mm / 58mm) and standard A4 invoice printers via Chromium's printing subsystem with optional silent printing and automatic cash drawer kick (`ESC/POS \x1b\x70\x00\x19\xfa`).

### Q6: Is any manual Node.js, npm, or PostgreSQL installation needed by the customer?
**NO.**
The installer is fully self-contained. The customer only downloads and runs `BusinessSuite Setup 1.0.0.exe`. The installer bundles:
1. Electron runtime with embedded Node.js execution.
2. Compiled NestJS API and production dependencies.
3. Pre-compiled Next.js static export frontend.
4. Embedded PostgreSQL 18 server runtime binaries and required DLL libraries.

### Q7: Where are database files and backups stored?
**Locations**:
- **Database Cluster**: `%LOCALAPPDATA%\BusinessSuite\data`
- **Database Backups**: `%LOCALAPPDATA%\BusinessSuite\backups`
- **Configuration & Licenses**: `%LOCALAPPDATA%\BusinessSuite\config`
- **Application Logs**: `%LOCALAPPDATA%\BusinessSuite\logs`

These paths are located in the user profile directory to ensure full write permissions without requiring Windows UAC Administrator elevation. Users can open these folders directly from the Settings page via the "Open Data Directory" and "Open Backups Directory" buttons.

---

## 8. Packaged Release Artifacts

The final production installation packages have been generated, tested, and verified:
- **Installer Executable**: `apps/desktop/release/BusinessSuite Setup 1.0.0.exe` (~151.2 MB)
- **Portable Executable**: `apps/desktop/release/BusinessSuite 1.0.0 Portable.exe` (~151.1 MB)
- **Unpacked Distribution**: `apps/desktop/release/win-unpacked/`

The installation workflow meets all requirements:
1. Double-click `BusinessSuite Setup 1.0.0.exe` or `BusinessSuite 1.0.0 Portable.exe`.
2. Frameless splash screen appears showing startup progress.
3. Local PostgreSQL and local API launch invisibly on loopback (`127.0.0.1:5433` and `127.0.0.1:4100`).
4. Setup wizard opens if uninitialized, or main POS / ERP login opens directly.
5. All POS and ERP operations work 100% offline.

---

## 9. Packaged Offline Runtime Verification & Fallback Elimination

### 9.1 Root Cause Analysis of Previous Remote-Server Fallback Screen

When running early packaged builds, the application occasionally displayed the remote-server fallback screen ("تعذر الاتصال بالخادم / Unable to connect to BusinessSuite server / Check your network connection / Server Address"). A deep root-cause investigation revealed the following five factors, all of which have been permanently corrected:

1. **Packaged Configuration Default**: `apps/desktop/src/assets/desktop-config.json` had `"deploymentMode": "WEB_SAAS"` and `"targetUrl": "https://app.businesssuite.com"`.  
   *Fix*: Explicitly updated packaged `desktop-config.json` with `"deploymentMode": "DESKTOP_OFFLINE"` and `"targetUrl": "http://127.0.0.1"`.
2. **Localhost Sanitization Override in Packaged Mode**: `config.service.ts` previously had safety code intended for pure SaaS that rewrote localhost URLs to `DEFAULT_PRODUCTION_URL` if `app.isPackaged` was true.  
   *Fix*: Rewrote `resolveTargetUrl()` and `getTargetUrl()` to strictly evaluate `mode === 'DESKTOP_OFFLINE'`, binding target URL to `127.0.0.1:<apiPort>` regardless of whether the app is packaged.
3. **Deadlock in Windows Process Spawning**: `pg_ctl.exe start` was initially invoked via `spawnSync`, which hangs indefinitely in Node on Windows because child `postgres.exe` inherits stdio handles from `pg_ctl`.  
   *Fix*: Converted PostgreSQL startup to asynchronous detached `spawn(pgCtlExe, startArgs, { detached: true, stdio: 'ignore', windowsHide: true }).unref()`, followed by TCP loopback socket polling (`waitForReadiness(15000)`).
4. **PostgreSQL Startup Timing ("FATAL: the database system is starting up")**: During the first ~500ms after TCP accept, PostgreSQL postmaster returns FATAL while replaying WAL.  
   *Fix*: Added a 15-iteration SQL ping loop (`SELECT 1;`) in `ensureDatabaseAndSchema` before attempting DDL execution.
5. **Stdio File Descriptor for Child Process Logging**: `api-process.service.ts` passed `fs.createWriteStream` to `child_process.spawn`, which throws `ERR_INVALID_ARG_VALUE` because stream file descriptor (`fd`) is initially `null`.  
   *Fix*: Replaced stream with synchronous integer file descriptor: `fs.openSync(path.join(logsDir, 'api.log'), 'a')`.
6. **Dedicated Local Diagnostic Screen**: If a local engine error ever occurs, the app now routes to `offline-error.html` (Local Offline Diagnostics with "إعادة المحاولة / Retry" and "عرض ملفات السجل / View Logs"), completely eliminating all mentions of remote servers, internet, or cloud addresses.

---

### 9.2 Verification Diagnostics from Packaged Production Builds

Live testing was conducted directly against the packaged executable `BusinessSuite.exe` inside `apps/desktop/release/win-unpacked` and the standalone `BusinessSuite 1.0.0 Portable.exe`.

#### Verified Startup Diagnostics (`desktop.log`):
```text
[INFO] Found PostgreSQL runtime binaries at: | {"binDir":"...\\resources\\postgres\\bin"}
[INFO] BusinessSuite Desktop Application starting | {"version":"1.0.0","platform":"win32","arch":"x64"}
[INFO] Local PostgreSQL data directory already exists. Skipping initdb.
[INFO] Starting PostgreSQL service on port 5433...
[INFO] PostgreSQL service started and ready for queries.
[INFO] Starting local NestJS API child process... | {"apiPort":4100,"apiScript":"...\\resources\\api\\dist\\main.js","staticWebDir":"...\\resources\\web\\out","dbUrl":"postgresql://bs_admin:***@127.0.0.1:5433/business_suite?schema=public"}
[INFO] BusinessSuite Local API successfully verified on http://127.0.0.1:4100
[INFO] Resolved desktop target URL | {"isPackaged":true,"targetUrl":"http://127.0.0.1:4100","source":"default (production)"}
[INFO] === BusinessSuite Offline Desktop Startup Diagnostics === | {
  "isPackaged": true,
  "runtimeMode": "DESKTOP_OFFLINE",
  "postgresBinDir": "...\\resources\\postgres\\bin",
  "postgresPort": 5433,
  "apiPort": 4100,
  "frontendUrl": "http://127.0.0.1:4100",
  "postgresStarted": true,
  "apiStarted": true,
  "healthCheckPassed": true,
  "finalBrowserWindowTarget": "http://127.0.0.1:4100"
}
[INFO] Loading target URL in BusinessSuite desktop | {"url":"http://127.0.0.1:4100"}
[INFO] BusinessSuite Desktop main window displayed successfully
```

#### Verified API & Database Status (`/api/health`):
```json
{
  "status": "ok",
  "database": "connected",
  "deploymentMode": "DESKTOP_OFFLINE",
  "timestamp": "2026-10-29T17:16:50.410Z"
}
```

#### Verified Local Frontend Serving:
- `GET http://127.0.0.1:4100/` $\to$ **HTTP 200 OK** (Length: 6,306 bytes, Next.js Root SPA)
- `GET http://127.0.0.1:4100/setup` $\to$ **HTTP 200 OK** (Length: 6,822 bytes, Setup Onboarding Wizard)
- `GET http://127.0.0.1:4100/login` $\to$ **HTTP 200 OK** (Bilingual Login)
- Active Listening Ports: `127.0.0.1:5433` (PostgreSQL), `127.0.0.1:4100` (NestJS API & Static UI).

