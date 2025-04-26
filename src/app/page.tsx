
"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLink,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, Home, Network, LineChart, LogOut, PlusCircle } from "lucide-react"; // Import correct icons
import { signOut } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import type { Post } from '@/types/post'; // Import Post type
import { CreatePostForm } from '@/components/CreatePostForm'; // Import the form component

const navItems = [
  { title: "Board", href: "/", icon: Home },
  { title: "Invest", href: "/invest", icon: LineChart },
  { title: "Connect", href: "/connect", icon: Network },
  { title: "Contracts", href: "/contracts", icon: FileText },
];

// Define available tags for consistency
export const availableTags = [
  "Legal", "Product", "Supplier", "Collaboration", "Marketing", "Ads", "Audience"
];

// Initial post data (will be moved to state)
const initialPostData: Post[] = [
 {
    id: 1,
    tags: ["Legal", "Product"],
    question: "How to get copyright-free product images?",
    description: "Looking for sources or strategies to obtain high-quality, legally safe images for e-commerce product listings without breaking the bank.",
    sector: "Retail",
    businessType: "Startup",
    safetyIndicator: "High",
    ratingScore: 4.5,
    stockGraphData: [
      { name: 'Jan', uv: 4000 }, { name: 'Feb', uv: 3000 }, { name: 'Mar', uv: 2000 },
      { name: 'Apr', uv: 2780 }, { name: 'May', uv: 1890 }, { name: 'Jun', uv: 2390 },
      { name: 'Jul', uv: 3490 },
    ],
    createdAt: new Date(2023, 10, 15), // Add timestamp
  },
  {
    id: 2,
    tags: ["Collaboration", "Marketing"],
    question: "Best strategies for B2B marketing collaboration?",
    description: "Seeking proven methods for partnering with other businesses for joint marketing campaigns, content sharing, or lead generation.",
    sector: "Marketing",
    businessType: "Growing",
    safetyIndicator: "Medium",
    ratingScore: 3.8,
    stockGraphData: [
      { name: 'Jan', uv: 2000 }, { name: 'Feb', uv: 2500 }, { name: 'Mar', uv: 1800 },
      { name: 'Apr', uv: 3000 }, { name: 'May', uv: 2000 }, { name: 'Jun', uv: 2800 },
      { name: 'Jul', uv: 3200 },
    ],
     createdAt: new Date(2023, 11, 1), // Add timestamp
  },
  {
    id: 3,
    tags: ["Supplier"],
    question: "Looking for reliable suppliers in the tech sector for electronic components.",
    description: "Need recommendations for trustworthy suppliers of specific electronic components with good track records for quality and delivery times.",
    sector: "Tech",
    businessType: "Established",
    safetyIndicator: "High",
    ratingScore: 4.8,
    stockGraphData: [
      { name: 'Jan', uv: 5000 }, { name: 'Feb', uv: 5200 }, { name: 'Mar', uv: 5500 },
      { name: 'Apr', uv: 5300 }, { name: 'May', uv: 5600 }, { name: 'Jun', uv: 5800 },
      { name: 'Jul', uv: 6000 },
    ],
     createdAt: new Date(2024, 0, 5), // Add timestamp
  },
  {
    id: 4,
    tags: ["Ads", "Audience"],
    question: "Effective ways to reach a niche audience for SaaS products?",
    description: "Exploring cost-effective advertising channels and audience targeting techniques to reach a specific niche market for a new SaaS offering.",
    sector: "Tech",
    businessType: "Startup",
    safetyIndicator: "Low",
    ratingScore: 3.2,
    stockGraphData: [
      { name: 'Jan', uv: 1000 }, { name: 'Feb', uv: 1200 }, { name: 'Mar', uv: 900 },
      { name: 'Apr', uv: 1500 }, { name: 'May', uv: 1300 }, { name: 'Jun', uv: 1600 },
      { name: 'Jul', uv: 1400 },
    ],
     createdAt: new Date(2024, 1, 20), // Add timestamp
  },
   {
    id: 5,
    tags: ["Legal"],
    question: "What are the key legal considerations for international B2B contracts?",
    description: "Drafting a contract with an overseas partner. What are the essential legal clauses and compliance points to include regarding jurisdiction, payments, and disputes?",
    sector: "Legal",
    businessType: "Growing",
    safetyIndicator: "Medium",
    ratingScore: 4.1,
    stockGraphData: [
        { name: 'Jan', uv: 3200 }, { name: 'Feb', uv: 3000 }, { name: 'Mar', uv: 3500 },
        { name: 'Apr', uv: 3700 }, { name: 'May', uv: 3600 }, { name: 'Jun', uv: 3900 },
        { name: 'Jul', uv: 4100 },
    ],
     createdAt: new Date(2024, 2, 10), // Add timestamp
  },
   {
    id: 6,
    tags: ["Product", "Marketing"],
    question: "How to effectively A/B test product features for a SaaS platform?",
    description: "Planning to roll out new features and need advice on designing and implementing A/B tests to measure user engagement and impact accurately.",
    sector: "Tech",
    businessType: "Startup",
    safetyIndicator: "High",
    ratingScore: 4.6,
    stockGraphData: [
        { name: 'Jan', uv: 2500 }, { name: 'Feb', uv: 2800 }, { name: 'Mar', uv: 2600 },
        { name: 'Apr', uv: 3000 }, { name: 'May', uv: 3200 }, { name: 'Jun', uv: 3500 },
        { name: 'Jul', uv: 3800 },
    ],
     createdAt: new Date(2024, 3, 1), // Add timestamp
  },
];

