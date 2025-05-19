// src/app/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // Import useSearchParams
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import Image from 'next/image';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
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
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Loader2, Trash2, HandHelping, FileText, Network, Home, Eye, Building, Link2, MessageCircle, Send, Trash, CornerDownRight, Heart, Sparkles, AtSign, Tag, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Post, NewPostData } from '@/types/post';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsFromFirestore, deletePostFromFirestore } from '@/services/postService';
import { Skeleton } from '@/components/ui/skeleton';
import { Timestamp } from 'firebase/firestore';
import { findOrCreateConversation } from '@/services/messagingService'; // Import conversation service
import { ConnectionButton } from '@/components/ConnectionButton'; // Import ConnectionButton
import { addCommentToPost, getCommentsForPost, deleteCommentFromPost, getSubCommentsForComment, addSubCommentToComment, deleteSubCommentFromComment, toggleLikeComment, toggleLikeSubComment } from '@/services/commentService'; // Import comment/subcomment/like services
import type { NewCommentData, ClientComment, ClientSubComment, NewSubCommentData } from '@/types/comment';
import { getUserProfileBasic } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
// Moved availableTags to MainLayout as it's used by CreatePostForm there
import { availableTags } from '@/components/layout/MainLayout';
import { generateAnonymousName } from '@/lib/pseudonymUtils';

const IS_UID_REGEX_PAGE = /^[a-zA-Z0-9]{20,}$/;

const getInitials = (displayNameOrUid: string | undefined | null): string => {
    if (!displayNameOrUid) return '?';
    const nameToProcess = displayNameOrUid.startsWith('@') ? displayNameOrUid.substring(1) : displayNameOrUid;

    const pseudonymRegex = /^[A-Z][a-z]+[A-Z][a-z]+[0-9]{3}$/;
    if (pseudonymRegex.test(nameToProcess)) {
        const match = nameToProcess.match(/^([A-Z])[a-z]+([A-Z])/);
        if (match && match[1] && match[2]) {
            return match[1] + match[2];
        } else if (match && match[1]) {
            return match[1];
        }
    }
    const names = nameToProcess.split(' ').filter(Boolean);
    if (names.length === 0) return '?';
    if (names.length === 1) return names[0].substring(0, 1).toUpperCase();
    return (names[0].substring(0, 1) + names[names.length - 1].substring(0, 1)).toUpperCase();
};


