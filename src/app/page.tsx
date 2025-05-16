// src/app/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Import Link
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle as UICardTitle } from "@/components/ui/card"; // Renamed CardTitle import
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import Image from 'next/image'; // For Next.js optimized images
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Import Popover for suggestions
import { cn } from "@/lib/utils";
import { Loader2, Trash2, HandHelping, LineChart, FileText, Network, Home, Eye, Building, Link2, MessageCircle, Send, Trash, CornerDownRight, Heart, Sparkles, AtSign } from "lucide-react"; // Added AtSign icon
import { useToast } from "@/hooks/use-toast";
import type { Post, NewPostData } from '@/types/post'; // Correctly import types
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsFromFirestore, deletePostFromFirestore, addPostToFirestore } from '@/services/postService';
import { Skeleton } from '@/components/ui/skeleton';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp
import { autocompletePostDescription } from '@/ai/flows/autocomplete-post-description'; // Import the AI flow
import { findOrCreateConversation } from '@/services/messagingService'; // Import conversation service
import { ConnectionButton } from '@/components/ConnectionButton'; // Import ConnectionButton
import { addCommentToPost, getCommentsForPost, deleteCommentFromPost, getSubCommentsForComment, addSubCommentToComment, deleteSubCommentFromComment, toggleLikeComment, toggleLikeSubComment } from '@/services/commentService'; // Import comment/subcomment/like services
import type { NewCommentData, ClientComment, ClientSubComment, NewSubCommentData } from '@/types/comment'; // Import comment/subcomment types
import { getUserProfileBasic } from '@/services/connectionService'; // To potentially resolve mentions
import type { UserProfileBasic } from '@/types/connection'; // Import UserProfileBasic type

// Moved availableTags to MainLayout as it's used by CreatePostForm there
import { availableTags } from '@/components/layout/MainLayout';

// --- Helper: Get Initials ---
const getInitials = (displayName: string | undefined | null): string => {
    if (!displayName) return '?';
    if (displayName.startsWith('@')) {
        return displayName.length > 1 ? displayName.charAt(1).toUpperCase() : '?';
    }
    return displayName.charAt(0).toUpperCase();
};

// --- Helper: Render Text with Mentions as Links ---
const TextWithMentions = React.memo(({ text, mentionedUserIds = [] }: { text: string, mentionedUserIds?: string[] }) => {
    const { data: mentionProfilesMap = new Map(), isLoading: isLoadingMentions } = useQuery<Map<string, UserProfileBasic | null>>({
        queryKey: ['mentionProfiles', mentionedUserIds],
        queryFn: async () => {
            const profiles = new Map<string, UserProfileBasic | null>();
            await Promise.all(
                mentionedUserIds.map(async (userId) => {
                    // Use existing profile fetching function
                    const profile = await getUserProfileBasic(userId);
                    profiles.set(userId, profile);
                })
            );
            return profiles;
        },
        enabled: mentionedUserIds.length > 0,
        staleTime: Infinity, // Cache profiles heavily
    });

    if (mentionedUserIds.length === 0 || isLoadingMentions) {
        return <>{text}</>; // Return plain text if no mentions or still loading profiles
    }

    // Simple replacement logic (can be improved for robustness)
    // Split text by potential mention patterns (e.g., @username or @id)
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);

    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith('@')) {
                    const potentialIdOrName = part.substring(1);
                    // Find the user ID from the map whose name matches or whose ID matches
                    const mentionedUserId = mentionedUserIds.find(id => {
                         const profile = mentionProfilesMap.get(id);
                         // Check if the potential match is the ID or the display name (without the @)
                         return id === potentialIdOrName || (profile?.displayName && profile.displayName === potentialIdOrName);
                     });

                    if (mentionedUserId) {
                        const profile = mentionProfilesMap.get(mentionedUserId);
                        const displayName = profile?.displayName || potentialIdOrName; // Fallback to the matched string
                        return (
                            <Link
                                key={`${mentionedUserId}-${index}`}
                                href={`/profile/${mentionedUserId}`}
                                className="text-primary hover:underline font-medium"
                            >
                                @{displayName}
                            </Link>
                        );
                    }
                }
                return <React.Fragment key={index}>{part}</React.Fragment>; // Return non-mention parts as is
            })}
        </>
    );
});
TextWithMentions.displayName = 'TextWithMentions';


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
           {post.imageUrls && post.imageUrls.length > 0 && (
             <div className="mt-2 rounded-md overflow-hidden aspect-video relative">
               <Image
                 src={post.imageUrls[0]} // Display first image as preview
                 alt={post.question}
                 layout="fill"
                 objectFit="cover"
                 data-ai-hint="post image" // Generic hint
               />
             </div>
           )}
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


