
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from 'next/navigation'
import { cn } from "@/lib/utils"

interface NavItemProps {
  title: string;
  href: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const NavigationMenu = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("group relative flex w-full items-center", className)}
    {...props}
  >
    {children}
  </div>
))
NavigationMenu.displayName = "NavigationMenu"

const NavigationMenuList = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, children, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn(
      "flex flex-1 items-center justify-center space-x-4 sm:space-x-6",
      className
    )}
    {...props}
  >
    {children}
  </ul>
))
NavigationMenuList.displayName = "NavigationMenuList"

const NavigationMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, children, ...props }, ref) => (
  <li ref={ref} className={cn("block", className)} {...props}>
    {children}
  </li>
))
NavigationMenuItem.displayName = "NavigationMenuItem"

const NavigationMenuLink = React.forwardRef<
  React.ElementRef<typeof Link>,
  React.ComponentPropsWithoutRef<typeof Link> & NavItemProps
>(({ className, children, href, icon: Icon, ...props }, ref) => {
  const pathname = usePathname()
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      ref={ref}
      className={cn(
        "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none data-[active=true]:bg-accent/50 data-[state=open]:bg-accent/50",
        isActive ? "data-[active=true]" : "",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="mr-2 h-4 w-4" />}
      {children}
    </Link>
  )
})
NavigationMenuLink.displayName = "NavigationMenuLink"

const NavigationMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "absolute left-0 top-full flex w-full justify-center",
      "data-[motion=from-start]:animate-in data-[motion=from-end]:animate-in data-[motion=to-start]:animate-out data-[motion=to-end]:animate-out",
      "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  >
    <div className="container top-0 z-50 w-full">
      <div className="grid w-full gap-6 rounded-lg bg-popover p-4 shadow-md outline-none animate-in fade-in-80 slide-in-from-bottom-10 md:w-[calc(100%-8rem)]">
        {children}
      </div>
    </div>
  </div>
))
NavigationMenuContent.displayName = "NavigationMenuContent"

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuLink,
}