const TextWithMentions = React.memo(({ text, mentionedUserIds = [] }: { text: string, mentionedUserIds?: string[] }) => {
    const { data: mentionProfilesMap = new Map<string, UserProfileBasic | null>(), isLoading: isLoadingMentions } = useQuery<Map<string, UserProfileBasic | null>>({
        queryKey: ['mentionProfiles', mentionedUserIds.join(',')],
        queryFn: async () => {
            const profiles = new Map<string, UserProfileBasic | null>();
            const validUids = mentionedUserIds.filter(id => id && IS_UID_REGEX_PAGE.test(id));
            if (validUids.length === 0) {
                // console.log(`%c[TextWithMentions] No valid UIDs in mentionedUserIds. IDs:`, "color: orange;", mentionedUserIds);
                return profiles;
            }
            // console.log(`%c[TextWithMentions] Fetching profiles for UIDs:`, "color: orange;", validUids);
            await Promise.all(
                validUids.map(async (userId) => {
                    const profile = await getUserProfileBasic(userId);
                    profiles.set(userId, profile);
                    // console.log(`%c[TextWithMentions] Fetched profile for ${userId}:`, "color: orange;", profile);
                })
            );
            return profiles;
        },
        enabled: mentionedUserIds && mentionedUserIds.length > 0 && mentionedUserIds.some(id => id && IS_UID_REGEX_PAGE.test(id)),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    if (isLoadingMentions && mentionedUserIds.length > 0) {
        return <>{text}</>; 
    }

    const mentionRegexGlobal = /@([a-zA-Z0-9_.'-]+(?: [a-zA-Z0-9_.'-]+)*)/g;
    const renderableParts: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    if (typeof text !== 'string') {
        console.warn("[TextWithMentions] Received non-string text prop:", text);
        return <>{text}</>;
    }

    for (const match of text.matchAll(mentionRegexGlobal)) {
        const mentionTextWithAt = match[0]; // e.g., "@JaneDoe" or "@XprORzYx..."
        const textualMention = match[1]; // e.g., "JaneDoe" or "XprORzYx..." (the part after @)
        const startIndex = match.index!;

        // console.log(`%c[TextWithMentions] Found mention: '${mentionTextWithAt}', textualMention: '${textualMention}' at index ${startIndex}`, "color: #FF8C00;");

        if (startIndex > lastIndex) {
            renderableParts.push(text.substring(lastIndex, startIndex));
        }

        let profileToLink: UserProfileBasic | null | undefined = undefined;

        // Strategy 1: Direct UID match (if textualMention is a UID AND it was in mentionedUserIds)
        if (IS_UID_REGEX_PAGE.test(textualMention) && mentionProfilesMap.has(textualMention)) {
            profileToLink = mentionProfilesMap.get(textualMention);
            // console.log(`%c[TextWithMentions] Strategy 1 (UID Match) SUCCESS for '${textualMention}'. Profile:`, "color: green;", profileToLink);
        }

        // Strategy 2: Case-insensitive display name match (if not found by UID, search among profiles fetched via mentionedUserIds)
        if (!profileToLink) {
            const textualMentionLower = textualMention.toLowerCase();
            for (const uid of mentionedUserIds) { // Iterate only through UIDs that were supposed to be fetched
                const profile = mentionProfilesMap.get(uid);
                if (profile && profile.displayName?.toLowerCase() === textualMentionLower) {
                    profileToLink = profile;
                    // console.log(`%c[TextWithMentions] Strategy 2 (DisplayName Match) SUCCESS for '${textualMention}'. Matched profile (UID ${uid}):`, "color: green;", profileToLink);
                    break;
                }
            }
        }

        if (profileToLink && profileToLink.userId && IS_UID_REGEX_PAGE.test(profileToLink.userId)) {
            // console.log(`%c[TextWithMentions] Rendering LINK for '${textualMention}'. Resolved to UID: ${profileToLink.userId}, DisplayName: ${profileToLink.displayName}`, "color: green; font-weight: bold;");
            renderableParts.push(
                <Link
                    key={`${profileToLink.userId}-${startIndex}`}
                    href={`/profile/${profileToLink.userId}`}
                    className="text-primary hover:underline font-medium"
                    onClick={(e) => { e.stopPropagation(); }} 
                >
                    @{profileToLink.displayName || generateAnonymousName(profileToLink.userId)}
                </Link>
            );
        } else {
            // console.log(`%c[TextWithMentions] Rendering SPAN for '${mentionTextWithAt}'. Profile not resolved. mentionProfilesMap size: ${mentionProfilesMap.size}`, "color: red;");
            renderableParts.push(
                <span key={`unresolved-${startIndex}`} className="text-primary cursor-default" title={`Unresolved mention: ${mentionTextWithAt}`}>
                    {mentionTextWithAt}
                </span>
            );
        }
        lastIndex = startIndex + mentionTextWithAt.length;
    }

    if (lastIndex < text.length) {
        renderableParts.push(text.substring(lastIndex));
    }

    return <>{renderableParts}</>;
});
TextWithMentions.displayName = 'TextWithMentions';


const PostCard = React.memo(({ post, onOpen }: { post: Post, onOpen: () => void }) => {
   const postDate = post.createdAt instanceof Timestamp
    ? post.createdAt.toDate().toLocaleDateString()
    : post.createdAt && typeof post.createdAt === 'object' && 'seconds' in post.createdAt 
    ? new Timestamp(post.createdAt.seconds, post.createdAt.nanoseconds).toDate().toLocaleDateString()
    : typeof post.createdAt === 'number' 
    ? new Date(post.createdAt).toLocaleDateString()
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
                 fill
                 sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                 style={{ objectFit: 'cover' }}
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
            // No immediate invalidation to rely on optimistic update
        } catch (err) {
            console.error("Error toggling subcomment like:", err);
            toast({ variant: "destructive", title: "Like Failed", description: "Could not update like." });
            if (previousSubComments) {
                queryClient.setQueryData(['subComments', postId, commentId], previousSubComments);
            }
        } finally {
            setIsLiking(false);
             queryClient.invalidateQueries({ queryKey: ['subComments', postId, commentId] }); // Invalidate after action
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
        staleTime: 1000 * 60 * 1,
    });

    const userIdsToFetch = useMemo(() => {
        console.log(`%c[CommentItem ${comment.id}] userIdsToFetch: Recalculating for comment by ${comment.userId}.`, "color: #FFBF00;");
        const ids = new Set<string>();
        if(comment.userId && IS_UID_REGEX_PAGE.test(comment.userId)) ids.add(comment.userId);
        
        // Add UIDs from subComments
        subComments.forEach(sc => {
            if(sc.userId && IS_UID_REGEX_PAGE.test(sc.userId)) ids.add(sc.userId)
            sc.mentionedUserIds?.forEach(muid => {
                if (muid && IS_UID_REGEX_PAGE.test(muid)) ids.add(muid);
            });
        });
        
        // Add UIDs from the main comment's mentions
        comment.mentionedUserIds?.forEach(muid => {
            if (muid && IS_UID_REGEX_PAGE.test(muid)) ids.add(muid);
        });

        // Add post author UID
        const selectedPostInScope = queryClient.getQueryData<Post>(['posts', postId]); // More specific key
        if (selectedPostInScope && selectedPostInScope.userId && IS_UID_REGEX_PAGE.test(selectedPostInScope.userId)) {
             ids.add(selectedPostInScope.userId);
        }

        const finalIds = Array.from(ids).filter(id => id && id !== currentUserId && IS_UID_REGEX_PAGE.test(id));
        console.log(`%c[CommentItem ${comment.id}] userIdsToFetch: Final UIDs for profile fetching (excluding self ${currentUserId}):`, "color: #FFBF00;", finalIds);
        return finalIds;
    }, [comment.id, comment.userId, comment.mentionedUserIds, subComments, currentUserId, queryClient, postId]);


    const { data: userProfilesMap = new Map<string, UserProfileBasic | null>(), isLoading: isLoadingProfiles } = useQuery<Map<string, UserProfileBasic | null>>({
        queryKey: ['userProfilesForMentions', comment.id, userIdsToFetch.join(',')],
        queryFn: async () => {
            // console.log(`%c[CommentItem ${comment.id}] userProfilesMap QueryFn: Fetching profiles for UIDs:`, "color: lightblue;", userIdsToFetch);
            const profiles = new Map<string, UserProfileBasic | null>();
            if (userIdsToFetch.length === 0) return profiles;
            await Promise.all(
                userIdsToFetch.map(async (userId) => {
                    if (!IS_UID_REGEX_PAGE.test(userId)) {
                        // console.warn(`%c[CommentItem ${comment.id}] userProfilesMap QueryFn: Invalid UID format '${userId}', skipping fetch.`, "color: orange;");
                        return;
                    }
                    try {
                        const profile = await getUserProfileBasic(userId);
                        profiles.set(userId, profile || { userId, displayName: generateAnonymousName(userId), avatarUrl: undefined });
                        // console.log(`%c[CommentItem ${comment.id}] userProfilesMap QueryFn: Fetched profile for ${userId}:`, "color: lightblue;", profile);
                    } catch (error) {
                        // console.error(`%c[CommentItem ${comment.id}] userProfilesMap QueryFn: Error fetching profile for ${userId}:`, "color: red;", error);
                        profiles.set(userId, { userId, displayName: generateAnonymousName(userId), avatarUrl: undefined }); // Fallback
                    }
                })
            );
            // console.log(`%c[CommentItem ${comment.id}] userProfilesMap QueryFn: Final profiles map:`, "color: lightblue;", profiles);
            return profiles;
        },
        enabled: userIdsToFetch.length > 0 && isReplying,
        staleTime: 1000 * 60 * 5,
    });

    const filteredSuggestions = useMemo(() => {
        // console.log(`%c[CommentItem ${comment.id}] filteredSuggestions: Recalculating. showSuggestions: ${showSuggestions}, isLoadingProfiles: ${isLoadingProfiles}, mentionQuery: '${mentionQuery}'`, "color: violet;");
        // console.log(`%c[CommentItem ${comment.id}] filteredSuggestions: userProfilesMap size: ${userProfilesMap.size}`, "color: violet;", Array.from(userProfilesMap.keys()));

        if (!showSuggestions) return [];
        if (isLoadingProfiles) return [{ userId: 'loading', displayName: 'Loading users...' } as UserProfileBasic];

        const profiles = Array.from(userProfilesMap.values()).filter((p): p is UserProfileBasic => !!p && p.userId !== currentUserId);
        // console.log(`%c[CommentItem ${comment.id}] filteredSuggestions: Filtered profiles from map (excluding self, count: ${profiles.length}):`, "color: violet;", profiles.slice(0,5).map(p => p.displayName));

        if (profiles.length === 0 && mentionQuery.trim() === '') return [{ userId: 'no-users', displayName: 'No users in this thread to mention.' } as UserProfileBasic];
        if (profiles.length === 0) return [{ userId: 'no-users', displayName: 'No users found.' } as UserProfileBasic];

        if (mentionQuery.trim() === '') {
            const suggestions = profiles.slice(0, 5);
            // console.log(`%c[CommentItem ${comment.id}] filteredSuggestions: Empty query, returning top 5 suggestions (count: ${suggestions.length}):`, "color: violet;", suggestions.map(p => p.displayName));
            return suggestions.length > 0 ? suggestions : [{ userId: 'no-users', displayName: 'No users in this thread.' } as UserProfileBasic];
        }
        const queryLower = mentionQuery.toLowerCase();
        const suggestions = profiles.filter(profile =>
            profile.displayName?.toLowerCase().includes(queryLower)
        ).slice(0, 5);
        // console.log(`%c[CommentItem ${comment.id}] filteredSuggestions: Query '${queryLower}', found ${suggestions.length} matching suggestions:`, "color: violet;", suggestions.map(p => p.displayName));
        return suggestions.length > 0 ? suggestions : [{ userId: 'no-users', displayName: `No users matching "${mentionQuery}"` } as UserProfileBasic];
    }, [mentionQuery, userProfilesMap, isLoadingProfiles, showSuggestions, comment.id, currentUserId]);


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
        
        let allAvailableProfilesForSubmit = Array.from(userProfilesMap.values()).filter(Boolean) as UserProfileBasic[];
        if (user && !allAvailableProfilesForSubmit.find(p => p.userId === user.uid)) {
            allAvailableProfilesForSubmit.push({ userId: user.uid, displayName: user.displayName || generateAnonymousName(user.uid), avatarUrl: user.photoURL || undefined });
        }
        // Also add the original commenter if not already present for UID resolution
        const originalCommenterProfile = await getUserProfileBasic(comment.userId);
        if (originalCommenterProfile && !allAvailableProfilesForSubmit.find(p => p.userId === originalCommenterProfile.userId)) {
            allAvailableProfilesForSubmit.push(originalCommenterProfile);
        }

        const mentionedUserUids = extractMentionedUids(newReply.trim(), allAvailableProfilesForSubmit);
        console.log(`%c[CommentItem ${comment.id}] handleReplySubmit: Extracted UIDs for notification:`, "color: orange;", mentionedUserUids);


        const replyData: Omit<NewSubCommentData, 'likeCount' | 'likedBy'> = {
            userId: user.uid,
            text: newReply.trim(),
            mentionedUserIds: mentionedUserUids,
        };
        try {
            const newSubCommentId = await addSubCommentToComment(postId, comment.id, replyData);
            toast({ title: "Reply Added" });
            setNewReply('');
            setIsReplying(false);
            setShowSuggestions(false);
            if (!showReplies) {
                setShowReplies(true);
            } else {
                refetchSubComments();
            }
            if (comment.userId !== user.uid) {
                console.log(`%c[CommentItem ${comment.id}] handleReplySubmit: Invalidating notifications for original commenter: ${comment.userId}`, "color: orange;");
                queryClient.invalidateQueries({ queryKey: ['notifications', comment.userId] });
            }
            mentionedUserUids.forEach(mentionedUid => {
                 if (mentionedUid !== user.uid && mentionedUid !== comment.userId) {
                    console.log(`%c[CommentItem ${comment.id}] handleReplySubmit: Invalidating notifications for mentioned user: ${mentionedUid}`, "color: orange;");
                    queryClient.invalidateQueries({ queryKey: ['notifications', mentionedUid] });
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
        // console.log(`%c[CommentItem ${comment.id}] handleMentionInputChange: Value: "${value}", Cursor: ${cursorPosition}, Last @: ${lastAtIndex}`, "color: violet;");

        if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
            const currentQuery = textBeforeCursor.substring(lastAtIndex + 1);
            // console.log(`%c[CommentItem ${comment.id}] handleMentionInputChange: Potential query: "${currentQuery}"`, "color: violet;");
            if (!/\s/.test(currentQuery)) { // Allow suggestions if query is empty (just "@")
                setMentionQuery(currentQuery);
                setShowSuggestions(true);
                // console.log(`%c[CommentItem ${comment.id}] handleMentionInputChange: SHOWING suggestions for query: "${currentQuery}"`, "color: violet; font-weight: bold");
                return;
            }
        }
        setMentionQuery('');
        setShowSuggestions(false);
        // console.log(`%c[CommentItem ${comment.id}] handleMentionInputChange: HIDING suggestions.`, "color: violet;");
    };


    const handleSelectSuggestion = (profile: UserProfileBasic) => {
        if (!replyInputRef.current) return;
        const currentValue = newReply;
        const cursorPosition = replyInputRef.current.selectionStart || 0;
        const textBeforeCursor = currentValue.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        // console.log(`%c[CommentItem ${comment.id}] handleSelectSuggestion: Profile:`, "color: violet;", profile, `CurrentValue: "${currentValue}", Cursor: ${cursorPosition}, Last @: ${lastAtIndex}`);


        if (lastAtIndex > -1) {
            const textBeforeMention = currentValue.substring(0, lastAtIndex);
            const textAfterCursor = currentValue.substring(cursorPosition);
            const newText = `${textBeforeMention}@${profile.displayName} ${textAfterCursor}`;
            setNewReply(newText);
            const newCursorPosition = textBeforeMention.length + `@${profile.displayName} `.length;
            // console.log(`%c[CommentItem ${comment.id}] handleSelectSuggestion: New text: "${newText}", New cursor: ${newCursorPosition}`, "color: violet; font-weight: bold;");
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
            // No immediate invalidation
        } catch (err) {
            console.error("Error toggling like:", err);
            toast({ variant: "destructive", title: "Like Failed", description: "Could not update like." });
            if (previousComments) {
                queryClient.setQueryData(['comments', postId], previousComments);
            }
        } finally {
            setIsLiking(false);
             queryClient.invalidateQueries({ queryKey: ['comments', postId] });
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
                        onOpenAutoFocus={(e) => e.preventDefault()}
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
                <div className="pl-11 mt-3 space-y-3 border-l-2 border-border ml-5">
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

function BoardPageContent() {
  const { user, loading: authLoading } = useAuth();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    staleTime: 1000 * 60 * 1,
    refetchOnWindowFocus: true,
    enabled: !!user,
  });

  useEffect(() => {
    const postIdFromUrl = searchParams?.get('postId');
    if (postIdFromUrl && posts.length > 0) {
      const postToOpen = posts.find(p => p.id === postIdFromUrl);
      if (postToOpen) {
        if (selectedPost?.id !== postIdFromUrl) {
          setSelectedPost(postToOpen);
        }
        if (searchParams?.has('postId')) {
             router.replace('/', { shallow: true });
        }
      } else {
        if (searchParams?.has('postId')) {
          router.replace('/', { shallow: true });
        }
      }
    }
  }, [searchParams, posts, router]); 


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
      return [];
    }
    let filtered = selectedTags.length === 0
      ? posts
      : posts.filter(post =>
          Array.isArray(post.tags) &&
          selectedTags.every(tag => post.tags.includes(tag))
        );
    return filtered.sort((a, b) => {
      const timeA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : (typeof a.createdAt === 'object' && a.createdAt && 'seconds' in a.createdAt ? new Timestamp(a.createdAt.seconds, a.createdAt.nanoseconds).toMillis() : (typeof a.createdAt === 'number' ? a.createdAt : 0));
      const timeB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : (typeof b.createdAt === 'object' && b.createdAt && 'seconds' in b.createdAt ? new Timestamp(b.createdAt.seconds, b.createdAt.nanoseconds).toMillis() : (typeof b.createdAt === 'number' ? b.createdAt : 0));
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
    queryFn: () => selectedPost?.id ? getCommentsForPost(selectedPost.id) : Promise.resolve([]),
    enabled: !!selectedPost && !!selectedPost.id,
    staleTime: 1000 * 60 * 1,
    refetchOnWindowFocus: true,
  });

   const userIdsForNewCommentMentions = useMemo(() => {
        console.log(`%c[BoardPageContent] userIdsForNewCommentMentions: Recalculating. SelectedPost: ${selectedPost?.id}`, "color: #BA55D3;");
        if (!selectedPost || !user) return [];
        const ids = new Set<string>();
        if(selectedPost.userId && IS_UID_REGEX_PAGE.test(selectedPost.userId)) ids.add(selectedPost.userId);
        
        comments.forEach(comment => {
            if(comment.userId && IS_UID_REGEX_PAGE.test(comment.userId)) ids.add(comment.userId);
            comment.mentionedUserIds?.forEach(uid => {
                if (uid && IS_UID_REGEX_PAGE.test(uid)) ids.add(uid);
            });
        });
        const finalIds = Array.from(ids).filter(id => id && id !== user.uid && IS_UID_REGEX_PAGE.test(id));
        console.log(`%c[BoardPageContent] userIdsForNewCommentMentions: Final UIDs for profile fetching (excluding self ${user.uid}):`, "color: #BA55D3;", finalIds);
        return finalIds;
   }, [selectedPost, comments, user?.uid]);

   const { data: newCommentMentionProfilesMap = new Map<string, UserProfileBasic | null>(), isLoading: isLoadingNewCommentMentionProfiles } = useQuery<Map<string, UserProfileBasic | null>>({
        queryKey: ['newCommentMentionProfiles', selectedPost?.id, userIdsForNewCommentMentions.join(',')],
        queryFn: async () => {
            const profiles = new Map<string, UserProfileBasic | null>();
            if (userIdsForNewCommentMentions.length === 0) {
                 console.log(`%c[BoardPageContent] newCommentMentionProfilesMap QueryFn: No UIDs to fetch.`, "color: #FFD700");
                return profiles;
            }
            // console.log(`%c[BoardPageContent] newCommentMentionProfilesMap QueryFn: Fetching for UIDs:`, "color: #FFD700", userIdsForNewCommentMentions);
            await Promise.all(
                userIdsForNewCommentMentions.map(async (userId) => {
                     if (!IS_UID_REGEX_PAGE.test(userId)) return;
                    const profile = await getUserProfileBasic(userId);
                    profiles.set(userId, profile || { userId, displayName: generateAnonymousName(userId), avatarUrl: undefined });
                })
            );
            // console.log(`%c[BoardPageContent] newCommentMentionProfilesMap QueryFn: Fetched profiles:`, "color: #FFD700", Array.from(profiles.values()).map(p => p?.displayName));
            return profiles;
        },
        enabled: userIdsForNewCommentMentions.length > 0 && showNewCommentSuggestions, // Only fetch when suggestions are active
        staleTime: 1000 * 60 * 5,
   });

   const filteredNewCommentSuggestions = useMemo(() => {
        // console.log(`%c[BoardPageContent] filteredNewCommentSuggestions: query='${newCommentMentionQuery}', loading=${isLoadingNewCommentMentionProfiles}, mapSize=${newCommentMentionProfilesMap.size}`, "color: #FFD700");
        if (!showNewCommentSuggestions) return [];
        if (isLoadingNewCommentMentionProfiles) return [{ userId: 'loading-nc', displayName: 'Loading users...' } as UserProfileBasic];
        
        const profilesSource = Array.from(newCommentMentionProfilesMap.values()).filter((p): p is UserProfileBasic => !!p && p.userId !== user?.uid);
        // console.log(`%c[BoardPageContent] filteredNewCommentSuggestions: Profiles source (after map, count: ${profilesSource.length}):`, "color: #FFD700", profilesSource.map(p => p.displayName));


        if (profilesSource.length === 0 && newCommentMentionQuery.trim() === '') return [{ userId: 'no-users-nc', displayName: 'No users in this context to mention.' } as UserProfileBasic];
        if (profilesSource.length === 0) return [{ userId: 'no-users-nc', displayName: 'No users found.' } as UserProfileBasic];


        if (newCommentMentionQuery.trim() === '') {
            const suggestions = profilesSource.slice(0, 5);
            // console.log(`%c[BoardPageContent] filteredNewCommentSuggestions: Empty query, returning top 5 suggestions:`, "color: #FFD700", suggestions.map(p => p.displayName));
            return suggestions.length > 0 ? suggestions : [{ userId: 'no-users-nc', displayName: 'No users in this context to mention.' } as UserProfileBasic];
        }
        const queryLower = newCommentMentionQuery.toLowerCase();
        const suggestions = profilesSource.filter(profile =>
            profile.displayName?.toLowerCase().includes(queryLower)
        ).slice(0, 5);
        // console.log(`%c[BoardPageContent] filteredNewCommentSuggestions: Query '${queryLower}', found ${suggestions.length} matching suggestions:`, "color: #FFD700", suggestions.map(p => p.displayName));
        return suggestions.length > 0 ? suggestions : [{ userId: 'no-match-nc', displayName: `No users matching "${newCommentMentionQuery}"` } as UserProfileBasic];
   }, [newCommentMentionQuery, newCommentMentionProfilesMap, isLoadingNewCommentMentionProfiles, showNewCommentSuggestions, user?.uid]);


  const handleNewCommentMentionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewComment(value);
        const cursorPosition = e.target.selectionStart || 0;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
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

    let allAvailableProfilesForSubmit = Array.from(newCommentMentionProfilesMap.values()).filter(Boolean) as UserProfileBasic[];
    if (user && !allAvailableProfilesForSubmit.find(p => p.userId === user.uid)) {
        allAvailableProfilesForSubmit.push({ userId: user.uid, displayName: user.displayName || generateAnonymousName(user.uid), avatarUrl: user.photoURL || undefined });
    }
    if (selectedPost && selectedPost.userId && !allAvailableProfilesForSubmit.find(p => p.userId === selectedPost.userId)) {
        const postAuthorProfile = await getUserProfileBasic(selectedPost.userId);
        if (postAuthorProfile) allAvailableProfilesForSubmit.push(postAuthorProfile);
    }


    const finalMentionedUids = extractMentionedUids(newComment.trim(), allAvailableProfilesForSubmit);
    console.log(`%c[BoardPageContent] handleCommentSubmit: Extracted UIDs for notification:`, "color: orange;", finalMentionedUids);

    const commentData: Omit<NewCommentData, 'likeCount' | 'likedBy'> = {
      userId: user.uid,
      text: newComment.trim(),
      mentionedUserIds: finalMentionedUids,
    };
    try {
      await addCommentToPost(selectedPost.id, commentData);
      await queryClient.invalidateQueries({ queryKey: ['comments', selectedPost.id] });

      if (selectedPost.userId !== user.uid) {
        queryClient.invalidateQueries({ queryKey: ['notifications', selectedPost.userId] });
      }
      finalMentionedUids.forEach(mentionedUid => {
        if (mentionedUid !== user.uid && mentionedUid !== selectedPost.userId) {
          queryClient.invalidateQueries({ queryKey: ['notifications', mentionedUid] });
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


  if (authLoading || (isLoadingPosts && !posts?.length && user)) {
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

      <Sheet open={!!selectedPost} onOpenChange={(open) => {
        if (!open) {
            setSelectedPost(null);
            if (searchParams?.has('postId')) {
                 router.replace('/', { shallow: true });
            }
        }
      }}>
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
                    {user && selectedPost.userId !== user.uid && IS_UID_REGEX_PAGE.test(selectedPost.userId) && (
                      <div className="mt-4 border-t pt-4">
                        <Link
                          href={`/profile/${selectedPost.userId}`}
                          passHref
                          legacyBehavior={false}
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
                        {IS_UID_REGEX_PAGE.test(selectedPost.userId) && (
                             <ConnectionButton
                               targetUserId={selectedPost.userId}
                               targetUserName={selectedPost.userName || generateAnonymousName(selectedPost.userId)}
                               size="sm"
                               variant="default"
                             />
                        )}
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

const extractMentionedUids = (text: string, profilesToSearch: UserProfileBasic[]): string[] => {
    const textualMentions = extractMentionsFromText(text);
    const uids = new Set<string>();

    // console.log(`%c[page.tsx] extractMentionedUids - Input Textual Mentions:`, "color: orange", textualMentions);
    // console.log(`%c[page.tsx] extractMentionedUids - Profiles to Search In (count: ${profilesToSearch.length}):`, "color: orange;", profilesToSearch.map(p => ({uid:p.userId, name:p.displayName})).slice(0,10));

    textualMentions.forEach(mention => {
        const mentionLower = mention.toLowerCase();
        let foundProfile: UserProfileBasic | undefined = undefined;

        // Strategy 1: Direct UID match (if mention itself is a UID)
        if (IS_UID_REGEX_PAGE.test(mention)) {
            foundProfile = profilesToSearch.find(p => p.userId === mention);
            // if (foundProfile) {
            //      console.log(`%c[page.tsx] extractMentionedUids - Resolved (UID Match): "${mention}" to UID "${foundProfile.userId}"`, "color: green");
            // }
        }

        // Strategy 2: Case-insensitive display name match
        if (!foundProfile) {
            foundProfile = profilesToSearch.find(p => p.displayName?.toLowerCase() === mentionLower);
            // if (foundProfile) {
            //      console.log(`%c[page.tsx] extractMentionedUids - Resolved (DisplayName Match): "${mention}" to UID "${foundProfile.userId}"`, "color: green");
            // }
        }

        if (foundProfile && IS_UID_REGEX_PAGE.test(foundProfile.userId)) {
            uids.add(foundProfile.userId);
        } else {
            // console.warn(`%c[page.tsx] extractMentionedUids: Could not resolve textual mention "${mention}" to a UID from profilesToSearch.`, "color: red");
        }
    });
    // console.log(`%c[page.tsx] extractMentionedUids - Final Resolved UIDs:`, "color: green; font-weight: bold;", Array.from(uids));
    return Array.from(uids);
};

// Helper to extract display names or UIDs from text, assuming @mention format
const extractMentionsFromText = (text: string): string[] => {
    const mentionRegex = /@([a-zA-Z0-9_.'-]+(?: [a-zA-Z0-9_.'-]+)*)/g;
    const matches = text.matchAll(mentionRegex);
    const identifiers = new Set<string>();
    for (const match of matches) {
        if (match[1]) {
            identifiers.add(match[1].trim());
        }
    }
    return Array.from(identifiers);
};