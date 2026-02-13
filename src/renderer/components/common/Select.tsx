import React, { useRef, useEffect } from "react";
import { ChevronDownIcon } from "../icons";
import { useDropdown } from "../../hooks/useDropdown";
import styles from "./Select.module.css";

export type SelectOption<T = string | number> = {
  value: T;
  label: string;
};

type SelectProps<T = string | number> = {
  value: T | null;
  onChange: (value: T | null) => void;
  options: SelectOption<T>[];
  placeholder: string;
  disabled?: boolean;
  id?: string;
  label?: React.ReactNode;
  "aria-label"?: string;
  className?: string;
  maxListHeight?: number;
};

function SelectInner<T extends string | number>({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  id,
  label,
  "aria-label": ariaLabel,
  className,
  maxListHeight = 220
}: SelectProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const { ref, isOpen, toggle, close } = useDropdown([listRef]);

  const selectedOption = value !== null && value !== "" ? options.find((o) => o.value === value) : null;
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (opt: SelectOption<T>) => {
    onChange(opt.value === "" ? null : (opt.value as T));
    close();
  };

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const list = listRef.current;
    const selector = value !== null && value !== "" ? `[data-value="${String(value)}"]` : "[data-value='']";
    const selected = list.querySelector(selector);
    if (selected) selected.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [isOpen, value]);

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(" ")}>
      {label != null ? (
        <span className={styles.label} id={id ? `${id}-label` : undefined}>
          {label}
        </span>
      ) : null}
      <div ref={ref} className={[styles.root, isOpen && styles.rootOpen].filter(Boolean).join(" ")}>
        <button
          type="button"
          id={id}
          className={styles.trigger}
          onClick={disabled ? undefined : toggle}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={ariaLabel ?? placeholder}
          aria-labelledby={label != null && id ? `${id}-label` : undefined}
        >
          <span className={styles.triggerText}>{displayLabel}</span>
          <ChevronDownIcon
            className={styles.chevron}
            aria-hidden
          />
        </button>
        {isOpen && (
          <div
            ref={listRef}
            className={styles.list}
            role="listbox"
            aria-activedescendant={value != null ? String(value) : undefined}
            style={{ maxHeight: maxListHeight }}
          >
            <button
              type="button"
              role="option"
              aria-selected={value === null || value === ""}
              data-value=""
              className={[styles.option, (!value || value === "") && styles.optionSelected].filter(Boolean).join(" ")}
              onClick={() => handleSelect({ value: "" as T, label: placeholder })}
            >
              {placeholder}
            </button>
            {options.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={value === opt.value}
                data-value={String(opt.value)}
                className={[styles.option, value === opt.value && styles.optionSelected].filter(Boolean).join(" ")}
                onClick={() => handleSelect(opt)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SelectInner;
