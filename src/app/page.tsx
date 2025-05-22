
// src/app/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs
import { cn } from "@/lib/utils";
import { Loader2, Trash2, HandHelping, FileText, Network, Home, Eye, Building, Link2, MessageCircle, Send, CornerDownRight, Trash, DollarSign, CalendarDays, Heart, Sparkles, AtSign, UserCircle, Briefcase, Lightbulb, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Post } from '@/types/post';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsFromFirestore, deletePostFromFirestore } from '@/services/postService';
import { Skeleton } from '@/components/ui/skeleton';
import { Timestamp } from 'firebase/firestore';
import { findOrCreateConversation } from '@/services/messagingService';
import { ConnectionButton } from '@/components/ConnectionButton';
import { addCommentToPost, getCommentsForPost, deleteCommentFromPost, getSubCommentsForComment, addSubCommentToComment, deleteSubCommentFromComment, toggleLikeComment, toggleLikeSubComment } from '@/services/commentService';
import type { NewCommentData, ClientComment, ClientSubComment, NewSubCommentData } from '@/types/comment';
import { fetchUserProfileBasic, getSuggestibleUsers } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { availableTags } from '@/components/layout/MainLayout';
import { generateAnonymousName, getInitials as getSharedInitials } from '@/lib/pseudonymUtils';

const IS_UID_REGEX_PAGE = /^[a-zA-Z0-9]{20,}$/;

const getInitials = (displayNameOrUid: string | undefined | null): string => {
    return getSharedInitials(displayNameOrUid);
};

const TextWithMentions = React.memo(({ text, mentionedUserIds = [] }: { text: string, mentionedUserIds?: string[] }) => {
    const { data: mentionProfilesMap = new Map<string, UserProfileBasic | null>() } = useQuery<Map<string, UserProfileBasic | null>>({
        queryKey: ['mentionProfiles', mentionedUserIds.join(',')],
        queryFn: async () => {
            const profiles = new Map<string, UserProfileBasic | null>();
            const validUids = mentionedUserIds.filter(id => id && IS_UID_REGEX_PAGE.test(id));
             if (validUids.length === 0) {
                 return profiles;
             }
            await Promise.all(
                validUids.map(async (userId) => {
                    try {
                        const profile = await fetchUserProfileBasic(userId);
                        profiles.set(userId, profile);
                    } catch (error) {
                        console.error(`[TextWithMentions] Error fetching profile for UID ${userId}:`, error);
                        profiles.set(userId, null);
                    }
                })
            );
            return profiles;
        },
        enabled: mentionedUserIds && mentionedUserIds.length > 0 && mentionedUserIds.some(id => id && IS_UID_REGEX_PAGE.test(id)),
        staleTime: 5 * 60 * 1000,
    });

    const renderableParts: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    if (typeof text !== 'string') {
        return <>{text}</>;
    }

    const mentionRegexGlobal = /@([A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}|[a-zA-Z0-9]{20,})/g;

    for (const match of text.matchAll(mentionRegexGlobal)) {
        const mentionWithAt = match[0];
        const textualMention = match[1];
        const startIndex = match.index!;

        if (startIndex > lastIndex) {
            renderableParts.push(text.substring(lastIndex, startIndex));
        }

        let profileToLink: UserProfileBasic | null | undefined = undefined;

        if (IS_UID_REGEX_PAGE.test(textualMention)) { // If @mention is a UID
            profileToLink = mentionProfilesMap.get(textualMention);
        } else { // If @mention is a ColorAnimalNumber
            const textualMentionLower = textualMention.toLowerCase();
            for (const profile of mentionProfilesMap.values()) {
                if (profile && profile.mentionName?.toLowerCase() === textualMentionLower) {
                    profileToLink = profile;
                    break;
                }
            }
        }
        
        if (profileToLink && profileToLink.userId && IS_UID_REGEX_PAGE.test(profileToLink.userId)) {
            renderableParts.push(
                <Link
                    key={`${profileToLink.userId}-${startIndex}`}
                    href={`/profile/${profileToLink.userId}`}
                    className="text-primary hover:underline font-medium cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); }}
                >
                    {`@${profileToLink.mentionName}`}
                </Link>
            );
        } else {
             renderableParts.push(
                <span
                    key={`unresolved-${startIndex}`}
                    className="text-primary cursor-pointer" // Make all @mentions look clickable
                    title={`Mention: ${mentionWithAt}`}
                >
                    {mentionWithAt}
                </span>
            );
        }
        lastIndex = startIndex + mentionWithAt.length;
    }

    if (lastIndex < text.length) {
        renderableParts.push(text.substring(lastIndex));
    }
    return <>{renderableParts.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>)}</>;
});
TextWithMentions.displayName = 'TextWithMentions';


