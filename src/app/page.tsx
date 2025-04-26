
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
import { Card, CardHeader } from "@/components/ui/card"; // Removed CardContent, CardTitle temporarily
import { Badge } from "@/components/ui/badge";
// Recharts imports are causing issues in RSC, comment out for now
// import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, Home, Network, LineChart, LogOut, PlusCircle, Loader2 } from "lucide-react"; // Import correct icons, Loader2
import { signOut } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import type { Post, NewPostData } from '@/types/post'; // Import Post types
import { CreatePostForm } from '@/components/CreatePostForm'; // Import the form component
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query'; // Import react-query
import { getPostsFromFirestore, addPostToFirestore } from '@/services/postService'; // Import Firestore services

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

// React Query Client
const queryClient = new QueryClient();

// Component for Post Card
const PostCard = ({ post, onOpen }: { post: Post, onOpen: () => void }) => {
  // Convert Firestore Timestamp to readable date string
  const postDate = post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString() : 'Date unavailable';

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
           {/* Use h3 or similar for semantic heading */}
           <h3 className="text-base font-semibold leading-snug text-card-foreground">{post.question}</h3>
           {/* Optional: Show a snippet of the description */}
           {post.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {post.description}
            </p>
          )}
           {/* Show post time */}
           <p className="mt-2 text-xs text-muted-foreground/80">
              Posted: {postDate}
           </p>
        </CardHeader>
      </Card>
  );
};

// Main Home Page Component Logic
function HomePageContent() {
  const { user } = useAuth(); // Get authenticated user
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false); // State for dialog
  const router = useRouter();
  const { toast } = useToast();

  // Fetch posts using react-query
  const { data: posts = [], isLoading: isLoadingPosts, error: postsError } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

   // Mutation for adding a new post
   const addPostMutation = useMutation({
     mutationFn: addPostToFirestore,
     onSuccess: () => {
       // Invalidate and refetch posts query to show the new post
       queryClient.invalidateQueries({ queryKey: ['posts'] });
       setIsCreatePostOpen(false); // Close the dialog
       toast({
         title: "Post Created",
         description: "Your post has been added to the board.",
       });
     },
     onError: (error) => {
        console.error("Failed to add post:", error);
        toast({
          variant: "destructive",
          title: "Post Failed",
          description: "Could not add your post. Please try again.",
        });
      },
   });

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

  // Function to handle submitting a new post from the form
  const handleAddPost = (formData: Omit<Post, 'id' | 'createdAt' | 'userId' | 'sector' | 'businessType' | 'safetyIndicator' | 'ratingScore' | 'stockGraphData'>) => {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication Required",
            description: "You must be logged in to create a post.",
        });
        return;
    }

    const newPostData: NewPostData = {
        ...formData,
        userId: user.uid, // Add the user ID
        createdAt: new Date(),
        // --- Placeholder/Default values for new posts ---
        // TODO: These should ideally come from user profile or be part of the form
        sector: "Unknown",
        businessType: "Startup",
        safetyIndicator: "Medium",
        ratingScore: 0,
        stockGraphData: [
            { name: 'Jan', uv: 1000 }, { name: 'Feb', uv: 1100 }, { name: 'Mar', uv: 1050 },
            { name: 'Apr', uv: 1200 }, { name: 'May', uv: 1150 }, { name: 'Jun', uv: 1250 },
            { name: 'Jul', uv: 1300 },
        ],
        // --- End Placeholder values ---
    };
    addPostMutation.mutate(newPostData); // Call the mutation
  };

  const filteredPosts = useMemo(() => {
    let sortedPosts = posts;
    // Ensure posts are sorted by date if not already sorted by query
    if (posts.length > 0 && posts[0].createdAt instanceof Date) { // Check if already Date objects
         sortedPosts = [...posts].sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
    } else if (posts.length > 0 && posts[0].createdAt?.toDate) { // Check if Firestore Timestamps
        sortedPosts = [...posts].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    }


    if (selectedTags.length === 0) {
      return sortedPosts;
    }

    return sortedPosts.filter(post =>
      selectedTags.every(tag => post.tags.includes(tag))
    );
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
                   <NavigationMenuLink href={item.href} title={item.title} icon={item.icon}>
                     {/* Icon is rendered inside NavigationMenuLink */}
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
                     {/* Pass handleAddPost and availableTags */}
                     <CreatePostForm
                       onSubmit={handleAddPost}
                       availableTags={availableTags}
                       isSubmitting={addPostMutation.isPending} // Pass loading state
                      />
                  </DialogContent>
                </Dialog>

               {/* Logout Button */}
              {user && ( // Only show logout if user is logged in
                  <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout" className="text-muted-foreground hover:text-foreground">
                    <LogOut className="h-5 w-5" />
                  </Button>
              )}
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
          {availableTags.map((tag) => (
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
         {isLoadingPosts && (
             <div className="col-span-full text-center py-10 flex justify-center items-center">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                 <p className="text-muted-foreground">Loading posts...</p>
             </div>
          )}
          {postsError && (
              <div className="col-span-full text-center py-10 text-destructive">
                 <p>Error loading posts. Please try again later.</p>
              </div>
           )}
          {!isLoadingPosts && !postsError && filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                 <PostCard key={post.id} post={post} onOpen={() => setSelectedPost(post)} />
              ))
          ) : (
             !isLoadingPosts && !postsError && ( // Only show 'no posts' if not loading and no error
                 <div className="col-span-full text-center py-10">
                     <p className="text-muted-foreground">
                         {selectedTags.length > 0
                           ? "No posts found matching the selected tags."
                           : "No posts available yet."
                         }
                     </p>
                      <Button variant="link" onClick={() => setIsCreatePostOpen(true)} className="mt-2">
                         Create the first post?
                      </Button>
                 </div>
             )
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
                             {/* Convert Timestamp to readable date */}
                            Posted on: {selectedPost.createdAt?.toDate ? selectedPost.createdAt.toDate().toLocaleDateString() : 'Date unavailable'}
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


                        {/* Temporarily comment out chart due to RSC issues */}
                        {/* <div className="mt-6 border-t pt-4">
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
                        </div> */}
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

// Wrap the main content with QueryClientProvider
export default function HomePage() {
    return (
        <QueryClientProvider client={queryClient}>
            <HomePageContent />
        </QueryClientProvider>
    );
}
