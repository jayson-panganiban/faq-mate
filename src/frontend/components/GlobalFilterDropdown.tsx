import { Check, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
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
  /** Optional per-row tooltip line (e.g. the issuing underwriter). */
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

/**
 * Matches the app-level `lg` breakpoint, mirroring the AppShell sidebar and the
 * 44px touch-target CSS ([`src/frontend/index.css`](../frontend/index.css)).
 */
const DESKTOP_QUERY = "(min-width: 1024px)";

/** Drag distance (px) past which the mobile sheet commits dismissal. */
const DRAG_DISMISS_THRESHOLD = 96;
const DESKTOP_MENU_MARGIN = 8;
const DESKTOP_MENU_MAX_HEIGHT = 322; // 20rem content height plus the menu border.

interface DesktopMenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "above" | "below";
}

/* --- Locked dropdown aesthetics (Spec 05 §4.1) — the single source of truth.
     Never copy these classes to screen code; compose this component instead. */

/** Options row: full-width flat target with the 1px hairline divider; the
     active selection is a deepened light-gray block plus the teal checkmark. */
const optionClass = (selected: boolean, disabled = false) =>
  `flex h-11 w-full items-center justify-between gap-2 border-b border-slate-200/70 px-3 text-left text-sm transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600/60 dark:border-slate-700/70 dark:focus-visible:ring-teal-400/60 ${
    selected
      ? "bg-slate-200 font-medium text-slate-900 dark:bg-slate-700 dark:text-white"
      : "text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:active:bg-slate-800/70"
  } ${disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent dark:hover:bg-transparent" : "cursor-pointer"}`;

/** Group header: muted small-caps. */
const groupHeaderClass =
  "px-3 pt-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase dark:text-slate-400";

/** Sticky search header separated by a 1px hairline border. */
const menuBodyClass =
  "flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5 sticky top-0 z-10 dark:border-slate-800 dark:bg-slate-900";

/** Compact chip trigger: icon + truncating label; teal when a choice is set. */
const chipTriggerClass =
  "flex h-11 min-h-[44px] min-w-[44px] max-w-full cursor-pointer items-center gap-1.5 rounded-xl px-2 transition-colors duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed dark:hover:bg-slate-800";

/** Form-field trigger: full-width hairline row, no pill bloat. */
const fieldTriggerClass =
  "flex min-h-[44px] min-w-0 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm transition-colors duration-150 hover:border-slate-400 focus:outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-500/60 disabled:cursor-not-allowed dark:border-slate-700 dark:hover:border-slate-600 dark:focus-visible:border-teal-500";

/**
 * True above the 1024px breakpoint. Falls back to desktop styling when
 * `matchMedia` is unavailable (testdom / exotic embedded webviews).
 */
