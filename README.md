# Super Insecure Tech Store

**OWASP API Security Top 10:2023 — Intentionally Vulnerable E-Commerce Application**

[![Validate Super Insecure Tech Store](https://github.com/fernandoconislla/nexora-shop/actions/workflows/validate.yml/badge.svg)](https://github.com/fernandoconislla/nexora-shop/actions/workflows/validate.yml)

Super Insecure Tech Store is a realistic, fictional online store built for hands-on **API security testing**. Explore customer accounts, shopping carts, orders, administrator functions, and a separate supplier portal while investigating **all ten categories of the OWASP API Security Top 10:2023**.

> [!WARNING]
> **Intentionally vulnerable software.** Deploy **only in an isolated, authorized training environment**. The default Docker Compose configuration publishes ports **8090, 8091, and 8092 on all host interfaces**. Do not expose them to the Internet or use real identities, passwords, payment cards, or business data. Some vulnerabilities deliberately bypass access controls or execute stored HTML.

## Contents

- [Overview](#overview)
- [Features](#features)
- [OWASP API Security Top 10:2023](#owasp-api-security-top-102023)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Access the lab](#access-the-lab)
- [Demo credentials](#demo-credentials)
- [Lab management](#lab-management)
- [Documentation and testing](#documentation-and-testing)
- [Security notice](#security-notice)
- [License](#license)

## Overview

The application models an e-commerce workflow with **Super Insecure Tech Store** (customers, cart, checkout, order history, administration) and **Meridian Supply** (an independently managed fictional supplier). It includes a local internal HTTP target for SSRF training, REST API documentation, and a Resource Monitor.

The deployment uses **one Docker Compose service/container** running multiple processes (Node.js API, React storefront via Nginx, supplier portal, internal target, and monitoring). It persists store and supplier state in separate named Docker volumes. The checkout uses simulated payments only.

**Learning path:** open the lab overview → choose one of ten guided challenges → investigate requests with browser DevTools, Burp Suite, Postman, or cURL → compare behavior with the walkthrough → restore the starting data when needed.

## Features

- **Storefront:** catalog, product detail pages, product search and pagination, guest and authenticated carts, checkout, order history, and demo payment methods.
- **Accounts:** Alice, Bob, and Shop Admin with distinct permissions and seeded data.
- **Administration:** catalog editing, supplier synchronization, and a live CPU/RAM/latency Resource Monitor.
- **Supplier portal:** separate Meridian Supply interface with its own demo login and product feed.
- **Security challenges:** ten objectives with progressive hints, technical walkthroughs, expected results, root causes, remediation, and verification-after-fix criteria.
- **Repeatable lab:** Reset Lab Data, seeded database, synthetic catalog for API04, and automated HTTP/browser regression tests.

## OWASP API Security Top 10:2023

| Category | Intentional training scenario |
| --- | --- |
| [API01: Broken Object Level Authorization](http://127.0.0.1:8090/challenges?api=api01) | Alice requests an order belonging to Bob by changing its ID. |
| [API02: Broken Authentication](http://127.0.0.1:8090/challenges?api=api02) | A specific order-history API accepts a tampered JWT subject. |
| [API03: Broken Object Property Level Authorization](http://127.0.0.1:8090/challenges?api=api03) | A client-controlled checkout item price changes the recorded total. |
| [API04: Unrestricted Resource Consumption](http://127.0.0.1:8090/challenges?api=api04) | Expensive product searches and large responses affect resource usage. |
| [API05: Broken Function Level Authorization](http://127.0.0.1:8090/challenges?api=api05) | A customer calls a product-management function intended for administrators. |
| [API06: Unrestricted Access to Sensitive Business Flows](http://127.0.0.1:8090/challenges?api=api06) | Repeated purchases bypass a per-customer limited-edition purchase rule. |
| [API07: Server Side Request Forgery](http://127.0.0.1:8090/challenges?api=api07) | An image importer requests a local internal training endpoint. |
| [API08: Security Misconfiguration](http://127.0.0.1:8090/challenges?api=api08) | An invalid order identifier exposes verbose internal error details. |
| [API09: Improper Inventory Management](http://127.0.0.1:8090/challenges?api=api09) | An undocumented experimental API version exposes orders without authentication. |
| [API10: Unsafe Consumption of APIs](http://127.0.0.1:8090/challenges?api=api10) | Supplier synchronization accepts an improperly low price and renders stored HTML unsafely in the storefront. |

API10 contains **two distinct observable consequences** (price manipulation and stored XSS); there are ten OWASP categories, not eleven categories. The links above point to a **locally running instance**; replace `127.0.0.1` with the lab host's reachable IP if accessing from another VM.

## Requirements

For the **Docker installation**, you need:

- **Git** to clone the repository.
- **Docker Engine** and the **Docker Compose v2 plugin** (`docker compose`, not the legacy `docker-compose` command); on Windows, use Docker Desktop with a working Linux-container/WSL2 backend.
- An isolated lab machine or VM with available ports **8090–8092**.
- Enough free resources to build the Node.js image and run a container configured with a **768 MiB memory limit and 2 CPUs**. These Compose limits are **not** measured host minimum requirements; Docker image builds require additional disk space and memory.

The Docker route does **not** require installing Node.js or npm on your host. To run repository tests outside the container, use **Node.js 22.13+** and npm.

Supported deployment paths are Docker on **Linux/Kali Linux** or **Windows with Docker Desktop**. Platform-specific Docker installation steps depend on your OS and are provided by the Docker project: [Docker Engine](https://docs.docker.com/engine/install/), [Docker Compose plugin](https://docs.docker.com/compose/install/), and [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/).

Verify the prerequisites:

```sh
git --version
docker --version
docker compose version
docker info
```

If `docker info` fails, ensure the Docker daemon or Docker Desktop is running. On Linux, use `sudo docker ...` if your account does not have Docker socket access.

## Quick start

### Linux / Kali Linux

```bash
git clone https://github.com/fernandoconislla/nexora-shop.git
cd nexora-shop
docker compose up -d --build --wait
docker compose ps
```

In environments where Docker requires elevated permissions, prefix Docker commands with `sudo`.

### Windows (PowerShell)

Install Git and Docker Desktop first; ensure Docker Desktop is running in **Linux containers** mode.

```powershell
git clone https://github.com/fernandoconislla/nexora-shop.git
cd nexora-shop
docker compose up -d --build --wait
docker compose ps
```

### Confirm the installation

A healthy deployment should show **one Compose service**, `nexora`, with a running/healthy container. Open:

- **Lab overview:** http://127.0.0.1:8090/
- **Storefront:** http://127.0.0.1:8090/shop
- **Supplier login:** http://127.0.0.1:8091/supplier/login
- **API health check:** http://127.0.0.1:8090/api/health

If the container is not healthy, inspect:

```sh
docker compose ps
docker compose logs --tail=100 nexora
```

### Access from another VM or computer

`127.0.0.1` means **the machine running the browser**. If Docker runs on a different Kali/Windows host, use that host's **isolated lab-network IP**, for example `http://<LAB_HOST_IP>:8090/`. The two systems must be able to communicate through their VM/network settings; allow inbound **TCP 8090 and 8091 only from trusted lab clients**. Port 8092 is the directly accessible legacy monitor and should generally be blocked from remote clients.

For a **same-host-only** deployment, override the default all-interface binding:

Linux / Kali:

```bash
NEXORA_BIND_ADDRESS=127.0.0.1 docker compose up -d --build --wait
```

Windows PowerShell:

```powershell
$env:NEXORA_BIND_ADDRESS = "127.0.0.1"
docker compose up -d --build --wait
```

This localhost option prevents direct access from another physical host or VM via the host's network IP. The default `0.0.0.0` binding is provided for isolated multi-VM labs, **not public exposure**.

## Access the lab

| Component | Local address | Notes |
| --- | --- | --- |
| Lab overview | http://127.0.0.1:8090/ | Access instructions, accounts, challenges and reset |
| Super Insecure Tech Store | http://127.0.0.1:8090/shop | Customer storefront |
| Security Challenges | http://127.0.0.1:8090/challenges | Ten guided OWASP scenarios |
| Shop Admin | http://127.0.0.1:8090/products/manage | Admin login required |
| Resource Monitor | http://127.0.0.1:8090/monitor | Integrated admin-authenticated monitoring |
| Swagger UI | http://127.0.0.1:8090/api/docs | API reference |
| Meridian Supply | http://127.0.0.1:8091/supplier/login | Separate supplier login |
| Legacy monitor | http://127.0.0.1:8092/ | Directly accessible; restrict network access |

These are local instance URLs. No hosted public installation is provided by this repository.

## Demo credentials

All accounts and products are **fictional**. The supplier account is independent of the store accounts.

| Service | Role | Username / email | Password |
| --- | --- | --- | --- |
| Super Insecure Tech Store | Alice (customer) | `alice@superinsecuretechstore.example` | `AliceDemo!2026` |
| Super Insecure Tech Store | Bob (customer) | `bob@superinsecuretechstore.example` | `BobDemo!2026` |
| Super Insecure Tech Store | Shop Admin | `admin@superinsecuretechstore.example` | `AdminDemo!2026` |
| Meridian Supply | Supplier administrator | `admin` | `admin` |

Do not reuse these credentials anywhere else.

## Lab management

Run these commands from the **`nexora-shop` repository directory**:

| Task | Command | Data impact |
| --- | --- | --- |
| Show status | `docker compose ps` | None |
| View logs | `docker compose logs -f nexora` | None |
| Stop the stack | `docker compose stop` | Preserves data |
| Start an existing stack | `docker compose start` | Preserves data |
| Restart the stack | `docker compose restart` | Preserves data |
| Rebuild after code changes | `docker compose up -d --build --wait` | Preserves named volumes |
| Stop/remove containers | `docker compose down` | Preserves named volumes |
| **Delete lab data and rebuild** | `docker compose down --volumes` then `docker compose up -d --build --wait` | **Deletes this project's persisted lab data** |

To update to the latest `main` branch:

```bash
git pull origin main
docker compose up -d --build --wait
```

For a **non-destructive-infrastructure, but destructive-to-lab-state** reset, go to the **lab overview** (`/`) and use **Reset Lab Data**. Supply the demo Shop Admin credentials and type `RESET LAB`. This resets fictional orders, carts, products, and supplier changes, **overwriting your practice progress**. Close or refresh existing browser tabs afterward. A failed reset across the store and supplier may still require verification or a full volume reset; do not assume cross-service atomicity.

**Troubleshooting quick checks:**

- **`docker: command not found` / Compose missing:** install Docker and Compose v2; check `docker compose version`.
- **Cannot connect to Docker daemon:** start Docker Engine/Desktop; on Linux, inspect socket permissions.
- **Port already allocated (8090/8091/8092):** identify and stop the conflicting process before starting Super Insecure Tech Store.
- **Container exits or fails health check:** run `docker compose ps` and `docker compose logs --tail=100 nexora`.
- **Cannot access from another VM:** verify the host's IP, VM network mode, host firewall, and published bindings; do not replace the remote IP with `localhost`.
- **Scenarios show unexpected orders/stock/prices:** the lab is stateful; use Reset Lab Data to return to the seeded state.
- **After updating code, the interface looks outdated:** rebuild and reload the browser; check the active container with `docker compose ps`.

## Documentation and testing

Documentation available **inside a running lab**:

- [Lab overview and operating instructions](http://127.0.0.1:8090/)
- [Guided challenges, progressive hints and technical walkthroughs](http://127.0.0.1:8090/challenges)
- [Swagger API reference](http://127.0.0.1:8090/api/docs)

Repository resources:

- [API and storefront source](apps/)
- [Supplier and internal services](services/)
- [Seeded database](database/)
- [HTTP scenario regression tests](scripts/smoke.mjs)
- [Playwright Chromium browser tests](tests/e2e/nexora.spec.mjs)
- [CI workflow](.github/workflows/validate.yml)

The automated pipeline builds the application, runs data/unit tests and HTTP OWASP scenario tests, checks Docker deployment, and runs **eight Chromium end-to-end test cases** covering the checkout journey, login/session handling, challenge navigation, administration, browser-based API10 XSS execution, reset, and a mobile-width overflow check. These checks are regression coverage, **not a guarantee of every OS, screen size, or failure mode**.

**Developer-only local tests** (requires Node.js and npm):

```bash
npm install
npm run build -w @nexora/api
npm run build -w @nexora/storefront
npm run test:data
```

**Destructive tests — isolated disposable lab only:** `node scripts/smoke.mjs` changes fictional orders, stock, and supplier products. Playwright also resets the store/supplier before each test and modifies lab data; it intentionally refuses to run unless you explicitly enable reset.

```bash
# Only on a disposable isolated installation after docker compose up:
node scripts/smoke.mjs
npx playwright install chromium
NEXORA_E2E_ALLOW_RESET=YES npm run test:e2e
```

On Windows PowerShell, set `$env:NEXORA_E2E_ALLOW_RESET = "YES"` before `npm run test:e2e`. **Do not run either suite against an installation whose practice data you want to keep.** The GitHub Actions workflow uses a disposable Compose environment and removes its volumes at the end.

## Security notice

This project intentionally includes broken authorization, token-validation bypasses on selected endpoints, SSRF, verbose error messages, an exposed legacy API, unsafe supplier data processing, and stored XSS. **Do not harden or remove these defects when following the training exercises:** they are the instructional objective. Other ordinary operational defects should be reported and fixed without changing scenario behavior.

Keep the deployment **off the public Internet**, isolate it from corporate/home production networks, restrict ports **8090–8092**, and use only fictional data. No real payments are processed.

## License

**No `LICENSE` file is currently provided in this repository.** Do not assume that the source code has an open-source license or redistribution permission. The project owner must select and publish a license before describing the project as open source under specific license terms.
