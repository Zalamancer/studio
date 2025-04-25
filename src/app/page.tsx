
"use client";

import React from 'react';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Use shadcn chart components for consistency
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaProps } from 'recharts';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, Home, Network, LineChart } from "lucide-react";

const sectors = [
  "Tech", "Retail", "Logistics", "Healthcare", "Finance",
];

const navItems = [
  { title: "Board", href: "/board", icon: Home },
  { title: "Invest", href: "/invest", icon: LineChart },
  { title: "Connect", href: "/connect", icon: Network },
  { title: "Contracts", href: "/contracts", icon: FileText },
];

const tagButtons = [
  "Legal", "Product", "Supplier", "Collaboration", "Marketing", "Ads", "Audience"
];

const postData = [
  {
    id: 1,
    tags: ["Legal", "Product"],
    question: "How to get copyright-free product images?",
    sector: "Retail",
    businessType: "Startup",
    safetyIndicator: "High",
    ratingScore: 4.5,
    stockGraphData: [
      { name: 'Jan', uv: 4000 }, { name: 'Feb', uv: 3000 }, { name: 'Mar', uv: 2000 },
      { name: 'Apr', uv: 2780 }, { name: 'May', uv: 1890 }, { name: 'Jun', uv: 2390 },
      { name: 'Jul', uv: 3490 },
    ],
  },
  {
    id: 2,
    tags: ["Collaboration", "Marketing"],
    question: "Best strategies for B2B marketing collaboration?",
    sector: "Marketing",
    businessType: "Growing",
    safetyIndicator: "Medium",
    ratingScore: 3.8,
    stockGraphData: [
      { name: 'Jan', uv: 2000 }, { name: 'Feb', uv: 2500 }, { name: 'Mar', uv: 1800 },
      { name: 'Apr', uv: 3000 }, { name: 'May', uv: 2000 }, { name: 'Jun', uv: 2800 },
      { name: 'Jul', uv: 3200 },
    ],
  },
  {
    id: 3,
    tags: ["Supplier"],
    question: "Looking for reliable suppliers in the tech sector for electronic components.",
    sector: "Tech",
    businessType: "Established",
    safetyIndicator: "High",
    ratingScore: 4.8,
    stockGraphData: [
      { name: 'Jan', uv: 5000 }, { name: 'Feb', uv: 5200 }, { name: 'Mar', uv: 5500 },
      { name: 'Apr', uv: 5300 }, { name: 'May', uv: 5600 }, { name: 'Jun', uv: 5800 },
      { name: 'Jul', uv: 6000 },
    ],
  },
  {
    id: 4,
    tags: ["Ads", "Audience"],
    question: "Effective ways to reach a niche audience for SaaS products?",
    sector: "Tech",
    businessType: "Startup",
    safetyIndicator: "Low",
    ratingScore: 3.2,
    stockGraphData: [
      { name: 'Jan', uv: 1000 }, { name: 'Feb', uv: 1200 }, { name: 'Mar', uv: 900 },
      { name: 'Apr', uv: 1500 }, { name: 'May', uv: 1300 }, { name: 'Jun', uv: 1600 },
      { name: 'Jul', uv: 1400 },
    ],
  },
];


const PostCard = ({ post }: { post: typeof postData[0] }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Added break-inside-avoid for masonry layout */}
      <Card className="mb-4 rounded-lg shadow-md cursor-pointer break-inside-avoid" onClick={() => setOpen(true)}>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag, index) => (
              <Badge key={index} variant="secondary">{tag}</Badge>
            ))}
          </div>
          <CardTitle className="mt-2 text-base font-semibold">{post.question}</CardTitle>
        </CardHeader>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-lg w-full p-0" side="right">
          <ScrollArea className="h-screen">
            <div className="p-6">
              <SheetHeader className="space-y-2.5 text-left mb-6">
                <SheetTitle>Post Details</SheetTitle>
                <SheetDescription>
                  Details about the selected post and business.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4">
                <p><strong>Sector:</strong> {post.sector}</p>
                <p><strong>Business Type:</strong> {post.businessType}</p>
                {/* Changed p to div to fix hydration error */}
                <div className="flex items-center gap-2">
                  <strong>Safety Indicator:</strong>
                  <Badge variant={post.safetyIndicator === 'High' ? 'default' : post.safetyIndicator === 'Medium' ? 'secondary' : 'destructive'}>
                    {post.safetyIndicator}
                  </Badge>
                </div>
                <p><strong>Rating Score:</strong> {post.ratingScore} / 5</p>
                <div className="mt-4">
                  <strong>Business Stock Graph:</strong>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={post.stockGraphData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        itemStyle={{ color: 'hsl(var(--primary))' }}
                      />
                      <Area type="monotone" dataKey="uv" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorUv)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center">
          <NavigationMenu className="mx-auto">
            <NavigationMenuList>
              {navItems.map((item) => (
                <NavigationMenuItem key={item.title}>
                  <NavigationMenuLink href={item.href} title={item.title} icon={item.icon}>
                    {item.title}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        {/* Sub-filters / Tag Buttons */}
        <div className="my-4 flex flex-wrap gap-2">
          {tagButtons.map((tag, index) => (
            <Button key={index} variant="outline" size="sm">{tag}</Button>
          ))}
        </div>

        {/* Post Feed - Masonry Layout */}
        {/* Using columns for masonry layout */}
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4">
          {postData.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </main>

      <footer className="py-4 border-t">
          <div className="container mx-auto text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} AnonyCollab. All rights reserved.
          </div>
      </footer>
    </div>
  );
}
