// The search box with its dropdown of suggestions. Kept in its own file so any layout can place it.
// Before anything is typed it offers recent searches and NASA's test targets. While typing it
// offers matching well-known objects, typed coordinates, and asteroids and comets by name.
// Keys: down and up move through the rows, Enter chooses, Escape closes.
// Austin's side owns the look. The engine pieces used here are listed in docs/ui-checklist.md.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { actions, useStore, type Suggestion } from "../core";
import "./styles/search.css";

/** A short word shown beside a row, by where the row came from. */
const TAGS: Record<Suggestion["group"], string> = {
  recent: "Recent",
  nasa: "NASA test target",
  place: "Coordinates",
  famous: "",
  solar: "Solar system",
  match: "Name found",
};

export function SearchBox() {
  const suggestions = useStore((s) => s.suggestions);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  // The highlighted row, or -1 when the typed text itself will be searched.
  const [active, setActive] = useState(-1);
  const [problem, setProblem] = useState<string | null>(null);
  const listId = useId();
  const wrap = useRef<HTMLFormElement>(null);

  // Close the list when the pointer goes down anywhere else on the page.
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function show(value: string) {
    actions.suggest(value);
    setActive(-1);
    setOpen(true);
  }

  function run(query: string, shown: string) {
    setText(shown);
    setOpen(false);
    setActive(-1);
    setProblem(null);
    void actions.search(query);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const row = active >= 0 ? suggestions[active] : undefined;
    if (row) {
      run(row.query, row.label);
    } else if (text.trim()) {
      run(text, text);
    } else {
      setProblem('Enter a name such as "Vega", or J2000 coordinates such as "133.76 -7.24" or "08h55m10.8s -07d14m42s".');
    }
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        show(text);
        return;
      }
      const count = suggestions.length;
      if (!count) return;
      // Moving past either end returns to the typed text.
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => ((current + 1 + step + count + 1) % (count + 1)) - 1);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  const listed = open && suggestions.length > 0;
  return (
    <form className="search" onSubmit={submit} role="search" ref={wrap}>
      <label htmlFor={`${listId}-input`}>Find</label>
      <div className="search-field">
        <input
          id={`${listId}-input`}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setProblem(null);
            show(event.target.value);
          }}
          onFocus={() => show(text)}
          onKeyDown={onKey}
          placeholder="Object name, or RA and Dec (J2000), for example Vega or 08h55m10.8s -07d14m42s"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={listed}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={listed && active >= 0 ? `${listId}-${active}` : undefined}
        />
        {listed && (
          <ul className="search-list" id={listId} role="listbox" aria-label="Suggestions">
            {suggestions.map((row, index) => (
              <li
                key={`${row.group}:${row.query}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? "on" : undefined}
                // Pointer down, not click, so the choice lands before the input loses focus.
                onPointerDown={(event) => {
                  event.preventDefault();
                  run(row.query, row.label);
                }}
                onPointerEnter={() => setActive(index)}
              >
                <span className="search-name">{row.label}</span>
                <span className="search-detail">{row.detail}</span>
                {TAGS[row.group] && <span className="search-tag">{TAGS[row.group]}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit">Go</button>
      {problem && <p className="problem" role="alert">{problem}</p>}
    </form>
  );
}
