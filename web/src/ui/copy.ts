// Putting text on the clipboard. Browsers only offer the modern clipboard on secure pages, so
// a plain http address on a local network falls back to the older way.
// Written with Claude Code (Anthropic) assistance.

/** Copy text. Resolves to true when it worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const holder = document.createElement("textarea");
    holder.value = text;
    holder.style.position = "fixed";
    holder.style.opacity = "0";
    document.body.appendChild(holder);
    holder.select();
    const copied = document.execCommand("copy");
    holder.remove();
    return copied;
  } catch {
    return false;
  }
}
