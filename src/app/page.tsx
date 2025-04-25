
"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Import useRouter
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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, Home, Network, LineChart, LogOut } from "lucide-react"; // Import LogOut


const navItems = [
  { title: "Board", href: "/", icon: Home },
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
   {
    id: 5,
    tags: ["Legal"],
    question: "What are the key legal considerations for international B2B contracts?",
    sector: "Legal",
    businessType: "Growing",
    safetyIndicator: "Medium",
    ratingScore: 4.1,
    stockGraphData: [
        { name: 'Jan', uv: 3200 }, { name: 'Feb', uv: 3000 }, { name: 'Mar', uv: 3500 },
        { name: 'Apr', uv: 3700 }, { name: 'May', uv: 3600 }, { name: 'Jun', uv: 3900 },
        { name: 'Jul', uv: 4100 },
    ],
  },
   {
    id: 6,
    tags: ["Product", "Marketing"],
    question: "How to effectively A/B test product features for a SaaS platform?",
    sector: "Tech",
    businessType: "Startup",
    safetyIndicator: "High",
    ratingScore: 4.6,
    stockGraphData: [
        { name: 'Jan', uv: 2500 }, { name: 'Feb', uv: 2800 }, { name: 'Mar', uv: 2600 },
        { name: 'Apr', uv: 3000 }, { name: 'May', uv: 3200 }, { name: 'Jun', uv: 3500 },
        { name: 'Jul', uv: 3800 },
    ],
  },
];


const PostCard = ({ post, onOpen }: { post: typeof postData[0], onOpen: () => void }) => {
  return (
      <Card className="mb-4 rounded-lg shadow-md cursor-pointer break-inside-avoid" onClick={onOpen}>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag, index) => (
              <Badge key={index} variant="secondary">{tag}</Badge>
            ))}
          </div>
          <CardTitle className="mt-2 text-base font-semibold">{post.question}</CardTitle>
        </CardHeader>
      </Card>
  );
};

export default function HomePage() {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<typeof postData[0] | null>(null);
  const router = useRouter(); // Initialize router

  const handleTagClick = (tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag)
        : [...prevTags, tag]
    );
  };

   const handleLogout = () => {
    // Simulate logout process
    // In a real app, clear auth tokens/session and redirect
    router.push('/login');
  };

  const filteredPosts = useMemo(() => {
    if (selectedTags.length === 0) {
      return postData;
    }
    return postData.filter(post =>
      selectedTags.every(tag => post.tags.includes(tag)) // Filter posts that include ALL selected tags
    );
  }, [selectedTags]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between"> {/* Changed justify-center to justify-between */}
          <NavigationMenu className="flex-1"> {/* Use flex-1 to allow menu to take space */}
            <NavigationMenuList className="justify-center"> {/* Center the main nav items */}
              {navItems.map((item) => (
                <NavigationMenuItem key={item.title}>
                  <NavigationMenuLink href={item.href} title={item.title} icon={item.icon} >
                    {item.title}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
          {/* Logout Button */}
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        {/* Sub-filters / Tag Buttons */}
        <div className="my-4 flex flex-wrap gap-2">
          {tagButtons.map((tag) => (
            <Button
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              size="sm"
              onClick={() => handleTagClick(tag)}
            >
              {tag}
            </Button>
          ))}
        </div>

        {/* Post Feed - Masonry Layout */}
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4">
          {filteredPosts.map((post) => (
             <PostCard key={post.id} post={post} onOpen={() => setSelectedPost(post)} />
          ))}
        </div>

        {/* Post Detail Side Panel */}
        <Sheet open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
            <SheetContent className="sm:max-w-lg w-[90vw] p-0" side="right">
                <ScrollArea className="h-screen">
                {selectedPost && (
                    <div className="p-6">
                    <SheetHeader className="space-y-2.5 text-left mb-6">
                        <SheetTitle>Post Details</SheetTitle>
                        <SheetDescription>
                        Details about the selected post and business.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-4">
                         {/* Display Tags */}
                         <div className="flex flex-wrap gap-2">
                            <strong>Tags:</strong>
                            {selectedPost.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary">{tag}</Badge>
                            ))}
                        </div>
                        {/* Display Question/Need */}
                        <p><strong>Need:</strong> {selectedPost.question}</p>
                        <p><strong>Sector:</strong> {selectedPost.sector}</p>
                        <p><strong>Business Type:</strong> {selectedPost.businessType}</p>
                        <div className="flex items-center gap-2">
                        <strong>Safety Indicator:</strong>
                        <Badge variant={selectedPost.safetyIndicator === 'High' ? 'default' : selectedPost.safetyIndicator === 'Medium' ? 'secondary' : 'destructive'}>
                            {selectedPost.safetyIndicator}
                        </Badge>
                        </div>
                        <p><strong>Rating Score:</strong> {selectedPost.ratingScore} / 5</p>
                        <div className="mt-4">
                        <strong>Business Stock Graph:</strong>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={selectedPost.stockGraphData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                )}
                </ScrollArea>
            </SheetContent>
        </Sheet>

      </main>

      <footer className="py-4 border-t">
          <div className="container mx-auto text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} AnonyCollab. All rights reserved.
          </div>
      </footer>
    </div>
  );
}