// Component for displaying a single subcomment (reply)
const SubCommentItem = React.memo(({ subComment, currentUserId, postId, commentId, onDelete }: { subComment: ClientSubComment, currentUserId: string | null, postId: string, commentId: string, onDelete: () => void }) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth(); // Get current user for liking
    const isOwnSubComment = subComment.userId === currentUserId;
    const [isLiking, setIsLiking] = useState(false);

    // Derived state: Check if the current user has liked this subcomment
    const hasLiked = !!(currentUserId && subComment.likedBy?.includes(currentUserId));

    const deleteSubCommentMutation = useMutation({
        mutationFn: () => deleteSubCommentFromComment(postId, commentId, subComment.id),
        onSuccess: () => {
            toast({ title: "Reply Deleted" });
            onDelete(); // Trigger parent (CommentItem) refetch
        },
        onError: (error: Error) => {
            console.error("Error deleting subcomment:", error);
            toast({
                variant: "destructive",
                title: "Delete Failed",
                description: `Could not delete reply: ${error.message}`,
            });
        },
    });

    const handleDeleteClick = () => {
        deleteSubCommentMutation.mutate();
    };

    // --- Toggle Like SubComment Mutation ---
    const toggleLikeSubCommentMutation = useMutation({
        mutationFn: () => {
            if (!user) throw new Error("User must be logged in to like");
            return toggleLikeSubComment(postId, commentId, subComment.id, user.uid);
        },
        onMutate: async () => {
            setIsLiking(true);
            // Optimistic UI update for subcomments
            await queryClient.cancelQueries({ queryKey: ['subComments', postId, commentId] });
            const previousSubComments = queryClient.getQueryData<ClientSubComment[]>(['subComments', postId, commentId]);

            queryClient.setQueryData<ClientSubComment[]>(['subComments', postId, commentId], (oldSubComments = []) =>
                oldSubComments.map(sc => {
                    if (sc.id === subComment.id) {
                        const currentlyLiked = sc.likedBy?.includes(user!.uid);
                        return {
                            ...sc,
                            likeCount: currentlyLiked ? (sc.likeCount ?? 1) - 1 : (sc.likeCount ?? 0) + 1,
                            likedBy: currentlyLiked
                                ? sc.likedBy?.filter(uid => uid !== user!.uid) ?? []
                                : [...(sc.likedBy ?? []), user!.uid],
                        };
                    }
                    return sc;
                })
            );
            return { previousSubComments };
        },
        onError: (err, _variables, context) => {
            console.error("Error toggling subcomment like:", err);
            toast({ variant: "destructive", title: "Like Failed", description: "Could not update like." });
            // Rollback on error
            if (context?.previousSubComments) {
                queryClient.setQueryData(['subComments', postId, commentId], context.previousSubComments);
            }
        },
        onSettled: () => {
            setIsLiking(false);
            // Refetch subcomments after mutation to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['subComments', postId, commentId] });
        },
    });

    const handleLikeClick = () => {
        if (!user || isLiking) return;
        toggleLikeSubCommentMutation.mutate();
    };

    return (
        <div key={subComment.id} className="flex items-start gap-2 group"> {/* Add group for hover effect */}
            {/* Wrap Avatar in Link */}
            <Link href={`/profile/${subComment.userId}`} passHref>
                <Avatar className="h-6 w-6 mt-1 flex-shrink-0 cursor-pointer">
                    <AvatarImage src={subComment.userAvatar} alt={subComment.userName} />
                    <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                        {getInitials(subComment.userName)}
                    </AvatarFallback>
                </Avatar>
            </Link>
            <div className="flex-grow bg-background p-2 rounded-md min-w-0 border border-border/50"> {/* Added min-w-0 */}
                {/* Header: Username (Left) | Like, Time, Delete (Right) */}
                <div className="flex justify-between items-center mb-1">
                    {/* Left: Username (Wrapped in Link) */}
                    <Link href={`/profile/${subComment.userId}`} passHref>
                         <p className="text-xs font-medium text-foreground truncate hover:underline cursor-pointer">
                             {subComment.userName || `@${subComment.userId}`}
                         </p>
                    </Link>

                    {/* Right: Actions (Like, Time, Delete) */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                         {/* Like Button */}
                         {user && ( // Only show like button if logged in
                           <Button
                              variant="ghost"
                              size="xs"
                              onClick={handleLikeClick}
                              disabled={isLiking}
                              className={cn(
                                  "text-xs h-auto p-0.5 flex items-center gap-0.5",
                                  hasLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500"
                              )}
                              aria-pressed={hasLiked}
                           >
                              {isLiking ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                  <Heart className={cn("h-3 w-3", hasLiked ? "fill-current" : "")} />
                              )}
                              {subComment.likeCount && subComment.likeCount > 0 ? <span className="text-xs">({subComment.likeCount})</span> : ''}
                           </Button>
                        )}
                        {/* Time */}
                        <p className="text-xs text-muted-foreground">
                            {new Date(subComment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {/* Delete Button */}
                        {isOwnSubComment && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-muted-foreground/70 hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                    disabled={deleteSubCommentMutation.isPending}
                                    aria-label="Delete reply"
                                >
                                    {deleteSubCommentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin"/> : <Trash className="h-3 w-3"/>}
                                </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Reply?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to delete this reply? This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={deleteSubCommentMutation.isPending}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDeleteClick}
                                            disabled={deleteSubCommentMutation.isPending}
                                            className="bg-destructive hover:bg-destructive/90"
                                        >
                                            {deleteSubCommentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>
                 {/* Main Content: Text */}
                <p className="text-sm text-muted-foreground break-words">
                     <TextWithMentions text={subComment.text} mentionedUserIds={subComment.mentionedUserIds} />
                </p>
            </div>
        </div>
    );
});
SubCommentItem.displayName = 'SubCommentItem';

// Component for displaying a single comment and its replies (subcomments)
const CommentItem = React.memo(({ comment, currentUserId, postId, onDelete }: { comment: ClientComment, currentUserId: string | null, postId: string, onDelete: () => void }) => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user } = useAuth(); // Get current user for adding replies and liking
    const isOwnComment = comment.userId === currentUserId;
    const [showReplies, setShowReplies] = useState(false); // State to toggle replies visibility
    const [newReply, setNewReply] = useState(''); // State for new reply input
    const [isReplying, setIsReplying] = useState(false); // State to show reply input form
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [isLiking, setIsLiking] = useState(false); // State for liking loading

    // --- State for mention suggestions ---
    const [mentionQuery, setMentionQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const replyInputRef = useRef<HTMLInputElement>(null);
    const suggestionsPopoverRef = useRef<HTMLDivElement>(null); // Ref for popover content

    // Derived state: Check if the current user has liked this comment
    const hasLiked = !!(currentUserId && comment.likedBy?.includes(currentUserId));

    // --- Fetch SubComments (Replies) ---
    const {
        data: subComments = [],
        isLoading: isLoadingSubComments,
        error: subCommentsError,
        refetch: refetchSubComments,
    } = useQuery<ClientSubComment[]>({
        queryKey: ['subComments', postId, comment.id], // Unique key for this comment's replies
        queryFn: () => getSubCommentsForComment(postId, comment.id),
        enabled: showReplies, // Only fetch when showReplies is true
        staleTime: 1000 * 60 * 1, // 1 minute stale time
    });
    // --- End Fetch SubComments ---

    // --- Fetch User Profiles for Mentions ---
    // Get unique user IDs from the current comment and all subcomments
    const userIdsToFetch = useMemo(() => {
        const ids = new Set<string>([comment.userId]);
        subComments.forEach(sc => ids.add(sc.userId));
        return Array.from(ids).filter(id => id !== currentUserId); // Exclude self
    }, [comment.userId, subComments, currentUserId]);

    const { data: userProfilesMap = new Map(), isLoading: isLoadingProfiles } = useQuery<Map<string, UserProfileBasic | null>>({
        queryKey: ['userProfilesForMentions', userIdsToFetch],
        queryFn: async () => {
            const profiles = new Map<string, UserProfileBasic | null>();
            await Promise.all(
                userIdsToFetch.map(async (userId) => {
                    const profile = await getUserProfileBasic(userId);
                    profiles.set(userId, profile);
                })
            );
            return profiles;
        },
        enabled: userIdsToFetch.length > 0 && isReplying, // Only fetch when reply form is open
        staleTime: Infinity,
    });
    // --- End Fetch User Profiles ---

    // --- Filtered suggestions based on mentionQuery ---
    const filteredSuggestions = useMemo(() => {
        if (!mentionQuery || isLoadingProfiles) return [];
        const queryLower = mentionQuery.toLowerCase();
        return Array.from(userProfilesMap.values())
            .filter((profile): profile is UserProfileBasic => profile !== null && profile.displayName.toLowerCase().includes(queryLower))
            .slice(0, 5); // Limit suggestions
    }, [mentionQuery, userProfilesMap, isLoadingProfiles]);


    // --- Delete Comment Mutation ---
    const deleteCommentMutation = useMutation({
        mutationFn: () => deleteCommentFromPost(postId, comment.id),
        onSuccess: () => {
            toast({ title: "Comment Deleted" });
            onDelete(); // Trigger parent refetch
        },
        onError: (error: Error) => {
            console.error("Error deleting comment:", error);
            toast({
                variant: "destructive",
                title: "Delete Failed",
                description: `Could not delete comment: ${error.message}`,
            });
        },
    });

    const handleDeleteClick = () => {
        deleteCommentMutation.mutate();
    };

    // --- Add SubComment (Reply) Mutation ---
    const addReplyMutation = useMutation({
        mutationFn: (replyData: Omit<NewSubCommentData, 'likeCount' | 'likedBy'>) => addSubCommentToComment(postId, comment.id, replyData),
        onSuccess: () => {
            toast({ title: "Reply Added" });
            setNewReply(''); // Clear input
            setIsReplying(false); // Hide reply input
            setShowSuggestions(false); // Hide suggestions
            if (!showReplies) {
                setShowReplies(true); // Show replies section if it was hidden
            } else {
                refetchSubComments(); // Refetch replies if section was already open
            }
            // Invalidate notifications query for the recipient of the reply
            // (The recipient ID would ideally be fetched or known, here assuming comment.userId)
            queryClient.invalidateQueries({ queryKey: ['notifications', comment.userId] });
             // Invalidate notifications for mentioned users (if any) - Requires resolving mentions to IDs
             // This part is complex without a proper mention resolution system
        },
        onError: (error: Error) => {
            console.error("Error adding reply:", error);
            toast({
                variant: "destructive",
                title: "Reply Failed",
                description: `Could not add reply: ${error.message}`,
            });
        },
        onSettled: () => {
            setIsSubmittingReply(false); // Always reset loading state
        },
    });

    // --- Handle Mention Input Changes ---
    const handleMentionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewReply(value);

        const lastAtIndex = value.lastIndexOf('@');
        const lastSpaceIndex = value.lastIndexOf(' ');

        // Check if '@' is the last character or follows a space, and there's no space after it
        if (lastAtIndex > -1 && lastAtIndex > lastSpaceIndex && value.indexOf(' ', lastAtIndex) === -1) {
            const query = value.substring(lastAtIndex + 1);
            setMentionQuery(query);
            setShowSuggestions(true); // Show suggestions when @ is typed correctly
        } else {
            setMentionQuery('');
            setShowSuggestions(false); // Hide otherwise
        }
    };

    // --- Handle Selecting a Suggestion ---
    const handleSelectSuggestion = (profile: UserProfileBasic) => {
        const lastAtIndex = newReply.lastIndexOf('@');
        if (lastAtIndex > -1) {
            const textBeforeMention = newReply.substring(0, lastAtIndex);
            // Append the selected username and a space
            setNewReply(`${textBeforeMention}@${profile.displayName} `);
        }
        setShowSuggestions(false); // Hide suggestions after selection
        setMentionQuery(''); // Clear query
        replyInputRef.current?.focus(); // Keep focus on input
    };

     // --- Use effect to handle clicks outside the suggestions popover ---
     useEffect(() => {
         const handleClickOutside = (event: MouseEvent) => {
             if (
                 suggestionsPopoverRef.current &&
                 !suggestionsPopoverRef.current.contains(event.target as Node) &&
                 replyInputRef.current &&
                 !replyInputRef.current.contains(event.target as Node) // Don't close if clicking inside input
             ) {
                 setShowSuggestions(false);
             }
         };

         document.addEventListener('mousedown', handleClickOutside);
         return () => {
             document.removeEventListener('mousedown', handleClickOutside);
         };
     }, []); // Empty dependency array to run only once on mount


    const handleReplySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newReply.trim() || isSubmittingReply) return;

        setIsSubmittingReply(true);
        // Omit likeCount and likedBy as they are initialized in the service
        // Extract mentions from the reply text (placeholder)
         const mentionedUserIds = extractMentions(newReply.trim()); // Use the same helper

        const replyData: Omit<NewSubCommentData, 'likeCount' | 'likedBy'> = {
            userId: user.uid,
            text: newReply.trim(),
            mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : [], // Add mentioned IDs
        };
        addReplyMutation.mutate(replyData);
    };

    // --- Toggle Like Mutation ---
    const toggleLikeMutation = useMutation({
        mutationFn: () => {
            if (!user) throw new Error("User must be logged in to like");
            return toggleLikeComment(postId, comment.id, user.uid);
        },
        onMutate: async () => {
            setIsLiking(true);
            // Optimistic UI update
            await queryClient.cancelQueries({ queryKey: ['comments', postId] });
            const previousComments = queryClient.getQueryData<ClientComment[]>(['comments', postId]);

            queryClient.setQueryData<ClientComment[]>(['comments', postId], (oldComments = []) =>
                oldComments.map(c => {
                    if (c.id === comment.id) {
                        const currentlyLiked = c.likedBy?.includes(user!.uid);
                        return {
                            ...c,
                            likeCount: currentlyLiked ? (c.likeCount ?? 1) - 1 : (c.likeCount ?? 0) + 1,
                            likedBy: currentlyLiked
                                ? c.likedBy?.filter(uid => uid !== user!.uid) ?? []
                                : [...(c.likedBy ?? []), user!.uid],
                        };
                    }
                    return c;
                })
            );
            return { previousComments };
        },
        onError: (err, _variables, context) => {
            console.error("Error toggling like:", err);
            toast({ variant: "destructive", title: "Like Failed", description: "Could not update like." });
            // Rollback on error
            if (context?.previousComments) {
                queryClient.setQueryData(['comments', postId], context.previousComments);
            }
        },
        onSettled: () => {
            setIsLiking(false);
            // Refetch comments after mutation to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['comments', postId] });
        },
    });

    const handleLikeClick = () => {
        if (!user || isLiking) return;
        toggleLikeMutation.mutate();
    };

    // Toggle showing/hiding replies
    const toggleShowReplies = () => {
        setShowReplies(prev => !prev);
    };

    // Toggle showing/hiding the reply input form
    const toggleReplyForm = () => {
        setIsReplying(prev => !prev);
        if (!isReplying) {
             // Delay focus slightly to ensure input is rendered
             setTimeout(() => replyInputRef.current?.focus(), 0);
        } else {
            setShowSuggestions(false); // Hide suggestions when closing form
        }
    };

    // Callback for SubCommentItem to trigger refetch
    const handleSubCommentDeleted = () => {
        refetchSubComments();
    };

    return (
        <div className="group border-b border-border/50 pb-4"> {/* Wrap entire comment + replies */}
            <div className="flex items-start gap-3 "> {/* Main comment content */}
                 {/* Wrap Avatar in Link */}
                 <Link href={`/profile/${comment.userId}`} passHref>
                     <Avatar className="h-8 w-8 mt-1 flex-shrink-0 cursor-pointer">
                         <AvatarImage src={comment.userAvatar} alt={comment.userName} />
                         <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                             {getInitials(comment.userName)}
                         </AvatarFallback>
                     </Avatar>
                 </Link>
                <div className="flex-grow bg-muted/50 p-3 rounded-lg min-w-0"> {/* Added min-w-0 */}
                     {/* Header: Username (Left) | Like, Time, Delete (Right) */}
                    <div className="flex justify-between items-center mb-1">
                         {/* Left: Username (Wrapped in Link) */}
                         <Link href={`/profile/${comment.userId}`} passHref>
                             <p className="text-sm font-medium text-foreground truncate hover:underline cursor-pointer">
                                 {comment.userName || `@${comment.userId}`}
                             </p>
                         </Link>

                        {/* Right: Actions (Like, Time, Delete) */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                             {/* Like Button */}
                            {user && ( // Only show like button if logged in
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={handleLikeClick}
                                    disabled={isLiking}
                                    className={cn(
                                        "text-xs h-auto p-0.5 flex items-center gap-0.5", // Reduced padding and gap
                                        hasLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500"
                                    )}
                                    aria-pressed={hasLiked}
                                >
                                    {isLiking ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Heart className={cn("h-3 w-3", hasLiked ? "fill-current" : "")} />
                                    )}
                                    {comment.likeCount && comment.likeCount > 0 ? <span className="text-xs">({comment.likeCount})</span> : ''}
                                </Button>
                             )}
                            {/* Time */}
                            <p className="text-xs text-muted-foreground">
                                {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {/* Delete Button */}
                            {isOwnComment && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-muted-foreground/70 hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                        disabled={deleteCommentMutation.isPending}
                                        aria-label="Delete comment"
                                    >
                                        {deleteCommentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin"/> : <Trash className="h-3 w-3"/>}
                                    </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Comment?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to delete this comment? This action cannot be undone. Deleting the comment will also remove all replies.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={deleteCommentMutation.isPending}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => handleDeleteClick()}
                                                disabled={deleteCommentMutation.isPending}
                                                className="bg-destructive hover:bg-destructive/90"
                                            >
                                                {deleteCommentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>
                    {/* Main Content: Text */}
                    <p className="text-sm text-muted-foreground break-words">
                         <TextWithMentions text={comment.text} mentionedUserIds={comment.mentionedUserIds} />
                    </p>
                </div>
            </div>

            {/* Reply & Show Replies Buttons */}
            <div className="flex items-center gap-3 pl-11 mt-2"> {/* Align with comment text, added gap */}
                 {user && ( // Only show reply button if logged in
                    <Button variant="ghost" size="xs" onClick={toggleReplyForm} className="text-xs text-muted-foreground hover:text-primary h-auto p-1">
                        <CornerDownRight className="h-3 w-3 mr-1" /> Reply
                    </Button>
                 )}
                 <Button variant="ghost" size="xs" onClick={toggleShowReplies} className="text-xs text-muted-foreground hover:text-primary h-auto p-1">
                     {showReplies ? 'Hide Replies' : `View Replies ${isLoadingSubComments ? '...' : subComments.length > 0 ? `(${subComments.length})` : ''}`}
                 </Button>
            </div>

            {/* Reply Input Form with Suggestions Popover */}
            {isReplying && user && (
                <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
                    <PopoverTrigger asChild>
                        <form onSubmit={handleReplySubmit} className="flex items-center gap-2 pl-11 mt-2 relative">
                             <Input
                                ref={replyInputRef}
                                type="text"
                                placeholder={`Replying to ${comment.userName || `@${comment.userId}`}... (@mention someone)`} // Use @ fallback
                                value={newReply}
                                onChange={handleMentionInputChange} // Use handler for suggestions
                                disabled={isSubmittingReply}
                                className="flex-grow h-8 text-sm"
                                aria-label="New reply input"
                                autoComplete="off" // Prevent browser autocomplete interfering
                             />
                             <Button type="submit" size="sm" disabled={!newReply.trim() || isSubmittingReply}>
                                 {isSubmittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                 <span className="sr-only">Send Reply</span>
                             </Button>
                         </form>
                    </PopoverTrigger>
                    {/* Suggestions Popover Content */}
                    <PopoverContent
                        ref={suggestionsPopoverRef} // Attach ref here
                        className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" // Style popover
                        side="top" // Adjust side as needed
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()} // Prevent focus stealing
                    >
                         {isLoadingProfiles ? (
                            <div className="p-2 text-center text-xs text-muted-foreground">Loading users...</div>
                         ) : filteredSuggestions.length > 0 ? (
                             <div className="space-y-1">
                                 {filteredSuggestions.map(profile => (
                                     <Button
                                         key={profile.userId}
                                         variant="ghost"
                                         size="sm"
                                         className="w-full justify-start h-auto px-2 py-1 text-xs"
                                         onClick={() => handleSelectSuggestion(profile)}
                                     >
                                         <Avatar className="h-5 w-5 mr-2">
                                             <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                                             <AvatarFallback className="text-xs">{getInitials(profile.displayName)}</AvatarFallback>
                                         </Avatar>
                                         {profile.displayName}
                                     </Button>
                                 ))}
                             </div>
                         ) : mentionQuery ? ( // Only show "no users found" if actively querying
                             <div className="p-2 text-center text-xs text-muted-foreground">No users found.</div>
                         ) : null}
                    </PopoverContent>
                </Popover>
            )}


            {/* Replies (SubComments) Section */}
            {showReplies && (
                <div className="pl-11 mt-3 space-y-3 border-l-2 border-border ml-5"> {/* Indent replies */}
                    {isLoadingSubComments ? (
                         <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                         </div>
                    ) : subCommentsError ? (
                        <p className="text-xs text-destructive pl-2">Error loading replies.</p>
                    ) : subComments.length === 0 ? (
                        <p className="text-xs text-muted-foreground pl-2">No replies yet.</p>
                    ) : (
                        subComments.map((subComment) => (
                            <SubCommentItem
                                key={subComment.id}
                                subComment={subComment}
                                currentUserId={currentUserId}
                                postId={postId}
                                commentId={comment.id}
                                onDelete={handleSubCommentDeleted} // Pass refetch handler
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
});
CommentItem.displayName = 'CommentItem';

// --- Main Board Page Content Component Logic ---
function BoardPageContent() {
  const { user, loading: authLoading } = useAuth(); // Get user and loading state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [newComment, setNewComment] = useState(''); // State for new comment input
  const [isSubmittingComment, setIsSubmittingComment] = useState(false); // State for comment submission loading
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- State for AI Autocomplete ---
   const [isAutocompleting, setIsAutocompleting] = useState(false);
   const [autocompleteSuggestion, setAutocompleteSuggestion] = useState<string | null>(null);
   const descriptionRef = useRef<HTMLTextAreaElement>(null); // Ref for description textarea
   const autocompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for debounce timer
   // --- End AI Autocomplete State ---

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


   // --- Fetch Comments for Selected Post ---
   const {
       data: comments = [],
       isLoading: isLoadingComments,
       error: commentsError,
       refetch: refetchComments, // Add refetch function
   } = useQuery<ClientComment[]>({
       queryKey: ['comments', selectedPost?.id], // Include post ID in query key
       queryFn: () => getCommentsForPost(selectedPost!.id), // Fetch comments for the selected post
       enabled: !!selectedPost && !!selectedPost.id, // Only fetch if a post is selected and has an ID
       staleTime: 1000 * 60 * 1, // 1 minute stale time
       refetchOnWindowFocus: true,
   });
   // --- End Fetch Comments ---

   // --- Handle Comment Submission ---
   const handleCommentSubmit = async (e: React.FormEvent) => {
       e.preventDefault();
       if (!user || !selectedPost || !newComment.trim() || isSubmittingComment) return;

       setIsSubmittingComment(true); // Indicate loading state

       // Extract mentions (placeholder)
       const mentionedUserIds = extractMentions(newComment.trim()); // Use the same helper

       // Adjust type based on imported comment service function expectation
       // Omit likeCount and likedBy as they are initialized in the service
       const commentData: Omit<NewCommentData, 'likeCount' | 'likedBy'> = {
           userId: user.uid,
           text: newComment.trim(),
           mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : [], // Add mentioned IDs
           // timestamp is set by the server in the service function
       };


       try {
            const newCommentId = await addCommentToPost(selectedPost.id, commentData);
            console.log(`Comment ${newCommentId} added to post ${selectedPost.id}`);

            // --- Invalidate comments query to refetch ---
            await queryClient.invalidateQueries({ queryKey: ['comments', selectedPost.id] });
            // --- Invalidate notifications query for mentioned users ---
            mentionedUserIds.forEach(mentionedId => {
                queryClient.invalidateQueries({ queryKey: ['notifications', mentionedId] });
            });

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

   // Callback function for CommentItem to trigger refetch after deletion
   const handleCommentDeleted = () => {
       refetchComments();
   };

    // Placeholder function to handle mention suggestions in the main comment input
    const handleMentionInput = (text: string) => {
        // For the main comment input, we don't implement suggestions yet
        setNewComment(text);
    };


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

                                {selectedPost.imageUrls && selectedPost.imageUrls.length > 0 && (
                                    <div className="mb-4 rounded-lg overflow-hidden shadow-md">
                                        <Carousel className="w-full">
                                            <CarouselContent>
                                                {selectedPost.imageUrls.map((url, index) => (
                                                <CarouselItem key={index}>
                                                    <div className="aspect-video relative">
                                                    <Image
                                                        src={url}
                                                        alt={`Post image ${index + 1}`}
                                                        layout="fill"
                                                        objectFit="contain" // Use contain to see full image, or cover
                                                        className="rounded-md"
                                                        data-ai-hint="uploaded content"
                                                    />
                                                    </div>
                                                </CarouselItem>
                                                ))}
                                            </CarouselContent>
                                            {selectedPost.imageUrls.length > 1 && (
                                                <>
                                                    <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2" />
                                                    <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2" />
                                                </>
                                            )}
                                        </Carousel>
                                    </div>
                                )}


                                <div className="space-y-4 text-sm mb-6"> {/* Add bottom margin */}
                                     {selectedPost.description && (
                                         <div>
                                             <strong className="text-foreground">Details:</strong>
                                             <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{selectedPost.description}</p>
                                         </div>
                                     )}

                                     <div className="grid grid-cols-1 gap-y-2 mt-4 border-t pt-4">
                                         <div>
                                            <strong className="block text-foreground">Sector:</strong>
                                            <span className="text-muted-foreground">{selectedPost.sector || 'N/A'}</span>
                                         </div>
                                         {selectedPost.subSector && (
                                            <div>
                                                <strong className="block text-foreground">Sub-Sector:</strong>
                                                <span className="text-muted-foreground">{selectedPost.subSector}</span>
                                            </div>
                                         )}
                                         {selectedPost.industry && (
                                            <div>
                                                <strong className="block text-foreground">Industry:</strong>
                                                <span className="text-muted-foreground">{selectedPost.industry}</span>
                                            </div>
                                         )}
                                         {selectedPost.naicsCode && (
                                            <div>
                                                <strong className="block text-foreground">NAICS Code:</strong>
                                                <span className="text-muted-foreground">{selectedPost.naicsCode}</span>
                                            </div>
                                         )}
                                      </div>

                                     <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 border-t pt-4">
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
                                        <MessageCircle className="h-5 w-5 text-primary"/> Comments ({isLoadingComments ? '...' : comments.length})
                                    </h4>
                                    {isLoadingComments ? (
                                        <div className="space-y-4">
                                            <Skeleton className="h-16 w-full" />
                                            <Skeleton className="h-16 w-full" />
                                        </div>
                                    ) : commentsError ? (
                                        <p className="text-sm text-destructive">Error loading comments.</p>
                                    ) : comments.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No comments yet.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {comments.map((comment) => (
                                                <CommentItem
                                                   key={comment.id}
                                                   comment={comment}
                                                   currentUserId={user?.uid ?? null} // Pass current user ID
                                                   postId={selectedPost!.id} // Pass post ID
                                                   onDelete={handleCommentDeleted} // Pass delete handler
                                                />
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
                                     {/* Replace Input with a component supporting mentions if needed */}
                                     <Input
                                         type="text"
                                         placeholder="Add a comment... (@mention someone)"
                                         value={newComment}
                                         onChange={(e) => handleMentionInput(e.target.value)} // Use handler
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

// Helper function to extract mentioned user IDs from text (Improved)
const extractMentions = (text: string): string[] => {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const matches = text.matchAll(mentionRegex);
    const userIdentifiers = new Set<string>(); // Use Set to avoid duplicates
    for (const match of matches) {
        if (match[1]) {
            userIdentifiers.add(match[1]);
        }
    }
    // TODO: Resolve usernames to actual user IDs here
    // For now, returning the matched identifier (which might be username or ID)
    return Array.from(userIdentifiers);
};
