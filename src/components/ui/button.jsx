import * as React from "react"
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui"

import { cn } from "src/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-2xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'rounded-[9px] text-white border border-white/[0.18] hover:brightness-[1.06] hover:-translate-y-px active:translate-y-0',
        outline:
          'rounded-[9px] text-pine bg-white border border-[--border-color] hover:bg-[#FAF8F5] hover:-translate-y-px hover:border-[rgba(var(--tenant-primary-rgb),0.30)] hover:shadow-[0_8px_20px_rgba(23,23,23,0.08)] active:translate-y-0',
        amber:
          'rounded-[9px] text-white bg-gradient-to-br from-[#C89B5C] to-[#B38443] border border-white/[0.18] shadow-[0_8px_18px_rgba(184,134,11,0.16)] hover:brightness-105 hover:-translate-y-px hover:shadow-[0_11px_24px_rgba(184,134,11,0.24)] active:translate-y-0',
        ghost:
          'rounded-[9px] text-pine hover:bg-[#FAF8F5]',
        destructive:
          'rounded-[9px] bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link:
          'text-pine underline-offset-4 hover:underline',
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    // Apply dynamic background gradient for default variant using CSS variables
    const dynamicStyle = variant === 'default' ? {
      backgroundImage: 'linear-gradient(135deg, var(--brand-color), var(--brand-color))',
      boxShadow: '0 8px 18px rgba(var(--tenant-primary-rgb), 0.18)',
      ...style
    } : style
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={dynamicStyle}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
