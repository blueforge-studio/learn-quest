#!/usr/bin/env python3
"""
Assert the lq-* language apps agree on the settings that make CI work.

Why this exists
---------------
On 2026-09-02/03, eleven of the fourteen apps had CI that had never installed
dependencies. Fixing it took SIX sequential round-trips, because each missing
setting was invisible behind the one before it:

    1. packageManager            absent -> died at pnpm/action-setup
    2. allowBuilds               absent -> ERR_PNPM_IGNORED_BUILDS
    3. @blueforge-studio scope   absent -> ERR_PNPM_FETCH_404 vs npmjs.org
    4. @learnquest/unit-core     stale  -> 1,486 false "missing asset ref"
    5. testIgnore                absent -> Playwright loaded the vitest specs
    6. AppConfig required fields absent -> config.contentLanguages not iterable

The same two or three apps had every setting, which is exactly why only they
ever went green — and why nobody noticed the other eleven were not testing
anything at all.

Nothing compared the apps to each other. This does. One run reports every
divergence at once instead of trading a CI cycle for each.

Usage
-----
    python3 scripts/check-app-consistency.py           # report, exit 1 on drift
    python3 scripts/check-app-consistency.py --quiet   # exit code only

Deliberately dependency-free: this repo has no package.json, and a check that
needs an install is a check that stops being run.
"""
from __future__ import annotations
import json, os, re, sys

def _find_root() -> str:
    """
    Locate lang-quest: next to this script first, then upward from cwd.

    Resolving only script-relative meant a copy run from elsewhere silently
    found zero apps.
    """
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [os.path.join(here, "..", "lang-quest")]
    d = os.getcwd()
    for _ in range(5):
        candidates.append(os.path.join(d, "lang-quest"))
        d = os.path.dirname(d)
    # Require a candidate that actually CONTAINS apps, not merely one that
    # exists: a fresh checkout of this repo has an empty lang-quest/ (the app
    # repos are separate and gitignored), and matching on existence alone
    # selected it and reported zero apps.
    for c in candidates:
        if os.path.isdir(c) and any(
            n.startswith("lq-") and os.path.isdir(os.path.join(c, n))
            for n in os.listdir(c)
        ):
            return os.path.abspath(c)
    return os.path.abspath(candidates[0])


ROOT = _find_root()

# A guard that finds nothing must FAIL, not pass. Reporting "0 apps checked —
# all agree" is the precise shape of every defect this script exists to catch:
# a green signal standing in for an absent one.
MIN_APPS = 10


def apps() -> list[str]:
    if not os.path.isdir(ROOT):
        sys.exit(f"FAIL: lang-quest not found (looked from {ROOT}) — nothing was checked")
    found = sorted(
        d for d in os.listdir(ROOT)
        if d.startswith("lq-") and os.path.isdir(os.path.join(ROOT, d))
    )
    if len(found) < MIN_APPS:
        sys.exit(f"FAIL: found only {len(found)} apps under {ROOT}, expected at least {MIN_APPS} — "
                 "refusing to report success on a partial scan")
    return found


def read(app: str, *parts: str) -> str | None:
    p = os.path.join(ROOT, app, *parts)
    try:
        with open(p, encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return None


def read_json(app: str, *parts: str) -> dict:
    raw = read(app, *parts)
    if raw is None:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


# ── the six checks, each named for the failure it prevents ──────────────────

def check_package_manager(app: str) -> str | None:
    pkg = read_json(app, "package.json")
    if not pkg.get("packageManager"):
        return "package.json has no packageManager — pnpm/action-setup fails with 'No pnpm version is specified'"
    return None


def check_allow_builds(app: str) -> str | None:
    ws = read(app, "pnpm-workspace.yaml")
    if ws is None:
        return "no pnpm-workspace.yaml — install dies with ERR_PNPM_IGNORED_BUILDS on esbuild/sharp"
    if "allowBuilds" not in ws:
        return "pnpm-workspace.yaml has no allowBuilds — ERR_PNPM_IGNORED_BUILDS (note: pnpm 11 renamed onlyBuiltDependencies and ignores the old key silently)"
    return None


def check_registry_scope(app: str) -> str | None:
    npmrc = read(app, ".npmrc") or ""
    pkg = read_json(app, "package.json")
    deps = json.dumps({**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})})
    if "@blueforge-studio/" in deps and "@blueforge-studio:registry" not in npmrc:
        return "depends on @blueforge-studio/* but .npmrc does not map that scope — resolves against npmjs.org and 404s"
    return None


