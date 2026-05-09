import { type ReactNode } from "react";
import { clsx } from "clsx";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: React.MouseEventHandler;
}

export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      className={clsx(
        hover ? "card-hover" : "card",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
