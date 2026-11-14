#!/usr/bin/env python3
# Repo-wide text check for the team writing rules in CLAUDE.md.
# Fails on an em dash, a middle dot, or any name for SI other than "SI".
# Written with Claude Code (Anthropic) assistance.

import re
import subprocess
import sys

# Built from code points and fragments so this file passes its own check.
BANNED_CHARS = {chr(0x2014): "em dash", chr(0x00B7): "middle dot"}
BANNED_WORDS = re.compile(r"\b(" + "A" + "I" + r"|[Aa]rtificial [Ii]ntelligence)\b")

# Third-party text and generated files are not ours to restyle.
SKIP = ("LICENSE", "package-lock.json", "uv.lock")


def tracked_files():
    """Every file git knows about or would add, minus ignored ones."""
    out = subprocess.run(
        ["git", "ls-files", "-co", "--exclude-standard"],
        capture_output=True, text=True, check=True,
    )
    return [f for f in out.stdout.splitlines() if not f.endswith(SKIP)]


def main():
    problems = 0
    for name in tracked_files():
        try:
            with open(name, encoding="utf-8") as handle:
                lines = handle.read().splitlines()
        except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
            continue  # binary or deleted
        for number, line in enumerate(lines, 1):
            for char, label in BANNED_CHARS.items():
                if char in line:
                    print(f"{name}:{number}: {label}")
                    problems += 1
            if BANNED_WORDS.search(line):
                print(f"{name}:{number}: use the term SI")
                problems += 1
    if problems:
        print(f"{problems} problem(s). See Rule 2 and Rule 4 in CLAUDE.md.")
        return 1
    print("Text check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
