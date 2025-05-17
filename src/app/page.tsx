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
import { Separator } from '@/components/ui/separator'; // Import Separator
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Import Popover for suggestions
import { cn } from "@/lib/utils";
import { Loader2, Trash2, HandHelping, LineChart, FileText, Network, Home, Eye, Building, Link2, MessageCircle, Send, Trash, CornerDownRight, Heart, Sparkles, AtSign, Tag } from "lucide-react"; // Added AtSign icon, Tag
import { useToast } from "@/hooks/use-toast";
import type { Post, NewPostData } from '@/types/post'; // Correctly import types
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsFromFirestore, deletePostFromFirestore, addPostToFirestore } from '@/services/postService';
import { Skeleton } from '@/components/ui/skeleton';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp
import { autocompletePostDescription } from '@/ai/flows/autocomplete-post-description';
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
                    const profile = await getUserProfileBasic(userId);
                    profiles.set(userId, profile);
                })
            );
            return profiles;
        },
        enabled: mentionedUserIds.length > 0,
        staleTime: Infinity, 
    });

    if (mentionedUserIds.length === 0 || isLoadingMentions) {
        return <>{text}</>; 
    }

    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);

    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith('@')) {
                    const potentialIdOrName = part.substring(1);
                    const mentionedUserId = mentionedUserIds.find(id => {
                         const profile = mentionProfilesMap.get(id);
                         return id === potentialIdOrName || (profile?.displayName && profile.displayName === potentialIdOrName);
                     });

                    if (mentionedUserId) {
                        const profile = mentionProfilesMap.get(mentionedUserId);
                        const displayName = profile?.displayName || potentialIdOrName;
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
    ? new Date(post.createdAt as any).toLocaleDateString() 
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
                 src={post.imageUrls[0]} 
                 alt={post.question}
                 layout="fill"
                 objectFit="cover"
                 data-ai-hint="post image" 
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
                    <AvatarImage src={subComment.userAvatar} alt={subComment.userName} />
                    <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                        {getInitials(subComment.userName)}
                    </AvatarFallback>
                </Avatar>
            </Link>
            <div className="flex-grow bg-background p-2 rounded-md min-w-0 border border-border/50"> 
                <div className="flex justify-between items-center mb-1">
                    <Link href={`/profile/${subComment.userId}`} passHref>
                         <p className="text-xs font-medium text-foreground truncate hover:underline cursor-pointer">
                             {subComment.userName || `@${subComment.userId}`}
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
                              {subComment.likeCount && subComment.likeCount > 0 ? <span className="text-xs">({subComment.likeCount})</span> : ''}
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

    const {
        data: subComments = [],
        isLoading: isLoadingSubComments,
        error: subCommentsError,
        refetch: refetchSubComments,
    } = useQuery<ClientSubComment[]>({
        queryKey: ['subComments', postId, comment.id], 
        queryFn: () => getSubCommentsForComment(postId, comment.id),
        enabled: showReplies, 
        staleTime: 1000 * 60 * 1, 
    });
    
    const userIdsToFetch = useMemo(() => {
        const ids = new Set<string>([comment.userId]);
        subComments.forEach(sc => ids.add(sc.userId));
        return Array.from(ids).filter(id => id !== currentUserId); 
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
        enabled: userIdsToFetch.length > 0 && isReplying, 
        staleTime: Infinity,
    });
    
    const filteredSuggestions = useMemo(() => {
        if (!mentionQuery || isLoadingProfiles) return [];
        const queryLower = mentionQuery.toLowerCase();
        return Array.from(userProfilesMap.values())
            .filter((profile): profile is UserProfileBasic => profile !== null && profile.displayName.toLowerCase().includes(queryLower))
            .slice(0, 5); 
    }, [mentionQuery, userProfilesMap, isLoadingProfiles]);

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
            await addSubCommentToComment(postId, comment.id, replyData);
            toast({ title: "Reply Added" });
            setNewReply(''); 
            setIsReplying(false); 
            setShowSuggestions(false); 
            if (!showReplies) {
                setShowReplies(true); 
            } else {
                refetchSubComments(); 
            }
            queryClient.invalidateQueries({ queryKey: ['notifications', comment.userId] });
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
        const lastAtIndex = value.lastIndexOf('@');
        const lastSpaceIndex = value.lastIndexOf(' ');
        if (lastAtIndex > -1 && lastAtIndex > lastSpaceIndex && value.indexOf(' ', lastAtIndex) === -1) {
            const query = value.substring(lastAtIndex + 1);
            setMentionQuery(query);
            setShowSuggestions(true); 
        } else {
            setMentionQuery('');
            setShowSuggestions(false); 
        }
    };

    const handleSelectSuggestion = (profile: UserProfileBasic) => {
        const lastAtIndex = newReply.lastIndexOf('@');
        if (lastAtIndex > -1) {
            const textBeforeMention = newReply.substring(0, lastAtIndex);
            setNewReply(`${textBeforeMention}@${profile.displayName} `);
        }
        setShowSuggestions(false); 
        setMentionQuery(''); 
        replyInputRef.current?.focus(); 
    };

     useEffect(() => {
         const handleClickOutside = (event: MouseEvent) => {
             if (
                 suggestionsPopoverRef.current &&
                 !suggestionsPopoverRef.current.contains(event.target as Node) &&
                 replyInputRef.current &&
                 !replyInputRef.current.contains(event.target as Node) 
             ) {
                 setShowSuggestions(false);
             }
         };
         document.addEventListener('mousedown', handleClickOutside);
         return () => {
             document.removeEventListener('mousedown', handleClickOutside);
         };
     }, []); 

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
        }
    };
    const handleSubCommentDeleted = () => refetchSubComments();

    return (
        <div className="group border-b border-border/50 pb-4"> 
            <div className="flex items-start gap-3 "> 
                 <Link href={`/profile/${comment.userId}`} passHref>
                     <Avatar className="h-8 w-8 mt-1 flex-shrink-0 cursor-pointer">
                         <AvatarImage src={comment.userAvatar} alt={comment.userName} />
                         <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                             {getInitials(comment.userName)}
                         </AvatarFallback>
                     </Avatar>
                 </Link>
                <div className="flex-grow bg-muted/50 p-3 rounded-lg min-w-0"> 
                    <div className="flex justify-between items-center mb-1">
                         <Link href={`/profile/${comment.userId}`} passHref>
                             <p className="text-sm font-medium text-foreground truncate hover:underline cursor-pointer">
                                 {comment.userName || `@${comment.userId}`}
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
                                    {comment.likeCount && comment.likeCount > 0 ? <span className="text-xs">({comment.likeCount})</span> : ''}
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
                     {showReplies ? 'Hide Replies' : `View Replies ${isLoadingSubComments ? '...' : subComments.length > 0 ? `(${subComments.length})` : ''}`}
                 </Button>
            </div>

            {isReplying && user && (
                <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
                    <PopoverTrigger asChild>
                        <form onSubmit={handleReplySubmit} className="flex items-center gap-2 pl-11 mt-2 relative">
                             <Input
                                ref={replyInputRef}
                                type="text"
                                placeholder={`Replying to ${comment.userName || `@${comment.userId}`}... (@mention someone)`} 
                                value={newReply}
                                onChange={handleMentionInputChange} 
                                disabled={isSubmittingReply}
                                className="flex-grow h-8 text-sm"
                                aria-label="New reply input"
                                autoComplete="off" 
                             />
                             <Button type="submit" size="sm" disabled={!newReply.trim() || isSubmittingReply}>
                                 {isSubmittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                 <span className="sr-only">Send Reply</span>
                             </Button>
                         </form>
                    </PopoverTrigger>
                    <PopoverContent
                        ref={suggestionsPopoverRef} 
                        className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" 
                        side="top" 
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()} 
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
                         ) : mentionQuery ? ( 
                             <div className="p-2 text-center text-xs text-muted-foreground">No users found.</div>
                         ) : null}
                    </PopoverContent>
                </Popover>
            )}

            {showReplies && (
                <div className="pl-11 mt-3 space-y-3 border-l-2 border-border ml-5"> 
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
  const [isAutocompleting, setIsAutocompleting] = useState(false);
  const [autocompleteSuggestion, setAutocompleteSuggestion] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null); 
  const autocompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null); 
  
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const { data: posts = [], isLoading: isLoadingPosts, error: postsError } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 1, 
    refetchOnWindowFocus: true,
    enabled: !!user, 
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
        setSelectedPost(null); 
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
      const timeA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
      return timeB - timeA; 
    });
  }, [posts, selectedTags]);

  const {
    data: comments = [],
    isLoading: isLoadingComments,
    error: commentsError,
    refetch: refetchComments, 
  } = useQuery<ClientComment[]>({
    queryKey: ['comments', selectedPost?.id], 
    queryFn: () => getCommentsForPost(selectedPost!.id), 
    enabled: !!selectedPost && !!selectedPost.id, 
    staleTime: 1000 * 60 * 1, 
    refetchOnWindowFocus: true,
  });

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
      mentionedUserIds.forEach(mentionedId => {
        queryClient.invalidateQueries({ queryKey: ['notifications', mentionedId] });
      });
      setNewComment(''); 
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
  const handleMentionInput = (text: string) => setNewComment(text);

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
        {isLoadingPosts && filteredPosts.length === 0 && ( 
          <div className="col-span-full text-center py-10 flex justify-center items-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
            <p className="text-muted-foreground">Loading posts...</p>
          </div>
        )}
        {!isLoadingPosts && postsError && ( 
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
                                  layout="fill"
                                  objectFit="contain" 
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
                    {user && selectedPost.userId !== user.uid && ( 
                      <div className="mt-4 border-t pt-4">
                        <Link
                          href={`/profile/${selectedPost.userId}`} 
                          passHref
                          legacyBehavior 
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
                  <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="Add a comment... (@mention someone)"
                      value={newComment}
                      onChange={(e) => handleMentionInput(e.target.value)} 
                      disabled={!user || isSubmittingComment} 
                      className="flex-grow"
                      aria-label="New comment input"
                    />
                    <Button type="submit" size="icon" disabled={!newComment.trim() || !user || isSubmittingComment}>
                      {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      <span className="sr-only">Send Comment</span>
                    </Button>
                  </form>
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

export default BoardPageContent;

const extractMentions = (text: string): string[] => {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const matches = text.matchAll(mentionRegex);
    const userIdentifiers = new Set<string>(); 
    for (const match of matches) {
        if (match[1]) {
            userIdentifiers.add(match[1]);
        }
    }
    return Array.from(userIdentifiers);
};
