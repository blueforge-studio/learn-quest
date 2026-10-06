# App-server convergence — proposal (2026-10-06)

**Ask (operator):** all app servers on one setup and one set of conventions, no special cases;
bake the conventions into forge-control provisioning; add an app-server validator and doctor.

**Status:** proposal. Nothing changed in forge-control. Facts below were read live from the hosts
on 2026-10-06 (read-only) and from `forge-control` `main`.

## 1. The design already exists — the gap is execution

Do not write a new design. These are committed in forge-control and cover most of the ask:

- `docs/superpowers/specs/2026-09-15-fleet-storage-overhaul-design.md` (+ plan, + audit) —
  **layout v2**, the migration method (§4), conformance guard (§3.6), `forge fleet provision` (§9).
- `docs/superpowers/specs/2026-08-26-app-server-spec.md` and `scripts/check-app-servers.mjs` —
  the completeness checklist (already ported into the provision pipeline as a gate, §9.4 step 14).
- `infrastructure/fleet/STORAGE.md` — why containerd's store must be bound to the data volume.
- Shipped: `forge fleet provision` (#1729, #1741), guards + `forge-storage-guard.timer` on all
  five app hosts, `scripts/rollout-fleet-guards.sh`.

**app-4 is not the special case — it is the target.** Layout v2 *is* app-4's layout
(`/mnt/forge-data` + binds for `/var/lib/containerd` and `/var/lib/docker`). The special cases are
the hosts that predate it.

## 2. Observed divergence (2026-10-06)

| | app-1 | app-2 | app-3 | app-4 | app-5 |
|---|---|---|---|---|---|
| data volume | sdb 100G ext4 → `/var/lib/docker` | HC volume xfs → `/var/lib/docker` | sdb 250G ext4 → `/var/lib/docker` | sdb 130G → `/mnt/forge-data` | sdb 150G ext4 → `/var/lib/docker` |
| containerd store | **on `/`** | **on `/`** | bind → volume (done) | bind → volume | **on `/`** (see note) |
| layout v2? | no — images on root | no — images on root | partly (no `/mnt/forge-data`) | **yes** | no |
| docker | 29.1.3 | 29.1.3 | 29.7.2 | 29.7.2 | 29.1.3 |
| daemon.json | log 10m×3, no builder.gc | log 10m×3, buildkit | no log-opts, no builder.gc | log 50m×3, no builder.gc | log 10m×3, builder.gc |
| `forge-docker-audit` | active | active | **inactive** | **inactive** | active |
| leftovers | — | — | `containerd.pre-bind` 110 GB (deleting, approved) | `docker.root-old` | `docker.old` |
| `df /` | 80% | 81–82% | 84% → falling | 7% | 34% |

Note app-5: `df /` is only 34% because it is young; its containerd store is still on `/` and will
grow into the same problem. Four different `daemon.json` shapes, two Docker versions, three
different mount idioms, and a different set of guard units running per host: this is the
"nightmare to maintain" in concrete form.

## 3. Proposal

### A. One declarative host spec — the single source of truth
`infrastructure/fleet/app-server.spec.yml` (versioned), consumed by **provisioning, the validator
and the doctor alike**, so the three can never drift from each other. It declares:
mounts + binds (v2), systemd drop-ins (`RequiresMountsFor`), the canonical `daemon.json`, a Docker
version pin, required `forge-*` units/timers (incl. `forge-docker-audit`), journald cap, sysctl,
and per-role firewall. Today these live in the packer file, `setup.sh`, `provision-app-server.sh`,
the design doc and each host's memory — pick one and generate the rest.

### B. `forge fleet doctor [<slug>|--all] [--json] [--fix]`
- Runs the **same** `evaluateAppServerCompleteness` the provision gate uses, on demand, over SSH
  (so "provisioned clean" and "still clean" are one definition).
- Read-only by default; exit codes match `forge fleet health` (0/1/2/3).
- Checks (each reports pass / fail / unknown, with the exact remediation command):
  1. image store and docker root on the data volume, both via `/mnt/forge-data` binds; root ≤ 30%;
  2. fstab by UUID + `nofail`; no double mounts; `RequiresMountsFor` drop-ins present;
  3. `daemon.json` equals the spec (live-restore, log-opts, address pools, builder.gc);
  4. docker/containerd versions equal the pin;
  5. all required guard units active; textfile metrics fresh (< 5 min);
  6. **orphans**: `*.pre-bind`, `*.pre-v2`, `*.old`, `*.root-old` older than 24 h and unmounted;
  7. unhealthy containers older than N days (the two found on app-3 today would have surfaced);
  8. capacity vs `FORGE_HOST_CAPACITY_APPS_*`; apps registered vs live.
- `--fix` applies only **idempotent, non-data-moving** repairs (drop-ins, daemon.json merge, enable
  units, remove verified orphans). Anything that moves data prints the plan for the migration script
  and stops. Never prunes images or restarts docker without `--allow-restart`.
- Continuous: the same verdict feeds the heartbeat `conformant` flag and `forge fleet health`;
  placement excludes non-conformant hosts (existing P4.2 flag, currently warn-only).

### C. Converge the fleet — one maintenance window per host
Use the existing P2.1 `forge-storage-layout apply --layout v2` (idempotent, has rollback), in order:
**app-5** (smallest store, lowest risk, proves the script) → **app-1** → **app-2** (xfs: decide
below) → **app-3** (convert its `/var/lib/docker/forge-containerd` bind to the v2 path) → then
standardise daemon.json + Docker version on all five, one host at a time.
Each window ends with `forge fleet doctor <slug>` green and a 24 h hold before orphan removal.
Note app-1/2 are the ones where an image prune *does* matter today (store is on `/`); do the
migration first so the prune frees the right disk.

## 4. Decisions (operator delegated 2026-10-06: "make recommendations and go with those")

| # | Decision | Chosen | Why |
|---|---|---|---|
| 1 | xfs vs ext4 | **Keep app-2 on xfs until its next rebuild**, then ext4. Spec allows both; doctor reports fs type as info, not a failure. | Converting a live 100G+ volume buys nothing the migration doesn't already; the grow code handles both. |
| 2 | Log rotation | **50m×3 fleet-wide** (app-4 / design value). Applied via daemon.json merge; takes effect for *new* containers only. | One value matters more than which; 10m truncates useful crash context. |
| 3 | Docker pin | **29.7.2** (what app-3/4 already run). Roll to app-5 first, soak 48 h, then app-1/2. Pin via apt hold in the spec. | Already running in prod on two hosts; avoids a downgrade. Docker restarts only inside each host's migration window (`live-restore` is on). |
| 4 | Where to land | **forge-control PRs, by the `control` session** (not this one). This doc is the handoff. Order: spec file → doctor → migrate app-5/1/2/3. | forge-control is another session's repo with its own CI/PR rules; this session owns learn-quest. |

## 5. What this session already did / did not do
- app-3: pruned dangling + unused sha-tagged images (~15 GB on the data disk); deleting the
  110 GB orphan `containerd.pre-bind` on `/` (operator-approved; running at time of writing).
- Nothing else was changed on any host. `docker.old` / `docker.root-old` (≤ 1 MB) left alone.
