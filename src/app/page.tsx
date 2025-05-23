
// src/app/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input";
import { Label } from '@/components/ui/label';
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { cn } from "@/lib/utils";
import { Loader2, Trash2, HandHelping, FileText, Network, Home, Eye, Building, Link2, MessageCircle, Send, CornerDownRight, Trash, DollarSign, CalendarDays, Heart, Sparkles, AtSign, Briefcase, X, MessageSquare, UserPlus, UserCheck, Hourglass, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Post } from '@/types/post';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient, useIsFetching } from '@tanstack/react-query';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addBidToPost, getBidsForPost } from '@/services/bidService';
import type { ClientBid, NewBidData } from '@/types/bid';
import { formatDistanceToNow } from 'date-fns';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const IS_UID_REGEX_PAGE = /^[a-zA-Z0-9]{20,}$/;

const TextWithMentions = React.memo(({ text, mentionedUserIds = [] }: { text: string, mentionedUserIds?: string[] }) => {
  const { data: mentionProfilesMap = new Map<string, UserProfileBasic | null>(), isLoading: isLoadingMentionProfiles } = useQuery<Map<string, UserProfileBasic | null>>({
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
                      console.error(`%c[TextWithMentions] QueryFn: Error fetching profile for UID ${userId}:`, "color: red;", error);
                      profiles.set(userId, null);
                  }
              })
          );
          return profiles;
      },
      enabled: mentionedUserIds && mentionedUserIds.length > 0 && mentionedUserIds.some(id => id && IS_UID_REGEX_PAGE.test(id)),
      staleTime: 5 * 60 * 1000,
  });

  const renderableParts = useMemo(() => {
    if (typeof text !== 'string' || text.trim() === '') {
        return [<React.Fragment key="original-text">{text || ''}</React.Fragment>];
    }
    // Regex to find @UID or @ColorAnimalNumber patterns
    const mentionRegexGlobal = /@([A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}|[a-zA-Z0-9]{20,})/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(mentionRegexGlobal)) {
        const mentionWithAt = match[0]; // e.g., "@BlueWhale123" or "@ActualUID"
        const textualMention = match[1]; // e.g., "BlueWhale123" or "ActualUID"
        const startIndex = match.index!;

        if (startIndex > lastIndex) {
            parts.push(text.substring(lastIndex, startIndex));
        }

        let profileToLink: UserProfileBasic | null | undefined = undefined;

        // Strategy 1: If textualMention is a UID and present in mentionedUserIds (and thus in map)
        if (IS_UID_REGEX_PAGE.test(textualMention) && mentionProfilesMap.has(textualMention)) {
            profileToLink = mentionProfilesMap.get(textualMention);
            console.log(`%c[TextWithMentions] Matched textualMention '${textualMention}' as UID. Profile:`, "color: cyan", profileToLink);
        }
        // Strategy 2: If textualMention matches a profile's generated mentionName
        if (!profileToLink) {
            const textualMentionLower = textualMention.toLowerCase();
            for (const profile of mentionProfilesMap.values()) {
                if (profile && profile.mentionName?.toLowerCase() === textualMentionLower) {
                    profileToLink = profile;
                    console.log(`%c[TextWithMentions] Matched textualMention '${textualMention}' as mentionName. Profile:`, "color: cyan", profileToLink);
                    break;
                }
            }
        }

        if (profileToLink && profileToLink.userId && IS_UID_REGEX_PAGE.test(profileToLink.userId)) {
             parts.push(
                <Link
                    key={`${profileToLink.userId}-${startIndex}`}
                    href={`/profile/${profileToLink.userId}`}
                    className="text-primary hover:underline font-medium cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); }} // Stop propagation if link is inside another clickable element
                >
                    {`@${profileToLink.mentionName}`}
                </Link>
            );
        } else {
             parts.push(
                <span
                    key={`unresolved-${textualMention}-${startIndex}`}
                    className="text-primary cursor-pointer" // Make it look clickable, but it won't navigate
                    title={`Unresolved mention: ${mentionWithAt}`}
                    onClick={(e) => e.stopPropagation()} // Ensure it doesn't trigger parent clicks
                >
                    {mentionWithAt}
                </span>
            );
        }
        lastIndex = startIndex + mentionWithAt.length;
    }

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    return parts;
  }, [text, mentionProfilesMap, mentionedUserIds]);


  if (isLoadingMentionProfiles && mentionedUserIds && mentionedUserIds.length > 0 && mentionedUserIds.some(id => id && IS_UID_REGEX_PAGE.test(id))) {
      return <span className="text-muted-foreground/80">{text}</span>;
  }

  return <>{renderableParts.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>)}</>;
});
TextWithMentions.displayName = 'TextWithMentions';

