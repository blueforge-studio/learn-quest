#!/usr/bin/env node
// scripts/check-sidecars.mjs
//
// Validate this repo's BlueForge sidecar files against the published
// schemas (@blueforge-studio/blueforge-sidecar-schemas), and check that every
// `assets` path names a file in the repo. A missing sidecar is skipped; a
// present but malformed one fails. Copied from forge-dev (fleet standard B14).
//
// Exit 0 on pass-or-skipped, 1 on any failure.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";
import {
  parseProductSidecar,
  parseFeaturesSidecar,
  SIDECAR_FILENAME,
  FEATURES_FILENAME,
} from "@blueforge-studio/blueforge-sidecar-schemas";

const CWD = process.cwd();
const results = [];

// sidecar-schemas ≥0.6 validates a parsed object (the *Yaml string helpers
// are gone); YAML parsing happens here so a YAML syntax error surfaces as a
// failed check rather than an unhandled throw.
function check(label, filename, parser) {
  const fullPath = join(CWD, filename);
  if (!existsSync(fullPath)) {
    results.push({ label, filename, status: "skipped" });
    return null;
  }
  let doc;
  try {
    doc = parseYaml(readFileSync(fullPath, "utf8"));
  } catch (err) {
    results.push({
      label,
      filename,
      status: "failed",
      issues: [{ path: ["<parse>"], message: String(err.message ?? err) }],
    });
    return null;
  }
  const r = parser(doc);
  if (r.ok) {
    results.push({ label, filename, status: "ok" });
    return r;
  }
  results.push({ label, filename, status: "failed", issues: r.issues });
  return null;
}

const product = check("product", SIDECAR_FILENAME, parseProductSidecar);
check("features", FEATURES_FILENAME, parseFeaturesSidecar);

// forge-control uploads `assets` by path after a deploy; a typo silently
// ships no image, so fail here instead.
const products = product?.data?.products ?? [];
const missing = [];
for (const p of products) {
  const a = p.assets ?? {};
  const paths = [a.logo, a.og, a.cover, ...(a.screenshots ?? [])]
    .map((s) => (typeof s === "string" ? s : s?.path ?? s?.src))
    .filter(Boolean);
  for (const rel of paths) {
    if (!existsSync(join(CWD, rel))) missing.push(`${p.id}: ${rel}`);
  }
}
if (missing.length) {
  results.push({
    label: "assets",
    filename: SIDECAR_FILENAME,
    status: "failed",
    issues: missing.map((m) => ({ path: ["assets"], message: `file not found: ${m}` })),
  });
}

const failed = results.filter((r) => r.status === "failed");
const ok = results.filter((r) => r.status === "ok");
const skipped = results.filter((r) => r.status === "skipped");

if (failed.length === 0) {
  console.log(`OK — ${ok.length} sidecar(s) checked, ${skipped.length} skipped`);
  process.exit(0);
}

console.error(`FAIL — ${failed.length} check(s) failed:`);
for (const f of failed) {
  console.error(`  ${f.label} (${f.filename}):`);
  for (const i of f.issues) {
    const path = (i.path ?? []).join(".") || "<root>";
    console.error(`    - ${path}: ${i.message}`);
  }
}
process.exit(1);
