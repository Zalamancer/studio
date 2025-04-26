
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Keep useRouter
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu"
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { FileText, Home, Network, LineChart, LogOut, PlusCircle, Loader2 } from "lucide-react"; // Correct icons
import { signOut } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import type { Post, NewPostData } from '@/types/post';
import { CreatePostForm } from '@/components/CreatePostForm';
import { useAuth } from '@/contexts/AuthContext';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { getPostsFromFirestore, addPostToFirestore } from '@/services/postService';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton
import { useForm } from 'react-hook-form'; // Import useForm for potential reset
import { zodResolver } from '@hookform/resolvers/zod'; // Import resolver if needed for reset
import * as z from 'zod'; // Import zod if needed for reset schema
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

const navItems = [
  { title: "Board", href: "/", icon: Home },
  { title: "Invest", href: "/invest", icon: LineChart },
  { title: "Connect", href: "/connect", icon: Network },
  { title: "Contracts", href: "/contracts", icon: FileText },
];

export const availableTags = [
  "Legal", "Product", "Supplier", "Collaboration", "Marketing", "Ads", "Audience"
];

const queryClient = new QueryClient();

// Define Zod schema for validation (needed if using form.reset())
const postFormSchema = z.object({
  question: z.string().min(10, "Question must be at least 10 characters long.").max(200, "Question cannot exceed 200 characters."),
  description: z.string().optional(), // Optional detailed description
  tags: z.array(z.string()).min(1, "Please select at least one tag."),
});

type PostFormValues = z.infer<typeof postFormSchema>;

