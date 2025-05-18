
// src/app/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Import Link
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from "@/components/ui/card"; // Renamed CardTitle import
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
import { Separator } from '@/components/ui/separator'; // Import Separator
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Import Popover for suggestions
import { cn } from "@/lib/utils";
import { Loader2, Trash2, HandHelping, FileText, Network, Home, Eye, Building, Link2, MessageCircle, Send, Trash, CornerDownRight, Heart, Sparkles, AtSign, Tag } from "lucide-react"; // Added AtSign icon, Tag
import { useToast } from "@/hooks/use-toast";
import type { Post, NewPostData } from '@/types/post'; // Correctly import types
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsFromFirestore, deletePostFromFirestore } from '@/services/postService';
import { Skeleton } from '@/components/ui/skeleton';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp
// Removed: import { autocompletePostDescription } from '@/ai/flows/autocomplete-post-description'; // Import the AI flow
import { findOrCreateConversation } from '@/services/messagingService'; // Import conversation service
import { ConnectionButton } from '@/components/ConnectionButton'; // Import ConnectionButton
import { addCommentToPost, getCommentsForPost, deleteCommentFromPost, getSubCommentsForComment, addSubCommentToComment, deleteSubCommentFromComment, toggleLikeComment, toggleLikeSubComment } from '@/services/commentService'; // Import comment/subcomment/like services
import type { NewCommentData, ClientComment, ClientSubComment, NewSubCommentData } from '@/types/comment'; // Import comment/subcomment types
import { getUserProfileBasic } from '@/services/connectionService'; // To potentially resolve mentions
import type { UserProfileBasic } from '@/types/connection'; // Import UserProfileBasic type

// Moved availableTags to MainLayout as it's used by CreatePostForm there
import { availableTags } from '@/components/layout/MainLayout';
import { generateAnonymousName } from '@/lib/pseudonymUtils';


// --- Helper: Get Initials ---
const getInitials = (displayNameOrUid: string | undefined | null): string => {
    if (!displayNameOrUid) return '?';
    const nameToProcess = displayNameOrUid.startsWith('@') ? displayNameOrUid.substring(1) : displayNameOrUid;

    // Check if the name looks like a generated pseudonym (e.g., "BlueWhale123")
    const pseudonymRegex = /^[A-Z][a-z]+[A-Z][a-z]+[0-9]{3}$/; // Simplified regex for "AdjNounNum"
    if (pseudonymRegex.test(nameToProcess)) {
        // For "BlueWhale123", try to get "BW" or just "B"
        const match = nameToProcess.match(/^([A-Z])[a-z]+([A-Z])/);
        if (match && match[1] && match[2]) {
            return match[1] + match[2];
        } else if (match && match[1]) {
            return match[1];
        }
    }

    // For regular names or other formats
    const names = nameToProcess.split(' ').filter(Boolean);
    if (names.length === 0) return '?';
    if (names.length === 1) return names[0].substring(0, 1).toUpperCase();
    return (names[0].substring(0, 1) + names[names.length - 1].substring(0, 1)).toUpperCase();
};


// --- Helper: Render Text with Mentions as Links ---
const TextWithMentions = React.memo(({ text, mentionedUserIds = [] }: { text: string, mentionedUserIds?: string[] }) => {
    const { data: mentionProfilesMap = new Map(), isLoading: isLoadingMentions } = useQuery<Map<string, UserProfileBasic | null>>({
        queryKey: ['mentionProfiles', mentionedUserIds],
        queryFn: async () => {
            const profiles = new Map<string, UserProfileBasic | null>();
            if (!mentionedUserIds || mentionedUserIds.length === 0) return profiles;

            await Promise.all(
                mentionedUserIds.map(async (userId) => {
                    const profile = await getUserProfileBasic(userId);
                    profiles.set(userId, profile);
                })
            );
            return profiles;
        },
        enabled: mentionedUserIds && mentionedUserIds.length > 0,
        staleTime: Infinity,
    });

    if (!mentionedUserIds || mentionedUserIds.length === 0 || isLoadingMentions) {
        return <>{text}</>;
    }

    // Regex to find @ followed by alphanumeric characters, underscores, or hyphens (common for UIDs)
    // It also tries to match display names if they are directly after @
    const parts = text.split(/(@[a-zA-Z0-9_.-]+(?: [a-zA-Z0-9_.-]+)*)/g);


    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith('@')) {
                    const potentialIdentifier = part.substring(1);
                    let profileToLink: UserProfileBasic | null | undefined = null;

                    // First, check if potentialIdentifier is a direct UID match
                    if (mentionedUserIds.includes(potentialIdentifier)) {
                        profileToLink = mentionProfilesMap.get(potentialIdentifier);
                    }
                    // If not a UID match, check if it's a display name from the map
                    if (!profileToLink) {
                        for (const [uid, profile] of mentionProfilesMap.entries()) {
                            if (profile && profile.displayName === potentialIdentifier && mentionedUserIds.includes(uid)) {
                                profileToLink = profile;
                                break;
                            }
                        }
                    }

                    if (profileToLink) {
                        return (
                            <Link
                                key={`${profileToLink.userId}-${index}`}
                                href={`/profile/${profileToLink.userId}`}
                                className="text-primary hover:underline font-medium"
                            >
                                @{profileToLink.displayName || generateAnonymousName(profileToLink.userId)}
                            </Link>
                        );
                    }
                }
                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </>
    );
});
TextWithMentions.displayName = 'TextWithMentions';


