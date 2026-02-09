import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export const useDropdown = (
  extraRefs: Array<RefObject<HTMLElement | null>> = []
) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (event: MouseEvent) => {
      if (!ref.current) return;
      const target = event.target as Node;
      const isInside = [ref, ...extraRefs].some((item) =>
        item.current?.contains(target)
      );
      if (!isInside) {
        setIsOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  const toggle = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  return {
    ref,
    isOpen,
    setIsOpen,
    toggle,
    close
  };
};
