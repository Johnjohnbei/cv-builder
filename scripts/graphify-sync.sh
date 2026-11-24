#!/bin/sh
# Keeps the COMMITTED graph (graphify-out/) current, so everyone who clones the repo reads a graph that matches the code.
# Modes:  --check  exit 1 when stale, change nothing (default)
#         --build  rebuild graphify-out/ only
#         --sync   if stale: rebuild, commit graphify-out/ only (what the pre-push hook runs)
# STALE = a code file changed in a commit made AFTER the last commit that touched graphify-out/. Decided from git
# history, never from file dates. Pattern: global CLAUDE.md "Graphe commité", reference implementation DESYRE.
# Rebuild = drop every code node, then re-extract (AST only, no LLM): graphify's own update keeps the nodes of deleted
# files and deleted symbols forever.
set -e
cd "$(git rev-parse --show-toplevel)"
MODE=${1:---check}
PY=${GRAPHIFY_PYTHON:-$(command -v python3 || command -v python || true)}
CODE_GLOBS="*.ts *.tsx *.js *.jsx *.mjs *.cjs *.py"

stale_files() {
  last=$(git log -1 --format=%H -- graphify-out 2>/dev/null || true)
  if [ -z "$last" ]; then echo "(graph never committed)"; return; fi
  # Pathspecs, not shell globs: switch globbing off or *.ts expands to the files of the repo root.
  set -f
  # shellcheck disable=SC2086
  git diff --name-only "$last" HEAD -- $CODE_GLOBS ':!graphify-out' ':!node_modules' ':!dist'
  set +f
}

build() {
  [ -n "$PY" ] && "$PY" -c "import graphify" 2>/dev/null || { echo "[graphify] not installed (pip install graphifyy): graph not rebuilt" >&2; return 2; }
  "$PY" - <<'PYEOF'
import json
from pathlib import Path
from graphify.watch import _rebuild_code

graph = Path("graphify-out/graph.json")
before = graph.read_text(encoding="utf-8") if graph.exists() else None
if before:
    data = json.loads(before)
    data["nodes"] = [n for n in data["nodes"] if n.get("file_type") != "code"]
    graph.write_text(json.dumps(data), encoding="utf-8")
try:
    ok = _rebuild_code(Path("."))
except Exception as e:
    print("[graphify] rebuild error:", e)
    ok = False
if not ok:
    if before:
        graph.write_text(before, encoding="utf-8")
    raise SystemExit(1)
PYEOF
}

case "$MODE" in
  --build) build ;;
  --check|--sync)
    changed=$(stale_files)
    if [ -z "$changed" ]; then echo "[graphify] graph is current"; exit 0; fi
    n=$(printf '%s\n' "$changed" | wc -l | tr -d ' ')
    if [ "$MODE" = "--check" ]; then echo "[graphify] STALE: $n file(s) changed since the last graph commit, e.g. $(printf '%s\n' "$changed" | head -1)"; exit 1; fi
    build || exit $?
    git add -A -- graphify-out
    if git diff --cached --quiet -- graphify-out; then echo "[graphify] rebuilt, identical to the committed graph"; exit 0; fi
    git commit -q -m "chore(graphify): refresh the graph ($n source file(s) changed since the last refresh)" -- graphify-out
    echo "[graphify] graph refreshed and committed (graphify-out/ only)" ;;
  *) echo "usage: graphify-sync.sh [--check|--build|--sync]" >&2; exit 64 ;;
esac
