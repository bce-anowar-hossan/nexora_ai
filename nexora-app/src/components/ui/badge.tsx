import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "info";
};

export default function Badge({
  children,
  variant = "default",
  className = "",
  ...props
}: Props) {
  return (
    <span
      {...props}
      className={`ui-badge ui-badge-${variant} ${className}`}
    >
      {children}
    </span>
  );
}
