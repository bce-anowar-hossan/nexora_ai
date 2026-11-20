import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export default function Input({
  label,
  error,
  id,
  className = "",
  ...props
}: Props) {
  const inputId = id || props.name;

  return (
    <div className="ui-input-wrapper">
      {label && <label htmlFor={inputId}>{label}</label>}
      <input
        {...props}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error && inputId ? `${inputId}-error` : undefined}
        className={`ui-input ${className}`}
      />
      {error && (
        <p id={inputId ? `${inputId}-error` : undefined} role="alert" className="ui-input-error">
          {error}
        </p>
      )}
    </div>
  );
}
