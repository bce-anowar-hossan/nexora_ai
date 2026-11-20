import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
};

export default function Card({
  children,
  title,
  description,
  className = "",
  ...props
}: Props) {
  return (
    <section className={`ui-card ${className}`} {...props}>
      {(title || description) && (
        <div className="ui-card-header">
          {title && <h3>{title}</h3>}
          {description && <p>{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
