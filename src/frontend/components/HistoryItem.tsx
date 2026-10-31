import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";

interface HistoryItemProps {
  id: string;
  label: string;
  onSelect: () => void;
  onDelete: () => void;
  mobile: boolean;
}

export function HistoryItem({ id, label, onSelect, onDelete, mobile }: HistoryItemProps) {
  const [offset, setOffset] = useState(0);
  const gesture = useRef<{
    x: number;
    y: number;
    start: number;
    horizontal: boolean;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  return (
    <div className="group relative overflow-hidden rounded-lg" data-testid={`history-item-${id}`}>
      {mobile && (
        <button
          type="button"
          data-testid={`history-swipe-delete-${id}`}
          aria-label={`Delete ${label}`}
          aria-hidden={offset === 0}
          disabled={offset === 0}
          tabIndex={offset === 0 ? -1 : 0}
          onClick={onDelete}
          className="absolute inset-y-0 right-0 w-[72px] bg-red-700 text-sm font-medium text-white lg:hidden"
        >
          Delete
        </button>
      )}
      {/* Pointer gestures supplement the accessible buttons inside the row. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: swipe gesture on a group of buttons */}
      <div
        className="relative flex bg-white motion-safe:transition-transform motion-safe:duration-150 dark:bg-slate-900"
        style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
        onPointerDown={(event) => {
          if (!mobile) return;
          gesture.current = {
            x: event.clientX,
            y: event.clientY,
            start: offset,
            horizontal: false,
            moved: false,
          };
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (!current) return;
          const dx = event.clientX - current.x;
          const dy = event.clientY - current.y;
          if (!current.horizontal && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy))
            current.horizontal = true;
          if (current.horizontal) {
            current.moved = true;
            setOffset(Math.max(-72, Math.min(0, current.start + dx)));
          }
        }}
        onPointerUp={(event) => {
          const current = gesture.current;
          if (!current) return;
          if (current.moved) {
            suppressClick.current = true;
            const dx = event.clientX - current.x;
            setOffset(dx < -40 ? -72 : dx > 40 ? 0 : current.start);
          }
          gesture.current = null;
        }}
        onPointerCancel={() => {
          setOffset(0);
          gesture.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && offset !== 0) {
            event.stopPropagation();
            setOffset(0);
          }
          if (event.key === "Delete") {
            event.preventDefault();
            onDelete();
          }
        }}
      >
        <button
          type="button"
          data-history-select
          className="min-h-[44px] min-w-0 flex-1 cursor-pointer rounded-lg px-3 text-left text-sm font-medium break-words text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            if (offset !== 0) {
              setOffset(0);
              return;
            }
            onSelect();
          }}
        >
          {label}
        </button>
        {!mobile && (
          <button
            type="button"
            data-testid={`history-delete-${id}`}
            aria-label={`Delete ${label}`}
            onClick={onDelete}
            className="pointer-events-none hidden min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center text-slate-500 opacity-0 hover:text-red-700 focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 lg:flex lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