def check_unit_core(app: str) -> str | None:
    pkg = read_json(app, "package.json")
    dev = pkg.get("devDependencies", {})
    dep = pkg.get("dependencies", {})
    ver = dev.get("@learnquest/unit-core") or dep.get("@learnquest/unit-core")
    if ver is None:
        return None
    m = re.search(r"(\d+)\.(\d+)\.(\d+)", ver)
    if m and tuple(int(x) for x in m.groups()) < (0, 1, 3):
        return (f"@learnquest/unit-core {ver} resolves @regional refs against disk; "
                "public/_regional/universal is a cross-repo symlink and dangles in CI")
    return None


def check_test_ignore(app: str) -> str | None:
    cfg = read(app, "playwright.config.ts")
    if cfg is None:
        return None
    if "testIgnore" not in cfg:
        return "playwright.config.ts has no testIgnore — Playwright collects tests/unit/*.spec.ts and dies on __dirname"
    return None


REQUIRED_APP_CONFIG = ("contentRoot", "assetsRoot", "defaultLocale", "contentLanguages")


def check_e2e_config(app: str) -> str | None:
    cfg = read(app, "tests", "e2e.config.ts")
    if cfg is None:
        return None
    missing = [k for k in REQUIRED_APP_CONFIG if k not in cfg]
    if missing:
        return f"tests/e2e.config.ts missing required AppConfig fields: {', '.join(missing)}"
    return None


def check_content_languages_match_labels(app: str) -> str | None:
    """
    contentLanguages is regexed against RENDERED h2 headings, not used as a
    path. A hyphenated directory id such as 'scottish-gaelic' can never match
    the heading "Scottish Gaelic", so the assertion cannot pass.
    """
    cfg = read(app, "tests", "e2e.config.ts")
    if cfg is None:
        return None
    m = re.search(r"contentLanguages:\s*\[([^\]]*)\]", cfg)
    if not m:
        return None
    entries = re.findall(r"'([^']+)'", m.group(1))
    hyphenated = [e for e in entries if "-" in e]
    if hyphenated:
        return (f"contentLanguages entries contain hyphens {hyphenated} — these are matched "
                "against rendered headings, where the label uses spaces")
    return None


CHECKS = [
    ("packageManager", check_package_manager),
    ("allowBuilds", check_allow_builds),
    ("registry scope", check_registry_scope),
    ("unit-core", check_unit_core),
    ("testIgnore", check_test_ignore),
    ("e2e AppConfig", check_e2e_config),
    ("contentLanguages", check_content_languages_match_labels),
]


def main() -> int:
    quiet = "--quiet" in sys.argv
    found: list[tuple[str, str, str]] = []
    names = apps()
    for app in names:
        for label, fn in CHECKS:
            problem = fn(app)
            if problem:
                found.append((app, label, problem))

    if not quiet:
        print(f"Checked {len(names)} apps against {len(CHECKS)} settings.\n")
        if not found:
            print("  All apps agree. Nothing to report.")
        else:
            width = max(len(a) for a, _, _ in found)
            for app, label, problem in found:
                print(f"  {app:<{width}}  [{label}]")
                print(f"  {'':<{width}}  {problem}\n")
            print(f"  {len(found)} divergence(s) across {len({a for a, _, _ in found})} app(s).")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
