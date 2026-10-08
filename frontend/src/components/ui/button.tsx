import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:pointer-events-none",
          variant === "default" && "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]",
          variant === "outline" && "border border-[var(--border)] bg-transparent hover:bg-[var(--surface-2)] text-[var(--text)]",
          variant === "ghost" && "bg-transparent hover:bg-[var(--surface-2)] text-[var(--text)]",
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
