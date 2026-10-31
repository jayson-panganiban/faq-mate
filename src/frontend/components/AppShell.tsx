import { Columns, History, Menu, MessageSquare, PanelLeft, Plus, Shield, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { RateLimitInfo, TelemetryInfo } from "../types/chat-ui";
import { ComplianceFooter } from "./ComplianceFooter";
import { HistoryItem } from "./HistoryItem";
import { RateLimitBadge } from "./RateLimitBadge";

export interface AppShellProps {
  telemetry?: TelemetryInfo;
  rateLimit?: RateLimitInfo;
  isThrottled?: boolean;
  isComparisonMode?: boolean;
  hideFooterGaw?: boolean;
  onToggleComparison?: () => void;
  onReset?: () => void;
  historyItems?: { id: string; label: string }[];
  onSelectHistory?: (id: string) => void;
  onDeleteHistory?: (id: string) => void;
  onClearHistory?: () => void;
  onUndoHistoryDeletion?: () => void;
  canUndoHistoryDeletion?: boolean;
  /** Developer debug mode; routed to the footer switch. */
  debugMode?: boolean;
  /** Flips the debug mode switch; omitting it hides the control. */
  onToggleDebugMode?: () => void;
  children: ReactNode;
  className?: string;
}

const actionClass =
  "inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium cursor-pointer text-slate-700 hover:bg-teal-50 hover:text-teal-800 dark:text-slate-200 dark:hover:bg-slate-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500";

/**
 * Sidebar primary action: a distinct bordered container with a faint surface
 * so it reads as a button, not a static navigation list row.
 */
const primaryActionClass =
  "inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium cursor-pointer text-slate-900 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-700/70";

/**
 * Sidebar navigation row: neutral gray hover/active states keep the tabs
 * quiet — the active view is marked by a subtle gray block with bolder
 * primary-colored text rather than a tinted wedge.
 */
const navItemClass =
  "inline-flex min-h-[44px] min-w-[44px] w-full items-center gap-2 rounded-lg px-3 text-sm font-medium cursor-pointer text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500";

export function AppShell({
  rateLimit,
  isThrottled = false,
  isComparisonMode = false,
  onToggleComparison,
  onReset,
  historyItems = [],
  onSelectHistory,
  onDeleteHistory,
  onClearHistory,
  onUndoHistoryDeletion,
  canUndoHistoryDeletion = false,
  debugMode,
  onToggleDebugMode,
  children,
  className = "",
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  /**
   * iOS keyboard anchoring: `100dvh`/`dvh` never shrink when the software
   * keyboard opens, so while the keyboard is up the shell is sized to the
   * *visual* viewport and translated by its `offsetTop` — the layout viewport
   * Safari scrolls on focus would otherwise leave the bottom-pinned composer
   * flying away from the keyboard edge.
   */
  const [viewportState, setViewportState] = useState<{ height?: number; top?: number }>();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const desktopHistory = useRef<HTMLHeadingElement>(null);
  const mobileHistory = useRef<HTMLHeadingElement>(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    requestAnimationFrame(() => menuTrigger.current?.focus());
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    // Pinch zooms (scale !== 1) are ignored: the layout stays put and zoom
    // panning frees the shell from keyboard compensation entirely.
    const update = () =>
      setViewportState(
        viewport.scale === 1 ? { height: viewport.height, top: viewport.offsetTop } : undefined
      );
    update();
    viewport.addEventListener("resize", update);
    // offsetTop also changes while the user pans the zoomed-out layout under
    // an open keyboard, so scroll events must refresh the compensation.
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current?.querySelector<HTMLElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [tabindex='0']"
        ) ?? []
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (document.activeElement === mobileHistory.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [drawerOpen, closeDrawer]);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(min-width: 1024px)");
    const change = () => {
      if (media.matches) setDrawerOpen(false);
    };
    media.addEventListener("change", change);
    change();
    return () => media.removeEventListener("change", change);
  }, []);

  const navigation = (mobile: boolean) => {
    const compact = !mobile && collapsed;
    return (
      <>
        {/* Drawer/mobile header: justified so the close control pins to the
            right edge on every width; the close glyph is a solid 44x44 target. */}
        <div className="flex items-start justify-between gap-2 px-2 pt-4 pb-3">
          <button
            type="button"
            data-testid={mobile ? undefined : "reset-chat-button"}
            aria-label="Start new chat"
            title="Start new chat"
            onClick={() => {
              onReset?.();
              if (mobile) closeDrawer();
            }}
            className={`${primaryActionClass} ${
              compact ? "justify-center px-0" : mobile ? "justify-start" : "flex-1 justify-start"
            }`}
          >
            <Plus size={20} aria-hidden="true" />
            {!compact && "New Chat"}
          </button>
          {mobile && (
            <button
              type="button"
              aria-label="Close navigation"
              title="Close navigation"
              onClick={closeDrawer}
              // Exact 44x44 target with the glyph centered, shrunk to nothing
              // and separated from "New Chat" by the row's gap.
              className={`${actionClass} h-11 w-11 shrink-0 justify-center px-0`}
            >
              <X size={20} />
            </button>
          )}
        </div>
        <nav
          aria-label={mobile ? "Mobile navigation" : "Main navigation"}
          className="space-y-1 px-2"
        >
          <button
            type="button"
            aria-label="Chat"
            title="Chat"
            aria-current={!isComparisonMode ? "page" : undefined}
            className={`${navItemClass} ${compact ? "justify-center px-0" : "justify-start"} ${!isComparisonMode ? "bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white" : ""}`}
            onClick={() => {
              if (isComparisonMode) onToggleComparison?.();
              if (mobile) closeDrawer();
            }}
          >
            <MessageSquare size={20} aria-hidden="true" />
            {!compact && "Chat"}
          </button>
          {onToggleComparison && (
            <button
              type="button"
              data-testid={mobile ? undefined : "comparison-toggle"}
              aria-label={
                isComparisonMode ? "Switch to chat view" : "Switch to policy comparison view"
              }
              title="Compare policies"
              aria-pressed={isComparisonMode}
              aria-current={isComparisonMode ? "page" : undefined}
              className={`${navItemClass} ${compact ? "justify-center px-0" : "justify-start"} ${isComparisonMode ? "bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white" : ""}`}
              onClick={() => {
                if (!isComparisonMode) onToggleComparison();
                if (mobile) closeDrawer();
              }}
            >
              <Columns size={20} aria-hidden="true" />
              {!compact && "Compare policies"}
            </button>
          )}
        </nav>
        {compact ? (
          <button
            type="button"
            aria-label="History"
            title="History"
            className={`${actionClass} mx-2 mt-6 justify-center px-0`}
            onClick={() => {
              setCollapsed(false);
              requestAnimationFrame(() => desktopHistory.current?.focus());
            }}
          >
            <History size={20} aria-hidden="true" />
          </button>
        ) : (
          <section className="min-h-0 flex flex-1 flex-col pt-6">
            <div className="min-h-0 flex-1 overflow-y-auto px-2">
              <h2
                ref={mobile ? mobileHistory : desktopHistory}
                tabIndex={-1}
                className="px-3 pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400"
              >
                History
              </h2>
              <p className="px-3 pb-2 text-xs text-slate-500 dark:text-slate-400">
                This conversation
              </p>
              {historyItems.length === 0 ? (
                <p className="px-3 pb-2 text-sm text-slate-400 italic dark:text-slate-500">
                  Your questions will appear here.
                </p>
              ) : (
                historyItems.map((item, index) => (
                  <HistoryItem
                    mobile={mobile}
                    key={item.id}
                    {...item}
                    onSelect={() => {
                      onSelectHistory?.(item.id);
                      if (mobile) closeDrawer();
                    }}
                    onDelete={() => {
                      onDeleteHistory?.(item.id);
                      const next = historyItems[index + 1] ?? historyItems[index - 1];
                      requestAnimationFrame(() => {
                        const container = mobile
                          ? drawerRef.current
                          : document.getElementById("desktop-sidebar");
                        const row = next
                          ? container?.querySelector<HTMLElement>(
                              `[data-testid="history-item-${next.id}"] [data-history-select]`
                            )
                          : null;
                        (row ?? (mobile ? mobileHistory.current : desktopHistory.current))?.focus();
                      });
                    }}
                  />
                ))
              )}
            </div>
            <div className="shrink-0 px-5 pb-3">
              {historyItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClearHistory?.();
                    requestAnimationFrame(() =>
                      (mobile ? drawerRef.current : document.getElementById("desktop-sidebar"))
                        ?.querySelector<HTMLButtonElement>("[data-undo-history]")
                        ?.focus()
                    );
                  }}
                  className="block min-h-[44px] text-sm text-slate-500 hover:text-red-700 dark:text-slate-400 dark:hover:text-red-400"
                >
                  Clear all history
                </button>
              )}
              {canUndoHistoryDeletion && (
                <button
                  type="button"
                  data-undo-history
                  onClick={onUndoHistoryDeletion}
                  className="block min-h-[44px] text-sm text-slate-500 hover:text-teal-800 dark:text-slate-400 dark:hover:text-teal-400"
                >
                  Undo deletion
                </button>
              )}
            </div>
          </section>
        )}
      </>
    );
  };
  return (
    <div
      className={`chat-app flex overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${className}`}
      style={
        viewportState === undefined
          ? undefined
          : {
              height: viewportState.height,
              transform: viewportState.top ? `translateY(${viewportState.top}px)` : undefined,
            }
      }
    >
      <aside
        id="desktop-sidebar"
        data-collapsed={collapsed}
        className={`hidden lg:flex ${collapsed ? "w-16" : "w-64"} shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900`}
      >
        {navigation(false)}
      </aside>
      <div inert={drawerOpen || undefined} className="min-w-0 flex flex-1 flex-col">
        <header className="shrink-0 z-30 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 pt-[env(safe-area-inset-top,0px)]">
          <div className="relative flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <button
                ref={menuTrigger}
                type="button"
                aria-label="Open navigation"
                aria-expanded={drawerOpen}
                aria-controls="mobile-navigation"
                onClick={() => setDrawerOpen(true)}
                className={`${actionClass} lg:hidden`}
              >
                <Menu size={20} />
              </button>
              <button
                id="sidebar-toggle"
                type="button"
                aria-label="Toggle sidebar"
                aria-expanded={!collapsed}
                aria-controls="desktop-sidebar"
                onClick={() => setCollapsed((value) => !value)}
                className={`${actionClass} hidden lg:inline-flex`}
              >
                <PanelLeft size={20} />
              </button>
              <Shield className="hidden sm:block h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h1 className="text-sm font-bold">FAQ-Mate</h1>
                <p className="hidden sm:block text-xs text-slate-600 dark:text-slate-400">
                  Australian insurance, explained
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isThrottled && <RateLimitBadge rateLimit={rateLimit} />}
              <button
                type="button"
                id="mobile-new-chat-button"
                data-testid="mobile-new-chat-button"
                aria-label="Start new chat"
                onClick={onReset}
                className={`${actionClass} justify-center px-0 lg:hidden`}
              >
                <Plus size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
          {isThrottled && (
            <div className="max-w-[800px] mx-auto px-3 pb-2">
              <RateLimitBadge rateLimit={rateLimit} isThrottled />
            </div>
          )}
        </header>
        <main className="min-h-0 flex-1 flex flex-col w-full max-w-[800px] mx-auto px-3 sm:px-4 lg:pt-4 overflow-hidden relative">
          {children}
        </main>
        <ComplianceFooter debugEnabled={debugMode} onToggleDebug={onToggleDebugMode} />
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation backdrop"
            tabIndex={-1}
            onClick={closeDrawer}
            className="absolute inset-0 w-full bg-slate-950/50"
          />
          <aside
            ref={drawerRef}
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-64 max-w-[85vw] flex-col pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] bg-white shadow-xl dark:bg-slate-900"
          >
            {navigation(true)}
          </aside>
        </div>
      )}
    </div>
  );
}
