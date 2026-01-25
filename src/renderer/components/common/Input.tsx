import React from "react";
import styles from "./Input.module.css";

type InputProps = {
  label?: string;
  helper?: string;
  error?: string;
  multiline?: boolean;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Input = ({
  label,
  helper,
  error,
  multiline,
  className,
  ...props
}: InputProps) => {
  const fieldClassName = [styles.input, className].filter(Boolean).join(" ");

  return (
    <label className={styles.field}>
      {label ? <span className={styles.label}>{label}</span> : null}
      {multiline ? (
        <textarea
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          className={fieldClassName}
        />
      ) : (
        <input
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          className={fieldClassName}
        />
      )}
      {error ? (
        <span className={styles.error}>{error}</span>
      ) : helper ? (
        <span className={styles.helper}>{helper}</span>
      ) : null}
    </label>
  );
};

export default Input;
