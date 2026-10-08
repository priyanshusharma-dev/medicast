import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-[var(--surface-2)] text-[var(--text)]",
    LOW: "bg-[#DCFCE7] text-[#16A34A] dark:bg-[#0F2E1C]",
    MEDIUM: "bg-[#FEF3C7] text-[#D97706] dark:bg-[#3A2A0A]",
    HIGH: "bg-[#FEE2E2] text-[#DC2626] dark:bg-[#3A1214]",
    CRITICAL: "bg-[#991B1B] text-[#FFFFFF]"
  }
  
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
