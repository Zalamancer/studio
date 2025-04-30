// src/app/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Import Link
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle as UICardTitle } from "@/components/ui/card"; // Renamed CardTitle import
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter, // Import SheetFooter
} from "@/components/ui/sheet"
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
import { Input } from "@/components/ui/input"; // Import Input for comment form
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Import Avatar for comment display
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator"; // Import Separator
import { cn } from "@/lib/utils";
import { Loader2, Trash2, HandHelping, LineChart, FileText, Network, Home, Eye, Building, Link2, MessageCircle, Send } from "lucide-react"; // Added MessageCircle, Send icons
import { useToast } from "@/hooks/use-toast";
import type { Post } from '@/types/post';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsFromFirestore, deletePostFromFirestore } from '@/services/postService';
import { Skeleton } from '@/components/ui/skeleton';
import { Timestamp } from 'firebase/firestore';
import { findOrCreateConversation } from '@/services/messagingService'; // Import conversation service
import { ConnectionButton } from '@/components/ConnectionButton'; // Import ConnectionButton
import { addCommentToPost } from '@/services/commentService'; // Import the new comment service
import type { NewCommentData, ClientComment } from '@/types/comment'; // Import comment types

// Moved availableTags to MainLayout as it's used by CreatePostForm there
import { availableTags } from '@/components/layout/MainLayout';

// Helper to get initials
const getInitials = (name: string | undefined | null): string => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0].substring(0, 1).toUpperCase();
    return (names[0].substring(0, 1) + names[names.length - 1].substring(0, 1)).toUpperCase();
};


// Component for Post Card
const PostCard = React.memo(({ post, onOpen }: { post: Post, onOpen: () => void }) => {
  // Handle potential Timestamp object for createdAt
   const postDate = post.createdAt instanceof Timestamp
    ? post.createdAt.toDate().toLocaleDateString()
    : post.createdAt // Handle case where it might already be a string/Date if mock data is used
    ? new Date(post.createdAt as any).toLocaleDateString() // Try converting if not Timestamp
    : 'Date unavailable';

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
                 <Badge key={`${post.id}-tag-${index}`} variant="secondary" className="text-xs cursor-default">
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
});
PostCard.displayName = 'PostCard'; // Add display name for React DevTools

