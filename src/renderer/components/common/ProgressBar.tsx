import React from "react";
import styles from "./ProgressBar.module.css";

type ProgressBarProps = {
  percent?: number;
  label?: string;
  className?: string;
};

export const ProgressBar = ({ percent = 0, label, className }: ProgressBarProps) => {
  const clampedPercent = Math.max(0, Math.min(100, percent));

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      {label && <div className={styles.label}>{label}</div>}
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${clampedPercent}%` }}
          role="progressbar"
          aria-valuenow={clampedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
      {percent !== undefined && (
        <div className={styles.percent}>{Math.round(clampedPercent)}%</div>
      )}
    </div>
  );
};