function useDesktopViewport(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window.matchMedia === "function" ? window.matchMedia(DESKTOP_QUERY).matches : true
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

/**
 * GlobalFilterDropdown — the one dropdown in the application.
 *
 * Renders the approved selection menu design as a single responsive control:
 * an anchored command palette above the mobile breakpoint and a bottom sheet
 * below it. Desktop field pickers escape scroll clipping and flip to the
 * available side of their trigger. Both views share the same state logic (open/search/selection,
 * focus trap, keyboard navigation) and the locked internal UI (sticky hairline
 * search bar, muted small-caps group headers, flat hairline checklist rows,
 * deepened gray selection with a teal checkmark). Screen code must compose
 * this component — never fork its CSS.
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [desktopMenuPosition, setDesktopMenuPosition] = useState<DesktopMenuPosition | null>(null);
  const isDesktop = useDesktopViewport();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);

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
    if (!isOpen || !isDesktop || variant !== "field") {
      setDesktopMenuPosition(null);
      return;
    }

    const trigger = triggerRef.current;
    const menu = contentRef.current;
    if (!trigger || !menu) return;

    const updatePosition = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const menuHeight = Math.min(
        menu.getBoundingClientRect().height || DESKTOP_MENU_MAX_HEIGHT,
        DESKTOP_MENU_MAX_HEIGHT,
        window.innerHeight * 0.6
      );
      const availableAbove = Math.max(0, triggerRect.top - DESKTOP_MENU_MARGIN);
      const availableBelow = Math.max(
        0,
        window.innerHeight - triggerRect.bottom - DESKTOP_MENU_MARGIN
      );
      const placement =
        availableAbove >= menuHeight || availableAbove >= availableBelow ? "above" : "below";
      const availableSpace = placement === "above" ? availableAbove : availableBelow;
      const width = Math.min(320, window.innerWidth - DESKTOP_MENU_MARGIN * 2);
      const left = Math.max(
        DESKTOP_MENU_MARGIN,
        Math.min(triggerRect.left, window.innerWidth - width - DESKTOP_MENU_MARGIN)
      );
      const position: DesktopMenuPosition = {
        top:
          placement === "above"
            ? triggerRect.top - Math.min(menuHeight, availableSpace)
            : triggerRect.bottom,
        left,
        width,
        maxHeight: Math.min(menuHeight, availableSpace),
        placement,
      };

      setDesktopMenuPosition((current) =>
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
  }, [isDesktop, isOpen, variant]);

  // Escape dismisses and Tab traps focus inside whichever wrapper is mounted.
  // The content node is resolved at event time so a viewport flip (inline
  // palette <-> portalled sheet) keeps the trap pointed at the live node.
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

  // Outside pointer presses dismiss the palette (the sheet's backdrop is
  // likewise outside the content node, so one handler serves both wrappers).
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (contentRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
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
  const hasNoMatches =
    query.trim() !== "" &&
    filteredGroups.length === 0 &&
    (!isDefault || !allOption?.label.toLowerCase().includes(query.trim().toLowerCase()));

  const focusEdgeOption = (offset: 1 | -1) => {
    const options = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        "button[role='option']:not([disabled])"
      ) ?? []
    );
    if (!options.length) return;
    options[offset === 1 ? 0 : options.length - 1].focus();
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusEdgeOption(event.key === "ArrowDown" ? 1 : -1);
    }
  };

  const handleOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const options = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        "button[role='option']:not([disabled])"
      ) ?? []
    );
    const current = options.indexOf(event.currentTarget);
    if (current === -1) return;
    const step = event.key === "ArrowDown" ? 1 : -1;
    options[(current + step + options.length) % options.length].focus();
  };

  const handleSelect = (nextValue: string) => {
    if (disabledOptionValues.includes(nextValue)) return;
    onSelect(nextValue);
    close();
  };

  // Bottom sheet drag-to-dismiss: the transform is applied directly so the
  // gesture tracks pointer movement without intermediate reflow jank.
  const applyDragOffset = (offset: number) => {
    dragOffsetRef.current = offset;
    setDragOffset(offset);
  };

  const handleSheetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.isPrimary === false) return;
    if (!(event.target as HTMLElement).closest("[data-drag-grip]")) return;
    dragStartYRef.current = event.clientY;
    setIsDragging(true);
    try {
      if (typeof event.currentTarget.setPointerCapture === "function") {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } catch {
      // jsdom / older engines without pointer capture still track the lift.
    }
  };

  const handleSheetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    applyDragOffset(Math.max(0, event.clientY - dragStartYRef.current));
  };

  const settleDrag = () => {
    if (dragStartYRef.current === null) return;
    dragStartYRef.current = null;
    const offset = dragOffsetRef.current;
    applyDragOffset(0);
    setIsDragging(false);
    if (offset > DRAG_DISMISS_THRESHOLD) close();
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

  const renderOption = (option: GlobalFilterOption, selected: boolean) => {
    const isDisabled = disabledOptionValues.includes(option.value);
    return (
      <button
        key={option.value}
        type="button"
        role="option"
        aria-selected={selected}
        aria-disabled={isDisabled || undefined}
        data-value={option.value}
        title={option.title}
        onClick={() => handleSelect(option.value)}
        onKeyDown={handleOptionKeyDown}
        disabled={isDisabled}
        className={optionClass(selected, isDisabled)}
      >
        <span className="truncate">{option.label}</span>
        {selected && (
          <Check className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden="true" />
        )}
      </button>
    );
  };

  const options = (
    <div ref={listRef} role="listbox" aria-label={optionsAriaLabel} data-testid={testIds.options}>
      {allOption && renderOption(allOption, isDefault)}
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
            {group.options.map((option) => renderOption(option, option.value === value))}
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
  const desktopMenu =
    isOpen && isDesktop ? (
      <div
        ref={contentRef}
        id={ids.menu}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        data-testid={testIds.menu}
        data-placement={desktopMenuPosition?.placement}
        className={`${variant === "field" ? "fixed" : "absolute bottom-full left-0"} z-50 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900`}
        style={
          variant === "field"
            ? {
                top: desktopMenuPosition?.top ?? 0,
                left: desktopMenuPosition?.left ?? 0,
                width: desktopMenuPosition?.width ?? 320,
                maxHeight: desktopMenuPosition?.maxHeight,
                visibility: desktopMenuPosition ? "visible" : "hidden",
              }
            : undefined
        }
      >
        <div
          className="max-h-[min(20rem,60vh)] overflow-y-auto overscroll-contain"
          style={
            variant === "field" && desktopMenuPosition
              ? { maxHeight: Math.max(0, desktopMenuPosition.maxHeight - 2) }
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
        className={variant === "chip" ? chipTriggerClass : fieldTriggerClass}
      >
        {variant === "chip" ? (
          <>
            <SlidersHorizontal
              className={`h-5 w-5 shrink-0 ${
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
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-left">{selectedLabel}</span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
          </>
        )}
        <span id={ids.description} className="sr-only">
          {descriptionPrefix}: {selectedLabel}
        </span>
      </button>

      {desktopMenu &&
        (variant === "field" ? createPortal(desktopMenu, document.body) : desktopMenu)}

      {isOpen &&
        !isDesktop &&
        // Mobile: native bottom sheet anchored to the viewport bottom edge.
        createPortal(
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              data-testid={testIds.backdrop}
              aria-label={`Close ${ariaLabel.toLowerCase()} backdrop`}
              tabIndex={-1}
              onClick={close}
              className="absolute inset-0 w-full cursor-pointer bg-slate-950/50"
            />
            <div
              ref={contentRef}
              id={ids.menu}
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              data-testid={testIds.menu}
              onPointerDown={handleSheetPointerDown}
              onPointerMove={handleSheetPointerMove}
              onPointerUp={settleDrag}
              onPointerCancel={settleDrag}
              style={{
                transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
              }}
              className={`absolute inset-x-0 bottom-0 flex max-h-[min(75dvh,36rem)] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-2xl dark:bg-slate-900 ${
                isDragging ? "" : "transition-transform duration-200 ease-out"
              }`}
            >
              <div
                data-drag-grip
                data-testid={testIds.grip}
                className="flex touch-none justify-center pb-1.5 pt-2.5"
              >
                <div
                  data-testid={testIds.handle}
                  className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600"
                />
              </div>
              <div
                data-testid={testIds.scroll}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              >
                {stickySearch}
                {options}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