const PostCard = React.memo(({ post, onOpen }: { post: Post, onOpen: (post: Post) => void }) => {
   const postDate = post.createdAt instanceof Timestamp
    ? post.createdAt.toDate().toLocaleDateString()
    : post.createdAt && typeof post.createdAt === 'object' && 'seconds' in post.createdAt
    ? new Timestamp(post.createdAt.seconds, post.createdAt.nanoseconds).toDate().toLocaleDateString()
    : typeof post.createdAt === 'number'
    ? new Date(post.createdAt).toLocaleDateString()
    : 'Date unavailable';


  return (
      <Card
        className={cn(
            "mb-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer break-inside-avoid bg-card",
            post.requestType === 'help_request' && "border-2 border-amber-500 ring-1 ring-amber-500"
        )}
        onClick={() => onOpen(post)}
        aria-label={`View details for post: ${post.question}`}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(post)}
      >
        <CardHeader className="p-4">
           <div className="flex flex-wrap items-center gap-2 mb-2">
                 {post.requestType === 'help_request' && (
                    <Badge variant="default" className="text-xs cursor-default bg-amber-500 hover:bg-amber-600 text-white">
                        <HandHelping className="mr-1.5 h-3 w-3" /> Help Request
                    </Badge>
                )}
                {post.requestType === 'help_request' && post.paymentAmount && (
                     <Badge variant="secondary" className="text-xs cursor-default">
                         <DollarSign className="mr-1 h-3 w-3 text-green-600" /> Offering: ${post.paymentAmount.toLocaleString()}
                     </Badge>
                 )}
                {post.tags?.map((tag, index) => (
                 <Badge key={`${post.id}-tag-${index}`} variant="outline" className="text-xs cursor-default">
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
           {post.requestType !== 'help_request' && post.description && (
             <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
               <TextWithMentions text={post.description} mentionedUserIds={post.mentionedUserIds || []} />
             </p>
           )}
           {post.requestType === 'help_request' && post.descriptionDetails && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                   <TextWithMentions text={post.descriptionDetails} mentionedUserIds={post.mentionedUserIds || []} />
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

const SubCommentItem = React.memo(({ subComment, currentUserId, postId, commentId, onDelete, onStartReply }: { subComment: ClientSubComment, currentUserId: string | null, postId: string, commentId: string, onDelete: () => void, onStartReply: (replyTo: ClientSubComment) => void }) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const isOwnSubComment = subComment.userId === currentUserId;
    const [isLiking, setIsLiking] = useState(false);
    const hasLiked = !!(currentUserId && subComment.likedBy?.includes(currentUserId));
    const [isDeleting, setIsDeleting] = useState(false);
    const displayAnonymousName = generateAnonymousName(subComment.userId);


    const handleDeleteClick = useCallback(async () => {
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            await deleteSubCommentFromComment(postId, commentId, subComment.id);
            toast({ title: "Reply Deleted" });
            onDelete();
        } catch (error: any) {
            console.error("[SubCommentItem] Error deleting subcomment:", error);
            toast({
                variant: "destructive",
                title: "Delete Failed",
                description: `Could not delete reply: ${error.message}`,
            });
        } finally {
            setIsDeleting(false);
        }
    }, [isDeleting, postId, commentId, subComment.id, toast, onDelete]);

    const handleLikeClick = useCallback(async () => {
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
        } catch (err) {
            console.error("[SubCommentItem] Error toggling subcomment like:", err);
            toast({ variant: "destructive", title: "Like Failed", description: "Could not update like." });
            if (previousSubComments) {
                queryClient.setQueryData(['subComments', postId, commentId], previousSubComments);
            }
        } finally {
            setIsLiking(false);
            queryClient.invalidateQueries({ queryKey: ['subComments', postId, commentId] });
        }
    }, [user, isLiking, queryClient, postId, commentId, subComment.id, subComment.likedBy, toast]);


    return (
        <div key={subComment.id} className="flex items-start gap-2 group">
            <Link href={`/profile/${subComment.userId}`} passHref>
                <Avatar className="h-6 w-6 mt-1 flex-shrink-0 cursor-pointer">
                    <AvatarImage src={subComment.userAvatar} alt={displayAnonymousName} />
                    <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                        {getInitials(displayAnonymousName)}
                    </AvatarFallback>
                </Avatar>
            </Link>
            <div className="flex-grow bg-background p-2 rounded-md min-w-0 border border-border/50">
                <div className="flex justify-between items-center mb-1">
                    <Link href={`/profile/${subComment.userId}`} passHref>
                         <p className="text-xs font-medium text-foreground truncate hover:underline cursor-pointer">
                             {displayAnonymousName}
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
                     <TextWithMentions text={subComment.text} mentionedUserIds={subComment.mentionedUserIds || []} />
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
    const [debouncedMentionQuery, setDebouncedMentionQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const replyInputRef = useRef<HTMLInputElement>(null);
    const suggestionsPopoverRef = useRef<HTMLDivElement>(null);
    const [replyingToSubComment, setReplyingToSubComment] = useState<ClientSubComment | null>(null);


    const hasLiked = !!(currentUserId && comment.likedBy?.includes(currentUserId));
    const [isDeleting, setIsDeleting] = useState(false);
    const displayAnonymousName = generateAnonymousName(comment.userId);


    useEffect(() => {
        const handler = setTimeout(() => {
          setDebouncedMentionQuery(mentionQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [mentionQuery]);


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

     const { data: suggestedProfilesForReply = [], isLoading: isLoadingProfilesForReply } = useQuery<UserProfileBasic[]>({
        queryKey: ['suggestibleUsersForReply', comment.id, debouncedMentionQuery, currentUserId],
        queryFn: async () => {
            const users = await getSuggestibleUsers(debouncedMentionQuery, debouncedMentionQuery ? 10 : 25);
            return users;
        },
        enabled: isReplying && showSuggestions && !!currentUserId,
        staleTime: 1000 * 60 * 1,
        retry: 1,
    });


     const filteredSuggestionsForReply = useMemo(() => {
        if (!showSuggestions || !isReplying) return [];
        if (isLoadingProfilesForReply) {
            return [{ userId: 'loading-reply', mentionName: 'loading-reply', actualDisplayName: 'Loading users...' } as UserProfileBasic];
        }

        const profilesSource = suggestedProfilesForReply.filter(p => p.userId !== currentUserId && !!p.mentionName);

        if (profilesSource.length === 0 && mentionQuery.trim() !== '') {
            return [{ userId: 'no-match-reply', mentionName:'no-match-reply', actualDisplayName: `No users matching "@${mentionQuery}"` } as UserProfileBasic];
        }
        if (profilesSource.length === 0) {
            return [{ userId: 'no-users-reply', mentionName: 'no-users-reply', actualDisplayName: 'No users to suggest.' } as UserProfileBasic];
        }

        return profilesSource;
    }, [mentionQuery, suggestedProfilesForReply, isLoadingProfilesForReply, showSuggestions, isReplying, currentUserId]);


    const handleDeleteClick = useCallback(async () => {
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            await deleteCommentFromPost(postId, comment.id);
            toast({ title: "Comment Deleted" });
            onDelete();
        } catch (error: any) {
            console.error("[CommentItem] Error deleting comment:", error);
            toast({
                variant: "destructive",
                title: "Delete Failed",
                description: `Could not delete comment: ${error.message}`,
            });
        } finally {
            setIsDeleting(false);
        }
    },[isDeleting, postId, comment.id, toast, onDelete]);

    const handleReplySubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newReply.trim() || isSubmittingReply) return;
        setIsSubmittingReply(true);

        const profilesToSearch: UserProfileBasic[] = [...(suggestedProfilesForReply || [])];
        const allKnownUserIds = new Set(profilesToSearch.map(p => p.userId));

        const addProfileIfMissing = async (uid: string) => {
            if (uid && !allKnownUserIds.has(uid)) {
                const profile = await fetchUserProfileBasic(uid);
                if (profile) { profilesToSearch.push(profile); allKnownUserIds.add(uid); }
            }
        };

        await addProfileIfMissing(user.uid);
        await addProfileIfMissing(comment.userId);
        const postData = queryClient.getQueryData<Post>(['post', postId]);
        if (postData?.userId) await addProfileIfMissing(postData.userId);


        const mentionedUserUids = await extractMentionedUids(newReply.trim(), profilesToSearch);

        const replyData: Omit<NewSubCommentData, 'likeCount' | 'likedBy'> = {
            userId: user.uid,
            text: newReply.trim(),
            mentionedUserIds: mentionedUserUids,
        };
        try {
            await addSubCommentToComment(postId, comment.id, replyData);
            toast({ title: "Reply Added" });
            setNewReply('');
            setIsReplying(false);
            setShowSuggestions(false);
            setMentionQuery('');
            if (!showReplies) {
                setShowReplies(true);
            } else {
                refetchSubComments();
            }
        } catch (error: any) {
            console.error("[CommentItem] Error adding reply:", error);
            toast({
                variant: "destructive",
                title: "Reply Failed",
                description: `Could not add reply: ${error.message}`,
            });
        } finally {
            setIsSubmittingReply(false);
        }
    },[user, newReply, isSubmittingReply, suggestedProfilesForReply, postId, comment.id, comment.userId, queryClient, showReplies, refetchSubComments, toast]);

    const handleMentionInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewReply(value);
        const cursorPosition = e.target.selectionStart || 0;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
            const currentQuery = textBeforeCursor.substring(lastAtIndex + 1);
            if (!/\s/.test(currentQuery)) {
                setMentionQuery(currentQuery);
                setShowSuggestions(true);
                return;
            }
        }
        setMentionQuery('');
        setShowSuggestions(false);
    },[]);


    const handleSelectSuggestion = useCallback((profile: UserProfileBasic) => {
        if (!replyInputRef.current || !profile.mentionName) return;
        const currentValue = newReply;
        const cursorPosition = replyInputRef.current.selectionStart || 0;
        const textBeforeCursor = currentValue.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex > -1) {
            const textBeforeMention = currentValue.substring(0, lastAtIndex);
            const textAfterCursor = currentValue.substring(cursorPosition);
            const mentionToInsert = profile.mentionName;
            setNewReply(`${textBeforeMention}@${mentionToInsert} ${textAfterCursor}`);

            const newCursorPosition = textBeforeMention.length + `@${mentionToInsert} `.length;
            setTimeout(() => {
                replyInputRef.current?.focus();
                replyInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
            }, 0);
        }
        setShowSuggestions(false);
        setMentionQuery('');
    },[newReply]);


     useEffect(() => {
         const handleClickOutside = (event: MouseEvent) => {
             if (
                 showSuggestions &&
                 suggestionsPopoverRef.current &&
                 !suggestionsPopoverRef.current.contains(event.target as Node) &&
                 replyInputRef.current &&
                 !replyInputRef.current.contains(event.target as Node)
             ) {
                 setShowSuggestions(false);
             }
         };
         if (showSuggestions) {
            document.addEventListener('mousedown', handleClickOutside);
         }
         return () => {
             document.removeEventListener('mousedown', handleClickOutside);
         };
     }, [showSuggestions]);

    const handleLikeClick = useCallback(async () => {
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
        } catch (err) {
            console.error("[CommentItem] Error toggling like:", err);
            toast({ variant: "destructive", title: "Like Failed", description: "Could not update like." });
            if (previousComments) {
                queryClient.setQueryData(['comments', postId], previousComments);
            }
        } finally {
            setIsLiking(false);
             queryClient.invalidateQueries({ queryKey: ['comments', postId] });
        }
    },[user, isLiking, queryClient, postId, comment.id, comment.likedBy, toast]);


    const toggleShowReplies = useCallback(() => setShowReplies(prev => !prev), []);
    const toggleReplyForm = useCallback(() => {
        setIsReplying(prev => !prev);
        if (!isReplying) {
             setTimeout(() => replyInputRef.current?.focus(), 0);
        } else {
            setShowSuggestions(false);
            setMentionQuery('');
        }
    },[isReplying]);

    const handleSubCommentDeleted = useCallback(() => refetchSubComments(), [refetchSubComments]);

    const handleStartSubCommentReply = useCallback((subCommentToReplyTo: ClientSubComment) => {
        if (!user) return;
        setIsReplying(true);
        setNewReply(`@${generateAnonymousName(subCommentToReplyTo.userId)} `);
        setReplyingToSubComment(subCommentToReplyTo); // Track this if you want to show "Replying to SubComment X"
        setTimeout(() => {
            replyInputRef.current?.focus();
            if (replyInputRef.current) {
                replyInputRef.current.setSelectionRange(newReply.length, newReply.length);
            }
        }, 0);
    }, [user, setNewReply, setIsReplying, newReply]);


    return (
        <div className="group border-b border-border/50 pb-4">
            <div className="flex items-start gap-3 ">
                 <Link href={`/profile/${comment.userId}`} passHref>
                     <Avatar className="h-8 w-8 mt-1 flex-shrink-0 cursor-pointer">
                         <AvatarImage src={comment.userAvatar} alt={displayAnonymousName} />
                         <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                             {getInitials(displayAnonymousName)}
                         </AvatarFallback>
                     </Avatar>
                 </Link>
                <div className="flex-grow bg-muted/50 p-3 rounded-lg min-w-0">
                    <div className="flex justify-between items-center mb-1">
                         <Link href={`/profile/${comment.userId}`} passHref>
                             <p className="text-sm font-medium text-foreground truncate hover:underline cursor-pointer">
                                 {displayAnonymousName}
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
                         <TextWithMentions text={comment.text} mentionedUserIds={comment.mentionedUserIds || []} />
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
                <Popover open={showSuggestions && filteredSuggestionsForReply.length > 0 && (filteredSuggestionsForReply[0]?.userId !== 'loading-reply' && filteredSuggestionsForReply[0]?.userId !== 'no-users-reply' && filteredSuggestionsForReply[0]?.userId !== 'no-match-reply')} onOpenChange={setShowSuggestions}>
                    <PopoverTrigger asChild>
                        <form onSubmit={handleReplySubmit} className="flex items-center gap-2 pl-11 mt-2 relative">
                             <Input
                                ref={replyInputRef}
                                type="text"
                                placeholder={`Replying to ${displayAnonymousName}... (@mention someone)`}
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
                         {filteredSuggestionsForReply.map(profile => {
                            const displayableName = profile.actualDisplayName || profile.companyName;
                            const showSecondaryNameLine = displayableName && profile.mentionName && displayableName.toLowerCase() !== profile.mentionName.toLowerCase();

                            return (
                                 profile.userId === 'loading-reply' || profile.userId === 'no-users-reply' || profile.userId === 'no-match-reply' ? (
                                    <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">
                                        {profile.actualDisplayName}
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
                                            <AvatarImage src={profile.avatarUrl} alt={profile.mentionName} />
                                            <AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col items-start">
                                             {showSecondaryNameLine && (
                                                 <span className="font-medium text-foreground">{displayableName}</span>
                                             )}
                                             <span className={cn("text-muted-foreground", !showSecondaryNameLine && "font-medium text-foreground")}>
                                                 @{profile.mentionName}
                                             </span>
                                        </div>
                                    </Button>
                                )
                            );
                        })}
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
                                onStartReply={handleStartSubCommentReply}
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
  const [activeTab, setActiveTab] = useState<string>("recommended");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNewCommentMentionQuery(newCommentMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);


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
            setSelectedPost(postToOpen);
            router.replace('/', { shallow: true });
        } else {
            router.replace('/', { shallow: true });
        }
    }
}, [searchParams, posts, router]); // Removed selectedPost from dependencies


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
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: `Could not delete the post: ${error.message}. Check console and Firestore rules.`,
      });
    },
  });

  const handleDeletePost = useCallback((postId: string | undefined) => {
    if (!postId) {
      toast({ variant: "destructive", title: "Error", description: "Post ID is missing." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "You must be logged in to delete posts." });
      return;
    }
    deletePostMutation.mutate(postId);
  },[user, deletePostMutation, toast]);

  const handleOfferHelp = useCallback(async (postOwnerId: string, postId: string | undefined) => {
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
        toast({ title: "Conversation Started", description: "Redirecting to Messages..." });
        router.push(`/contracts?conversationId=${conversationId}`);
        setSelectedPost(null);
      } else {
        throw new Error("Failed to get conversation ID.");
      }
    } catch (error: any) {
      console.error("[BoardPageContent] Error starting conversation:", error);
      toast({
        variant: "destructive",
        title: "Failed to Start Conversation",
        description: error.message || "Could not start the conversation. Please try again.",
      });
    }
  },[user, router, toast]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag)
        : [...prevTags, tag]
    );
  },[]);

  const filteredPostsByTags = useMemo(() => {
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

  const helpRequestPosts = useMemo(() => filteredPostsByTags.filter(post => post.requestType === 'help_request'), [filteredPostsByTags]);
  const opportunitiesPosts = useMemo(() => filteredPostsByTags.filter(post => post.requestType === 'post' || !post.requestType), [filteredPostsByTags]);


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

  const { data: generalSuggestibleUsers = [], isLoading: isLoadingGeneralSuggestions } = useQuery<UserProfileBasic[]>({
    queryKey: ['generalSuggestibleUsersForBoard', debouncedNewCommentMentionQuery, user?.uid],
    queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, debouncedNewCommentMentionQuery ? 10 : 25),
    enabled: !!selectedPost && !!user && showNewCommentSuggestions,
    staleTime: 1000 * 60 * 1,
    retry: 1,
  });

   const filteredNewCommentSuggestions = useMemo(() => {
        if (!showNewCommentSuggestions) return [];
        if (isLoadingGeneralSuggestions) {
            return [{ userId: 'loading-nc', mentionName: 'loading-nc', actualDisplayName: 'Loading users...' } as UserProfileBasic];
        }

        const profilesSource = generalSuggestibleUsers.filter(p => p.userId !== user?.uid && !!p.mentionName);

        if (profilesSource.length === 0 && newCommentMentionQuery.trim() !== '') {
          return [{ userId: 'no-match-nc', mentionName:'no-match-nc', actualDisplayName: `No users matching "@${newCommentMentionQuery}"` } as UserProfileBasic];
        }
        if (profilesSource.length === 0) {
            return [{ userId: 'no-users-nc', mentionName: 'no-users-nc', actualDisplayName: 'No users to suggest.' } as UserProfileBasic];
        }
        return profilesSource;
   }, [newCommentMentionQuery, generalSuggestibleUsers, isLoadingGeneralSuggestions, showNewCommentSuggestions, user?.uid]);


  const handleNewCommentMentionInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
  },[]);

  const handleSelectNewCommentSuggestion = useCallback((profile: UserProfileBasic) => {
        if (!newCommentInputRef.current || !profile.mentionName) return;
        const currentValue = newComment;
        const cursorPosition = newCommentInputRef.current.selectionStart || 0;
        const textBeforeCursor = currentValue.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex > -1) {
            const textBeforeMention = currentValue.substring(0, lastAtIndex);
            const textAfterCursor = currentValue.substring(cursorPosition);
            const mentionToInsert = profile.mentionName;
            setNewComment(`${textBeforeMention}@${mentionToInsert} ${textAfterCursor}`);

            const newCursorPosition = textBeforeMention.length + `@${mentionToInsert} `.length;
            setTimeout(() => {
                newCommentInputRef.current?.focus();
                newCommentInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
            }, 0);
        }
        setShowNewCommentSuggestions(false);
        setNewCommentMentionQuery('');
  }, [newComment]);

   useEffect(() => {
       const handleClickOutside = (event: MouseEvent) => {
           if (
               showNewCommentSuggestions &&
               newCommentSuggestionsPopoverRef.current &&
               !newCommentSuggestionsPopoverRef.current.contains(event.target as Node) &&
               newCommentInputRef.current &&
               !newCommentInputRef.current.contains(event.target as Node)
           ) {
                setShowNewCommentSuggestions(false);
           }
       };
       if (showNewCommentSuggestions) document.addEventListener('mousedown', handleClickOutside);
       return () => document.removeEventListener('mousedown', handleClickOutside);
   }, [showNewCommentSuggestions]);


  const handleCommentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPost || !newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);

    const profilesToSearch: UserProfileBasic[] = [...(generalSuggestibleUsers || [])];
    const allKnownUserIds = new Set(profilesToSearch.map(p => p.userId));

    const addProfileIfMissing = async (uid: string) => {
        if (uid && !allKnownUserIds.has(uid)) {
            const profile = await fetchUserProfileBasic(uid);
            if (profile) { profilesToSearch.push(profile); allKnownUserIds.add(uid); }
        }
    };

    if (user) await addProfileIfMissing(user.uid);
    if (selectedPost?.userId) await addProfileIfMissing(selectedPost.userId);
    comments.forEach(c => { if (c.userId) addProfileIfMissing(c.userId); });


    const finalMentionedUids = await extractMentionedUids(newComment.trim(), profilesToSearch);

    const commentData: Omit<NewCommentData, 'likeCount' | 'likedBy'> = {
      userId: user.uid,
      text: newComment.trim(),
      mentionedUserIds: finalMentionedUids,
    };
    try {
      await addCommentToPost(selectedPost.id, commentData);
      await queryClient.invalidateQueries({ queryKey: ['comments', selectedPost.id] });
      setNewComment('');
      setNewCommentMentionQuery('');
      setShowNewCommentSuggestions(false);
      toast({ title: "Comment Added" });
    } catch (error: any) {
      console.error("[BoardPageContent] Error submitting comment:", error);
      toast({
        variant: "destructive",
        title: "Comment Failed",
        description: `Could not add comment: ${error.message}. Check rules.`,
      });
    } finally {
      setIsSubmittingComment(false);
    }
  },[user, selectedPost, newComment, isSubmittingComment, generalSuggestibleUsers, comments, queryClient, toast]);

  const handleCommentDeleted = useCallback(() => refetchComments(), [refetchComments]);

  const openPostCallback = useCallback((postToOpen: Post) => {
    setSelectedPost(postToOpen);
  }, []);


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

  const renderPosts = (postsToRender: Post[]) => (
    <div className="masonry-grid">
      {postsToRender.length > 0 ? (
        postsToRender.map((post) => (
          <PostCard key={post.id} post={post} onOpen={openPostCallback} />
        ))
      ) : (
        <div className="col-span-full text-center py-10">
          <p className="text-muted-foreground">
            {selectedTags.length > 0
              ? "No posts found matching the selected tags."
              : "No posts available in this category yet."
            }
          </p>
        </div>
      )}
    </div>
  );

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="recommended" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Recommended
          </TabsTrigger>
          <TabsTrigger value="help_requests" className="flex items-center gap-2">
             <HandHelping className="h-4 w-4" /> Help Requests
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="flex items-center gap-2">
             <Briefcase className="h-4 w-4" /> Opportunities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommended">
          {isLoadingPosts && filteredPostsByTags.length === 0 && user ? (
            <div className="col-span-full text-center py-10 flex justify-center items-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
              <p className="text-muted-foreground">Loading posts...</p>
            </div>
          ) : renderPosts(filteredPostsByTags) /* Shows all posts filtered by tags for now */ }
        </TabsContent>
        <TabsContent value="help_requests">
           {isLoadingPosts && helpRequestPosts.length === 0 && user ? (
            <div className="col-span-full text-center py-10 flex justify-center items-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
              <p className="text-muted-foreground">Loading help requests...</p>
            </div>
          ) : renderPosts(helpRequestPosts) }
        </TabsContent>
        <TabsContent value="opportunities">
           {isLoadingPosts && opportunitiesPosts.length === 0 && user ? (
            <div className="col-span-full text-center py-10 flex justify-center items-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
              <p className="text-muted-foreground">Loading opportunities...</p>
            </div>
          ) : renderPosts(opportunitiesPosts) }
        </TabsContent>
      </Tabs>


      <Sheet open={!!selectedPost} onOpenChange={(open) => {
        if (!open) {
            setSelectedPost(null);
            if (searchParams?.get('postId')) {
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
                        {selectedPost.requestType === 'help_request' && (
                            <Badge variant="default" className="text-xs cursor-default bg-amber-500 hover:bg-amber-600 text-white">
                                <HandHelping className="mr-1.5 h-3 w-3" /> Help Request
                            </Badge>
                        )}
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
                    {selectedPost.requestType === 'help_request' ? (
                        <div className="mt-4">
                            <Tabs defaultValue="details" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 bg-muted/60 p-1 h-auto rounded-md">
                                <TabsTrigger value="details" className="text-xs px-2 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm">Problem Details</TabsTrigger>
                                <TabsTrigger value="tried" disabled={!selectedPost.descriptionTried} className="text-xs px-2 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm">What I've Tried</TabsTrigger>
                                <TabsTrigger value="outcome" disabled={!selectedPost.descriptionOutcome} className="text-xs px-2 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm">Expected Outcome</TabsTrigger>
                            </TabsList>
                            <TabsContent value="details" className="mt-2 border rounded-md p-3 bg-card min-h-[100px] text-sm">
                                {selectedPost.descriptionDetails ? (
                                <p className="text-muted-foreground whitespace-pre-wrap">
                                    <TextWithMentions text={selectedPost.descriptionDetails} mentionedUserIds={selectedPost.mentionedUserIds || []} />
                                </p>
                                ) : (
                                <p className="text-muted-foreground italic">No details provided.</p>
                                )}
                            </TabsContent>
                            {selectedPost.descriptionTried && (
                                <TabsContent value="tried" className="mt-2 border rounded-md p-3 bg-card min-h-[100px] text-sm">
                                <p className="text-muted-foreground whitespace-pre-wrap">{selectedPost.descriptionTried}</p>
                                </TabsContent>
                            )}
                            {selectedPost.descriptionOutcome && (
                                <TabsContent value="outcome" className="mt-2 border rounded-md p-3 bg-card min-h-[100px] text-sm">
                                <p className="text-muted-foreground whitespace-pre-wrap">{selectedPost.descriptionOutcome}</p>
                                </TabsContent>
                            )}
                            </Tabs>
                        </div>
                        ) : (
                        selectedPost.description && (
                            <div>
                            <strong className="text-foreground">Details:</strong>
                            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                                <TextWithMentions text={selectedPost.description} mentionedUserIds={selectedPost.mentionedUserIds || []} />
                            </p>
                            </div>
                        )
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
                          <Badge variant="outline" className="text-xs ml-1">{selectedPost.naicsCode}</Badge>
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
                       {selectedPost.requestType === 'help_request' && selectedPost.paymentAmount && (
                           <div className="flex items-center gap-1">
                               <DollarSign className="h-4 w-4 text-green-600" />
                               <strong className="text-foreground">Offering:</strong>
                               <span className="text-green-600 font-semibold">${selectedPost.paymentAmount.toLocaleString()}</span>
                           </div>
                       )}
                       {selectedPost.requestType === 'help_request' && selectedPost.deadline && (
                           <div className="flex items-center gap-1">
                               <CalendarDays className="h-4 w-4 text-muted-foreground" />
                               <strong className="text-foreground">Deadline:</strong>
                               <span>{selectedPost.deadline instanceof Date ? selectedPost.deadline.toLocaleDateString() : new Date(selectedPost.deadline as any).toLocaleDateString()}</span>
                           </div>
                       )}
                    </div>
                    {user && selectedPost.userId && selectedPost.userId !== user.uid && IS_UID_REGEX_PAGE.test(selectedPost.userId) && (
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
                  <Popover
                    open={showNewCommentSuggestions && filteredNewCommentSuggestions.length > 0 && (filteredNewCommentSuggestions[0]?.userId !== 'loading-nc' && filteredNewCommentSuggestions[0]?.userId !== 'no-users-nc' && filteredNewCommentSuggestions[0]?.userId !== 'no-match-nc')}
                    onOpenChange={setShowNewCommentSuggestions}
                  >
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
                          {filteredNewCommentSuggestions.map(profile => {
                               const displayableName = profile.actualDisplayName || profile.mentionName;
                               const showSecondaryNameLine = profile.actualDisplayName && profile.mentionName && profile.actualDisplayName.toLowerCase() !== profile.mentionName.toLowerCase();

                                return (
                                  profile.userId === 'loading-nc' || profile.userId === 'no-users-nc' || profile.userId === 'no-match-nc' ? (
                                      <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">
                                          {profile.actualDisplayName}
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
                                              <AvatarImage src={profile.avatarUrl} alt={profile.mentionName} />
                                              <AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback>
                                          </Avatar>
                                          <div className="flex flex-col items-start">
                                            {showSecondaryNameLine && (
                                                 <span className="font-medium text-foreground">{displayableName}</span>
                                             )}
                                             <span className={cn("text-muted-foreground", !showSecondaryNameLine && "font-medium text-foreground")}>
                                                 @{profile.mentionName}
                                             </span>
                                          </div>
                                      </Button>
                                  )
                                );
                            })}
                      </PopoverContent>
                  </Popover>
                  <div className="flex justify-end gap-2">
                    {user && selectedPost.userId && selectedPost.userId !== user.uid && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOfferHelp(selectedPost.userId!, selectedPost.id)}
                          disabled={deletePostMutation.isPending}
                        >
                          <HandHelping className="mr-2 h-4 w-4" /> Offer Help
                        </Button>
                        {IS_UID_REGEX_PAGE.test(selectedPost.userId) && (
                             <ConnectionButton
                               targetUserId={selectedPost.userId}
                               targetUserName={generateAnonymousName(selectedPost.userId)}
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

export const extractMentionedUids = async (text: string, profilesToSearch: UserProfileBasic[]): Promise<string[]> => {
  const textualMentions = new Set<string>();
  const mentionRegexGlobal = /@([A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}|[a-zA-Z0-9]{20,})/g;
  for (const match of text.matchAll(mentionRegexGlobal)) {
    if (match[1]) textualMentions.add(match[1].trim());
  }

  if (textualMentions.size === 0) return [];

  const resolvedUids = new Set<string>();
  textualMentions.forEach(textualMention => {
    let foundProfile: UserProfileBasic | undefined = undefined;
    // Prioritize matching against mentionName (ColorAnimalNumber)
    foundProfile = profilesToSearch.find(p => p.mentionName?.toLowerCase() === textualMention.toLowerCase());

    if (foundProfile && IS_UID_REGEX_PAGE.test(foundProfile.userId)) {
      resolvedUids.add(foundProfile.userId);
    } else if (IS_UID_REGEX_PAGE.test(textualMention)) { // Fallback: if the mention itself is a UID
      const profileByUid = profilesToSearch.find(p => p.userId === textualMention);
      if (profileByUid) resolvedUids.add(profileByUid.userId);
    }
  });
  return Array.from(resolvedUids);
};

export default BoardPageContent;
