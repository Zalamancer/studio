
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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileContract, Home, Connect, Invest } from "lucide-react";

const sectors = [
  "Tech", "Retail", "Logistics", "Healthcare", "Finance",
];

const navItems = [
  { title: "Board", href: "/board", icon: Home },
  { title: "Invest", href: "/invest", icon: Invest },
  { title: "Connect", href: "/connect", icon: Connect },
  { title: "Contracts", href: "/contracts", icon: FileContract },
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
];

const PostCard = ({ post }: { post: typeof postData[0] }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Card className="mb-4 rounded-lg shadow-md cursor-pointer" onClick={() => setOpen(true)}>
        <CardHeader>
          <div className="flex gap-2">
            {post.tags.map((tag, index) => (
              <Badge key={index} variant="secondary">{tag}</Badge>
            ))}
          </div>
          <CardTitle>{post.question}</CardTitle>
        </CardHeader>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-lg p-6" side="right">
          <SheetHeader className="space-y-2.5">
            <SheetTitle>Post Details</SheetTitle>
            <SheetDescription>
              Details about the selected post and business.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[70vh] mt-4">
            <div className="space-y-4">
              <p><strong>Sector:</strong> {post.sector}</p>
              <p><strong>Business Type:</strong> {post.businessType}</p>
              <p><strong>Safety Indicator:</strong> {post.safetyIndicator}</p>
              <p><strong>Rating Score:</strong> {post.ratingScore}</p>
              <div>
                <strong>Business Stock Graph:</strong>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={post.stockGraphData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="uv" stroke="#8884d8" fill="#8884d8" />
                  </AreaChart>
                </ResponsiveContainer>
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
    <div className="container mx-auto p-4">
      {/* Top Navigation Bar */}
      <NavigationMenu>
        <NavigationMenuList>
          {navItems.map((item) => (
            <NavigationMenuItem key={item.title}>
              <NavigationMenuLink href={item.href} icon={item.icon}>
                {item.title}
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>

      {/* Sub-filters / Tag Buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {tagButtons.map((tag, index) => (
          <Button key={index} variant="outline">{tag}</Button>
        ))}
      </div>

      {/* Post Feed */}
      <div className="mt-6">
        {postData.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
