
// src/components/board-page/PostDetailPanel.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import {
  Loader2, Trash2, HandHelping, MessageCircle, Send, X, DollarSign, CalendarDays, Star, Info, CornerDownRight, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Post } from '@/types/post';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { ConnectionButton } from '@/components/ConnectionButton';
import { addCommentToPost, getCommentsForPost } from '@/services/commentService';
import type { NewCommentData, ClientComment, ClientSubComment, NewSubCommentData } from '@/types/comment';
import { fetchUserProfileBasic, getSuggestibleUsers } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { generateAnonymousName, getInitials as getSharedInitials } from '@/lib/pseudonymUtils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addBidToPost, getBidsForPost } from '@/services/bidService';
import type { ClientBid, NewBidData } from '@/types/bid';
import { formatDistanceToNow } from 'date-fns';
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { findOrCreateConversation } from '@/services/messagingService';
import { Label } from '@/components/ui/label';
import { TextWithMentions } from './TextWithMentions';
import { CommentItem } from './CommentItem';

// Define IS_UID_REGEX_COMPONENT locally or import if centralized
const IS_UID_REGEX_COMPONENT = /^[a-zA-Z0-9]{20,28}$/;

const bidFormSchema = z.object({
    bidAmount: z.coerce.number().min(0, "Bid must be non-negative.").optional(),
    bidMessage: z.string().max(300, "Message too long.").optional(),
});
type BidFormValues = z.infer<typeof bidFormSchema>;

interface PostDetailPanelProps {
  post: Post;
  currentUser: FirebaseUser | null;
  onClose: () => void;
  onDelete: (postId: string) => void;
}