// Main Board Page Content Component Logic (Renamed from HomePageContent)
function BoardPageContent() {
  const { user, loading: authLoading } = useAuth(); // Get user and loading state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [newComment, setNewComment] = useState(''); // State for new comment input
  const [isSubmittingComment, setIsSubmittingComment] = useState(false); // State for comment submission loading
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Placeholder comments data - Replace with real-time fetching later
  const [comments, setComments] = useState<ClientComment[]>([
      { id: 'c1', userId: 'user1', userName: 'Alice B.', userAvatar: 'https://picsum.photos/seed/user1/40', text: 'This is a helpful question, interested in the answers!', timestamp: Date.now() - 1000 * 60 * 5 },
      { id: 'c2', userId: 'user2', userName: 'Bob C.', userAvatar: 'https://picsum.photos/seed/user2/40', text: 'Following this thread.', timestamp: Date.now() - 1000 * 60 * 2 },
  ]);


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
    staleTime: 1000 * 60 * 1, // 1 minute
    refetchOnWindowFocus: true,
    enabled: !!user, // Only fetch if user is logged in
  });

   // --- Delete Post Mutation ---
   const deletePostMutation = useMutation({
       mutationFn: deletePostFromFirestore, // Use the imported function
       onSuccess: () => {
           queryClient.invalidateQueries({ queryKey: ['posts'] }); // Refetch posts
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

    // --- Offer Help / Start Conversation Handler ---
   const handleOfferHelp = async (postOwnerId: string, postId: string | undefined) => { // postId can be undefined
     if (!user) {
       toast({ variant: "destructive", title: "Authentication Required", description: "Please log in to offer help." });
       return;
     }
     if (user.uid === postOwnerId) {
         toast({ variant: "default", title: "Action Info", description: "You cannot start a conversation with yourself." });
         return; // Prevent starting conversation with oneself
     }
     if (!postId) { // Explicit check for postId
         toast({ variant: "destructive", title: "Error", description: "Post ID is missing for conversation." });
         return;
     }

     try {
        // Find or create a conversation linked to the specific post
        const conversationId = await findOrCreateConversation(user.uid, postOwnerId, postId);
        if (conversationId) {
             toast({ title: "Conversation Started", description: "Redirecting to Contracts..." });
             // Navigate to the contracts page, highlighting the specific post and conversation
             // Pass both postId and conversationId as query parameters
             router.push(`/contracts?postId=${postId}&conversationId=${conversationId}`);
             setSelectedPost(null); // Close the sheet
        } else {
            throw new Error("Failed to get conversation ID.");
        }
     } catch (error: any) {
        console.error("Error starting conversation:", error);
        toast({
            variant: "destructive",
            title: "Failed to Start Conversation",
            description: error.message || "Could not start the conversation. Please try again.",
        });
     }
   };
   // --- End Offer Help Handler ---


  const handleTagClick = (tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag)
        : [...prevTags, tag]
    );
  };


 const filteredPosts = useMemo(() => {
    if (!Array.isArray(posts)) {
        console.warn("Posts data is not an array:", posts);
        return [];
    }

    // Filter first
     let filtered = selectedTags.length === 0
        ? posts
        : posts.filter(post =>
             Array.isArray(post.tags) && // Check if post.tags exists and is an array
             selectedTags.every(tag => post.tags.includes(tag)) // Check if all selected tags are in post.tags
          );

    // Then sort the filtered results
    return filtered.sort((a, b) => {
        const timeA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return timeB - timeA; // Descending order (newest first)
    });

  }, [posts, selectedTags]);

   // --- Handle Comment Submission ---
   const handleCommentSubmit = async (e: React.FormEvent) => {
       e.preventDefault();
       if (!user || !selectedPost || !newComment.trim() || isSubmittingComment) return;

       setIsSubmittingComment(true); // Indicate loading state

       const commentData: NewCommentData = {
           userId: user.uid,
           text: newComment.trim(),
           // timestamp is set by the server in the service function
       };

       try {
            const newCommentId = await addCommentToPost(selectedPost.id, commentData);
            console.log(`Comment ${newCommentId} added to post ${selectedPost.id}`);

            // Add to local state for immediate feedback (replace later with real-time listener)
             const commentToAdd: ClientComment = {
               id: newCommentId, // Use the ID returned from Firestore
               userId: user.uid,
               userName: user.displayName || getInitials(user.email), // Use display name or initials
               userAvatar: user.photoURL || undefined,
               text: newComment.trim(),
               timestamp: Date.now(), // Use current client time for immediate display
           };
           setComments(prev => [...prev, commentToAdd]);

            setNewComment(''); // Clear input
            toast({ title: "Comment Added" });

       } catch (error: any) {
           console.error("Error submitting comment:", error);
           toast({
               variant: "destructive",
               title: "Comment Failed",
               description: `Could not add comment: ${error.message}. Check rules.`,
           });
       } finally {
           setIsSubmittingComment(false); // Reset loading state
       }
   };
   // --- End Handle Comment Submission ---


  // Loading state for authentication check or initial data fetch
  if (authLoading || (isLoadingPosts && !posts?.length)) {
      return (
         <div className="container mx-auto p-4 pt-6 text-center">
            <div className="flex justify-center items-center h-64">
               <Loader2 className="h-8 w-8 animate-spin mr-3 text-primary" />
               <p className="text-muted-foreground text-lg">Loading posts...</p>
            </div>
         </div>
     );
   }

    // Handle case where user is logged in but there's an error fetching posts
    if (postsError && user) {
       return (
         <div className="container mx-auto p-4 pt-6 text-center">
           <div className="col-span-full text-center py-10 text-destructive">
             <p>Error loading posts: {postsError instanceof Error ? postsError.message : 'Unknown error'}.</p>
             <p>Please check your Firestore connection and security rules.</p>
           </div>
         </div>
       );
     }

  // Main content render
  return (
    <div className="container mx-auto p-4 pt-6">
        {/* Tag Filtering UI */}
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
         {isLoadingPosts && filteredPosts.length === 0 && ( // Show loading only if no posts are displayed yet
             <div className="col-span-full text-center py-10 flex justify-center items-center">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                 <p className="text-muted-foreground">Loading posts...</p>
             </div>
          )}
          {!isLoadingPosts && postsError && ( // Error state handled above, but keep this as fallback
              <div className="col-span-full text-center py-10 text-destructive">
                 <p>Error loading posts.</p>
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
                           : "No posts available yet. Be the first to create one!" // Adjusted message
                         }
                     </p>
                     {/* Create post button is now in the header */}
                 </div>
             )
          )}
        </div>

        {/* Post Detail Side Panel */}
        <Sheet open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
            <SheetContent className="sm:max-w-lg w-[90vw] p-0 flex flex-col" side="right"> {/* Make content flex column */}
                {selectedPost && (
                    <>
                        <ScrollArea className="flex-grow"> {/* Scroll main content */}
                            <div className="p-6 pb-0"> {/* Add padding, remove bottom padding */}
                                <SheetHeader className="space-y-2.5 text-left mb-6 border-b pb-4">
                                    <SheetTitle className="text-xl font-semibold">{selectedPost.question}</SheetTitle>
                                     <div className="flex flex-wrap items-center gap-2 pt-1">
                                        {selectedPost.tags?.map((tag, index) => (
                                        <Badge key={`${selectedPost.id}-detail-tag-${index}`} variant="secondary" className="text-xs cursor-default">{tag}</Badge>
                                        ))}
                                    </div>
                                     <SheetDescription className="text-sm pt-1">
                                        Posted on: {selectedPost.createdAt instanceof Timestamp ? selectedPost.createdAt.toDate().toLocaleDateString() : 'Date unavailable'}
                                    </SheetDescription>
                                </SheetHeader>

                                <div className="space-y-4 text-sm mb-6"> {/* Add bottom margin */}
                                     {selectedPost.description && (
                                         <div>
                                             <strong className="text-foreground">Details:</strong>
                                             <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{selectedPost.description}</p>
                                         </div>
                                     )}

                                     <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 border-t pt-4">
                                          <div>
                                              <strong className="block text-foreground">Sector:</strong>
                                              <span className="text-muted-foreground">{selectedPost.sector || 'N/A'}</span>
                                           </div>
                                            <div>
                                                <strong className="block text-foreground">Business Type:</strong>
                                                <span className="text-muted-foreground">{selectedPost.businessType || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <strong className="text-foreground">Safety Indicator:</strong>
                                                <span className={cn(
                                                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                                                    selectedPost.safetyIndicator === 'High' ? "bg-primary text-primary-foreground"
                                                    : selectedPost.safetyIndicator === 'Medium' ? "bg-secondary text-secondary-foreground"
                                                    : "bg-destructive text-destructive-foreground"
                                                  )}>
                                                    {selectedPost.safetyIndicator || 'N/A'}
                                                </span>
                                            </div>
                                            <div>
                                                <strong className="block text-foreground">Rating Score:</strong>
                                                <span className="text-muted-foreground">{selectedPost.ratingScore ? `${selectedPost.ratingScore} / 5` : 'N/A'}</span>
                                            </div>
                                     </div>
                                       {/* --- View Business Profile Link --- */}
                                       {user && selectedPost.userId !== user.uid && ( // Show only if logged in and not the owner
                                         <div className="mt-4 border-t pt-4">
                                           <Link
                                               href={`/profile/${selectedPost.userId}`} // Link to a dynamic profile page
                                               passHref
                                               legacyBehavior // Needed for passing href to Button asChild
                                           >
                                               <Button variant="link" size="sm" className="text-primary p-0 h-auto flex items-center gap-1">
                                                   <Building className="h-4 w-4" /> View Business Profile
                                               </Button>
                                           </Link>
                                           <p className="text-xs text-muted-foreground mt-1">
                                               (Business details are revealed upon connection/contract)
                                           </p>
                                         </div>
                                       )}
                                       {/* --- End View Business Profile Link --- */}
                                </div>

                                {/* --- Comments Section --- */}
                                <div className="mt-6 border-t pt-4">
                                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <MessageCircle className="h-5 w-5 text-primary"/> Comments ({comments.length})
                                    </h4>
                                    {comments.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No comments yet.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* TODO: Fetch and display real comments, map over fetched data */}
                                            {comments.map((comment) => (
                                                <div key={comment.id} className="flex items-start gap-3">
                                                    <Avatar className="h-8 w-8 mt-1">
                                                        <AvatarImage src={comment.userAvatar} alt={comment.userName}/>
                                                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                                                            {getInitials(comment.userName)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-grow bg-muted/50 p-3 rounded-lg">
                                                        <div className="flex justify-between items-center mb-1">
                                                             <p className="text-sm font-medium text-foreground">{comment.userName || 'Anonymous'}</p>
                                                             <p className="text-xs text-muted-foreground">
                                                                 {/* Format timestamp correctly */}
                                                                 {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                             </p>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">{comment.text}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {/* --- End Comments Section --- */}
                            </div>
                        </ScrollArea>

                         {/* Fixed Footer for Actions and Comment Input */}
                         <SheetFooter className="p-6 border-t bg-background mt-auto sticky bottom-0"> {/* Make footer sticky */}
                             <div className="w-full space-y-4">
                                 {/* Comment Input Form */}
                                 <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
                                     <Input
                                         type="text"
                                         placeholder="Add a comment..."
                                         value={newComment}
                                         onChange={(e) => setNewComment(e.target.value)}
                                         disabled={!user || isSubmittingComment} // Disable if not logged in or submitting
                                         className="flex-grow"
                                         aria-label="New comment input"
                                     />
                                     <Button type="submit" size="icon" disabled={!newComment.trim() || !user || isSubmittingComment}>
                                         {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                         <span className="sr-only">Send Comment</span>
                                     </Button>
                                 </form>
                                 {/* Existing Action Buttons */}
                                 <div className="flex justify-end gap-2">
                                     {user && selectedPost.userId !== user.uid && (
                                         <>
                                             <Button
                                                 variant="outline"
                                                 size="sm"
                                                 onClick={() => handleOfferHelp(selectedPost.userId, selectedPost.id)}
                                             >
                                                 <HandHelping className="mr-2 h-4 w-4" /> Offer Help
                                             </Button>
                                             <ConnectionButton
                                                 targetUserId={selectedPost.userId}
                                                 size="sm"
                                                 variant="default"
                                             />
                                         </>
                                     )}
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
                                                     Delete Post
                                                 </Button>
                                             </AlertDialogTrigger>
                                             <AlertDialogContent>
                                                 <AlertDialogHeader>
                                                     <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                     <AlertDialogDescription>
                                                         This action cannot be undone. This will permanently delete your post.
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
                                                                 <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
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
                             </div>
                         </SheetFooter>
                    </>
                )}
            </SheetContent>
        </Sheet>
    </div>
  );
}

// Export the BoardPageContent component as the default export for this page route
export default BoardPageContent;
