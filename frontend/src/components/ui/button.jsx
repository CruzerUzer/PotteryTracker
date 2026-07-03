import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] text-sm font-semibold tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 select-none",
  {
    variants: {
      variant: {
        default: [
          "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)]",
          "text-white",
          "shadow-[0_1px_3px_rgba(139,69,19,0.25),0_1px_2px_rgba(139,69,19,0.15)]",
          "hover:brightness-105 hover:-translate-y-px hover:shadow-[0_4px_8px_rgba(139,69,19,0.3)]",
          "active:brightness-95 active:translate-y-0 active:shadow-sm",
        ].join(" "),
        destructive:
          "bg-[var(--color-error)] text-white shadow-sm hover:brightness-105 hover:-translate-y-px hover:shadow-md active:brightness-95",
        outline:
          "border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-hover)] text-[var(--color-text-primary)] shadow-[var(--shadow-xs)]",
        secondary:
          "bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] shadow-[var(--shadow-sm)] hover:-translate-y-px hover:shadow-[var(--shadow-md)]",
        ghost: "hover:bg-[var(--color-primary-light)] text-[var(--color-text-primary)] hover:text-[var(--color-primary)]",
        link: "text-[var(--color-primary)] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-9 px-4 py-2 gap-1.5",
        sm: "h-8 px-3 text-xs gap-1",
        lg: "h-11 px-6 text-base gap-2",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
