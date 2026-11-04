import { Check, ChevronsUpDown, Search, SlidersHorizontal } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export interface GlobalFilterOption {
  /** Canonical value committed to `onSelect` (may be "" for the default row). */
  value: string;
  /** Visible row label. */
  label: string;
  /** Optional per-row tooltip or secondary description (e.g. the issuing underwriter). */
  title?: string;
}

export interface GlobalFilterGroup {
  /** Stable key reused for DOM ids; falls back to the label. */
  id?: string;
  /** Muted small-caps group header text. */
  label: string;
  options: GlobalFilterOption[];
}

export interface GlobalFilterDropdownProps {
  /** Currently committed value; matched against option values. */
  value: string;
  /** Invoked with the newly selected option value. */
  onSelect: (value: string) => void;
  /** The approved grouped roster; search filters options by label + value. */
  groups: GlobalFilterGroup[];
  /**
   * The unfiltered default row pinned above the groups (e.g. "All Insurers").
   * Omit when every choice is an explicit option.
   */
  allOption?: GlobalFilterOption;
  /** Option values that cannot be chosen in this context (rendered disabled). */
  disabledOptionValues?: string[];
  /**
   * Stable DOM prefix: `${testIdPrefix}-trigger|-menu|-search|-options|-scroll|
   * -grip|-drag-handle|-backdrop|-description|-group-<id>`.
   */
  testIdPrefix: string;
  /** Accessible name of the trigger control. */
  ariaLabel: string;
  /** Accessible name of the options listbox. */
  optionsAriaLabel?: string;
  /** Accessible name and placeholder of the sticky search input. */
  searchAriaLabel?: string;
  searchPlaceholder?: string;
  /** Sr-only "selected" sentence prefix; defaults to "Selected insurer". */
  descriptionPrefix?: string;
  /** Chip label shown while the default (all) option is selected. */
  emptyLabel?: string;
  /** Formats the empty-search message; QA asserts the composer's wording. */
  formatNoMatches?: (query: string) => ReactNode;
  /**
   * "chip" (default): compact icon + truncating label, for toolbar slots.
   * "field": full-width select-style row with a trailing chevron, for forms.
   */
  variant?: "chip" | "field";
  /** Trigger id so an external `<label htmlFor>` can point at it. */
  triggerId?: string;
  disabled?: boolean;
  /**
   * "trigger" (default): the palette hangs off the trigger button.
   * "container": the wrapper stays unpositioned so the palette defers to the
   * nearest positioned ancestor (e.g. the rectangular composer card) and its
   * straight edges align flush with the container's bottom-left.
   */
  anchorTo?: "trigger" | "container";
  className?: string;
}

const MENU_MARGIN = 8;
const MENU_MAX_HEIGHT = 322; // 20rem content height plus the menu border.

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "above" | "below";
}

/**
 * Highlight component matching EasyUI Combobox:
 * Underlines the matching search substring as the user types.
 */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-semibold text-slate-950 underline decoration-teal-600/70 underline-offset-[3px] dark:text-white dark:decoration-teal-400/80">
        {text.slice(i, i + q.length)}
      </span>
      {text.slice(i + q.length)}
    </>
  );
}

/* --- Combobox Aesthetics (EasyUI Combobox Design) --- */

/**
 * Combobox options row: rounded option target with active gliding highlight,
 * search match underline, and selection checkmark.
 */
const optionClass = (selected: boolean, active: boolean, disabled = false) =>
  `relative flex min-h-[44px] h-11 w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600/60 dark:focus-visible:ring-teal-400/60 ${
    disabled
      ? "cursor-not-allowed opacity-40 hover:bg-transparent dark:hover:bg-transparent"
      : "cursor-pointer"
  } ${
    selected
      ? "bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-white"
      : active
        ? "text-slate-900 dark:text-white"
        : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
  }`;

/** Group header: muted small-caps. */
const groupHeaderClass =
  "px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase dark:text-slate-400 select-none";

/** Sticky search header separated by a 1px hairline border. */
const menuBodyClass =
  "flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5 sticky top-0 z-10 dark:border-slate-800 dark:bg-slate-900";

/** Compact chip trigger: icon + truncating label + trailing ChevronsUpDown. */
const chipTriggerClass =
  "flex h-11 min-h-[44px] min-w-[44px] max-w-full cursor-pointer items-center gap-1.5 rounded-xl px-2.5 transition-colors duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed dark:hover:bg-slate-800";

