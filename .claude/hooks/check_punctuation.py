#!/usr/bin/env python3
# Claude Code PreToolUse hook. Blocks Write and Edit calls whose new text
# contains an em dash (U+2014) or a middle dot (U+00B7), per the team
# writing rules in CLAUDE.md.
# Written with Claude Code (Anthropic) assistance.

import json
import sys

# Characters the team never writes, mapped to readable names.
BANNED = {
    "\u2014": "em dash",
    "\u00b7": "middle dot",
}

# Input fields that hold paths or the text being replaced, not new text.
SKIP_KEYS = {"file_path", "old_string"}


def new_text(tool_input):
    """Collect every string the edit would write, including MultiEdit lists."""
    parts = []
    for key, value in tool_input.items():
        if key in SKIP_KEYS:
            continue
        if isinstance(value, str):
            parts.append(value)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    parts.extend(
                        v for k, v in item.items()
                        if k not in SKIP_KEYS and isinstance(v, str)
                    )
    return "\n".join(parts)


def main():
    try:
        event = json.load(sys.stdin)
    except json.JSONDecodeError:
        # Unreadable input is not ours to judge. Let the tool run.
        return 0

    tool_input = event.get("tool_input") or {}
    text = new_text(tool_input)
    found = [name for char, name in BANNED.items() if char in text]
    if not found:
        return 0

    # Exit code 2 blocks the edit and sends this message back to Claude.
    target = tool_input.get("file_path", "this edit")
    print(
        f"Blocked: {' and '.join(found)} in the new text for {target}. "
        "Team rule: never use em dashes or middle dots. "
        "Rewrite with commas, periods, colons, parentheses, or separate sentences.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
