#!/usr/bin/env python3
"""VersionBox: snapshot public GitHub static builds without mutating source repos."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import tempfile

REPO_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
SLUG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
STATIC_EXTS = {".html", ".htm", ".css", ".js", ".mjs", ".json", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".txt", ".webmanifest", ".wasm", ".map", ".pdf"}
MAX_FILE_BYTES = 15 * 1024 * 1024
MAX_VERSION_BYTES = 45 * 1024 * 1024
MAX_FILES = 2000


def command(*args, cwd=None, check=True, binary=False):
    run = subprocess.run(args, cwd=cwd, capture_output=True, check=False)
    if check and run.returncode:
        raise RuntimeError((run.stderr or run.stdout).decode(errors="replace")[-1200:])
    return run.stdout if binary else run.stdout.decode(errors="replace").strip()


def safe_path(raw):
    path = PurePosixPath(raw)
    if not raw or path.is_absolute() or any(part in (".", "..") for part in raw.split("/")) or "\\" in raw:
        raise ValueError(f"Invalid publish path: {raw}")
    return path


def existing(repo_dir, sha, path):
    return subprocess.run(["git", "cat-file", "-e", f"{sha}:{path}"], cwd=repo_dir, capture_output=True).returncode == 0


def archive_file(repo, sha, source, dest):
    data = command("git", "show", f"{sha}:{source}", cwd=repo, binary=True)
    if len(data) > MAX_FILE_BYTES:
        raise ValueError(f"Build file exceeds size limit: {source}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return len(data)


def archive_directory(repo, sha, source, dest):
    source = source.rstrip("/")
    prefix = (source + "/") if source != "." else ""
    raw = command("git", "ls-tree", "-r", "-z", sha, "--", source, cwd=repo, binary=True)
    total = 0
    count = 0
    for entry in raw.split(b"\0"):
        if not entry:
            continue
        info, filename = entry.split(b"\t", 1)
        mode, kind, _ = info.decode().split()
        path = filename.decode("utf-8")
        if kind != "blob" or mode == "120000" or (prefix and not path.startswith(prefix)):
            continue
        relative = path[len(prefix):]
        parts = PurePosixPath(relative).parts
        if not parts or any(p.startswith(".") for p in parts):
            continue
        if PurePosixPath(relative).suffix.lower() not in STATIC_EXTS:
            continue
        count += 1
        if count > MAX_FILES:
            raise ValueError("Too many files in published build")
        total += archive_file(repo, sha, path, dest.joinpath(*parts))
        if total > MAX_VERSION_BYTES:
            raise ValueError("Published build exceeds 45 MB")
    if not count:
        raise FileNotFoundError(f"No static files found in {source}")
    if not (dest / "index.html").is_file():
        raise FileNotFoundError(f"Directory build {source} needs index.html")


def publish(repo, sha, publish_path, dest):
    path = str(safe_path(publish_path))
    if not existing(repo, sha, path):
        raise FileNotFoundError(f"No {path} at {sha[:12]}")
    typ = command("git", "cat-file", "-t", f"{sha}:{path}", cwd=repo)
    if typ == "blob":
        if not path.lower().endswith((".html", ".htm")):
            raise ValueError("Single-file builds must be HTML")
        archive_file(repo, sha, path, dest / "index.html")
    elif typ == "tree":
        archive_directory(repo, sha, path, dest)
    else:
        raise ValueError(f"Unsupported Git object {typ}")


def sync(root, repo_base=None):
    base = root / "versionbox"
    catalog = json.loads((base / "catalog.json").read_text(encoding="utf-8"))
    state_path = base / "data.json"
    previous = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    previous_projects = {p["id"]: p for p in previous.get("projects", [])}
    tracked = previous.get("tracked", {})
    out_projects = []
    for project in catalog["projects"]:
        ident = project["id"]
        if not SLUG_PATTERN.fullmatch(ident):
            raise ValueError(f"Invalid project ID {ident}")
        history = [v for v in previous_projects.get(ident, {}).get("versions", []) if not v.get("legacy")]
        existing_shas = {v.get("sha") for v in history}
        error = None
        repo_name = project.get("repo")
        path = project.get("publish_path")
        if repo_name and path:
            if not REPO_PATTERN.fullmatch(repo_name):
                raise ValueError(f"Invalid repo {repo_name}")
            safe_path(path)
            branch = project.get("branch", "main")
            if not re.fullmatch(r"[\w./-]+", branch) or ".." in branch or branch.startswith("-"):
                raise ValueError("Invalid branch")
            with tempfile.TemporaryDirectory(prefix="versionbox-") as temp:
                clone = Path(temp) / "repo"
                url = str(repo_base / repo_name) if repo_base else f"https://github.com/{repo_name}.git"
                try:
                    command("git", "clone", "--quiet", "--filter=blob:none", "--single-branch", "--branch", branch, url, str(clone))
                    head = command("git", "rev-parse", "HEAD", cwd=clone)
                    last = tracked.get(ident, {}).get("head")
                    known = last and subprocess.run(["git", "cat-file", "-e", f"{last}^{{commit}}"], cwd=clone, capture_output=True).returncode == 0
                    ancestor = known and subprocess.run(["git", "merge-base", "--is-ancestor", last, head], cwd=clone, capture_output=True).returncode == 0
                    changes = command("git", "rev-list", "--reverse", f"{last}..{head}", "--", path, cwd=clone).splitlines() if ancestor else [head]
                    if not ancestor and last:
                        print(f"{ident}: history rewritten or prior SHA missing; saving latest only")
                    for sha in changes:
                        if sha in existing_shas:
                            continue
                        version_id = sha[:12]
                        destination = base / "snapshots" / ident / version_id
                        if destination.exists():
                            shutil.rmtree(destination)
                        try:
                            publish(clone, sha, path, destination)
                        except FileNotFoundError as exc:
                            shutil.rmtree(destination, ignore_errors=True)
                            print(f"{ident}: skipping {sha[:12]}: {exc}")
                            continue
                        except Exception:
                            shutil.rmtree(destination, ignore_errors=True)
                            raise
                        message = command("git", "show", "-s", "--format=%s", sha, cwd=clone)
                        date = command("git", "show", "-s", "--format=%cI", sha, cwd=clone)
                        label = version_id
                        if project.get("version_file"):
                            vpath = str(safe_path(project["version_file"]))
                            if existing(clone, sha, vpath):
                                version_string = command("git", "show", f"{sha}:{vpath}", cwd=clone).splitlines()[0].strip()[:36]
                                if re.fullmatch(r"[a-zA-Z0-9._-]+", version_string):
                                    label = version_string
                        history.append({"id": version_id, "label": label, "sha": sha, "url": f"versionbox/snapshots/{ident}/{version_id}/index.html", "date": date, "message": message[:180], "repo": repo_name})
                        existing_shas.add(sha)
                        print(f"{ident}: saved {label} ({sha[:12]})")
                    tracked[ident] = {"head": head}
                except Exception as exc:
                    error = str(exc)[:240]
                    print(f"{ident}: unable to sync ({error})")
        history = [v for _, v in sorted(enumerate(history), key=lambda pair: (pair[1].get("date", ""), pair[0]), reverse=True)]
        versions = history + [{**v, "legacy": True} for v in project.get("legacy", [])]
        output = {key: project[key] for key in ("id", "name", "description", "repo") if key in project}
        output["versions"] = versions
        if error:
            output["sync_note"] = error
        out_projects.append(output)
    if previous.get("projects") == out_projects and previous.get("tracked") == tracked:
        print("No changes; existing archive remains unchanged")
        return previous
    result = {"schema": 1, "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(), "projects": out_projects, "tracked": tracked}
    state_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Done: {sum(len(p['versions']) for p in out_projects)} versions")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--repo-base", type=Path, help="Override GitHub remote for tests")
    args = parser.parse_args()
    sync(args.root.resolve(), args.repo_base.resolve() if args.repo_base else None)
