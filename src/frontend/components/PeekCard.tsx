import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export interface PeekCardProps {
  /** Target trigger element (e.g. citation pill, badge, link). */
  children: ReactNode;
  /** Preview content rendered inside the floating peek popover. */
  content: ReactNode;
  /** Hover activation delay in milliseconds (default: 200). */
  delay?: number;
  /** Placement preference: 'top' | 'bottom' | 'auto' (default: 'auto'). */
  placement?: "top" | "bottom" | "auto";
  /** Whether the peek preview is enabled (default: true). */
  enabled?: boolean;
  /** Optional click handler for opening full view. */
  onOpenFull?: () => void;
  /** Test ID for the popover element. */
  testId?: string;
}

interface PeekPosition {
  top: number;
  left: number;
  placement: "top" | "bottom";
}

const PEEK_MARGIN = 8;
const ESTIMATED_PEEK_HEIGHT = 180;
const ESTIMATED_PEEK_WIDTH = 320;

/**
 * PeekCard Component — EasyUI Peek Card
 *
 * An origin-anchored contextual preview popover that emerges directly from
 * target triggers on hover or focus with collision detection and rich metadata summaries.
 */
export function PeekCard({
  children,
  content,
  delay = 200,
  placement = "auto",
  enabled = true,
  onOpenFull,
  testId = "peek-card-popover",
}: PeekCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PeekPosition | null>(null);

  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const openTimeoutRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimeoutRef.current !== null) {
      window.clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const popover = popoverRef.current;
    const popoverHeight = popover?.offsetHeight || ESTIMATED_PEEK_HEIGHT;
    const popoverWidth = Math.min(ESTIMATED_PEEK_WIDTH, window.innerWidth - PEEK_MARGIN * 2);

    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;

    let computedPlacement: "top" | "bottom" = "top";
    if (placement === "top") {
      computedPlacement = "top";
    } else if (placement === "bottom") {
      computedPlacement = "bottom";
    } else {
      // Auto: prefer top unless room above is cramped
      computedPlacement =
        spaceAbove >= popoverHeight + PEEK_MARGIN || spaceAbove >= spaceBelow ? "top" : "bottom";
    }

    const top =
      computedPlacement === "top"
        ? Math.max(PEEK_MARGIN, triggerRect.top - popoverHeight - 6)
        : Math.min(window.innerHeight - popoverHeight - PEEK_MARGIN, triggerRect.bottom + 6);

    // Center horizontally on the trigger, clamped within screen margins
    const idealLeft = triggerRect.left + triggerRect.width / 2 - popoverWidth / 2;
    const left = Math.max(
      PEEK_MARGIN,
      Math.min(idealLeft, window.innerWidth - popoverWidth - PEEK_MARGIN)
    );

    setPosition({
      top,
      left,
      placement: computedPlacement,
    });
  }, [placement]);

  const handleMouseEnter = useCallback(() => {
    if (!enabled) return;
    clearTimers();
    openTimeoutRef.current = window.setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, delay);
  }, [enabled, delay, clearTimers, updatePosition]);

  const handleMouseLeave = useCallback(() => {
    clearTimers();
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, [clearTimers]);

  const handlePopoverMouseEnter = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  const handlePopoverMouseLeave = useCallback(() => {
    clearTimers();
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, [clearTimers]);

  const handleFocus = useCallback(() => {
    if (!enabled) return;
    clearTimers();
    updatePosition();
    setIsOpen(true);
  }, [enabled, clearTimers, updatePosition]);

  const handleBlur = useCallback(() => {
    clearTimers();
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, [clearTimers]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const popover = isOpen ? (
    <div
      ref={popoverRef}
      role="tooltip"
      tabIndex={0}
      data-testid={testId}
      data-placement={position?.placement}
      onMouseEnter={handlePopoverMouseEnter}
      onMouseLeave={handlePopoverMouseLeave}
      onClick={(e) => {
        e.stopPropagation();
        onOpenFull?.();
        setIsOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onOpenFull?.();
          setIsOpen(false);
        }
      }}
      className="fixed z-50 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-xl shadow-slate-900/10 dark:shadow-black/50 overflow-hidden cursor-pointer animate-in fade-in zoom-in-95 duration-150 select-none hover:border-teal-500/40 dark:hover:border-teal-400/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {content}
    </div>
  ) : null;

  if (!isValidElement(children)) {
    return <>{children}</>;
  }

  const childElement = children as ReactElement<{
    ref?: (node: HTMLElement | null) => void;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
  }>;

  const trigger = cloneElement(childElement, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const childRef = (children as unknown as { ref?: unknown }).ref;
      if (typeof childRef === "function") {
        childRef(node);
      } else if (childRef && typeof childRef === "object" && "current" in childRef) {
        (childRef as { current: unknown }).current = node;
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter();
      childElement.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave();
      childElement.props.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      handleFocus();
      childElement.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      handleBlur();
      childElement.props.onBlur?.(e);
    },
  });

  return (
    <>
      {trigger}
      {popover && createPortal(popover, document.body)}
    </>
  );
}
