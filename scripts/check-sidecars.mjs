#!/usr/bin/env node
// scripts/check-sidecars.mjs
//
// Validate this repo's BlueForge sidecar files against the published
// Zod schemas. Walks the repo recursively, skipping node_modules, .git,
// .worktrees, and any directory the package manager owns.
//
// Exit 0 on pass-or-skipped, 1 on any validation failure.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";

import {
  parseProductSidecarYaml,
  parseFeaturesSidecarYaml,
  SIDECAR_FILENAME,
  FEATURES_FILENAME,
} from "@blueforge-studio/blueforge-sidecar-schemas";

const CWD = process.cwd();
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".worktrees",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".cache",
]);
const MAX_DEPTH = 6;

const results = [];

function walk(dir, depth) {
  if (depth > MAX_DEPTH) return;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(full, depth + 1);
    } else if (entry === SIDECAR_FILENAME || entry === FEATURES_FILENAME) {
      check(entry, full);
    }
  }
}

function check(filename, fullPath) {
  const label = relative(CWD, fullPath);
  const parser =
    filename === SIDECAR_FILENAME
      ? parseProductSidecarYaml
      : parseFeaturesSidecarYaml;
  let text;
  try {
    text = readFileSync(fullPath, "utf8");
  } catch (err) {
    results.push({ label, status: "failed", issues: [{ path: "<io>", message: err.message }] });
    return;
  }
  const r = parser(text);
  if (r.ok) {
    results.push({ label, status: "ok" });
    return;
  }
  results.push({
    label,
    status: "failed",
    issues: r.parseError ? [{ path: "<parse>", message: r.parseError }] : r.issues,
  });
}

walk(CWD, 0);

const failed = results.filter((r) => r.status === "failed");
const ok = results.filter((r) => r.status === "ok");

if (failed.length === 0) {
  console.log(
    ok.length === 0
      ? "OK — no sidecars found, nothing to validate"
      : `OK — ${ok.length} sidecar(s) checked, 0 skipped`,
  );
  process.exit(0);
}

console.error(`FAIL — ${failed.length} sidecar(s) failed validation:`);
for (const f of failed) {
  console.error(`  ${f.label}:`);
  for (const i of f.issues) {
    const path = (i.path ?? []).join(".") || "<root>";
    console.error(`    - ${path}: ${i.message}`);
  }
}
process.exit(1);