export const PostDetailPanel: React.FC<PostDetailPanelProps> = React.memo(({ post, currentUser, onClose, onDelete }) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const user = currentUser; // Alias for clarity

  // State for new comments
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);

  // State for inline bidding
  const [inlineBidAmount, setInlineBidAmount] = useState<string>("");
  const [inlineBidError, setInlineBidError] = useState<string | null>(null);
  const [isProcessingOffer, setIsProcessingOffer] = useState(false);


  const { data: comments = [], isLoading: isLoadingComments, error: commentsError, refetch: refetchComments } = useQuery<ClientComment[]>({
    queryKey: ['comments', post?.id],
    queryFn: () => post?.id && user ? getCommentsForPost(post.id) : Promise.resolve([]),
    enabled: !!post?.id && !!user,
  });

  const { data: bids = [], isLoading: isLoadingBids, error: bidsError } = useQuery<ClientBid[], Error>({
    queryKey: ['bids', post?.id],
    queryFn: () => post?.id ? getBidsForPost(post.id) : Promise.resolve([]),
    enabled: !!post && post.requestType === 'help_request' && !!user,
  });

   const bidForm = useForm<BidFormValues>({
    resolver: zodResolver(bidFormSchema),
    defaultValues: { bidAmount: undefined, bidMessage: "" },
  });

  useEffect(() => {
    bidForm.reset({ bidAmount: undefined, bidMessage: "" });
    setInlineBidAmount("");
    setInlineBidError(null);
  }, [post?.id, bidForm]);


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNewCommentMentionQuery(newCommentMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);

  const { data: generalSuggestibleUsers = [], isLoading: isLoadingGeneralSuggestions } = useQuery<UserProfileBasic[]>({
    queryKey: ['generalSuggestibleUsersForPanel', post?.id, debouncedNewCommentMentionQuery],
    queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, debouncedNewCommentMentionQuery ? 10 : 25),
    enabled: !!post && !!user && showNewCommentSuggestions,
  });

  const newCommentMentionProfilesMap = useMemo(() => {
    const map = new Map<string, UserProfileBasic>();
    generalSuggestibleUsers.forEach(profile => {
      if (profile.userId) map.set(profile.userId, profile);
    });
    if (post?.userId && !map.has(post.userId)) {
        map.set(post.userId, {
            userId: post.userId,
            mentionName: generateAnonymousName(post.userId),
            displayName: generateAnonymousName(post.userId),
        });
    }
    comments.forEach(comment => {
        if (comment.userId && !map.has(comment.userId)) {
            map.set(comment.userId, {
                userId: comment.userId,
                mentionName: comment.mentionName || generateAnonymousName(comment.userId),
                displayName: comment.userName || comment.mentionName || generateAnonymousName(comment.userId),
                avatarUrl: comment.userAvatar,
            });
        }
    });
    return map;
  }, [generalSuggestibleUsers, post?.userId, comments]);

  const extractMentionedUids = useCallback((text: string, profilesToSearch: UserProfileBasic[]): string[] => {
    if (!text || !profilesToSearch || profilesToSearch.length === 0) return [];
    const mentionRegex = /@([A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}|[a-zA-Z0-9]{20,28})/g;
    const textualMentions = new Set<string>();
    for (const match of text.matchAll(mentionRegex)) {
      if (match[1]) textualMentions.add(match[1].trim());
    }

    const resolvedUids = new Set<string>();
    for (const textualMention of textualMentions) {
      let foundProfile: UserProfileBasic | undefined = undefined;
      const textualMentionLower = textualMention.toLowerCase();

      foundProfile = profilesToSearch.find(p => p.mentionName?.toLowerCase() === textualMentionLower);

      if (foundProfile?.userId) {
        resolvedUids.add(foundProfile.userId);
      } else if (IS_UID_REGEX_COMPONENT.test(textualMention)) {
        foundProfile = profilesToSearch.find(p => p.userId === textualMention);
        if (foundProfile?.userId) resolvedUids.add(foundProfile.userId);
      }
    }
    return Array.from(resolvedUids);
  }, []);


  const handleCommentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !post || !newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);

    const finalMentionedUids = extractMentionedUids(newComment.trim(), Array.from(newCommentMentionProfilesMap.values()));

    const commentData: Omit<NewCommentData, 'likeCount' | 'likedBy'> = {
      userId: user.uid,
      text: newComment.trim(),
      mentionedUserIds: finalMentionedUids,
      mentionName: generateAnonymousName(user.uid),
    };
    try {
      await addCommentToPost(post.id, commentData);
      setNewComment('');
      setNewCommentMentionQuery('');
      setShowNewCommentSuggestions(false);
      toast({ title: "Comment Added" });
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Comment Failed", description: `Could not add comment: ${error.message}.` });
    } finally {
      setIsSubmittingComment(false);
    }
  }, [user, post, newComment, isSubmittingComment, newCommentMentionProfilesMap, queryClient, toast, extractMentionedUids]);

  const handleCommentDeleted = useCallback(() => {
    if (post) queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
  }, [post, queryClient]);

  const evaluateNewCommentMentionState = useCallback((text: string, cursorPosition: number) => {
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
      const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(potentialQuery) && !/\n/.test(potentialQuery)) { // Check for newline
        activeQuery = potentialQuery;
      }
    }
    setNewCommentMentionQuery(activeQuery !== null ? activeQuery : '');
    setShowNewCommentSuggestions(activeQuery !== null);
  }, []);

  const handleNewCommentInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    evaluateNewCommentMentionState(value, e.target.selectionStart || 0);
  }, [evaluateNewCommentMentionState]);

  const handleNewCommentInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    evaluateNewCommentMentionState(value, e.target.selectionStart || 0);
  }, [evaluateNewCommentMentionState]);

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
      if (showNewCommentSuggestions && newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(event.target as Node) && newCommentInputRef.current && !newCommentInputRef.current.contains(event.target as Node)) {
        setShowNewCommentSuggestions(false);
      }
    };
    if (showNewCommentSuggestions) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewCommentSuggestions]);


  const addBidMutation = useMutation({
    mutationFn: addBidToPost,
    onSuccess: () => {
      if (post) queryClient.invalidateQueries({ queryKey: ['bids', post.id] });
      toast({ title: "Bid Placed Successfully"});
      setInlineBidAmount("");
      setInlineBidError(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Bid Failed", description: error.message });
    },
  });

  const handleInlineBidChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInlineBidAmount(value);
    if (value === "") {
      setInlineBidError(null);
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) setInlineBidError("Please enter a valid number.");
    else if (numValue < 0) setInlineBidError("Bid cannot be negative.");
    else if (post?.maxBudget != null && numValue > post.maxBudget) {
      setInlineBidError(`Bid cannot exceed max budget of $${post.maxBudget.toLocaleString()}.`);
    } else {
      setInlineBidError(null);
    }
  }, [post?.maxBudget]);

  const handleOfferHelpAndBid = useCallback(async () => {
    if (!user || !post || post.userId === user.uid || post.requestType !== 'help_request' || post.maxBudget == null) {
      toast({ variant: "destructive", title: "Action Not Allowed", description: "Cannot perform this action." });
      return;
    }
    setIsProcessingOffer(true);
    const parsedBidAmount = parseFloat(inlineBidAmount);

    if (inlineBidAmount === "") {
      toast({ variant: "destructive", title: "Bid Required", description: "Please enter a bid amount or select 'Bid FREE'." });
      setIsProcessingOffer(false);
      return;
    }
    if (isNaN(parsedBidAmount) || parsedBidAmount < 0 || (post.maxBudget != null && parsedBidAmount > post.maxBudget)) {
      const currentError = isNaN(parsedBidAmount) || parsedBidAmount < 0 ? "Invalid bid amount." : `Bid cannot exceed max budget of $${post.maxBudget.toLocaleString()}.`;
      setInlineBidError(currentError);
      toast({ variant: "destructive", title: "Invalid Bid", description: currentError });
      setIsProcessingOffer(false);
      return;
    }
    setInlineBidError(null);

    const bidDetails: NewBidData = {
      postId: post.id,
      bidderId: user.uid,
      bidAmount: parsedBidAmount,
      bidMessage: `Bid placed: $${parsedBidAmount.toLocaleString()}`,
    };

    try {
      await addBidMutation.mutateAsync(bidDetails);
      const conversationId = await findOrCreateConversation(user.uid, post.userId, post.id);
      if (conversationId) {
        toast({ title: "Bid Placed & Conversation Started", description: "Redirecting to Messages..." });
        router.push(`/contracts?conversationId=${conversationId}&postId=${post.id}&initialMessageText=${encodeURIComponent(`My bid for this request is $${parsedBidAmount}. Let's discuss the details.`)}`);
        setInlineBidAmount("");
        setInlineBidError(null);
        onClose();
      } else {
        throw new Error("Failed to initiate conversation after bid.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action Failed", description: error.message || "Could not place bid or start conversation." });
    } finally {
      setIsProcessingOffer(false);
    }
  }, [user, post, inlineBidAmount, addBidMutation, router, toast, queryClient, onClose]);


  const minimumBidAmount = useMemo(() => {
    if (!bids || bids.length === 0 || !post || post.requestType !== 'help_request') return null;
    return Math.min(...bids.map(bid => bid.bidAmount));
  }, [bids, post]);


  const filteredNewCommentSuggestions = useMemo(() => {
    if (!showNewCommentSuggestions) return [];
    if (isLoadingGeneralSuggestions) return [{ userId: 'loading-main-comment', mentionName: 'Loading users...', displayName: 'Loading users...' } as UserProfileBasic];

    let results: UserProfileBasic[];
    const source = generalSuggestibleUsers.filter(p => p.userId !== user?.uid && !!p.mentionName);

    if (newCommentMentionQuery.trim() === '') {
      results = source.slice(0, 25);
    } else {
      const queryLower = newCommentMentionQuery.toLowerCase();
      results = source.filter(p =>
        (p.mentionName && p.mentionName.toLowerCase().includes(queryLower)) ||
        (p.displayName && p.displayName.toLowerCase().includes(queryLower))
      ).slice(0, 10);
    }
    if (results.length === 0 && newCommentMentionQuery.trim() !== '') {
      return [{ userId: 'no-match-main-comment', mentionName: `no-match-main-comment`, displayName: `No users matching "@${newCommentMentionQuery}"` } as UserProfileBasic];
    }
    if (results.length === 0) {
      return [{ userId: 'no-users-main-comment', mentionName: `no-users-main-comment`, displayName: 'No users to suggest.' } as UserProfileBasic];
    }
    return results;
  }, [newCommentMentionQuery, generalSuggestibleUsers, isLoadingGeneralSuggestions, showNewCommentSuggestions, user?.uid]);


  if (!post) return null;

  const postDate = post.createdAt instanceof Timestamp
    ? post.createdAt.toDate().toLocaleDateString()
    : post.createdAt && typeof (post.createdAt as any)?.seconds === 'number'
    ? new Timestamp((post.createdAt as any).seconds, (post.createdAt as any).nanoseconds).toDate().toLocaleDateString()
    : typeof post.createdAt === 'number'
    ? new Date(post.createdAt).toLocaleDateString()
    : 'Date unavailable';

  const postAuthorMentionName = generateAnonymousName(post.userId);


  return (
    <Card className="shadow-xl flex flex-col flex-1 overflow-hidden bg-card h-full border-border md:rounded-lg">
      <CardHeader className="p-4 border-b flex-shrink-0">
        <div className="flex justify-between items-start">
          <div className="flex-grow min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {post.requestType === 'help_request' && (
                <Badge variant="outline" className="text-xs cursor-default border-amber-500 text-amber-600 bg-amber-500/10">
                  <HandHelping className="mr-1.5 h-3 w-3" /> Help Request
                </Badge>
              )}
              {post.requestType === 'help_request' && post.maxBudget != null && (
                <Badge variant="secondary" className="text-xs cursor-default">
                  <DollarSign className="mr-1 h-3 w-3 text-green-600" /> Max Budget: ${post.maxBudget.toLocaleString()}
                </Badge>
              )}
              {post.tags?.map((tag, index) => (
                <Badge key={`${post.id}-detail-tag-${index}`} variant="secondary" className="text-xs cursor-default">{tag}</Badge>
              ))}
            </div>
            <CardTitle className="text-xl font-semibold line-clamp-3">{post.question}</CardTitle>
            <CardDescription className="text-sm pt-1">
              Posted by: <Link href={`/profile/${post.userId}`} className="text-primary hover:underline">{postAuthorMentionName}</Link> on {postDate}
              {post.requestType === 'help_request' && post.deadline && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Deadline: {post.deadline instanceof Date ? post.deadline.toLocaleDateString() : 'N/A'}
                </span>
              )}
              {post.ratingScore != null && (
                <span className="ml-2 inline-flex items-center text-xs text-muted-foreground">
                  <Star className={cn("h-3.5 w-3.5 mr-1", post.ratingScore > 0 ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground")} />
                  {post.ratingScore.toFixed(1)}/5
                </span>
              )}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close post details" className="flex-shrink-0 ml-2">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <ScrollArea className="flex-grow">
        <CardContent className="p-4 space-y-4">
          {post.imageUrls && post.imageUrls.length > 0 && (
            <div className="mb-4 rounded-lg overflow-hidden shadow-md">
              <Carousel className="w-full">
                <CarouselContent>
                  {post.imageUrls.map((url, index) => (
                    <CarouselItem key={index}>
                      <div className="aspect-video relative">
                        <Image
                          src={url}
                          alt={`Post image ${index + 1}`}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          style={{ objectFit: 'contain' }}
                          className="rounded-md"
                          data-ai-hint={post.tags && post.tags.length > 0 ? post.tags.slice(0,2).join(' ') : 'abstract'}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {post.imageUrls.length > 1 && (
                  <>
                    <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2" />
                    <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2" />
                  </>
                )}
              </Carousel>
            </div>
          )}

          {post.requestType === 'help_request' ? (
            <div className="mt-4">
               <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-0.5 p-0 h-auto bg-transparent border-b-2 border-border rounded-none">
                   <TabsTrigger
                      value="details"
                      className={cn(
                        "text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0",
                        // Add error styling if needed for form validation, not applicable here for display
                      )}
                    >
                      Problem Details
                    </TabsTrigger>
                  <TabsTrigger value="tried" disabled={!post.descriptionTried} className="text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0">What I've Tried</TabsTrigger>
                  <TabsTrigger value="outcome" disabled={!post.descriptionOutcome} className="text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0">Expected Outcome</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-muted/30 min-h-[100px]">
                  {post.descriptionDetails ? (
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      <TextWithMentions text={post.descriptionDetails} mentionedUserIds={post.mentionedUserIds || []} />
                    </p>
                  ) : (
                    <p className="text-muted-foreground italic">No details provided.</p>
                  )}
                </TabsContent>
                {post.descriptionTried && (
                  <TabsContent value="tried" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-muted/30 min-h-[100px]">
                    <p className="text-muted-foreground whitespace-pre-wrap">{post.descriptionTried}</p>
                  </TabsContent>
                )}
                {post.descriptionOutcome && (
                  <TabsContent value="outcome" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-muted/30 min-h-[100px]">
                    <p className="text-muted-foreground whitespace-pre-wrap">{post.descriptionOutcome}</p>
                  </TabsContent>
                )}
              </Tabs>
            </div>
          ) : (
            post.description && (
              <div>
                <strong className="text-foreground">Details:</strong>
                <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                  <TextWithMentions text={post.description} mentionedUserIds={post.mentionedUserIds || []} />
                </p>
              </div>
            )
          )}

          <div className="grid grid-cols-1 gap-y-2 mt-4 border-t pt-4">
            <div> <strong className="block text-foreground">Sector:</strong> <span className="text-muted-foreground">{post.sector || 'N/A'}</span> </div>
            {post.subSector && (<div> <strong className="block text-foreground">Sub-Sector:</strong> <span className="text-muted-foreground">{post.subSector}</span> </div>)}
            {post.industry && (<div> <strong className="block text-foreground">Industry:</strong> <span className="text-muted-foreground">{post.industry}</span> </div>)}
            {post.naicsCode && (<div> <strong className="block text-foreground">NAICS Code:</strong> <Badge variant="outline" className="text-xs ml-1">{post.naicsCode}</Badge> </div>)}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 border-t pt-4">
            <div> <strong className="block text-foreground">Business Type:</strong> <span className="text-muted-foreground">{post.businessType || 'N/A'}</span> </div>
            <div className="flex items-center gap-2"> <strong className="text-foreground">Safety Indicator:</strong> <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", post.safetyIndicator === 'High' ? "bg-primary text-primary-foreground" : post.safetyIndicator === 'Medium' ? "bg-secondary text-secondary-foreground" : "bg-destructive text-destructive-foreground")}>{post.safetyIndicator || 'N/A'}</span> </div>
          </div>

           {/* Bids Section - Only for Help Requests */}
           {post.requestType === 'help_request' && (
            <div className="mt-6 border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                 <h4 className="text-md font-semibold flex items-center gap-2"> <DollarSign className="h-5 w-5 text-green-600" /> Bids ({user && !isLoadingBids ? bids.length : '...'}) </h4>
                  <p className="text-xs text-muted-foreground">
                    Minimum bid: <span className="font-semibold text-primary">{isLoadingBids ? '...' : (minimumBidAmount !== null ? `$${minimumBidAmount.toLocaleString()}` : 'N/A')}</span>
                  </p>
              </div>
              {isLoadingBids && user ? (
                <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading bids...</div>
              ) : bidsError && user ? (
                <p className="text-sm text-destructive">Error loading bids: {bidsError.message}</p>
              ) : user && bids.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bids placed yet.</p>
              ) : !user ? (
                <p className="text-sm text-muted-foreground text-center py-4"> <Link href="/login" className="text-primary hover:underline">Log in</Link> to view or place bids. </p>
              ) : bids.length > 0 ? (
                <ScrollArea className="max-h-48 pr-3">
                  <div className="space-y-3">
                    {bids.map(bid => (
                      <Card key={bid.id} className="p-3 bg-muted/40 shadow-sm">
                        <div className="flex items-start gap-2.5">
                          <Link href={`/profile/${bid.bidderId}`} passHref>
                            <Avatar className="h-8 w-8 cursor-pointer">
                              <AvatarImage src={bid.bidderAvatar} alt={bid.bidderName || generateAnonymousName(bid.bidderId)} />
                              <AvatarFallback className="text-xs">{getSharedInitials(bid.bidderName || generateAnonymousName(bid.bidderId))}</AvatarFallback>
                            </Avatar>
                          </Link>
                          <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-center">
                              <Link href={`/profile/${bid.bidderId}`} passHref>
                                <p className="text-xs font-medium text-foreground truncate hover:underline">{bid.bidderName || generateAnonymousName(bid.bidderId)}</p>
                              </Link>
                              <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">{formatDistanceToNow(new Date(bid.timestamp), { addSuffix: true })}</p>
                            </div>
                            <p className="text-sm font-semibold text-primary">${bid.bidAmount.toLocaleString()}</p>
                            {bid.bidMessage && <p className="text-xs text-muted-foreground mt-0.5 break-words">{bid.bidMessage}</p>}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : null}
            </div>
          )}


          <div className="mt-6 border-t pt-4">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2"> <MessageCircle className="h-5 w-5 text-primary" /> Comments ({user && !isLoadingComments ? comments.length : '...'}) </h4>
            {isLoadingComments && user ? (
              <div className="space-y-4"> <div className="h-16 w-full bg-muted rounded animate-pulse"></div> <div className="h-16 w-full bg-muted rounded animate-pulse"></div> </div>
            ) : commentsError && user ? (
              <p className="text-sm text-destructive">Error loading comments: {commentsError.message}</p>
            ) : user && comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : !user ? (
              <p className="text-sm text-muted-foreground text-center py-4"> <Link href="/login" className="text-primary hover:underline">Log in</Link> to view and add comments. </p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} currentUserId={user?.uid ?? null} postId={post!.id} onDelete={handleCommentDeleted} postAuthorId={post.userId}/>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </ScrollArea>

      <CardFooter className="p-4 border-t bg-card flex-shrink-0">
        <div className="w-full space-y-3">
          {user && (
             <Popover
                open={showNewCommentSuggestions && filteredNewCommentSuggestions.length > 0 && (filteredNewCommentSuggestions[0]?.userId !== 'loading-main-comment' && filteredNewCommentSuggestions[0]?.userId !== 'no-users-main-comment' && filteredNewCommentSuggestions[0]?.userId !== 'no-match-main-comment')}
                onOpenChange={(open) => { setShowNewCommentSuggestions(open); if (!open) setNewCommentMentionQuery(''); }}
              >
                <PopoverTrigger asChild>
                  <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
                    <Input
                        ref={newCommentInputRef}
                        type="text"
                        placeholder="Add a comment... (@mention someone)"
                        value={newComment}
                        onChange={handleNewCommentInputChange}
                        onFocus={handleNewCommentInputFocus}
                        onBlurCapture={() => setTimeout(() => { if (newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(document.activeElement as Node) && newCommentInputRef.current !== document.activeElement) { setShowNewCommentSuggestions(false); } }, 150)}
                        disabled={!user || isSubmittingComment}
                        className="flex-grow bg-background"
                        aria-label="New comment input"
                        autoComplete="off"
                    />
                    <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" disabled={!newComment.trim() || !user || isSubmittingComment}> {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />} <span className="sr-only">Send Comment</span> </Button>
                  </form>
                </PopoverTrigger>
                 <PopoverContent ref={newCommentSuggestionsPopoverRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="top" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    {filteredNewCommentSuggestions.map(profile => {
                       const displayableName = profile.companyName || profile.mentionName;
                       const showSecondaryNameLine = (profile.companyName) && profile.companyName.toLowerCase() !== profile.mentionName.toLowerCase();
                        return (
                          ['loading-main-comment', 'no-users-main-comment', 'no-match-main-comment'].includes(profile.userId) ? (
                            <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>
                          ) : (
                            <Button key={profile.userId} variant="ghost" size="sm" className="w-full justify-start h-auto px-2 py-1 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelectNewCommentSuggestion(profile)}>
                              <Avatar className="h-5 w-5 mr-2"><AvatarImage src={profile.avatarUrl} alt={profile.mentionName} /><AvatarFallback className="text-xs">{getSharedInitials(profile.mentionName)}</AvatarFallback></Avatar>
                              <div className="flex flex-col items-start">
                                {showSecondaryNameLine && (<span className="font-medium text-foreground">{displayableName}</span>)}
                                <span className={cn("text-muted-foreground", !showSecondaryNameLine && "font-medium text-foreground")}>@{profile.mentionName}</span>
                              </div>
                            </Button>
                          )
                        );
                      })}
                </PopoverContent>
              </Popover>
          )}

           {/* Bidding UI for Help Requests */}
          {user && post.requestType === 'help_request' && post.userId !== user.uid && post.maxBudget != null && (
            <div className="pt-3 space-y-3">
                {/* New row for Bid buttons and Offer Help */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {/* Left side: Bid Amount Input and Preset Buttons */}
                    <div className="flex-grow flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex items-center gap-2 order-2 sm:order-1">
                            <Button variant="outline" size="sm" className="h-9 flex-1 sm:flex-initial" onClick={() => {setInlineBidAmount("0"); setInlineBidError(null);}} disabled={isProcessingOffer}>Bid FREE</Button>
                        </div>
                        <div className="flex-grow order-1 sm:order-2 min-w-[100px] sm:min-w-[130px]">
                            <Label htmlFor="inlineBidAmountSheet" className="sr-only">
                                Your Bid (0 - ${post.maxBudget.toLocaleString()})
                            </Label>
                            <Input
                                id="inlineBidAmountSheet"
                                type="number"
                                placeholder={`Custom bid (Max: $${post.maxBudget.toLocaleString()})`}
                                value={inlineBidAmount}
                                onChange={handleInlineBidChange}
                                className={cn("h-9 text-sm w-full bg-background", inlineBidError && "border-destructive ring-destructive focus-visible:ring-destructive")}
                                disabled={isProcessingOffer}
                                min="0"
                                max={post.maxBudget}
                                step="0.01"
                            />
                             {inlineBidError && (<p className="text-xs text-destructive mt-1 text-left sm:text-center">{inlineBidError}</p>)}
                        </div>
                    </div>
                    {/* Right side: Offer Help button */}
                    <div className="flex-shrink-0 order-3 w-full sm:w-auto">
                        <TooltipProvider>
                            <Tooltip delayDuration={100}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={handleOfferHelpAndBid}
                                        disabled={isProcessingOffer || !!inlineBidError || inlineBidAmount === "" || !user}
                                        className="bg-green-600 hover:bg-green-700 text-white w-full h-9"
                                    >
                                        {isProcessingOffer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HandHelping className="mr-2 h-4 w-4" />}
                                        Offer Help & Submit Bid
                                    </Button>
                                </TooltipTrigger>
                                {(!!inlineBidError || inlineBidAmount === "" || !user) && (
                                <TooltipContent side="top" className="bg-destructive text-destructive-foreground">
                                    <p>{!user ? "Log in to offer help" : inlineBidError || "Please enter a valid bid amount."}</p>
                                </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </div>
          )}

          {/* Action buttons for non-help requests or if user owns the post */}
          {user && (post.requestType !== 'help_request' || post.userId === user.uid || post.maxBudget == null) && (
            <div className="flex justify-end gap-2 pt-1">
              {post.userId && user.uid !== post.userId && (
                <Button variant="outline" size="sm" onClick={() => { if (user && post && post.userId) { findOrCreateConversation(user.uid, post.userId, post.id).then(conversationId => { if (conversationId) router.push(`/contracts?conversationId=${conversationId}&postId=${post.id}`); }).catch(err => toast({ variant: "destructive", title: "Failed to start conversation", description: err.message })); } }} disabled={!user}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Start Conversation
                </Button>
              )}
              {post.userId && user.uid !== post.userId && (
                <ConnectionButton targetUserId={post.userId} targetUserName={generateAnonymousName(post.userId)} size="sm" />
              )}
              {post.userId === user.uid && (
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={onDelete && typeof onDelete !== 'function'}> {/* Placeholder for deletePostMutation.isPending */}
                            {/* {deletePostMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} */}
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Post
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone. This will permanently delete your post.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(post.id)} className="bg-destructive hover:bg-destructive/90">
                                Continue
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
});
PostDetailPanel.displayName = 'PostDetailPanel';

// Main Board Page Content Component
export const BoardPageContent = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>("recommended");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Fetch all posts
  const { data: posts = [], isLoading: isLoadingPosts, error: postsError } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 1,
    refetchOnWindowFocus: true,
  });

  // Mutation for deleting a post
  const deletePostMutation = useMutation({
    mutationFn: deletePostFromFirestore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({ title: "Post Deleted", description: "The post has been removed." });
      setSelectedPost(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Deletion Failed", description: `Could not delete post: ${error.message}.` });
    },
  });

  const handleDeletePost = useCallback((postId: string | undefined) => {
    if (!postId) {
      toast({ variant: "destructive", title: "Error", description: "Post ID missing." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "Must be logged in." });
      return;
    }
    deletePostMutation.mutate(postId);
  }, [user, deletePostMutation, toast]);


  const openPostCallback = useCallback((postToOpen: Post) => {
    if (selectedPost && selectedPost.id === postToOpen.id) {
      setSelectedPost(null);
      router.replace('/', undefined, { shallow: true });
    } else {
      setSelectedPost(postToOpen);
    }
  }, [selectedPost, router]);

  useEffect(() => {
    const postIdFromUrl = searchParams?.get('postId');
    console.log("[BoardPageContent] useEffect for URL postId. postIdFromUrl:", postIdFromUrl, "Posts length:", posts.length, "SelectedPost ID:", selectedPost?.id);
    if (postIdFromUrl && posts.length > 0) {
      const postToOpen = posts.find(p => p.id === postIdFromUrl);
      if (postToOpen) {
        if (!selectedPost || selectedPost.id !== postIdFromUrl) {
          console.log("[BoardPageContent] Opening post from URL:", postToOpen.id);
          setSelectedPost(postToOpen);
        }
      } else {
        toast({ variant: "destructive", title: "Post Not Found", description: "The requested post could not be found." });
        router.replace('/', undefined, { shallow: true });
      }
    }
  }, [searchParams, posts, router, toast, selectedPost?.id]); // Ensure selectedPost.id is used for comparison, not whole object


  const filteredPostsByTags = useMemo(() => {
    if (!Array.isArray(posts)) return [];
    let filtered = selectedTags.length === 0 ? posts : posts.filter(post =>
      Array.isArray(post.tags) && selectedTags.every(tag => post.tags.includes(tag))
    );
    return filtered;
  }, [posts, selectedTags]);

  const helpRequestPosts = useMemo(() =>
    filteredPostsByTags.filter(post => post.requestType === 'help_request'),
    [filteredPostsByTags]
  );

  const opportunitiesPosts = useMemo(() =>
    filteredPostsByTags.filter(post => post.requestType === 'post' || !post.requestType),
    [filteredPostsByTags]
  );

  const renderPosts = useCallback((postsToRender: Post[]) => (
    <div className="columns-1 md:columns-2 gap-4 space-y-4">
      {postsToRender.length > 0 ? (
        postsToRender.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onOpen={openPostCallback}
            isSelected={selectedPost?.id === post.id}
          />
        ))
      ) : (
        <div className="col-span-full text-center py-10">
          <p className="text-muted-foreground">
            {isLoadingPosts ? "Loading posts..." : (selectedTags.length > 0 ? "No posts found matching the selected tags." : "No posts available in this category yet.")}
          </p>
        </div>
      )}
    </div>
  ), [isLoadingPosts, selectedTags, openPostCallback, selectedPost?.id]);

  // Main Return
  return (
    <div className="container mx-auto p-4 pt-6 flex flex-col flex-grow">
      <div className="md:grid md:grid-cols-2 md:gap-8 flex-grow">
        {/* Left Column: Post List */}
        <div className="md:col-span-1 flex flex-col overflow-hidden">
          {/* Tag Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-2">Filter by Tag:</span>
            {availableTags.map((tag) => (
              <Button
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-colors duration-150",
                  selectedTags.includes(tag) ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                aria-pressed={selectedTags.includes(tag)}
              >
                {tag}
              </Button>
            ))}
            {selectedTags.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedTags([])} className="text-xs text-primary hover:underline p-1 h-auto ml-2">
                Clear Filters
              </Button>
            )}
          </div>

          {/* Tabs for Post Categories */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-grow">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="recommended" className="flex items-center gap-1.5 text-xs sm:text-sm"><Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Recommended</TabsTrigger>
              <TabsTrigger value="help_requests" className="flex items-center gap-1.5 text-xs sm:text-sm"><HandHelping className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Help Requests</TabsTrigger>
              <TabsTrigger value="opportunities" className="flex items-center gap-1.5 text-xs sm:text-sm"><Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Opportunities</TabsTrigger>
            </TabsList>
            <TabsContent value="recommended" className="mt-0 flex-grow overflow-hidden">
              <ScrollArea className="h-full pr-2"> {isLoadingPosts && posts.length === 0 ? <div className="h-40 w-full bg-muted rounded animate-pulse"></div> : renderPosts(filteredPostsByTags)} </ScrollArea>
            </TabsContent>
            <TabsContent value="help_requests" className="mt-0 flex-grow overflow-hidden">
              <ScrollArea className="h-full pr-2"> {isLoadingPosts && helpRequestPosts.length === 0 ? <div className="h-40 w-full bg-muted rounded animate-pulse"></div> : renderPosts(helpRequestPosts)} </ScrollArea>
            </TabsContent>
            <TabsContent value="opportunities" className="mt-0 flex-grow overflow-hidden">
              <ScrollArea className="h-full pr-2"> {isLoadingPosts && opportunitiesPosts.length === 0 ? <div className="h-40 w-full bg-muted rounded animate-pulse"></div> : renderPosts(opportunitiesPosts)} </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Selected Post Details or Placeholder */}
        {selectedPost ? (
          <div className="md:col-span-1 flex flex-col">
            <DynamicPostDetailPanel
              post={selectedPost}
              currentUser={user}
              onClose={() => {
                setSelectedPost(null);
                router.replace('/', undefined, { shallow: true });
              }}
              onDelete={handleDeletePost}
            />
          </div>
        ) : (
          <div className="hidden md:col-span-1 md:flex md:flex-col md:items-center md:justify-center h-full border rounded-lg bg-card/50 text-muted-foreground p-8 sticky top-20 max-h-[calc(100vh-6rem)]">
            <MessageSquareDashed className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg">Select a post to view details</p>
            <p className="text-sm mt-1">Details will appear here once you click on a post from the list.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BoardPageContent;

```