// Component for Post Card
const PostCard = ({ post, onOpen }: { post: Post, onOpen: () => void }) => {
  // Handle potential Timestamp object for createdAt
  const postDate = post.createdAt instanceof Timestamp
    ? post.createdAt.toDate().toLocaleDateString()
    : 'Date unavailable'; // Fallback if createdAt is not a Timestamp

  return (
      <Card
        className="mb-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer break-inside-avoid bg-card"
        onClick={onOpen}
        aria-label={`View details for post: ${post.question}`}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      >
        <CardHeader className="p-4">
          <div className="flex flex-wrap gap-1 mb-2">
            {post.tags?.map((tag, index) => ( // Add optional chaining for safety
              <Badge key={`${post.id}-tag-${index}`} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
           <h3 className="text-base font-semibold leading-snug text-card-foreground">{post.question}</h3>
           {post.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {post.description}
            </p>
          )}
           <p className="mt-2 text-xs text-muted-foreground/80">
              Posted: {postDate}
           </p>
        </CardHeader>
      </Card>
  );
};

// Main Home Page Component Logic
function HomePageContent() {
  const { user, loading: authLoading } = useAuth(); // Get user and loading state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Redirect unauthenticated users after loading is finished
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);


  // Fetch posts using react-query
  const { data: posts = [], isLoading: isLoadingPosts, error: postsError } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 1, // 1 minute (reduce stale time for faster updates)
    refetchOnWindowFocus: true, // Refetch when window gains focus
    enabled: !!user, // Only fetch posts if the user is logged in
  });

   const addPostMutation = useMutation({
     mutationFn: addPostToFirestore,
     onSuccess: (newPostId) => {
       console.log("Mutation succeeded! New Post ID:", newPostId);
        // Invalidate queries first to refetch data in the background
        queryClient.invalidateQueries({ queryKey: ['posts'] }).then(() => {
            console.log("Queries invalidated.");
            // Show success toast
            toast({
                title: "Post Created",
                description: "Your post has been added to the board.",
            });
            // Close the dialog - this will unmount the form
             console.log("Closing dialog...");
            setIsCreatePostOpen(false);
        }).catch(err => {
            console.error("Error during post-success operations (invalidate/toast/close):", err);
             // Still attempt to close the dialog even if other steps failed
             setIsCreatePostOpen(false);
        });
     },
     onError: (error: Error) => { // Ensure error is typed
        console.error("Mutation failed:", error);
        toast({
          variant: "destructive",
          title: "Post Failed",
          description: `Could not add your post: ${error.message}. Check console and Firestore rules.`,
        });
        // Keep the dialog open on error so the user can try again or see the error.
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
        // Redirect is handled by the useEffect hook now
    } catch (error) {
        console.error("Logout Error:", error);
        toast({
            variant: "destructive",
            title: "Logout Failed",
            description: "An error occurred during logout. Please try again.",
          });
    }
  };

  const handleAddPost = (formData: Omit<Post, 'id' | 'createdAt' | 'userId' | 'sector' | 'businessType' | 'safetyIndicator' | 'ratingScore' | 'stockGraphData'>) => {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication Required",
            description: "You must be logged in to create a post.",
        });
        return;
    }
    console.log("Submitting post data:", formData);

    const newPostData: NewPostData = {
        question: formData.question,
        description: formData.description,
        tags: formData.tags || [], // Ensure tags is an array
        userId: user.uid,
        createdAt: new Date(), // Use current Date, Firestore service will convert to serverTimestamp
        // Placeholder values - these should ideally come from user profile or form
        sector: "Tech", // Example placeholder
        businessType: "Startup", // Example placeholder
        safetyIndicator: "Medium", // Example placeholder
        ratingScore: Math.floor(Math.random() * 5) + 1, // Random rating for now
        stockGraphData: [], // Placeholder, ideally fetched or calculated
    };
    console.log("Calling addPostMutation.mutate with:", newPostData);
    addPostMutation.mutate(newPostData);
  };

 const filteredPosts = useMemo(() => {
    // Ensure posts is an array before sorting and filtering
    if (!Array.isArray(posts)) {
        console.warn("Posts data is not an array:", posts);
        return [];
    }

    let sortedPosts = [...posts].sort((a, b) => {
        // Handle cases where createdAt might not be a Timestamp yet (e.g., optimistic updates)
        const timeA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : (a.createdAt as any instanceof Date ? (a.createdAt as any).getTime() : 0);
        const timeB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : (b.createdAt as any instanceof Date ? (b.createdAt as any).getTime() : 0);
        return timeB - timeA; // Descending order (newest first)
    });


    if (selectedTags.length === 0) {
      return sortedPosts;
    }

    return sortedPosts.filter(post =>
       Array.isArray(post.tags) && // Ensure post.tags is an array
       selectedTags.every(tag => post.tags.includes(tag))
    );
  }, [posts, selectedTags]);


  // Show loading skeleton or message while auth is loading or user is null (before redirect)
  if (authLoading || !user) {
      return (
         <div className="flex flex-col min-h-screen bg-background">
             <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto flex h-14 items-center">
                 <Skeleton className="h-6 w-32 mr-6" /> {/* Logo Placeholder */}
                 <div className="flex-1 flex justify-center gap-4">
                   <Skeleton className="h-6 w-16" />
                   <Skeleton className="h-6 w-16" />
                   <Skeleton className="h-6 w-16" />
                   <Skeleton className="h-6 w-16" />
                 </div>
                 <div className="flex items-center gap-2 ml-auto">
                    <Skeleton className="h-9 w-28" /> {/* Create Post Placeholder */}
                    <Skeleton className="h-9 w-9 rounded-full" /> {/* Logout Placeholder */}
                 </div>
                </div>
            </header>
            <main className="flex-1 container mx-auto p-4 pt-6 text-center">
                <div className="flex justify-center items-center h-64">
                    {authLoading ? (
                        <>
                         <Loader2 className="h-8 w-8 animate-spin mr-3 text-primary" />
                         <p className="text-muted-foreground text-lg">Loading user data...</p>
                        </>
                    ) : (
                       // Changed the message to indicate redirecting to login
                       <p className="text-muted-foreground text-lg">Redirecting to login...</p>
                    )}
                </div>
            </main>
             <footer className="py-4 border-t mt-8">
                <div className="container mx-auto text-center text-sm text-muted-foreground">
                    <Skeleton className="h-4 w-64 mx-auto" /> {/* Footer Placeholder */}
                </div>
             </footer>
         </div>
     );
   }

  // Render dashboard content if authenticated
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center">
           <div className="mr-4 md:mr-6 flex items-center">
             <Link href="/" className="font-bold text-lg text-primary hover:text-primary/90">
               AnonyCollab
             </Link>
           </div>
          <NavigationMenu className="flex-1 justify-center hidden md:flex">
             <NavigationMenuList>
               {navItems.map((item) => (
                 <NavigationMenuItem key={item.title}>
                   {/* Pass props directly to NavigationMenuLink */}
                   <NavigationMenuLink
                      href={item.href ?? '#'} // Provide a fallback href
                      title={item.title}
                      icon={item.icon} // Pass the icon component
                      className="text-sm font-medium transition-colors hover:text-primary [&_svg]:mr-2 [&_svg]:h-4 [&_svg]:w-4"
                   >
                      {item.title}
                   </NavigationMenuLink>
                 </NavigationMenuItem>
               ))}
             </NavigationMenuList>
          </NavigationMenu>
           <div className="flex items-center gap-2 ml-auto">
               {/* Manage Dialog open state */}
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
                     {/* Render CreatePostForm only when the dialog is open */}
                     {/* Pass the mutation's pending state to the form */}
                     {isCreatePostOpen && (
                        <CreatePostForm
                           onSubmit={handleAddPost}
                           availableTags={availableTags}
                           isSubmitting={addPostMutation.isPending} // Use isPending from the mutation
                          />
                     )}
                  </DialogContent>
                </Dialog>
              {user && (
                  <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout" className="text-muted-foreground hover:text-foreground">
                    <LogOut className="h-5 w-5" />
                  </Button>
              )}
           </div>
             <div className="md:hidden ml-2">
                {/* Hamburger menu placeholder */}
             </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 pt-6">
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
              aria-pressed={selectedTags.includes(tag)} // Accessibility: Indicate button state
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
                 <p>Error loading posts: {postsError instanceof Error ? postsError.message : 'Unknown error'}. Check console and Firestore rules.</p>
              </div>
           )}
          {!isLoadingPosts && !postsError && filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                 <PostCard key={post.id} post={post} onOpen={() => setSelectedPost(post)} />
              ))
          ) : (
             !isLoadingPosts && !postsError && (
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
                            {selectedPost.tags?.map((tag, index) => ( // Add optional chaining
                            <Badge key={`${selectedPost.id}-detail-tag-${index}`} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                        </div>
                         <SheetDescription className="text-sm pt-1">
                            Posted on: {selectedPost.createdAt instanceof Timestamp ? selectedPost.createdAt.toDate().toLocaleDateString() : 'Date unavailable'}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-4 text-sm">
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