// Component for Post Card
const PostCard = React.memo(({ post, onOpen }: { post: Post, onOpen: () => void }) => {
   const postDate = post.createdAt instanceof Timestamp
    ? post.createdAt.toDate().toLocaleDateString()
    : post.createdAt
    ? new Date(post.createdAt as any).toLocaleDateString() // Type assertion for safety
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
                {post.tags?.map((tag, index) => (
                 <Badge key={`${post.id}-tag-${index}`} variant="secondary" className="text-xs cursor-default">
                   {tag}
                 </Badge>
                ))}
            </div>
           <h3 className="text-base font-semibold leading-snug text-card-foreground">{post.question}</h3>
           {post.imageUrls && post.imageUrls.length > 0 && (
             <div className="mt-2 rounded-md overflow-hidden aspect-video relative">
               <Image
                 src={post.imageUrls[0]} // Display first image, carousel is in detail view
                 alt={post.question}
                 fill // Use fill instead of layout="fill" objectFit="cover"
                 sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Example sizes, adjust as needed
                 style={{ objectFit: 'cover' }} // Use style for objectFit
                 data-ai-hint="post image" // Keep the hint
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
PostCard.displayName = 'PostCard';


// Component for displaying a single subcomment (reply)
const SubCommentItem = React.memo(({ subComment, currentUserId, postId, commentId, onDelete }: { subComment: ClientSubComment, currentUserId: string | null, postId: string, commentId: string, onDelete: () => void }) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const isOwnSubComment = subComment.userId === currentUserId;
    const [isLiking, setIsLiking] = useState(false);
    const hasLiked = !!(currentUserId && subComment.likedBy?.includes(currentUserId));
    const [isDeleting, setIsDeleting] = useState(false);
    const displayName = subComment.userName || generateAnonymousName(subComment.userId);


    const handleDeleteClick = async () => {
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            await deleteSubCommentFromComment(postId, commentId, subComment.id);
            toast({ title: "Reply Deleted" });
            onDelete();
        } catch (error: any) {
            console.error("Error deleting subcomment:", error);
            toast({
                variant: "destructive",
                title: "Delete Failed",
                description: `Could not delete reply: ${error.message}`,
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleLikeClick = async () => {
        if (!user || isLiking) return;
        setIsLiking(true);
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

        try {
            await toggleLikeSubComment(postId, commentId, subComment.id, user.uid);
            queryClient.invalidateQueries({ queryKey: ['subComments', postId, commentId] });
        } catch (err) {
            console.error("Error toggling subcomment like:", err);
            toast({ variant: "destructive", title: "Like Failed", description: "Could not update like." });
            if (previousSubComments) {
                queryClient.setQueryData(['subComments', postId, commentId], previousSubComments);
            }
        } finally {
            setIsLiking(false);
        }
    };

    return (
        <div key={subComment.id} className="flex items-start gap-2 group">
            <Link href={`/profile/${subComment.userId}`} passHref>
                <Avatar className="h-6 w-6 mt-1 flex-shrink-0 cursor-pointer">
                    <AvatarImage src={subComment.userAvatar} alt={displayName} />
                    <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                        {getInitials(displayName)}
                    </AvatarFallback>
                </Avatar>
            </Link>
            <div className="flex-grow bg-background p-2 rounded-md min-w-0 border border-border/50">
                <div className="flex justify-between items-center mb-1">
                    <Link href={`/profile/${subComment.userId}`} passHref>
                         <p className="text-xs font-medium text-foreground truncate hover:underline cursor-pointer">
                             {displayName}
                         </p>
                    </Link>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {user && (
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
                                {subComment.likeCount && subComment.likeCount > 0 ? <span className="text-xs ml-0.5">({subComment.likeCount})</span> : ''}
                            </Button>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {new Date(subComment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {isOwnSubComment && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-muted-foreground/70 hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                    disabled={isDeleting}
                                    aria-label="Delete reply"
                                >
                                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin"/> : <Trash className="h-3 w-3"/>}
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
                                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDeleteClick}
                                            disabled={isDeleting}
                                            className="bg-destructive hover:bg-destructive/90"
                                        >
                                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>
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
    const { user } = useAuth();
    const isOwnComment = comment.userId === currentUserId;
    const [showReplies, setShowReplies] = useState(false);
    const [newReply, setNewReply] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const replyInputRef = useRef<HTMLInputElement>(null);
    const suggestionsPopoverRef = useRef<HTMLDivElement>(null);
    const hasLiked = !!(currentUserId && comment.likedBy?.includes(currentUserId));
    const [isDeleting, setIsDeleting] = useState(false);
    const displayName = comment.userName || generateAnonymousName(comment.userId);

    const {
        data: subComments = [],
        isLoading: isLoadingSubComments,
        error: subCommentsError,
        refetch: refetchSubComments,
    } = useQuery<ClientSubComment[]>({
        queryKey: ['subComments', postId, comment.id],
        queryFn: () => getSubCommentsForComment(postId, comment.id),
        enabled: showReplies,
        staleTime: 1000 * 60 * 1, // 1 minute
    });

    // Collect user IDs from the comment and its subcomments for profile fetching (suggestions)
    const userIdsToFetch = useMemo(() => {
        const ids = new Set<string>([comment.userId]);
        subComments.forEach(sc => ids.add(sc.userId));
        // If the post author is different from the commenter or any sub-commenter, include them too.
        const selectedPost = queryClient.getQueryData<Post>(['posts', postId]); // Or however you access post data
        if (selectedPost && selectedPost.userId) ids.add(selectedPost.userId);

        return Array.from(ids).filter(id => id !== currentUserId); // Exclude self for suggestions
    }, [comment.userId, subComments, currentUserId, queryClient, postId]);


    const { data: userProfilesMap = new Map(), isLoading: isLoadingProfiles } = useQuery<Map<string, UserProfileBasic | null>>({
        queryKey: ['userProfilesForMentions', comment.id, userIdsToFetch.join(',')], // Key depends on fetched IDs
        queryFn: async () => {
            console.log(`[CommentItem ${comment.id}] userProfilesMap QueryFn: Fetching profiles for:`, userIdsToFetch);
            const profiles = new Map<string, UserProfileBasic | null>();
            if (userIdsToFetch.length === 0) return profiles;

            await Promise.all(
                userIdsToFetch.map(async (userId) => {
                    const profile = await getUserProfileBasic(userId);
                    profiles.set(userId, profile || { userId, displayName: generateAnonymousName(userId) });
                    console.log(`[CommentItem ${comment.id}] Fetched profile for ${userId}:`, profile);
                })
            );
            console.log(`[CommentItem ${comment.id}] userProfilesMap QueryFn: Final profiles map:`, profiles);
            return profiles;
        },
        enabled: userIdsToFetch.length > 0 && isReplying, // Only fetch if replying and there are users to fetch
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    useEffect(() => {
        if (isReplying && !isLoadingProfiles) {
            console.log(`[CommentItem ${comment.id}] userProfilesMap for suggestions (when isReplying is true):`, userProfilesMap);
        }
    }, [isReplying, isLoadingProfiles, userProfilesMap, comment.id]);


    const filteredSuggestions = useMemo(() => {
        console.log(`[CommentItem ${comment.id}] filteredSuggestions useMemo - Query: '${mentionQuery}', LoadingProfiles: ${isLoadingProfiles}, ProfilesMap size: ${userProfilesMap?.size || 0}`);
        if (!showSuggestions) return [];
        if (isLoadingProfiles) return [{ userId: 'loading', displayName: 'Loading users...' } as UserProfileBasic];
        if (!userProfilesMap || userProfilesMap.size === 0) return [{ userId: 'no-users', displayName: 'No users found.' } as UserProfileBasic];


        const profiles = Array.from(userProfilesMap.values()).filter((p): p is UserProfileBasic => !!p);

        if (mentionQuery.trim() === '') {
            const suggestions = profiles.slice(0, 5);
            return suggestions.length > 0 ? suggestions : [{ userId: 'no-users', displayName: 'No users in this thread.' } as UserProfileBasic];
        }

        const queryLower = mentionQuery.toLowerCase();
        const suggestions = profiles.filter(profile =>
            profile.displayName.toLowerCase().includes(queryLower)
        ).slice(0, 5);
        return suggestions.length > 0 ? suggestions : [{ userId: 'no-users', displayName: `No users matching "${mentionQuery}"` } as UserProfileBasic];

    }, [mentionQuery, userProfilesMap, isLoadingProfiles, showSuggestions, comment.id]);



    const handleDeleteClick = async () => {
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            await deleteCommentFromPost(postId, comment.id);
            toast({ title: "Comment Deleted" });
            onDelete();
        } catch (error: any) {
            console.error("Error deleting comment:", error);
            toast({
                variant: "destructive",
                title: "Delete Failed",
                description: `Could not delete comment: ${error.message}`,
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReplySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newReply.trim() || isSubmittingReply) return;
        setIsSubmittingReply(true);
        const mentionedUserIds = extractMentions(newReply.trim());
        const replyData: Omit<NewSubCommentData, 'likeCount' | 'likedBy'> = {
            userId: user.uid,
            text: newReply.trim(),
            mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : [],
        };
        try {
            const newSubCommentId = await addSubCommentToComment(postId, comment.id, replyData);
            toast({ title: "Reply Added" });
            setNewReply('');
            setIsReplying(false);
            setShowSuggestions(false);
            if (!showReplies) {
                setShowReplies(true); // Auto-show replies if they were hidden
            } else {
                refetchSubComments(); // Otherwise, just refetch
            }
            // Invalidate notifications for original commenter and mentioned users
            if (comment.userId !== user.uid) {
                queryClient.invalidateQueries({ queryKey: ['notifications', comment.userId] });
            }
            mentionedUserIds.forEach(mentionedId => {
                 if (mentionedId !== user.uid && mentionedId !== comment.userId) { // Don't double-notify original commenter if they were also mentioned
                    queryClient.invalidateQueries({ queryKey: ['notifications', mentionedId] });
                 }
            });
        } catch (error: any) {
            console.error("Error adding reply:", error);
            toast({
                variant: "destructive",
                title: "Reply Failed",
                description: `Could not add reply: ${error.message}`,
            });
        } finally {
            setIsSubmittingReply(false);
        }
    };

    const handleMentionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewReply(value);
        const cursorPosition = e.target.selectionStart || 0;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
            const currentQuery = textBeforeCursor.substring(lastAtIndex + 1);
            if (!/\s/.test(currentQuery)) { // No space within the query itself
                setMentionQuery(currentQuery);
                setShowSuggestions(true);
                 console.log(`[CommentItem ${comment.id}] Active mention query: '${currentQuery}'`);
                return;
            }
        }
        // If no valid mention pattern at cursor, hide suggestions
        setMentionQuery('');
        setShowSuggestions(false);
         console.log(`[CommentItem ${comment.id}] No active mention query.`);
    };


    const handleSelectSuggestion = (profile: UserProfileBasic) => {
        if (!replyInputRef.current) return;
        const currentValue = newReply;
        const cursorPosition = replyInputRef.current.selectionStart || 0;
        const textBeforeCursor = currentValue.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex > -1) {
            const textBeforeMention = currentValue.substring(0, lastAtIndex);
            const textAfterCursor = currentValue.substring(cursorPosition);
            const newText = `${textBeforeMention}@${profile.displayName} ${textAfterCursor}`; // Add space after display name
            setNewReply(newText);

            // Set cursor position after the inserted name + space
            const newCursorPosition = textBeforeMention.length + `@${profile.displayName} `.length;
            setTimeout(() => {
                replyInputRef.current?.focus();
                replyInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
            }, 0);
        }
        setShowSuggestions(false);
        setMentionQuery('');
    };


     useEffect(() => {
         const handleClickOutside = (event: MouseEvent) => {
             if (
                 suggestionsPopoverRef.current &&
                 !suggestionsPopoverRef.current.contains(event.target as Node) &&
                 replyInputRef.current &&
                 !replyInputRef.current.contains(event.target as Node)
             ) {
                 if (showSuggestions) {
                     console.log(`[CommentItem ${comment.id}] Click outside suggestion popover, closing.`);
                     setShowSuggestions(false);
                 }
             }
         };
         if (showSuggestions) {
            document.addEventListener('mousedown', handleClickOutside);
         }
         return () => {
             document.removeEventListener('mousedown', handleClickOutside);
         };
     }, [showSuggestions, comment.id]);

    const handleLikeClick = async () => {
        if (!user || isLiking) return;
        setIsLiking(true);
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
        try {
            await toggleLikeComment(postId, comment.id, user.uid);
            queryClient.invalidateQueries({ queryKey: ['comments', postId] });
        } catch (err) {
            console.error("Error toggling like:", err);
            toast({ variant: "destructive", title: "Like Failed", description: "Could not update like." });
            if (previousComments) {
                queryClient.setQueryData(['comments', postId], previousComments);
            }
        } finally {
            setIsLiking(false);
        }
    };

    const toggleShowReplies = () => setShowReplies(prev => !prev);
    const toggleReplyForm = () => {
        setIsReplying(prev => !prev);
        if (!isReplying) {
             setTimeout(() => replyInputRef.current?.focus(), 0);
        } else {
            setShowSuggestions(false);
            setMentionQuery('');
        }
    };
    const handleSubCommentDeleted = () => refetchSubComments();

    return (
        <div className="group border-b border-border/50 pb-4">
            <div className="flex items-start gap-3 ">
                 <Link href={`/profile/${comment.userId}`} passHref>
                     <Avatar className="h-8 w-8 mt-1 flex-shrink-0 cursor-pointer">
                         <AvatarImage src={comment.userAvatar} alt={displayName} />
                         <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                             {getInitials(displayName)}
                         </AvatarFallback>
                     </Avatar>
                 </Link>
                <div className="flex-grow bg-muted/50 p-3 rounded-lg min-w-0">
                    <div className="flex justify-between items-center mb-1">
                         <Link href={`/profile/${comment.userId}`} passHref>
                             <p className="text-sm font-medium text-foreground truncate hover:underline cursor-pointer">
                                 {displayName}
                             </p>
                         </Link>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            {user && (
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
                                     {comment.likeCount && comment.likeCount > 0 ? <span className="text-xs ml-0.5">({comment.likeCount})</span> : ''}
                                 </Button>
                            )}
                            <p className="text-xs text-muted-foreground">
                                {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {isOwnComment && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-muted-foreground/70 hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                        disabled={isDeleting}
                                        aria-label="Delete comment"
                                    >
                                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin"/> : <Trash className="h-3 w-3"/>}
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
                                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleDeleteClick}
                                                disabled={isDeleting}
                                                className="bg-destructive hover:bg-destructive/90"
                                            >
                                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground break-words">
                         <TextWithMentions text={comment.text} mentionedUserIds={comment.mentionedUserIds} />
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3 pl-11 mt-2">
                 {user && (
                    <Button variant="ghost" size="xs" onClick={toggleReplyForm} className="text-xs text-muted-foreground hover:text-primary h-auto p-1">
                        <CornerDownRight className="h-3 w-3 mr-1" /> Reply
                    </Button>
                 )}
                 <Button variant="ghost" size="xs" onClick={toggleShowReplies} className="text-xs text-muted-foreground hover:text-primary h-auto p-1">
                     {isLoadingSubComments ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin"/>
                     ) : showReplies ? (
                        'Hide Replies'
                     ) : (
                        `View Replies ${subComments && subComments.length > 0 ? `(${subComments.length})` : ''}`
                     )}
                 </Button>
            </div>

            {isReplying && user && (
                <Popover open={showSuggestions && filteredSuggestions.length > 0 && (filteredSuggestions[0]?.userId !== 'loading' && filteredSuggestions[0]?.userId !== 'no-users')} onOpenChange={setShowSuggestions}>
                    <PopoverTrigger asChild>
                        <form onSubmit={handleReplySubmit} className="flex items-center gap-2 pl-11 mt-2 relative">
                             <Input
                                ref={replyInputRef}
                                type="text"
                                placeholder={`Replying to ${displayName}... (@mention someone)`}
                                value={newReply}
                                onChange={handleMentionInputChange}
                                disabled={isSubmittingReply}
                                className="flex-grow h-8 text-sm"
                                aria-label="New reply input"
                                autoComplete="off"
                             />
                             <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" disabled={!newReply.trim() || isSubmittingReply}>
                                 {isSubmittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />}
                                 <span className="sr-only">Send Reply</span>
                             </Button>
                         </form>
                    </PopoverTrigger>
                    <PopoverContent
                        ref={suggestionsPopoverRef}
                        className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto"
                        side="top"
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()} // Prevent focus stealing
                    >
                         {filteredSuggestions.map(profile => (
                             profile.userId === 'loading' || profile.userId === 'no-users' ? (
                                <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">
                                    {profile.displayName}
                                </div>
                             ) : (
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
                            )
                         ))}
                    </PopoverContent>
                </Popover>
            )}

            {showReplies && (
                <div className="pl-11 mt-3 space-y-3 border-l-2 border-border ml-5"> {/* Adjusted ml-5 for consistent indentation from avatar */}
                    {isLoadingSubComments ? (
                         <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                         </div>
                    ) : subCommentsError ? (
                        <p className="text-xs text-destructive pl-2">Error loading replies.</p>
                    ) : subComments && subComments.length === 0 ? (
                        <p className="text-xs text-muted-foreground pl-2">No replies yet.</p>
                    ) : (
                        subComments && subComments.map((subComment) => (
                            <SubCommentItem
                                key={subComment.id}
                                subComment={subComment}
                                currentUserId={currentUserId}
                                postId={postId}
                                commentId={comment.id}
                                onDelete={handleSubCommentDeleted}
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
  const { user, loading: authLoading } = useAuth();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Removed AI Autocomplete states
  // const [isAutocompleting, setIsAutocompleting] = useState(false);
  // const [autocompleteSuggestion, setAutocompleteSuggestion] = useState<string | null>(null);
  // const autocompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State for new comment mentions
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const { data: posts = [], isLoading: isLoadingPosts, error: postsError } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 1, // 1 minute
    refetchOnWindowFocus: true,
    enabled: !!user, // Only fetch if user is loaded
  });

  const deletePostMutation = useMutation({
    mutationFn: deletePostFromFirestore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({
        title: "Post Deleted",
        description: "The post has been removed from the board.",
      });
      setSelectedPost(null);
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

  const handleDeletePost = (postId: string | undefined) => {
    if (!postId) {
      toast({ variant: "destructive", title: "Error", description: "Post ID is missing." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "You must be logged in to delete posts." });
      return;
    }
    deletePostMutation.mutate(postId);
  };

  const handleOfferHelp = async (postOwnerId: string, postId: string | undefined) => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "Please log in to offer help." });
      return;
    }
    if (user.uid === postOwnerId) {
      toast({ variant: "default", title: "Action Info", description: "You cannot start a conversation with yourself." });
      return;
    }
    if (!postId) {
      toast({ variant: "destructive", title: "Error", description: "Post ID is missing for conversation." });
      return;
    }
    try {
      const conversationId = await findOrCreateConversation(user.uid, postOwnerId, postId);
      if (conversationId) {
        toast({ title: "Conversation Started", description: "Redirecting to Contracts..." });
        router.push(`/contracts?postId=${postId}&conversationId=${conversationId}`);
        setSelectedPost(null); // Close sheet after initiating contact
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
    let filtered = selectedTags.length === 0
      ? posts
      : posts.filter(post =>
          Array.isArray(post.tags) &&
          selectedTags.every(tag => post.tags.includes(tag))
        );
    return filtered.sort((a, b) => {
      const timeA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : (typeof a.createdAt === 'number' ? a.createdAt : 0);
      const timeB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : (typeof b.createdAt === 'number' ? b.createdAt : 0);
      return timeB - timeA; // Sort newest first
    });
  }, [posts, selectedTags]);

  const {
    data: comments = [],
    isLoading: isLoadingComments,
    error: commentsError,
    refetch: refetchComments,
  } = useQuery<ClientComment[]>({
    queryKey: ['comments', selectedPost?.id],
    queryFn: () => selectedPost?.id ? getCommentsForPost(selectedPost.id) : Promise.resolve([]),
    enabled: !!selectedPost && !!selectedPost.id,
    staleTime: 1000 * 60 * 1, // 1 minute
    refetchOnWindowFocus: true,
  });

  // Data for new comment @mentions
   const userIdsForNewCommentMentions = useMemo(() => {
        if (!selectedPost) return [];
        const ids = new Set<string>([selectedPost.userId]);
        comments.forEach(comment => ids.add(comment.userId));
        return Array.from(ids).filter(id => id !== user?.uid); // Exclude self
   }, [selectedPost, comments, user?.uid]);

   const { data: newCommentMentionProfilesMap = new Map(), isLoading: isLoadingNewCommentMentionProfiles } = useQuery<Map<string, UserProfileBasic | null>>({
        queryKey: ['newCommentMentionProfiles', selectedPost?.id, userIdsForNewCommentMentions.join(',')],
        queryFn: async () => {
            const profiles = new Map<string, UserProfileBasic | null>();
            if (userIdsForNewCommentMentions.length === 0) return profiles;
            await Promise.all(
                userIdsForNewCommentMentions.map(async (userId) => {
                    const profile = await getUserProfileBasic(userId);
                    profiles.set(userId, profile || { userId, displayName: generateAnonymousName(userId) });
                })
            );
            return profiles;
        },
        enabled: userIdsForNewCommentMentions.length > 0 && showNewCommentSuggestions, // Only fetch if popover might show
        staleTime: 1000 * 60 * 5, // 5 minutes
   });

   const filteredNewCommentSuggestions = useMemo(() => {
        if (!showNewCommentSuggestions) return [];
        if (isLoadingNewCommentMentionProfiles) return [{ userId: 'loading-nc', displayName: 'Loading users...' } as UserProfileBasic];
        if (!newCommentMentionProfilesMap || newCommentMentionProfilesMap.size === 0) return [{ userId: 'no-users-nc', displayName: 'No users in this context.' } as UserProfileBasic];


        const profiles = Array.from(newCommentMentionProfilesMap.values()).filter((p): p is UserProfileBasic => !!p);

        if (newCommentMentionQuery.trim() === '') {
            const suggestions = profiles.slice(0, 5);
            return suggestions.length > 0 ? suggestions : [{ userId: 'no-users-nc', displayName: 'No users found in this context.' } as UserProfileBasic];
        }
        const queryLower = newCommentMentionQuery.toLowerCase();
        const suggestions = profiles.filter(profile =>
            profile.displayName.toLowerCase().includes(queryLower)
        ).slice(0, 5);
        return suggestions.length > 0 ? suggestions : [{ userId: 'no-match-nc', displayName: `No users matching "${newCommentMentionQuery}"` } as UserProfileBasic];
   }, [newCommentMentionQuery, newCommentMentionProfilesMap, isLoadingNewCommentMentionProfiles, showNewCommentSuggestions]);


  const handleNewCommentMentionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewComment(value);

        const cursorPosition = e.target.selectionStart || 0;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
            const currentQuery = textBeforeCursor.substring(lastAtIndex + 1);
            if (!/\s/.test(currentQuery)) {
                setNewCommentMentionQuery(currentQuery);
                setShowNewCommentSuggestions(true);
                return;
            }
        }
        setNewCommentMentionQuery('');
        setShowNewCommentSuggestions(false);
  };

  const handleSelectNewCommentSuggestion = (profile: UserProfileBasic) => {
        if (!newCommentInputRef.current) return;
        const currentValue = newComment;
        const cursorPosition = newCommentInputRef.current.selectionStart || 0;
        const textBeforeCursor = currentValue.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex > -1) {
            const textBeforeMention = currentValue.substring(0, lastAtIndex);
            const textAfterCursor = currentValue.substring(cursorPosition);
            const newText = `${textBeforeMention}@${profile.displayName} ${textAfterCursor}`;
            setNewComment(newText);

            const newCursorPosition = textBeforeMention.length + `@${profile.displayName} `.length;
            setTimeout(() => {
                newCommentInputRef.current?.focus();
                newCommentInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
            }, 0);
        }
        setShowNewCommentSuggestions(false);
        setNewCommentMentionQuery('');
  };

   useEffect(() => {
       const handleClickOutside = (event: MouseEvent) => {
           if (
               newCommentSuggestionsPopoverRef.current &&
               !newCommentSuggestionsPopoverRef.current.contains(event.target as Node) &&
               newCommentInputRef.current &&
               !newCommentInputRef.current.contains(event.target as Node)
           ) {
               if (showNewCommentSuggestions) setShowNewCommentSuggestions(false);
           }
       };
       if (showNewCommentSuggestions) document.addEventListener('mousedown', handleClickOutside);
       return () => document.removeEventListener('mousedown', handleClickOutside);
   }, [showNewCommentSuggestions]);


  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPost || !newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    const mentionedUserIds = extractMentions(newComment.trim());
    const commentData: Omit<NewCommentData, 'likeCount' | 'likedBy'> = {
      userId: user.uid,
      text: newComment.trim(),
      mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : [],
    };
    try {
      const newCommentId = await addCommentToPost(selectedPost.id, commentData);
      console.log(`Comment ${newCommentId} added to post ${selectedPost.id}`);
      await queryClient.invalidateQueries({ queryKey: ['comments', selectedPost.id] });

      // Notify post author (if different from commenter)
      if (selectedPost.userId !== user.uid) {
        queryClient.invalidateQueries({ queryKey: ['notifications', selectedPost.userId] });
      }
      // Notify mentioned users (if different from commenter and post author if already notified)
      mentionedUserIds.forEach(mentionedId => {
        if (mentionedId !== user.uid && mentionedId !== selectedPost.userId) {
          queryClient.invalidateQueries({ queryKey: ['notifications', mentionedId] });
        }
      });

      setNewComment('');
      setNewCommentMentionQuery('');
      setShowNewCommentSuggestions(false);
      toast({ title: "Comment Added" });
    } catch (error: any) {
      console.error("Error submitting comment:", error);
      toast({
        variant: "destructive",
        title: "Comment Failed",
        description: `Could not add comment: ${error.message}. Check rules.`,
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCommentDeleted = () => refetchComments();

   // Removed AI Autocomplete functionality
   // const triggerAutocomplete = useCallback(async (title: string, currentDesc: string) => {
   // ...
   // }, [toast]);

  // const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // const currentText = e.target.value;
    // if (descriptionRef.current) descriptionRef.current.value = currentText;

    // if (autocompleteTimeoutRef.current) {
    //   clearTimeout(autocompleteTimeoutRef.current);
    // }
    // autocompleteTimeoutRef.current = setTimeout(() => {
    //   if (selectedPost?.question && currentText.length > 10 && currentText.length < 300) {
    //   }
    // }, 1500);
  // };


  if (authLoading || (isLoadingPosts && !posts?.length && user)) { // Show loading if auth is loading OR if posts are loading AND user is present
    return (
      <div className="container mx-auto p-4 pt-6 text-center">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin mr-3 text-primary" />
          <p className="text-muted-foreground text-lg">Loading posts...</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="container mx-auto p-4 pt-6">
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

      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {isLoadingPosts && filteredPosts.length === 0 && user && (
          <div className="col-span-full text-center py-10 flex justify-center items-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
            <p className="text-muted-foreground">Loading posts...</p>
          </div>
        )}
        {!isLoadingPosts && postsError && user &&(
          <div className="col-span-full text-center py-10 text-destructive">
            <p>Error loading posts.</p>
          </div>
        )}
        {!isLoadingPosts && !postsError && user && filteredPosts.length > 0 ? (
          filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} onOpen={() => setSelectedPost(post)} />
          ))
        ) : (
          !isLoadingPosts && !postsError && user && (
            <div className="col-span-full text-center py-10">
              <p className="text-muted-foreground">
                {selectedTags.length > 0
                  ? "No posts found matching the selected tags."
                  : "No posts available yet. Be the first to create one!"
                }
              </p>
            </div>
          )
        )}
      </div>

      <Sheet open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <SheetContent className="sm:max-w-lg w-[90vw] p-0 flex flex-col" side="right">
          {selectedPost && (
            <>
              <ScrollArea className="flex-grow">
                <div className="p-6 pb-0">
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
                                  fill
                                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  style={{ objectFit: 'contain' }}
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

                  <div className="space-y-4 text-sm mb-6">
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
                          <Badge variant="outline" className="text-xs ml-1"><Tag className="h-3 w-3 mr-1"/>{selectedPost.naicsCode}</Badge>
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
                    {user && selectedPost.userId !== user.uid && (
                      <div className="mt-4 border-t pt-4">
                        <Link
                          href={`/profile/${selectedPost.userId}`}
                          passHref
                          legacyBehavior={false} // Use new Link behavior
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
                  </div>

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
                            currentUserId={user?.uid ?? null}
                            postId={selectedPost!.id}
                            onDelete={handleCommentDeleted}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              <SheetFooter className="p-6 border-t bg-background mt-auto sticky bottom-0">
                <div className="w-full space-y-4">
                  <Popover open={showNewCommentSuggestions && filteredNewCommentSuggestions.length > 0 && (filteredNewCommentSuggestions[0]?.userId !== 'loading-nc' && filteredNewCommentSuggestions[0]?.userId !== 'no-users-nc' && filteredNewCommentSuggestions[0]?.userId !== 'no-match-nc')} onOpenChange={setShowNewCommentSuggestions}>
                      <PopoverTrigger asChild>
                          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
                              <Input
                                  ref={newCommentInputRef}
                                  type="text"
                                  placeholder="Add a comment... (@mention someone)"
                                  value={newComment}
                                  onChange={handleNewCommentMentionInputChange}
                                  disabled={!user || isSubmittingComment}
                                  className="flex-grow bg-card"
                                  aria-label="New comment input"
                                  autoComplete="off"
                              />
                              <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" disabled={!newComment.trim() || !user || isSubmittingComment}>
                                  {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />}
                                  <span className="sr-only">Send Comment</span>
                              </Button>
                          </form>
                      </PopoverTrigger>
                      <PopoverContent
                          ref={newCommentSuggestionsPopoverRef}
                          className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto"
                          side="top"
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                          {filteredNewCommentSuggestions.map(profile => (
                              profile.userId === 'loading-nc' || profile.userId === 'no-users-nc' || profile.userId === 'no-match-nc' ? (
                                  <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">
                                      {profile.displayName}
                                  </div>
                              ) : (
                                  <Button
                                      key={profile.userId}
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start h-auto px-2 py-1 text-xs"
                                      onClick={() => handleSelectNewCommentSuggestion(profile)}
                                  >
                                      <Avatar className="h-5 w-5 mr-2">
                                          <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                                          <AvatarFallback className="text-xs">{getInitials(profile.displayName)}</AvatarFallback>
                                      </Avatar>
                                      {profile.displayName}
                                  </Button>
                              )
                          ))}
                      </PopoverContent>
                  </Popover>
                  <div className="flex justify-end gap-2">
                    {user && selectedPost.userId !== user.uid && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOfferHelp(selectedPost.userId, selectedPost.id)}
                          disabled={deletePostMutation.isPending}
                        >
                          <HandHelping className="mr-2 h-4 w-4" /> Offer Help
                        </Button>
                        <ConnectionButton
                          targetUserId={selectedPost.userId}
                          targetUserName={selectedPost.userName || generateAnonymousName(selectedPost.userId)}
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

export default BoardPageContent;

// Helper to extract potential UIDs or DisplayNames from text, assuming @UID or @DisplayName format
const extractMentions = (text: string): string[] => {
    const mentionRegex = /@([a-zA-Z0-9_.\- ]+)/g; // Allow spaces, dots, hyphens in display names
    const matches = text.matchAll(mentionRegex);
    const userIdentifiers = new Set<string>();
    for (const match of matches) {
        if (match[1]) {
            // Here, match[1] could be a UID or a multi-word display name.
            // The notification service will need to resolve display names to UIDs if necessary.
            // For now, we store what was typed.
            userIdentifiers.add(match[1].trim());
        }
    }
    console.log(`[page.tsx] extractMentions from text "${text.substring(0,30)}...": Found identifiers:`, Array.from(userIdentifiers));
    return Array.from(userIdentifiers);
};


    
