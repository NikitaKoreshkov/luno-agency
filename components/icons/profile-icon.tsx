import type { SVGProps } from "react";

type ProfileIconProps = SVGProps<SVGSVGElement> & { size?: number };

export function ProfileIcon({
  size = 16,
  className,
  ...rest
}: ProfileIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...rest}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" />
    </svg>
  );
}
