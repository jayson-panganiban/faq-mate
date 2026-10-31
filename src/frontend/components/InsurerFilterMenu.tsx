import { getGroupedInsurerOptions, PRIMARY_INSURERS } from "../../constants/insurers";
import { GlobalFilterDropdown, type GlobalFilterGroup } from "./GlobalFilterDropdown";

export interface InsurerFilterMenuProps {
  /** Uppercase insurer filter code, or "" to query the general corpus. */
  value: string;
  /** Invoked with the newly selected code; "" clears the filter. */
  onSelect: (value: string) => void;
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

const GROUPED_OPTIONS = getGroupedInsurerOptions();
const ALL_INSURERS_LABEL = `All Insurers (${PRIMARY_INSURERS.length})`;

/** Domain roster shaped for the shared dropdown (underwriter as row tooltip). */
const GROUPS: GlobalFilterGroup[] = GROUPED_OPTIONS.map((group) => ({
  id: group.category,
  label: group.label,
  options: group.options.map((option) => ({
    value: option.value,
    label: option.label,
    title: option.underwriter,
  })),
}));

/**
 * "All Insurers" filter — the insurers domain composition of the approved
 * `GlobalFilterDropdown` menu: an anchored command palette above the mobile
 * breakpoint and a bottom sheet below it, sharing the locked internal UI
 * (sticky hairline search, muted small-caps group headers, flat hairline
 * checklist rows with the deepened gray selection and teal checkmark).
 */
export function InsurerFilterMenu({
  value,
  onSelect,
  disabled = false,
  anchorTo = "trigger",
  className = "",
}: InsurerFilterMenuProps) {
  return (
    <GlobalFilterDropdown
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      anchorTo={anchorTo}
      className={className}
      testIdPrefix="insurer-filter"
      ariaLabel="Filter by insurer"
      optionsAriaLabel="Insurer options"
      searchAriaLabel="Search insurers"
      searchPlaceholder="Search insurers…"
      descriptionPrefix="Selected insurer"
      emptyLabel="All Insurers"
      formatNoMatches={(query) => `No insurers match “${query}”.`}
      groups={GROUPS}
      allOption={{ value: "", label: ALL_INSURERS_LABEL }}
    />
  );
}
