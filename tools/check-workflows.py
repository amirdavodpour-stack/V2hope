#!/usr/bin/env python3
"""HOPE CI workflow lint gate.

Checks every .github/workflows/*.yml for the three failure classes that have
actually broken this repo's CI before:
  1. YAML syntax errors.
  2. `run:` steps that reference a repo file (tools/..., scripts/...,
     ../tools/...) which does not exist on disk. `working-directory` is read
     from the step first, then the job, mirroring GitHub's resolution order.
  3. Third-party `uses:` actions that are not pinned to a full 40-char commit
     SHA (supply-chain protection). Local reusable workflows (./.github/...)
     are exempt.

Exits non-zero on the first problem found, so it can run as a CI gate.
"""
import glob
import os
import re
import sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKFLOWS = sorted(glob.glob(os.path.join(ROOT, ".github", "workflows", "*.yml")))

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
# Captures the full relative path of a repo file invoked in a run step,
# e.g. "tools/verify-pubspec-lock-fresh.sh" or "../tools/perf-smoke.mjs".
RUN_FILE_RE = re.compile(
    r"\b(?:bash|sh|node|python3)\s+((?:\.\./)?(?:tools|scripts)/[\w./-]+)"
)


def main() -> int:
    problems = []
    for path in WORKFLOWS:
        rel = os.path.relpath(path, ROOT)
        with open(path, "r", encoding="utf-8") as fh:
            try:
                data = yaml.safe_load(fh)
            except yaml.YAMLError as exc:
                problems.append(f"{rel}: YAML syntax error: {exc}")
                continue
        if not isinstance(data, dict):
            problems.append(f"{rel}: workflow root must be a mapping")
            continue

        jobs = data.get("jobs") or {}
        for job_name, job in jobs.items():
            if not isinstance(job, dict):
                continue
            job_wd = job.get("working-directory", "")
            steps = job.get("steps") or []
            for i, step in enumerate(steps, start=1):
                if not isinstance(step, dict):
                    continue
                uses = step.get("uses")
                if uses and not uses.startswith("./"):
                    _, _, tag = uses.partition("@")
                    if not SHA_RE.match(tag):
                        problems.append(
                            f"{rel}: job '{job_name}' step {i}: action '{uses}' "
                            f"is not pinned to a 40-char commit SHA"
                        )
                run = step.get("run")
                if not run:
                    continue
                wd = step.get("working-directory") or job_wd
                for m in RUN_FILE_RE.finditer(run):
                    full = m.group(1)
                    # Resolve relative to the step/job working-directory (GitHub
                    # semantics): a leading ../ walks up from there, not from ROOT.
                    base = os.path.join(ROOT, wd) if wd else ROOT
                    target = os.path.normpath(os.path.join(base, full))
                    if not os.path.isfile(target):
                        problems.append(
                            f"{rel}: job '{job_name}' step {i}: run references "
                            f"missing file '{full}' (working-directory: '{wd}')"
                        )

    if problems:
        print("Workflow lint FAILED:")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(
        "Workflow lint OK: all workflows parse, referenced repo files exist, "
        "and every third-party action is SHA-pinned."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
