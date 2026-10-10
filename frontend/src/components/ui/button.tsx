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
          "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-(--primary) disabled:opacity-50 disabled:pointer-events-none",
          variant === "default" && "bg-(--primary) text-white hover:bg-(--primary-hover)",
          variant === "outline" && "border border-(--border) bg-transparent hover:bg-(--surface-2) text-(--text)",
          variant === "ghost" && "bg-transparent hover:bg-(--surface-2) text-(--text)",
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