const PostCard = React.memo(({ post, onOpen, isSelected }: { post: Post, onOpen: (post: Post) => void, isSelected?: boolean }) => {
   const postDate = post.createdAt instanceof Timestamp
    ? post.createdAt.toDate().toLocaleDateString()
    : post.createdAt && typeof post.createdAt === 'object' && 'seconds' in post.createdAt && typeof (post.createdAt as any).seconds === 'number' && typeof (post.createdAt as any).nanoseconds === 'number'
    ? new Timestamp((post.createdAt as any).seconds, (post.createdAt as any).nanoseconds).toDate().toLocaleDateString()
    : typeof post.createdAt === 'number'
    ? new Date(post.createdAt).toLocaleDateString()
    : 'Date unavailable';

  return (
      <Card
        className={cn(
            "mb-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer break-inside-avoid bg-card",
            post.requestType === 'help_request' && "border-2 border-amber-500/70 hover:border-amber-500",
            isSelected && "ring-2 ring-primary ring-offset-2 shadow-primary/20"
        )}
        onClick={() => onOpen(post)}
        aria-label={`View details for post: ${post.question}`}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(post)}
      >
        <CardHeader className="p-4">
           <div className="flex flex-wrap items-center gap-2 mb-2">
                {post.requestType === 'help_request' && (
                    <Badge variant="outline" className="text-xs cursor-default border-amber-500 text-amber-600 bg-amber-500/10">
                        <HandHelping className="mr-1.5 h-3 w-3" /> Help Request
                    </Badge>
                )}
                {post.requestType === 'help_request' && post.maxBudget != null && ( // Changed from paymentAmount
                     <Badge variant="secondary" className="text-xs cursor-default">
                         <DollarSign className="mr-1 h-3 w-3 text-green-600" /> Max Budget: ${post.maxBudget.toLocaleString()}
                     </Badge>
                 )}
                {post.tags?.map((tag, index) => (
                 <Badge key={`${post.id}-tag-${index}`} variant="outline" className="text-xs cursor-default">
                   {tag}
                 </Badge>
                ))}
            </div>
           <h3 className="text-base font-semibold leading-snug text-card-foreground line-clamp-3">{post.question}</h3>
           {post.imageUrls && post.imageUrls.length > 0 && (
             <div className="mt-2 rounded-md overflow-hidden aspect-[3/4] relative"> {/* 3:4 aspect ratio */}
               <Image
                 src={post.imageUrls[0]}
                 alt={post.question}
                 fill
                 sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                 className="object-cover"
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
            toast({ variant: "destructive", title: "Like Failed", description: "Could not update like." });
            if (previousSubComments) {
                queryClient.setQueryData(['subComments', postId, commentId], previousSubComments);
            }
        } finally {
            setIsLiking(false);
            queryClient.invalidateQueries({ queryKey: ['subComments', postId, commentId] });
        }
    }, [user, isLiking, queryClient, postId, commentId, subComment.id, toast]);


    return (
        <div key={subComment.id} className="flex items-start gap-2 group">
            <Link href={`/profile/${subComment.userId}`} passHref>
                <Avatar className="h-6 w-6 mt-1 flex-shrink-0 cursor-pointer">
                    <AvatarImage src={subComment.userAvatar} alt={displayAnonymousName} />
                    <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                        {getSharedInitials(displayAnonymousName)}
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
                         <p className="text-xs text-muted-foreground">
                            {new Date(subComment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
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
        queryKey: ['suggestibleUsersForReply', comment.id, debouncedMentionQuery],
        queryFn: () => getSuggestibleUsers(debouncedMentionQuery, debouncedMentionQuery ? 10 : 25),
        enabled: isReplying && showSuggestions && !!currentUserId,
        staleTime: 1000 * 60 * 1,
        retry: 1,
    });

    const filteredSuggestionsForReply = useMemo(() => {
        if (!showSuggestions || !isReplying) return [];
        if (isLoadingProfilesForReply) {
             return [{ userId: 'loading-reply', mentionName: 'loading-reply', displayName: 'Loading users...' } as UserProfileBasic];
        }

        const profilesSource = (suggestedProfilesForReply || []).filter(p => p.userId !== currentUserId && !!p.mentionName);
        let results: UserProfileBasic[];

        if (mentionQuery.trim() === '') {
            results = profilesSource.slice(0, 5);
        } else {
            const queryLower = mentionQuery.toLowerCase();
            results = profilesSource.filter(
                p => p.mentionName.toLowerCase().includes(queryLower) ||
                     (p.displayName && p.displayName.toLowerCase().includes(queryLower))
            ).slice(0,10);
        }

        if (results.length === 0 && mentionQuery.trim() !== '') {
            return [{ userId: 'no-match-reply', mentionName: 'no-match-reply', displayName: `No users matching "@${mentionQuery}"` } as UserProfileBasic];
        }
        if (results.length === 0) {
            return [{ userId: 'no-users-reply', mentionName: 'no-users-reply', displayName: 'No users to suggest.' } as UserProfileBasic];
        }
        return results;
    }, [mentionQuery, suggestedProfilesForReply, isLoadingProfilesForReply, showSuggestions, isReplying, currentUserId]);

    const handleDeleteClick = useCallback(async () => {
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            await deleteCommentFromPost(postId, comment.id);
            toast({ title: "Comment Deleted" });
            onDelete();
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Delete Failed",
                description: `Could not delete comment: ${error.message}`,
            });
        } finally {
            setIsDeleting(false);
        }
    },[isDeleting, postId, comment.id, toast, onDelete]);

    const [selectedReplyMentionedUserIds, setSelectedReplyMentionedUserIds] = useState<Set<string>>(new Set());

    const handleReplySubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newReply.trim() || isSubmittingReply) return;
        setIsSubmittingReply(true);

        // For reply context, profilesToSearch would include the original comment author, previous repliers, and users from the general suggestion list.
        const profilesForMentionResolution: UserProfileBasic[] = [...(suggestedProfilesForReply || [])];
        // Ensure original commenter is available for @mention resolution if not already in suggestible list
        if (!profilesForMentionResolution.find(p => p.userId === comment.userId)) {
            const originalCommenterProfile = await fetchUserProfileBasic(comment.userId);
            if (originalCommenterProfile) profilesForMentionResolution.push(originalCommenterProfile);
        }
         // Ensure person being replied to (if it's a sub-comment reply) is available
        if (replyingToSubComment?.userId && !profilesForMentionResolution.find(p => p.userId === replyingToSubComment.userId)) {
            const subCommentAuthorProfile = await fetchUserProfileBasic(replyingToSubComment.userId);
            if (subCommentAuthorProfile) profilesForMentionResolution.push(subCommentAuthorProfile);
        }


        const finalMentionedUids = await extractMentionedUids(newReply.trim(), profilesForMentionResolution);

        const replyData: Omit<NewSubCommentData, 'likeCount' | 'likedBy'> = {
            userId: user.uid,
            text: newReply.trim(),
            mentionedUserIds: finalMentionedUids,
        };
        try {
            await addSubCommentToComment(postId, comment.id, replyData);
            toast({ title: "Reply Added" });
            setNewReply('');
            setIsReplying(false);
            setShowSuggestions(false);
            setMentionQuery('');
            setReplyingToSubComment(null);
            setSelectedReplyMentionedUserIds(new Set());
            if (!showReplies) {
                setShowReplies(true);
            } else {
                refetchSubComments();
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Reply Failed",
                description: `Could not add reply: ${error.message}`,
            });
        } finally {
            setIsSubmittingReply(false);
        }
    },[user, newReply, isSubmittingReply, suggestedProfilesForReply, postId, comment.id, comment.userId, replyingToSubComment, showReplies, refetchSubComments, toast]);

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
    },[setNewReply, setMentionQuery, setShowSuggestions]);

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
            setSelectedReplyMentionedUserIds(prev => new Set(prev).add(profile.userId));

            const newCursorPosition = textBeforeMention.length + `@${mentionToInsert} `.length;
            setTimeout(() => {
                replyInputRef.current?.focus();
                replyInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
            }, 0);
        }
        setShowSuggestions(false);
        setMentionQuery('');
    },[newReply, setNewReply, setMentionQuery, setShowSuggestions]);

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
            toast({ variant: "destructive", title: "Like Failed", description: "Could not update like." });
            if (previousComments) {
                queryClient.setQueryData(['comments', postId], previousComments);
            }
        } finally {
            setIsLiking(false);
             queryClient.invalidateQueries({ queryKey: ['comments', postId] });
        }
    },[user, isLiking, queryClient, postId, comment.id, toast]);

    const toggleShowReplies = useCallback(() => setShowReplies(prev => !prev), []);

    const toggleReplyForm = useCallback(() => {
        setIsReplying(prev => !prev);
        setReplyingToSubComment(null); 
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
        const subCommentAuthorMentionName = subCommentToReplyTo.userName || generateAnonymousName(subCommentToReplyTo.userId);
        setNewReply(`@${subCommentAuthorMentionName} `);
        setReplyingToSubComment(subCommentToReplyTo); 
        setTimeout(() => { 
            replyInputRef.current?.focus();
            if (replyInputRef.current) { 
                const len = replyInputRef.current.value.length;
                replyInputRef.current.setSelectionRange(len, len);
            }
        }, 0);
    }, [user, setNewReply, setIsReplying]);


    useEffect(() => {
        if (!isReplying) {
            setSelectedReplyMentionedUserIds(new Set());
        }
    }, [isReplying]);


    return (
        <div className="group border-b border-border/50 pb-4">
            <div className="flex items-start gap-3 ">
                 <Link href={`/profile/${comment.userId}`} passHref>
                     <Avatar className="h-8 w-8 mt-1 flex-shrink-0 cursor-pointer">
                         <AvatarImage src={comment.userAvatar} alt={displayAnonymousName} />
                         <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                             {getSharedInitials(displayAnonymousName)}
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
                            <p className="text-xs text-muted-foreground">
                                {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
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
                            const displayableName = profile.displayName;
                            const showSecondaryNameLine = displayableName && profile.mentionName && displayableName.toLowerCase() !== profile.mentionName.toLowerCase();

                            return (
                                 profile.userId === 'loading-reply' || profile.userId === 'no-users-reply' || profile.userId === 'no-match-reply' ? (
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
                                            <AvatarImage src={profile.avatarUrl} alt={profile.mentionName} />
                                            <AvatarFallback className="text-xs">{getSharedInitials(profile.mentionName)}</AvatarFallback>
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

// Bid Form Zod Schema and Type
const bidFormSchema = z.object({
  bidAmount: z.coerce.number().min(0, "Bid cannot be negative.").optional(), // Optional for preset buttons
  bidMessage: z.string().max(200, "Message cannot exceed 200 characters.").optional(),
});
type BidFormValues = z.infer<typeof bidFormSchema>;

const DisplayBids = React.memo(({ postId }: { postId: string }) => {
  const { data: bids = [], isLoading, isError, error } = useQuery<ClientBid[], Error>({
    queryKey: ['bids', postId],
    queryFn: () => getBidsForPost(postId),
    enabled: !!postId,
  });

  if (isLoading) return <div className="flex justify-center items-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (isError) return <p className="text-sm text-destructive text-center py-4">Error loading bids: {error?.message}</p>;
  if (bids.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No bids yet.</p>;

  return (
    <div className="space-y-4">
      {bids.map(bid => (
        <Card key={bid.id} className="bg-muted/50 shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={bid.bidderAvatar} alt={bid.bidderName || 'Bidder'} />
                  <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                    {getSharedInitials(bid.bidderName || bid.bidderId)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium text-foreground">{bid.bidderName || generateAnonymousName(bid.bidderId)}</p>
              </div>
              <p className="text-sm font-semibold text-primary">${bid.bidAmount.toLocaleString()}</p>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {bid.bidMessage && <p className="text-xs text-muted-foreground mt-1 italic">"{bid.bidMessage}"</p>}
            <p className="text-xs text-muted-foreground/80 mt-1.5 text-right">
              {formatDistanceToNow(new Date(bid.timestamp), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});
DisplayBids.displayName = 'DisplayBids';


// Main Board Page Content Component
const BoardPageContent = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>("recommended");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);
  const [selectedNewCommentMentionedUserIds, setSelectedNewCommentMentionedUserIds] = useState<Set<string>>(new Set());

  const [inlineBidAmount, setInlineBidAmount] = useState<string>("");
  const [inlineBidError, setInlineBidError] = useState<string | null>(null);
  const [isProcessingOffer, setIsProcessingOffer] = useState(false);

  const { data: posts = [], isLoading: isLoadingPosts, error: postsError } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 1,
    refetchOnWindowFocus: true,
  });

  const deletePostMutation = useMutation({
    mutationFn: deletePostFromFirestore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: ['allPostsForSectorPage']});
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

  const addBidMutation = useMutation({
    mutationFn: (bidData: NewBidData) => {
      if (!selectedPost || !selectedPost.id) throw new Error("Post ID is missing for bid.");
      return addBidToPost(selectedPost.id, bidData);
    },
    onSuccess: () => {
      toast({ title: "Bid Placed Successfully" });
      if (selectedPost) {
        queryClient.invalidateQueries({ queryKey: ['bids', selectedPost.id] });
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Bid Failed", description: error.message });
    },
  });

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

  const { data: bids = [], isLoading: isLoadingBids } = useQuery<ClientBid[], Error>({
    queryKey: ['bids', selectedPost?.id],
    queryFn: () => selectedPost?.id ? getBidsForPost(selectedPost.id) : Promise.resolve([]),
    enabled: !!selectedPost && selectedPost.requestType === 'help_request',
  });

  const { data: generalSuggestibleUsers = [], isLoading: isLoadingGeneralSuggestions } = useQuery<UserProfileBasic[]>({
      queryKey: ['generalSuggestibleUsers', debouncedNewCommentMentionQuery, selectedPost?.id], 
      queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, debouncedNewCommentMentionQuery ? 10 : 25),
      enabled: !!selectedPost && !!user && showNewCommentSuggestions,
      staleTime: 1000 * 60 * 5,
      retry: 1,
  });

  const newCommentMentionProfilesMap = useMemo(() => {
    const map = new Map<string, UserProfileBasic>();
    (generalSuggestibleUsers || []).forEach(profile => {
        if (profile.userId) map.set(profile.userId, profile);
    });
    return map;
  }, [generalSuggestibleUsers]);

  const filteredNewCommentSuggestions = useMemo(() => {
    if (!showNewCommentSuggestions) return [];
    if (isLoadingGeneralSuggestions) return [{ userId: 'loading-nc', mentionName: 'loading-nc', displayName: 'Loading users...' } as UserProfileBasic];

    const profilesSource = generalSuggestibleUsers.filter(p => p.userId !== user?.uid && !!p.mentionName);
    let results: UserProfileBasic[];

    if (newCommentMentionQuery.trim() === '') {
        results = profilesSource;
    } else {
        const queryLower = newCommentMentionQuery.toLowerCase();
        results = profilesSource.filter(
            p => p.mentionName.toLowerCase().includes(queryLower) ||
                 (p.displayName && p.displayName.toLowerCase().includes(queryLower))
        );
    }
    results = results.slice(0, 10);

    if (results.length === 0 && newCommentMentionQuery.trim() !== '') {
      return [{ userId: 'no-match-nc', mentionName:'no-match-nc', displayName: `No users matching "@${newCommentMentionQuery}"` } as UserProfileBasic];
    }
    if (results.length === 0) {
        return [{ userId: 'no-users-nc', mentionName: 'no-users-nc', displayName: 'No users to suggest.' } as UserProfileBasic];
    }
    return results;
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
  },[setNewComment, setNewCommentMentionQuery, setShowNewCommentSuggestions]);

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
            setSelectedNewCommentMentionedUserIds(prev => new Set(prev).add(profile.userId));

            const newCursorPosition = textBeforeMention.length + `@${mentionToInsert} `.length;
            setTimeout(() => {
                newCommentInputRef.current?.focus();
                newCommentInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
            }, 0);
        }
        setShowNewCommentSuggestions(false);
        setNewCommentMentionQuery('');
  }, [newComment, setNewComment, setNewCommentMentionQuery, setShowNewCommentSuggestions]);

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
    if (selectedPost.userId && !profilesToSearch.find(p => p.userId === selectedPost.userId)) {
        const postAuthorProfile = await fetchUserProfileBasic(selectedPost.userId);
        if (postAuthorProfile) profilesToSearch.push(postAuthorProfile);
    }
    if (comments && comments.length > 0) {
        const commenterIds = new Set(comments.map(c => c.userId));
        for (const commenterId of commenterIds) {
            if (!profilesToSearch.find(p => p.userId === commenterId)) {
                const commenterProfile = await fetchUserProfileBasic(commenterId);
                if (commenterProfile) profilesToSearch.push(commenterProfile);
            }
        }
    }

    const finalMentionedUids = await extractMentionedUids(newComment.trim(), profilesToSearch);

    const commentData: Omit<NewCommentData, 'likeCount' | 'likedBy'> = {
      userId: user.uid,
      text: newComment.trim(),
      mentionedUserIds: finalMentionedUids,
    };
    try {
      await addCommentToPost(selectedPost.id, commentData);
      queryClient.invalidateQueries({ queryKey: ['comments', selectedPost.id] });
      setNewComment('');
      setNewCommentMentionQuery('');
      setShowNewCommentSuggestions(false);
      setSelectedNewCommentMentionedUserIds(new Set());
      toast({ title: "Comment Added" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Comment Failed",
        description: `Could not add comment: ${error.message}. Check rules.`,
      });
    } finally {
      setIsSubmittingComment(false);
    }
  },[user, selectedPost, newComment, isSubmittingComment, generalSuggestibleUsers, comments, queryClient, toast]);

  const handleCommentDeleted = useCallback(() => {
    if (selectedPost) refetchComments();
  }, [selectedPost, refetchComments]);

  const handleInlineBidChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInlineBidAmount(value);
    if (value === "") {
      setInlineBidError(null);
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setInlineBidError("Please enter a valid number.");
    } else if (numValue < 0) {
      setInlineBidError("Bid cannot be negative.");
    } else if (selectedPost?.maxBudget != null && numValue > selectedPost.maxBudget) {
      setInlineBidError(`Bid cannot exceed max budget of $${selectedPost.maxBudget.toLocaleString()}.`);
    } else {
      setInlineBidError(null);
    }
  }, [selectedPost?.maxBudget]);

  const handleOfferHelpAndBid = useCallback(async () => {
    if (!user || !selectedPost || selectedPost.userId === user.uid || selectedPost.requestType !== 'help_request') {
        toast({ variant: "destructive", title: "Action Not Allowed", description: "Cannot perform this action on this post."});
        return;
    }
    setIsProcessingOffer(true);

    const parsedBidAmount = parseFloat(inlineBidAmount);
    if (inlineBidAmount === "" || isNaN(parsedBidAmount) || parsedBidAmount < 0 || (selectedPost.maxBudget != null && parsedBidAmount > selectedPost.maxBudget)) {
      const currentError = inlineBidAmount === "" ? "Bid amount is required." : (selectedPost.maxBudget != null ? `Invalid bid amount. Must be between $0 and $${selectedPost.maxBudget.toLocaleString()}.` : "Invalid bid amount.");
      setInlineBidError(currentError);
      toast({ variant: "destructive", title: "Invalid Bid", description: currentError });
      setIsProcessingOffer(false);
      return;
    }
    setInlineBidError(null);

    const bidDetails: NewBidData = {
      postId: selectedPost.id,
      bidderId: user.uid,
      bidAmount: parsedBidAmount,
      bidMessage: `Bid: $${parsedBidAmount.toLocaleString()} via 'Offer Help'.`, 
    };

    try {
      await addBidMutation.mutateAsync(bidDetails);
      const conversationId = await findOrCreateConversation(user.uid, selectedPost.userId, selectedPost.id);
      if (conversationId) {
        toast({ title: "Bid Placed & Conversation Started", description: "Redirecting to Messages..." });
        router.push(`/contracts?conversationId=${conversationId}&postId=${selectedPost.id}&initialMessageText=${encodeURIComponent(`My bid for your request '${selectedPost.question.substring(0,30)}...' is $${parsedBidAmount.toLocaleString()}. Let's discuss!`)}`);
        setInlineBidAmount("");
        setSelectedPost(null);
      } else {
        throw new Error("Failed to initiate conversation after bid.");
      }
    } catch (error: any) {
      console.error("Error in handleOfferHelpAndBid:", error);
      toast({
        variant: "destructive",
        title: "Action Failed",
        description: error.message || "Could not place bid or start conversation.",
      });
    } finally {
      setIsProcessingOffer(false);
    }
  },[user, selectedPost, inlineBidAmount, addBidMutation, router, toast, queryClient]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag)
        : [...prevTags, tag]
    );
  },[]);

  const openPostCallback = useCallback((postToOpen: Post) => {
      if (selectedPost && selectedPost.id === postToOpen.id) {
        setSelectedPost(null); 
        setInlineBidAmount("");
        setInlineBidError(null);
      } else {
        setSelectedPost(postToOpen);
        setInlineBidAmount(""); 
        setInlineBidError(null);
      }
    }, [selectedPost]); 

  useEffect(() => {
    const postIdFromUrl = searchParams?.get('postId');
    if (postIdFromUrl && posts.length > 0) {
        const postToOpen = posts.find(p => p.id === postIdFromUrl);
        if (postToOpen) {
            if (!selectedPost || selectedPost.id !== postIdFromUrl) {
                setSelectedPost(postToOpen);
            }
            router.replace('/', { shallow: true });
        } else {
            router.replace('/', { shallow: true });
            toast({ variant: "destructive", title: "Post Not Found", description: "The requested post could not be found or has been removed." });
        }
    }
  }, [searchParams, posts, router, selectedPost, toast]); // Added toast

  useEffect(() => {
    if (newComment.trim() === '') {
        setSelectedNewCommentMentionedUserIds(new Set());
    }
  }, [newComment]);

  useEffect(() => {
    if (selectedPost && !authLoading && !user) {
      setSelectedPost(null); 
       setInlineBidAmount("");
       setInlineBidError(null);
    }
  }, [user, authLoading, selectedPost]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNewCommentMentionQuery(newCommentMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);

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


  const filteredPostsByTags = useMemo(() => {
    if (!Array.isArray(posts)) return [];
    let filtered = selectedTags.length === 0
      ? posts
      : posts.filter(post =>
          Array.isArray(post.tags) &&
          selectedTags.every(tag => post.tags.includes(tag))
        );
    return filtered.sort((a, b) => {
      const timeA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : (typeof a.createdAt === 'object' && a.createdAt && 'seconds' in a.createdAt ? new Timestamp((a.createdAt as any).seconds, (a.createdAt as any).nanoseconds).toMillis() : (typeof a.createdAt === 'number' ? a.createdAt : 0));
      const timeB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : (typeof b.createdAt === 'object' && b.createdAt && 'seconds' in b.createdAt ? new Timestamp((b.createdAt as any).seconds, (b.createdAt as any).nanoseconds).toMillis() : (typeof b.createdAt === 'number' ? b.createdAt : 0));
      return timeB - timeA;
    });
  }, [posts, selectedTags]);

  const helpRequestPosts = useMemo(() => filteredPostsByTags.filter(post => post.requestType === 'help_request'), [filteredPostsByTags]);
  const opportunitiesPosts = useMemo(() => filteredPostsByTags.filter(post => post.requestType === 'post' || !post.requestType), [filteredPostsByTags]);

  const renderPosts = useCallback((postsToRender: Post[]) => (
    <div className="masonry-grid columns-1 md:columns-2 gap-4 space-y-4">
      {postsToRender.length > 0 ? (
        postsToRender.map((post) => (
          <PostCard key={post.id} post={post} onOpen={openPostCallback} isSelected={selectedPost?.id === post.id} />
        ))
      ) : (
        <div className="col-span-full text-center py-10">
          <p className="text-muted-foreground">
            {isLoadingPosts ? "Loading..." : (selectedTags.length > 0
              ? "No posts found matching the selected tags."
              : "No posts available in this category yet."
            )}
          </p>
        </div>
      )}
    </div>
  ), [isLoadingPosts, selectedTags, openPostCallback, selectedPost?.id]);


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

  // Main Return
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

      <div className="md:grid md:grid-cols-2 md:gap-8">
        {/* Left Column: Post List */}
        <div className="w-full md:col-span-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="recommended" className="flex items-center gap-1.5 text-xs sm:text-sm"><Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Recommended</TabsTrigger>
              <TabsTrigger value="help_requests" className="flex items-center gap-1.5 text-xs sm:text-sm"><HandHelping className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Help Requests</TabsTrigger>
              <TabsTrigger value="opportunities" className="flex items-center gap-1.5 text-xs sm:text-sm"><Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Opportunities</TabsTrigger>
            </TabsList>
            <ScrollArea className="h-[calc(100vh-18rem)] md:h-[calc(100vh-12rem)] md:pr-2">
              <TabsContent value="recommended" className="mt-0">
                {renderPosts(filteredPostsByTags) }
              </TabsContent>
              <TabsContent value="help_requests" className="mt-0">
                {renderPosts(helpRequestPosts) }
              </TabsContent>
              <TabsContent value="opportunities" className="mt-0">
                {renderPosts(opportunitiesPosts) }
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Right Column: Selected Post Details */}
         <div className="md:col-span-1 md:sticky md:top-20 flex flex-col">
          {selectedPost ? (
            <Card className="shadow-xl flex flex-col bg-card flex-1 overflow-hidden max-h-[calc(100vh-6rem)]"> {/* Added max-h */}
              <CardHeader className="p-4 border-b flex-shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl font-semibold">{selectedPost.question}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {selectedPost.requestType === 'help_request' && (
                           <Badge variant="outline" className="text-xs cursor-default border-amber-500 text-amber-600 bg-amber-500/10">
                                <HandHelping className="mr-1.5 h-3 w-3" /> Help Request
                            </Badge>
                        )}
                        {selectedPost.requestType === 'help_request' && selectedPost.maxBudget != null && (
                          <Badge variant="secondary" className="text-xs cursor-default">
                            <DollarSign className="mr-1 h-3 w-3 text-green-600" /> Max Budget: ${selectedPost.maxBudget.toLocaleString()}
                          </Badge>
                        )}
                        {selectedPost.tags?.map((tag, index) => (
                            <Badge key={`${selectedPost.id}-detail-tag-${index}`} variant="secondary" className="text-xs cursor-default">{tag}</Badge>
                        ))}
                    </div>
                    <CardDescription className="text-sm pt-1">
                      Posted on: {selectedPost.createdAt instanceof Timestamp ? selectedPost.createdAt.toDate().toLocaleDateString() : 'Date unavailable'}
                       {selectedPost.deadline && selectedPost.requestType === 'help_request' && (
                           <span className="ml-2 inline-flex items-center gap-1">
                               <CalendarDays className="h-3.5 w-3.5" /> Deadline: {selectedPost.deadline instanceof Date ? selectedPost.deadline.toLocaleDateString() : (selectedPost.deadline as unknown as Timestamp)?.toDate().toLocaleDateString() || 'N/A'}
                           </span>
                       )}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openPostCallback(selectedPost)} aria-label="Close post details">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>

              <ScrollArea className="flex-grow"> {/* This ScrollArea wraps the content that needs scrolling */}
                <CardContent className="p-4 space-y-4">
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

                    {selectedPost.requestType === 'help_request' ? (
                        <div className="mt-4">
                            <Tabs defaultValue="details" className="w-full">
                              <TabsList className="grid w-full grid-cols-3 mb-0.5 p-0 h-auto bg-transparent rounded-none border-b-2 border-border">
                                <TabsTrigger
                                  value="details"
                                  className={cn(
                                    "text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0",
                                  )}
                                >
                                  Problem Details
                                </TabsTrigger>
                                <TabsTrigger
                                  value="tried"
                                  disabled={!selectedPost.descriptionTried}
                                  className="text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                                >
                                  What I've Tried
                                </TabsTrigger>
                                <TabsTrigger
                                  value="outcome"
                                  disabled={!selectedPost.descriptionOutcome}
                                  className="text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                                >
                                  Expected Outcome
                                </TabsTrigger>
                              </TabsList>
                              <TabsContent value="details" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[100px]">
                                {selectedPost.descriptionDetails ? (
                                <p className="text-muted-foreground whitespace-pre-wrap">
                                    <TextWithMentions text={selectedPost.descriptionDetails} mentionedUserIds={selectedPost.mentionedUserIds || []} />
                                </p>
                                ) : (
                                <p className="text-muted-foreground italic">No details provided.</p>
                                )}
                              </TabsContent>
                              {selectedPost.descriptionTried && (
                                <TabsContent value="tried" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[100px]">
                                <p className="text-muted-foreground whitespace-pre-wrap">{selectedPost.descriptionTried}</p>
                                </TabsContent>
                              )}
                              {selectedPost.descriptionOutcome && (
                                <TabsContent value="outcome" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[100px]">
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
                    </div>

                    {selectedPost.requestType === 'help_request' && (
                      <div className="mt-6 border-t pt-4">
                        <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                           <DollarSign className="h-5 w-5 text-primary"/> Bids ({isLoadingBids ? '...' : bids.length})
                        </h4>
                        <DisplayBids postId={selectedPost.id} />
                      </div>
                    )}

                    <div className="mt-6 border-t pt-4">
                      <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary"/> Comments ({isLoadingComments ? '...' : comments.length})
                      </h4>
                      {isLoadingComments ? (
                        <div className="space-y-4">
                          <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" />
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
                </CardContent>
              </ScrollArea>

              <CardFooter className="p-4 border-t bg-background mt-auto sticky bottom-0 flex-shrink-0"> {/* Make footer shrink-0 */}
                <div className="w-full space-y-4">
                  {/* Top Row: Comment Input */}
                   <Popover open={showNewCommentSuggestions && filteredNewCommentSuggestions.length > 0 && (filteredNewCommentSuggestions[0]?.userId !== 'loading-nc' && filteredNewCommentSuggestions[0]?.userId !== 'no-users-nc' && filteredNewCommentSuggestions[0]?.userId !== 'no-match-nc')} onOpenChange={setShowNewCommentSuggestions}>
                      <PopoverTrigger asChild>
                          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
                              <Input
                                  ref={newCommentInputRef}
                                  type="text"
                                  placeholder={ user ? `Add a comment... (@${generalSuggestibleUsers[0]?.mentionName || 'mention someone'})` : "Log in to comment" }
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
                                const displayableName = profile.displayName;
                                const showSecondaryNameLine = displayableName && profile.mentionName && displayableName.toLowerCase() !== profile.mentionName.toLowerCase();
                                
                                return (
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
                                              <AvatarImage src={profile.avatarUrl} alt={profile.mentionName} />
                                              <AvatarFallback className="text-xs">{getSharedInitials(profile.mentionName)}</AvatarFallback>
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

                  {/* Bottom Row: Bidding UI and Action Buttons */}
                   <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-end gap-3 pt-2">
                     {/* Bidding specific UI - now on the left for sm screens and up */}
                     {user && selectedPost.requestType === 'help_request' && selectedPost.userId !== user.uid && selectedPost.maxBudget != null && (
                        <div className="flex-grow space-y-2 self-start sm:self-center order-1 sm:order-none">
                           <Label htmlFor="inlineBidAmount" className="text-xs font-medium">
                              Your Bid (0 - ${selectedPost.maxBudget.toLocaleString()})
                           </Label>
                           <div className="flex flex-wrap items-center gap-1.5">
                              <Button variant="outline" size="xs" onClick={() => { setInlineBidAmount("0"); setInlineBidError(null); }} disabled={isProcessingOffer}>Bid FREE</Button>
                              <Input
                                 id="inlineBidAmount"
                                 type="number"
                                 placeholder="Custom amount"
                                 value={inlineBidAmount}
                                 onChange={handleInlineBidChange}
                                 className={cn("h-8 text-xs w-24 bg-card", inlineBidError && "border-destructive ring-destructive focus-visible:ring-destructive")}
                                 disabled={isProcessingOffer}
                                 min="0"
                                 max={selectedPost.maxBudget}
                              />
                           </div>
                           {inlineBidError && <p className="text-xs text-destructive mt-1">{inlineBidError}</p>}
                        </div>
                     )}

                    {/* Action Buttons Container - now on the right */}
                    <div className="flex flex-shrink-0 gap-2 self-center sm:self-end order-2 sm:order-none">
                      {user && selectedPost.userId && selectedPost.userId !== user.uid && (
                        <>
                          {selectedPost.requestType === 'help_request' && selectedPost.maxBudget != null ? (
                            <TooltipProvider>
                              <Tooltip delayDuration={100}>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleOfferHelpAndBid}
                                    disabled={isProcessingOffer || !!inlineBidError || inlineBidAmount === "" || !user}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    {isProcessingOffer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HandHelping className="mr-2 h-4 w-4" />}
                                    Offer Help & Bid
                                  </Button>
                                </TooltipTrigger>
                                {(!!inlineBidError || inlineBidAmount === "" || !user) && (
                                  <TooltipContent side="top" className="bg-destructive text-destructive-foreground">
                                    <p>{!user ? "Log in to offer help" : inlineBidError || "Please enter a valid bid amount."}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          ) : selectedPost.requestType !== 'help_request' ? ( // Only show general "Offer Help" for non-help_request posts
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (user && selectedPost && selectedPost.userId) {
                                  findOrCreateConversation(user.uid, selectedPost.userId, selectedPost.id)
                                    .then(conversationId => {
                                      if (conversationId) router.push(`/contracts?conversationId=${conversationId}&postId=${selectedPost.id}`);
                                    })
                                    .catch(err => toast({ variant: "destructive", title: "Failed to start conversation", description: err.message }));
                                }
                              }}
                              disabled={!user}
                            >
                              <HandHelping className="mr-2 h-4 w-4" /> Offer Help
                            </Button>
                          ) : null }
                          <ConnectionButton
                            targetUserId={selectedPost.userId}
                            targetUserName={generateAnonymousName(selectedPost.userId)}
                            size="sm"
                          />
                        </>
                      )}
                      {user && selectedPost.userId === user.uid && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={deletePostMutation.isPending}>
                              {deletePostMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                              Delete Post
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>This action cannot be undone. This will permanently delete your post.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={deletePostMutation.isPending}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeletePost(selectedPost.id)} disabled={deletePostMutation.isPending} className="bg-destructive hover:bg-destructive/90">
                                {deletePostMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Continue'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              </CardFooter>
            </Card>
          ) : (
             <div className="hidden md:flex md:flex-col md:items-center md:justify-center h-full border rounded-lg bg-card text-muted-foreground p-8 sticky top-20 max-h-[calc(100vh-6rem)]">
              <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg">Select a post to view details</p>
              <p className="text-sm mt-1">Details will appear here once you click on a post from the list.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to extract mentioned user UIDs from comment text
// It expects profilesToSearch to be an array of UserProfileBasic objects from the current context
export const extractMentionedUids = async (text: string, profilesToSearch: UserProfileBasic[]): Promise<string[]> => {
  if (!text || text.trim() === '' || !Array.isArray(profilesToSearch) || profilesToSearch.length === 0) {
    return [];
  }
  console.log(`%c[page.tsx] extractMentionedUids - Input Text: "${text.substring(0, 50)}..."`, "color: #FFA500;");
  console.log(`%c[page.tsx] extractMentionedUids - Profiles to Search In (first 5):`, "color: #FFA500;", profilesToSearch.slice(0, 5).map(p => ({uid: p.userId, mentionName: p.mentionName, displayName: p.displayName })));

  const mentionRegexGlobal = /@([A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}|[a-zA-Z0-9]{20,})/g;
  const textualMentions = new Set<string>();
  for (const match of text.matchAll(mentionRegexGlobal)) {
    if (match[1]) textualMentions.add(match[1].trim());
  }

  console.log(`%c[page.tsx] extractMentionedUids - Extracted Textual Mentions:`, "color: #FFA500;", Array.from(textualMentions));
  if (textualMentions.size === 0) return [];

  const resolvedUids = new Set<string>();

  for (const textualMention of textualMentions) {
    let foundProfile: UserProfileBasic | undefined = undefined;
    const textualMentionLower = textualMention.toLowerCase();

    // Strategy 1: Match against generated mentionName (ColorAnimalNumber)
    foundProfile = profilesToSearch.find(p => p.mentionName?.toLowerCase() === textualMentionLower);
    if (foundProfile && foundProfile.userId) {
      console.log(`%c[page.tsx] extractMentionedUids - Resolved "@${textualMention}" to UID "${foundProfile.userId}" via mentionName match.`, "color: green;");
      resolvedUids.add(foundProfile.userId);
      continue;
    }

    // Strategy 2: Check if the textualMention itself is a UID
    if (IS_UID_REGEX_PAGE.test(textualMention)) {
      foundProfile = profilesToSearch.find(p => p.userId === textualMention);
      if (foundProfile && foundProfile.userId) {
        console.log(`%c[page.tsx] extractMentionedUids - Resolved "@${textualMention}" to UID "${foundProfile.userId}" via direct UID match.`, "color: green;");
        resolvedUids.add(foundProfile.userId);
        continue;
      }
    }
    console.log(`%c[page.tsx] extractMentionedUids - Could not resolve "@${textualMention}" to a UID.`, "color: orange;");
  }
  console.log(`%c[page.tsx] extractMentionedUids - Final Resolved UIDs:`, "color: #FFA500; font-weight: bold;", Array.from(resolvedUids));
  return Array.from(resolvedUids);
};


export default BoardPageContent;

