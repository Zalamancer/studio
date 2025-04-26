
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, Home, Network, LineChart, LogOut, PlusCircle, Loader2, Trash2 } from "lucide-react"; // Correct icons, added Trash2
import { signOut } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import type { Post, NewPostData } from '@/types/post';
import { CreatePostForm } from '@/components/CreatePostForm';
import { useAuth } from '@/contexts/AuthContext';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { getPostsFromFirestore, addPostToFirestore, deletePostFromFirestore } from '@/services/postService'; // Import deletePostFromFirestore
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton
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
  const { data: posts = [], isLoading: isLoadingPosts, error: postsError, refetch: refetchPosts } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 1, // 1 minute
    refetchOnWindowFocus: true,
    enabled: !!user,
  });

   const addPostMutation = useMutation({
     mutationFn: addPostToFirestore,
     onSuccess: () => {
        // Invalidate queries first to refetch data in the background
        queryClient.invalidateQueries({ queryKey: ['posts'] }).then(() => {
            // Show success toast
            toast({
                title: "Post Created",
                description: "Your post has been added to the board.",
            });
            // Close the dialog
            setIsCreatePostOpen(false);
        }).catch(err => {
            console.error("Error during post-success operations (invalidate/toast/close):", err);
             // Still attempt to close the dialog even if other steps failed
             setIsCreatePostOpen(false);
        });
     },
     onError: (error: Error) => {
        console.error("Add Post Mutation failed:", error);
        toast({
          variant: "destructive",
          title: "Post Failed",
          description: `Could not add your post: ${error.message}. Check console and Firestore rules.`,
        });
      },
   });

   // --- Delete Post Mutation ---
   const deletePostMutation = useMutation({
       mutationFn: deletePostFromFirestore, // Use the imported function
       onSuccess: () => {
           // Invalidate the posts query to refetch and update the list
           queryClient.invalidateQueries({ queryKey: ['posts'] });
           toast({
               title: "Post Deleted",
               description: "The post has been removed from the board.",
           });
           setSelectedPost(null); // Close the detail sheet
       },
       onError: (error: Error) => {
           console.error("Delete Post Mutation failed:", error);
           toast({
               variant: "destructive",
               title: "Deletion Failed",
               description: `Could not delete the post: ${error.message}. Check console and Firestore rules.`,
           });
           // Optionally close the sheet even on error, or leave it open
           // setSelectedPost(null);
       },
   });
   // --- End Delete Post Mutation ---


   // --- Delete Post Handler ---
   const handleDeletePost = (postId: string | undefined) => {
       if (!postId) {
           toast({ variant: "destructive", title: "Error", description: "Post ID is missing." });
           return;
       }
       if (!user) {
           toast({ variant: "destructive", title: "Authentication Required", description: "You must be logged in to delete posts." });
           return;
       }
       // Trigger the mutation
       deletePostMutation.mutate(postId);
   };
   // --- End Delete Post Handler ---


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

    const newPostData: NewPostData = {
        question: formData.question,
        description: formData.description,
        tags: formData.tags || [],
        userId: user.uid, // Associate post with the logged-in user
        createdAt: new Date(),
        sector: "Tech", // Placeholder
        businessType: "Startup", // Placeholder
        safetyIndicator: "Medium", // Placeholder
        ratingScore: Math.floor(Math.random() * 5) + 1, // Placeholder
        stockGraphData: [], // Placeholder
    };
    addPostMutation.mutate(newPostData);
  };

 const filteredPosts = useMemo(() => {
    if (!Array.isArray(posts)) {
        console.warn("Posts data is not an array:", posts);
        return [];
    }

    let sortedPosts = [...posts].sort((a, b) => {
        const timeA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return timeB - timeA; // Descending order (newest first)
    });


    if (selectedTags.length === 0) {
      return sortedPosts;
    }

    return sortedPosts.filter(post =>
       Array.isArray(post.tags) &&
       selectedTags.every(tag => post.tags.includes(tag))
    );
  }, [posts, selectedTags]);


  if (authLoading || !user) {
      return (
         <div className="flex flex-col min-h-screen bg-background">
             <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                {/* Header Skeleton */}
                <div className="container mx-auto flex h-14 items-center">
                 <Skeleton className="h-6 w-32 mr-6" />
                 <div className="flex-1 flex justify-center gap-4">
                   <Skeleton className="h-6 w-16" />
                   <Skeleton className="h-6 w-16" />
                   <Skeleton className="h-6 w-16" />
                   <Skeleton className="h-6 w-16" />
                 </div>
                 <div className="flex items-center gap-2 ml-auto">
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-9 w-9 rounded-full" />
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
                       <p className="text-muted-foreground text-lg">Redirecting to login...</p>
                    )}
                </div>
            </main>
             <footer className="py-4 border-t mt-8">
                <div className="container mx-auto text-center text-sm text-muted-foreground">
                    <Skeleton className="h-4 w-64 mx-auto" />
                </div>
             </footer>
         </div>
     );
   }

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
                   <NavigationMenuLink
                      href={item.href ?? '#'}
                      title={item.title}
                      icon={item.icon}
                   >
                     {item.title}
                   </NavigationMenuLink>
                 </NavigationMenuItem>
               ))}
             </NavigationMenuList>
          </NavigationMenu>
           <div className="flex items-center gap-2 ml-auto">
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
                     {isCreatePostOpen && (
                        <CreatePostForm
                           onSubmit={handleAddPost}
                           availableTags={availableTags}
                           isSubmitting={addPostMutation.isPending}
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
              aria-pressed={selectedTags.includes(tag)}
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
                            {selectedPost.tags?.map((tag, index) => (
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
                         {/* --- Buttons including Delete --- */}
                         <div className="mt-6 pt-4 border-t flex justify-end gap-2">
                             <Button variant="outline" size="sm">Offer Help</Button>
                             <Button variant="default" size="sm">Connect</Button>
                             {/* Show Delete Button only if the post belongs to the current user */}
                             {user && selectedPost.userId === user.uid && (
                                 <AlertDialog>
                                     <AlertDialogTrigger asChild>
                                         <Button
                                             variant="destructive"
                                             size="sm"
                                             disabled={deletePostMutation.isPending}
                                         >
                                             {deletePostMutation.isPending ? (
                                                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                             ) : (
                                                 <Trash2 className="mr-2 h-4 w-4" />
                                             )}
                                             Delete
                                         </Button>
                                     </AlertDialogTrigger>
                                     <AlertDialogContent>
                                         <AlertDialogHeader>
                                             <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                             <AlertDialogDescription>
                                                 This action cannot be undone. This will permanently delete your post
                                                 and remove your data from our servers.
                                             </AlertDialogDescription>
                                         </AlertDialogHeader>
                                         <AlertDialogFooter>
                                             <AlertDialogCancel disabled={deletePostMutation.isPending}>Cancel</AlertDialogCancel>
                                             <AlertDialogAction
                                                 onClick={() => handleDeletePost(selectedPost.id)}
                                                 disabled={deletePostMutation.isPending}
                                                 className="bg-destructive hover:bg-destructive/90"
                                             >
                                                 {deletePostMutation.isPending ? (
                                                     <>
                                                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                         Deleting...
                                                     </>
                                                 ) : (
                                                     'Continue'
                                                 )}
                                             </AlertDialogAction>
                                         </AlertDialogFooter>
                                     </AlertDialogContent>
                                 </AlertDialog>
                             )}
                         </div>
                         {/* --- End Buttons --- */}
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
