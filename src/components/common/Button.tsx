import type { ButtonHTMLAttributes } from "react";

type Variant = "solid" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-base font-medium transition-all duration-200 ease-out hover:scale-[1.03] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

const variants: Record<Variant, string> = {
  solid: "bg-ink text-paper hover:bg-ink-soft",
  outline: "border border-line text-ink hover:border-ink/40 hover:bg-cream",
  ghost: "text-ink-soft hover:bg-cream hover:text-ink",
};

export function Button({
  variant = "solid",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