/** Form-field trigger: full-width hairline row with ChevronsUpDown. */
const fieldTriggerClass =
  "flex min-h-[44px] h-11 min-w-0 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-slate-300 bg-white dark:bg-slate-900 px-3 py-2 text-sm transition-colors duration-150 hover:border-slate-400 focus:outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-500/60 disabled:cursor-not-allowed dark:border-slate-700 dark:hover:border-slate-600 dark:focus-visible:border-teal-500 shadow-2xs";

/**
 * GlobalFilterDropdown — EasyUI Combobox component.
 *
 * A searchable select where one highlight glides between options as you move
 * (keyboard or mouse), the match underlines as you type, and the check pops
 * in on selection.
 */
export function GlobalFilterDropdown({
  value,
  onSelect,
  groups,
  allOption,
  disabledOptionValues = [],
  testIdPrefix,
  ariaLabel,
  optionsAriaLabel = "Options",
  searchAriaLabel = "Search options",
  searchPlaceholder = "Search options…",
  descriptionPrefix = "Selected insurer",
  emptyLabel,
  formatNoMatches,
  variant = "chip",
  triggerId,
  disabled = false,
  anchorTo = "trigger",
  className = "",
}: GlobalFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const ids = useMemo(
    () => ({
      menu: `${testIdPrefix}-menu`,
      options: `${testIdPrefix}-options`,
      description: `${testIdPrefix}-description`,
      group: (id: string) => `${testIdPrefix}-group-${id}`,
    }),
    [testIdPrefix]
  );
  const testIds = useMemo(
    () => ({
      menu: `${testIdPrefix}-menu`,
      trigger: `${testIdPrefix}-trigger`,
      search: `${testIdPrefix}-search`,
      options: `${testIdPrefix}-options`,
      scroll: `${testIdPrefix}-scroll`,
      grip: `${testIdPrefix}-grip`,
      handle: `${testIdPrefix}-drag-handle`,
      backdrop: `${testIdPrefix}-backdrop`,
    }),
    [testIdPrefix]
  );

  const isDefault = allOption ? value === allOption.value : value === "";
  const selectedLabel =
    groups.flatMap((group) => group.options).find((option) => option.value === value)?.label ??
    (isDefault ? (allOption?.label ?? "") : value);

  const close = useCallback(() => {
    setIsOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  // Drop a stale search phrase so the roster is complete on reopen.
  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  // Host interactions are blocked while disabled (streaming / throttled).
  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  // Place the caret in the search bar as soon as the menu opens.
  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || variant !== "field") {
      setMenuPosition(null);
      return;
    }

    const trigger = triggerRef.current;
    const menu = contentRef.current;
    if (!trigger || !menu) return;

    const updatePosition = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const menuHeight = Math.min(
        menu.getBoundingClientRect().height || MENU_MAX_HEIGHT,
        MENU_MAX_HEIGHT,
        window.innerHeight * 0.6
      );
      const availableAbove = Math.max(0, triggerRect.top - MENU_MARGIN);
      const availableBelow = Math.max(0, window.innerHeight - triggerRect.bottom - MENU_MARGIN);
      const placement =
        availableAbove >= menuHeight || availableAbove >= availableBelow ? "above" : "below";
      const availableSpace = placement === "above" ? availableAbove : availableBelow;
      const width = Math.min(320, window.innerWidth - MENU_MARGIN * 2);
      const left = Math.max(
        MENU_MARGIN,
        Math.min(triggerRect.left, window.innerWidth - width - MENU_MARGIN)
      );
      const position: MenuPosition = {
        top:
          placement === "above"
            ? triggerRect.top - Math.min(menuHeight, availableSpace) - 4
            : triggerRect.bottom + 4,
        left,
        width,
        maxHeight: Math.min(menuHeight, availableSpace),
        placement,
      };

      setMenuPosition((current) =>
        current &&
        current.top === position.top &&
        current.left === position.left &&
        current.width === position.width &&
        current.maxHeight === position.maxHeight &&
        current.placement === position.placement
          ? current
          : position
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updatePosition);
    resizeObserver?.observe(trigger);
    resizeObserver?.observe(menu);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      resizeObserver?.disconnect();
    };
  }, [isOpen, variant]);

  // Escape dismisses and Tab traps focus inside whichever wrapper is mounted.
  useEffect(() => {
    if (!isOpen) return;
    const keydown = (event: KeyboardEvent) => {
      const content = contentRef.current;
      if (!content) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        content.querySelectorAll<HTMLElement>("input, button:not([disabled])")
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [isOpen, close]);

  // Outside pointer presses dismiss the palette.
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (contentRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [isOpen, close]);

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter(
          (option) =>
            option.label.toLowerCase().includes(needle) ||
            option.value.toLowerCase().includes(needle)
        ),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);

  const flatOptions = useMemo(() => {
    const list: GlobalFilterOption[] = [];
    if (allOption) {
      const q = query.trim().toLowerCase();
      if (!q || allOption.label.toLowerCase().includes(q)) {
        list.push(allOption);
      }
    }
    for (const group of filteredGroups) {
      for (const opt of group.options) {
        list.push(opt);
      }
    }
    return list;
  }, [allOption, query, filteredGroups]);

  const hasNoMatches =
    query.trim() !== "" &&
    filteredGroups.length === 0 &&
    (!isDefault || !allOption?.label.toLowerCase().includes(query.trim().toLowerCase()));

  // Active highlighted option index for roving focus and gliding pill
  const [active, setActive] = useState<number>(0);
  const [box, setBox] = useState<{ y: number; h: number } | null>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const byKeyboard = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setBox(null);
      return;
    }
    const idx = flatOptions.findIndex((o) =>
      allOption && isDefault ? o.value === allOption.value : o.value === value
    );
    setActive(idx >= 0 ? idx : 0);
  }, [isOpen, value, allOption, isDefault, flatOptions]);

  useLayoutEffect(() => {
    if (!isOpen || flatOptions.length === 0) {
      setBox(null);
      return;
    }
    const currentOption = flatOptions[active];
    if (!currentOption) {
      setBox(null);
      return;
    }
    const el = itemRefs.current.get(currentOption.value);
    const listEl = listRef.current;
    if (!el || !listEl) {
      setBox(null);
      return;
    }
    const listRect = listEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const y = elRect.top - listRect.top + listEl.scrollTop;
    const h = elRect.height || el.offsetHeight || 44;
    setBox({ y, h });

    if (byKeyboard.current) {
      el.scrollIntoView({ block: "nearest" });
      byKeyboard.current = false;
    }
  }, [active, flatOptions, isOpen]);

  const focusEdgeOption = (offset: 1 | -1) => {
    const options = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        "button[role='option']:not([disabled])"
      ) ?? []
    );
    if (!options.length) return;
    const targetEl = options[offset === 1 ? 0 : options.length - 1];
    targetEl.focus();
    const val = targetEl.getAttribute("data-value");
    const idx = flatOptions.findIndex((o) => o.value === val);
    if (idx >= 0) setActive(idx);
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      byKeyboard.current = true;
      focusEdgeOption(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      byKeyboard.current = true;
      focusEdgeOption(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const current = flatOptions[active];
      if (current && !disabledOptionValues.includes(current.value)) {
        handleSelect(current.value);
      }
    }
  };

  const handleOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    byKeyboard.current = true;
    const options = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        "button[role='option']:not([disabled])"
      ) ?? []
    );
    const current = options.indexOf(event.currentTarget);
    if (current === -1) return;
    const step = event.key === "ArrowDown" ? 1 : -1;
    const nextEl = options[(current + step + options.length) % options.length];
    nextEl.focus();
    const nextVal = nextEl.getAttribute("data-value");
    const nextIdx = flatOptions.findIndex((o) => o.value === nextVal);
    if (nextIdx >= 0) setActive(nextIdx);
  };

  const handleSelect = (nextValue: string) => {
    if (disabledOptionValues.includes(nextValue)) return;
    onSelect(nextValue);
    close();
  };

  const stickySearch = (
    <div className={menuBodyClass}>
      <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
      <input
        ref={searchRef}
        data-testid={testIds.search}
        type="text"
        enterKeyHint="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleSearchKeyDown}
        aria-label={searchAriaLabel}
        aria-controls={ids.options}
        placeholder={searchPlaceholder}
        className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
  );

  const renderOption = (option: GlobalFilterOption, selected: boolean, index: number) => {
    const isDisabled = disabledOptionValues.includes(option.value);
    const isActive = active === index;
    return (
      <button
        key={option.value}
        ref={(el) => {
          if (el) itemRefs.current.set(option.value, el);
          else itemRefs.current.delete(option.value);
        }}
        type="button"
        role="option"
        aria-selected={selected}
        aria-disabled={isDisabled || undefined}
        aria-label={option.label}
        data-value={option.value}
        title={option.title}
        onClick={() => handleSelect(option.value)}
        onKeyDown={handleOptionKeyDown}
        onMouseMove={() => {
          if (!isDisabled && active !== index) {
            setActive(index);
          }
        }}
        onFocus={() => {
          if (active !== index) {
            setActive(index);
          }
        }}
        disabled={isDisabled}
        className={optionClass(selected, isActive, isDisabled)}
      >
        <span className="relative min-w-0 flex-1 truncate font-medium">
          <Highlight text={option.label} query={query} />
        </span>
        {selected && (
          <Check
            className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400 transition-transform duration-150 animate-in fade-in zoom-in-75"
            aria-hidden="true"
          />
        )}
      </button>
    );
  };

  const options = (
    <div
      ref={listRef}
      role="listbox"
      aria-label={optionsAriaLabel}
      data-testid={testIds.options}
      className="relative p-1"
    >
      {box && flatOptions.length > 0 && (
        <div
          aria-hidden="true"
          style={{
            transform: `translateY(${box.y}px)`,
            height: `${box.h}px`,
            transition:
              "transform 150ms cubic-bezier(0.4, 0, 0.2, 1), height 150ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-slate-100 dark:bg-slate-800/80"
        />
      )}
      {allOption &&
        (!query.trim() || allOption.label.toLowerCase().includes(query.trim().toLowerCase())) &&
        renderOption(allOption, isDefault, 0)}
      {filteredGroups.map((group) => {
        const groupId = group.id ?? group.label;
        return (
          <fieldset
            key={groupId}
            aria-labelledby={ids.group(groupId)}
            className="border-none p-0 m-0"
          >
            <div
              id={ids.group(groupId)}
              role="presentation"
              data-filter-group={groupId}
              className={groupHeaderClass}
            >
              {group.label}
            </div>
            {group.options.map((option) => {
              const flatIndex = flatOptions.findIndex((o) => o.value === option.value);
              return renderOption(option, option.value === value, flatIndex);
            })}
          </fieldset>
        );
      })}
      {hasNoMatches && (
        <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {formatNoMatches ? formatNoMatches(query.trim()) : `No matches for "${query.trim()}".`}
        </p>
      )}
    </div>
  );

  const chipLabel = isDefault ? (emptyLabel ?? allOption?.label ?? "") : selectedLabel;
  const comboboxMenu = isOpen ? (
    <div
      ref={contentRef}
      id={ids.menu}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      data-testid={testIds.menu}
      data-placement={menuPosition?.placement}
      className={`${
        variant === "field" ? "fixed" : "absolute bottom-full mb-2 left-0"
      } z-50 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg shadow-slate-900/10 dark:shadow-black/50 animate-in fade-in zoom-in-95 duration-100`}
      style={
        variant === "field"
          ? {
              top: menuPosition?.top ?? 0,
              left: menuPosition?.left ?? 0,
              width: menuPosition?.width ?? 320,
              maxHeight: menuPosition?.maxHeight,
              visibility: menuPosition ? "visible" : "hidden",
            }
          : undefined
      }
    >
      <div
        data-testid={testIds.scroll}
        className="max-h-[min(20rem,60vh)] overflow-y-auto overscroll-contain"
        style={
          variant === "field" && menuPosition
            ? { maxHeight: Math.max(0, menuPosition.maxHeight - 2) }
            : undefined
        }
      >
        {stickySearch}
        {options}
      </div>
    </div>
  ) : null;

  return (
    <div className={`inline-block ${anchorTo === "container" ? "" : "relative"} ${className}`}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        data-testid={testIds.trigger}
        aria-label={ariaLabel}
        aria-describedby={ids.description}
        title={selectedLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? ids.menu : undefined}
        disabled={disabled}
        onClick={() => {
          if (isOpen) close();
          else setIsOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className={
          variant === "field"
            ? `${fieldTriggerClass} ${
                isOpen ? "border-slate-400 dark:border-slate-600 ring-2 ring-teal-500/20" : ""
              }`
            : chipTriggerClass
        }
      >
        {variant === "chip" ? (
          <>
            <SlidersHorizontal
              className={`h-4 w-4 shrink-0 ${
                isDefault
                  ? "text-slate-500 dark:text-slate-400"
                  : "text-teal-700 dark:text-teal-400"
              }`}
              aria-hidden="true"
            />
            <span
              aria-hidden="true"
              className={`max-w-36 truncate text-xs font-medium ${
                isDefault
                  ? "text-slate-500 dark:text-slate-400"
                  : "text-teal-700 dark:text-teal-400"
              }`}
            >
              {chipLabel}
            </span>
            <ChevronsUpDown
              className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-left font-medium text-slate-900 dark:text-slate-100">
              {selectedLabel}
            </span>
            <ChevronsUpDown
              className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
          </>
        )}
        <span id={ids.description} className="sr-only">
          {descriptionPrefix}: {selectedLabel}
        </span>
      </button>

      {comboboxMenu &&
        (variant === "field" ? createPortal(comboboxMenu, document.body) : comboboxMenu)}
    </div>
  );
}
