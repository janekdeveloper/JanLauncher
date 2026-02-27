import type { ReactNode } from "react";
import styles from "./AboutCard.module.css";

type AboutCardProps = {
  children: ReactNode;
  className?: string;
};

const AboutCard = ({ children, className }: AboutCardProps) => {
  return (
    <div className={[styles.card, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
};

export default AboutCard;
