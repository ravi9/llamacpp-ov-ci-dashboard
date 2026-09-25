#!/usr/bin/env python3
"""Append one CI run result to docs/0-ov-ci-dashboard/data/history.json.

Usage:
  record_result.py --job "CI (openvino)" --status success --sha <sha> --run-url <url> \
      --jobs-file /tmp/jobs.json [--run-id <id>] [--upstream-sha <sha>] [--timestamp <iso>]

--status is whatever value the caller passes through - for this project
that's github.event.workflow_run.conclusion: success, failure, cancelled,
skipped, timed_out, action_required, or startup_failure.

--jobs-file is a JSON list of per-job results from the GitHub Jobs API:
[{"name", "conclusion", "status", "html_url"}, ...]
"""
import argparse
import datetime
import json
import logging
import pathlib

DATA_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "docs" / "0-ov-ci-dashboard" / "data"
HISTORY_FILE = DATA_DIR / "history.json"
MAX_RECORDS_PER_JOB = 90  # ~3 months of daily runs
JOB_KEYS = ("name", "conclusion", "status", "html_url")


def load(path, default):
    if path.exists():
        return json.loads(path.read_text())
    return default


def write_json(path, data):
    """Write LF-only JSON with a final newline (upstream editorconfig-checker)."""
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    path.write_bytes(text.encode("utf-8"))


def load_jobs(path):
    jobs = load(pathlib.Path(path), [])
    # Sort by name: the Jobs API order is not stable between runs.
    return sorted(({k: j.get(k) for k in JOB_KEYS} for j in jobs), key=lambda j: j["name"] or "")


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    p = argparse.ArgumentParser()
    p.add_argument("--job", required=True, help="workflow name, e.g. \"CI (openvino)\"")
    p.add_argument("--status", required=True, help="success | failure | cancelled | skipped")
    p.add_argument("--sha", default="", help="commit of this repo the workflow ran on")
    p.add_argument("--upstream-sha", default="", help="ggml-org/llama.cpp commit merged into --sha")
    p.add_argument("--run-url", required=True, help="link to the GitHub Actions run")
    p.add_argument("--run-id", default="", help="GitHub Actions run id; a re-run with the same id replaces the old record")
    p.add_argument("--timestamp", default="", help="ISO 8601 run start time; defaults to now")
    p.add_argument("--jobs-file", required=True, help="JSON list of per-job results from the Jobs API")
    args = p.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    history = load(HISTORY_FILE, [])

    record = {
        "job": args.job,
        "status": args.status,
        "sha": args.sha,
        "upstream_sha": args.upstream_sha,
        "run_url": args.run_url,
        "run_id": args.run_id,
        "timestamp": args.timestamp or datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "jobs": load_jobs(args.jobs_file),
    }

    # A re-run of the same run id replaces the old record instead of adding a new one.
    if args.run_id:
        history = [r for r in history if not (r["job"] == args.job and r.get("run_id") == args.run_id)]
    history.append(record)

    # Trim per-job so one job's history can't crowd out another's.
    by_job = {}
    for r in history:
        by_job.setdefault(r["job"], []).append(r)
    trimmed = []
    for records in by_job.values():
        trimmed.extend(records[-MAX_RECORDS_PER_JOB:])
    trimmed.sort(key=lambda r: r["timestamp"])

    write_json(HISTORY_FILE, trimmed)
    summary = ", ".join(f"{j['name']}={j['conclusion']}" for j in record["jobs"])
    logging.info("Recorded %s = %s @ %s [%s]", args.job, args.status, record["timestamp"], summary)


if __name__ == "__main__":
    main()
