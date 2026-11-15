#!/usr/bin/env python3
# Guards against losing a tool in a UI redesign. Reads docs/ui-checklist.md and fails when an
# engine piece listed there is not used anywhere under web/src/ui/.
# Written with Claude Code (Anthropic) assistance.

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHECKLIST = ROOT / "docs" / "ui-checklist.md"
UI = ROOT / "web" / "src" / "ui"


def required():
    """(tool, piece) pairs from the third column of every table row in the checklist."""
    pairs = []
    for line in CHECKLIST.read_text().splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 3 or cells[0] in ("Tool", "---") or set(cells[0]) <= {"-"}:
            continue
        for piece in re.findall(r"`([^`]+)`", cells[2]):
            pairs.append((cells[0], piece))
    return pairs


# Compare the checklist with the UI source, print anything missing, and return 1 if something is.
def main():
    source = "\n".join(path.read_text() for path in sorted(UI.rglob("*")) if path.suffix in (".ts", ".tsx"))
    pairs = required()
    if len(pairs) < 40:
        print("The checklist could not be read. Check the tables in docs/ui-checklist.md.")
        return 1
    missing = []
    for tool, piece in pairs:
        # "actions.name" must appear as written. Anything else must appear as a whole word.
        pattern = re.escape(piece) + r"\b" if piece.startswith("actions.") else r"\b" + re.escape(piece) + r"\b"
        if not re.search(pattern, source):
            missing.append((tool, piece))
    if missing:
        print("The UI no longer uses these engine pieces. Each one is a tool that would be lost:")
        for tool, piece in missing:
            print(f"  {tool}: {piece}")
        print("See docs/ui-checklist.md. The starter UI in git history shows how each was wired.")
        return 1
    print(f"UI coverage check passed ({len(pairs)} engine pieces in use).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
