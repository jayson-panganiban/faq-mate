export interface AppIconProps {
  size?: number;
  className?: string;
}

/**
 * FAQ-Mate application brand mark: a faceted duotone shield with an inner
 * policy-verification check, sized to the 24x24 optical grid used in the
 * desktop sidebar header and mobile app bar.
 */
export function AppIcon({ size = 24, className = "" }: AppIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-testid="app-icon"
      className={`lucide lucide-shield ${className}`.trim()}
    >
      {/* Soft duotone shield base */}
      <path
        d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="none"
      />
      {/* Asymmetric heraldic right facet for dimensional depth */}
      <path
        d="M12 2.02c.27 0 .54.09.76.26C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.34.05V2.02z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="none"
      />
      {/* Crisp outer shield silhouette */}
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      {/* Grounded clause verification mark */}
      <path d="M9 12 L11 14 L15 10" />
    </svg>
  );
}