const PostCard = ({ post, onOpen }: { post: Post, onOpen: () => void }) => {
  return (
      <Card
        className="mb-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer break-inside-avoid bg-card"
        onClick={onOpen}
        aria-label={`View details for post: ${post.question}`}
        tabIndex={0} // Make it focusable
        onKeyDown={(e) => e.key === 'Enter' && onOpen()} // Allow opening with Enter key
      >
        <CardHeader className="p-4">
          <div className="flex flex-wrap gap-1 mb-2">
            {post.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
          <CardTitle className="text-base font-semibold leading-snug text-card-foreground">{post.question}</CardTitle>
           {/* Optional: Show a snippet of the description */}
           {post.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {post.description}
            </p>
          )}
           {/* Optional: Show post time */}
           {post.createdAt && (
             <p className="mt-2 text-xs text-muted-foreground/80">
                Posted: {post.createdAt.toLocaleDateString()}
            </p>
           )}
        </CardHeader>
      </Card>
  );
};


export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>(initialPostData); // Manage posts in state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false); // State for dialog
  const router = useRouter();
  const { toast } = useToast();

  const handleTagClick = (tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag)
        : [...prevTags, tag]
    );
  };

   const handleLogout = async () => {
    try {
        await signOut();
        toast({
            title: "Logged Out",
            description: "You have been successfully logged out.",
          });
        router.push('/login'); // Redirect to login page after logout
    } catch (error) {
        console.error("Logout Error:", error);
        toast({
            variant: "destructive",
            title: "Logout Failed",
            description: "An error occurred during logout. Please try again.",
          });
    }
  };

  // Function to add a new post
  const addPost = (newPostData: Omit<Post, 'id' | 'createdAt' | 'sector' | 'businessType' | 'safetyIndicator' | 'ratingScore' | 'stockGraphData'>) => {
     const newPost: Post = {
        ...newPostData,
        id: Date.now(), // Simple unique ID generation for demo
        createdAt: new Date(),
        // --- Placeholder/Default values for new posts ---
        // These would normally come from user profile or backend logic
        sector: "Unknown", // Placeholder
        businessType: "Startup", // Placeholder
        safetyIndicator: "Medium", // Placeholder
        ratingScore: 0, // Placeholder
        stockGraphData: [ // Placeholder graph data
            { name: 'Jan', uv: 1000 }, { name: 'Feb', uv: 1100 }, { name: 'Mar', uv: 1050 },
            { name: 'Apr', uv: 1200 }, { name: 'May', uv: 1150 }, { name: 'Jun', uv: 1250 },
            { name: 'Jul', uv: 1300 },
        ],
        // --- End Placeholder values ---
    };
    setPosts(prevPosts => [newPost, ...prevPosts]); // Add new post to the beginning
    setIsCreatePostOpen(false); // Close the dialog
    toast({
        title: "Post Created",
        description: "Your post has been added to the board.",
      });
  };

  const filteredPosts = useMemo(() => {
    if (selectedTags.length === 0) {
      return posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    const filtered = posts.filter(post =>
      selectedTags.every(tag => post.tags.includes(tag))
    );
    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [posts, selectedTags]);


  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center">
           {/* Logo/Brand Placeholder - Added margin */}
           <div className="mr-4 md:mr-6 flex items-center">
             <Link href="/" className="font-bold text-lg text-primary hover:text-primary/90">
               AnonyCollab
             </Link>
           </div>

           {/* Navigation Menu - Occupies most space */}
          <NavigationMenu className="flex-1 justify-center hidden md:flex">
             <NavigationMenuList>
               {navItems.map((item) => (
                 <NavigationMenuItem key={item.title}>
                   {/* Use NavigationMenuLink from ShadCN */}
                   <NavigationMenuLink
                     href={item.href}
                     title={item.title} // Pass title for potential tooltip or aria-label
                     icon={item.icon} // Pass icon component
                   >
                     {item.title} {/* Display the title text */}
                   </NavigationMenuLink>
                 </NavigationMenuItem>
               ))}
             </NavigationMenuList>
          </NavigationMenu>

           {/* Right Aligned Actions - Create Post and Logout */}
           <div className="flex items-center gap-2 ml-auto">
              {/* Create Post Button */}
               <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
                  <DialogTrigger asChild>
                     <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                       <PlusCircle className="mr-2 h-4 w-4" />
                       Create Post
                     </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                     <DialogHeader>
                       <DialogTitle>Create a New Post</DialogTitle>
                       <DialogDescription>
                         Share your question or need with the community. Keep it anonymous.
                       </DialogDescription>
                     </DialogHeader>
                     <CreatePostForm onSubmit={addPost} availableTags={availableTags} />
                     {/* Footer moved inside CreatePostForm for better control */}
                  </DialogContent>
                </Dialog>

               {/* Logout Button */}
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout" className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-5 w-5" />
              </Button>
           </div>

             {/* Mobile Navigation (Optional Hamburger Menu) - Placeholder */}
             <div className="md:hidden ml-2">
                {/* Add a hamburger menu button here to toggle mobile nav */}
             </div>
        </div>
      </header>


      <main className="flex-1 container mx-auto p-4 pt-6">
        {/* Sub-filters / Tag Buttons */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
           <span className="text-sm font-medium text-muted-foreground mr-2">Filter by Tag:</span>
          {availableTags.map((tag) => ( // Use availableTags here
            <Button
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              size="sm"
              onClick={() => handleTagClick(tag)}
              className={cn(
                "rounded-full px-3 py-1 text-xs transition-colors duration-150",
                 selectedTags.includes(tag)
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {tag}
            </Button>
          ))}
          {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTags([])}
                className="text-xs text-primary hover:underline p-1 h-auto ml-2"
                >
                Clear Filters
              </Button>
           )}
        </div>

        {/* Post Feed - Masonry Layout */}
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                 <PostCard key={post.id} post={post} onOpen={() => setSelectedPost(post)} />
              ))
          ) : (
              <div className="col-span-full text-center py-10">
                 <p className="text-muted-foreground">No posts found matching the selected tags.</p>
                 {/* Optional: Suggest creating a post */}
                  <Button variant="link" onClick={() => setIsCreatePostOpen(true)} className="mt-2">
                    Create the first post?
                 </Button>
              </div>
          )}
        </div>

        {/* Post Detail Side Panel */}
        <Sheet open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
            <SheetContent className="sm:max-w-lg w-[90vw] p-0" side="right">
                <ScrollArea className="h-screen">
                {selectedPost && (
                    <div className="p-6">
                    <SheetHeader className="space-y-2.5 text-left mb-6 border-b pb-4">
                        <SheetTitle className="text-xl font-semibold">{selectedPost.question}</SheetTitle>
                         <div className="flex flex-wrap items-center gap-2 pt-1">
                            {selectedPost.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                        </div>
                         <SheetDescription className="text-sm pt-1">
                            Posted on: {selectedPost.createdAt.toLocaleDateString()}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-4 text-sm">
                        {/* Display Full Description */}
                         {selectedPost.description && (
                             <div>
                                 <strong className="text-foreground">Details:</strong>
                                 <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{selectedPost.description}</p>
                             </div>
                         )}

                         <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 border-t pt-4">
                              <div>
                                  <strong className="block text-foreground">Sector:</strong>
                                  <span className="text-muted-foreground">{selectedPost.sector}</span>
                               </div>
                                <div>
                                    <strong className="block text-foreground">Business Type:</strong>
                                    <span className="text-muted-foreground">{selectedPost.businessType}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <strong className="text-foreground">Safety Indicator:</strong>
                                    <Badge
                                        variant={
                                            selectedPost.safetyIndicator === 'High' ? 'default'
                                            : selectedPost.safetyIndicator === 'Medium' ? 'secondary'
                                            : 'destructive'
                                        }
                                        className="text-xs"
                                    >
                                        {selectedPost.safetyIndicator}
                                    </Badge>
                                </div>
                                <div>
                                    <strong className="block text-foreground">Rating Score:</strong>
                                    <span className="text-muted-foreground">{selectedPost.ratingScore} / 5</span>
                                </div>
                         </div>


                        <div className="mt-6 border-t pt-4">
                            <strong className="text-foreground">Business Stock Graph (Trust Indicator):</strong>
                            <ResponsiveContainer width="100%" height={150} className="mt-2">
                                <AreaChart data={selectedPost.stockGraphData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorUvSheet" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: 'var(--radius)',
                                        fontSize: '12px',
                                        padding: '4px 8px'
                                     }}
                                    labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '4px', fontWeight: '500' }}
                                    itemStyle={{ color: 'hsl(var(--primary))' }}
                                />
                                <Area type="monotone" dataKey="uv" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorUvSheet)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                         {/* Add Action Buttons Here (e.g., Connect, Offer Help) */}
                         <div className="mt-6 pt-4 border-t flex justify-end gap-2">
                             <Button variant="outline" size="sm">Offer Help</Button>
                             <Button variant="default" size="sm">Connect</Button>
                         </div>
                    </div>
                    </div>
                )}
                </ScrollArea>
            </SheetContent>
        </Sheet>

      </main>

      <footer className="py-4 border-t mt-8">
          <div className="container mx-auto text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} AnonyCollab. All rights reserved.
          </div>
      </footer>
    </div>
  );
}
