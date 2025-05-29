
// src/components/board-page/PostDetailPanel.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Loader2, Trash2, HandHelping, MessageCircle, Send, X, DollarSign, CalendarDays, Star, Info, CornerDownRight, Eye, User, AtSign
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Post } from '@/types/post';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { ConnectionButton } from '@/components/ConnectionButton';
import { addCommentToPost, getCommentsForPost, deleteCommentFromPost, getSubCommentsForComment, addSubCommentToComment, deleteSubCommentFromComment, toggleLikeComment, toggleLikeSubComment } from '@/services/commentService';
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
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"; // Removed unused FormLabel
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { findOrCreateConversation } from '@/services/messagingService';
import { Label } from '@/components/ui/label'; // Added Label import
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import { TextWithMentions } from './TextWithMentions';
import { CommentItem } from './CommentItem';


// Define IS_UID_REGEX_COMPONENT locally or import if it's centralized
const IS_UID_REGEX_COMPONENT = /^[a-zA-Z0-9]{20,28}$/;


const bidFormSchema = z.object({
  bidAmount: z.coerce.number().min(0, "Bid must be non-negative.").optional(),
  bidMessage: z.string().max(300, "Message too long.").optional(),
});
type BidFormValues = z.infer<typeof bidFormSchema>;


interface PostDetailPanelProps {
  post: Post | null;
  currentUser: FirebaseUser | null;
  onClose: () => void;
  onDelete: (postId: string) => void;
}

export const PostDetailPanel: React.FC<PostDetailPanelProps> = React.memo(({ post: selectedPost, currentUser: user, onClose, onDelete }) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);

  const [inlineBidAmount, setInlineBidAmount] = useState<string>("");
  const [inlineBidError, setInlineBidError] = useState<string | null>(null);
  const [isProcessingOffer, setIsProcessingOffer] = useState(false);

  // State for comment replies (if CommentItem is directly here)
  const [replyingTo, setReplyingTo] = useState<ClientComment | ClientSubComment | null>(null);
  const [activeReplyInputFor, setActiveReplyInputFor] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPost) {
        setInlineBidAmount("");
        setInlineBidError(null);
        setNewComment('');
        setNewCommentMentionQuery('');
        setShowNewCommentSuggestions(false);
        setReplyingTo(null);
        setActiveReplyInputFor(null);
    }
  }, [selectedPost?.id]); // Reset when a new post is selected

  // Debounce for new comment mention query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNewCommentMentionQuery(newCommentMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);


  // Fetch comments
  const { data: comments = [], isLoading: isLoadingComments, refetch: refetchComments } = useQuery<ClientComment[]>({
    queryKey: ['comments', selectedPost?.id],
    queryFn: () => selectedPost?.id && user ? getCommentsForPost(selectedPost.id) : Promise.resolve([]),
    enabled: !!selectedPost?.id && !!user,
  });

  // Fetch bids
  const { data: bids = [], isLoading: isLoadingBids } = useQuery<ClientBid[], Error>({
    queryKey: ['bids', selectedPost?.id],
    queryFn: () => selectedPost?.id ? getBidsForPost(selectedPost.id) : Promise.resolve([]),
    enabled: !!selectedPost && selectedPost.requestType === 'help_request' && !!user,
  });

  // Fetch suggestible users for new top-level comments
   const { data: generalSuggestibleUsers = [], isLoading: isLoadingGeneralSuggestions } = useQuery<UserProfileBasic[]>({
    queryKey: ['generalSuggestibleUsersForPanel', selectedPost?.id, debouncedNewCommentMentionQuery],
    queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, debouncedNewCommentMentionQuery ? 10 : 25),
    enabled: !!selectedPost && !!user && showNewCommentSuggestions,
    staleTime: 1000 * 60 * 5,
  });

  const newCommentMentionProfilesMap = useMemo(() => {
    const map = new Map<string, UserProfileBasic>();
    if (generalSuggestibleUsers) {
      generalSuggestibleUsers.forEach(profile => map.set(profile.userId, profile));
    }
    return map;
  }, [generalSuggestibleUsers]);


  const addCommentMutation = useMutation({
    mutationFn: (commentDataWithPostId: NewCommentData & { postId: string }) => {
        const { postId: pId, ...restData } = commentDataWithPostId;
        return addCommentToPost(pId, restData);
    },
    onSuccess: () => {
        setNewComment('');
        setNewCommentMentionQuery('');
        setShowNewCommentSuggestions(false);
        toast({ title: "Comment Added" });
        if (selectedPost) queryClient.invalidateQueries({ queryKey: ['comments', selectedPost.id] });
    },
    onError: (error: Error) => {
        toast({ variant: "destructive", title: "Comment Failed", description: `Could not add comment: ${error.message}.` });
    },
    onSettled: () => {
        setIsSubmittingComment(false);
    }
  });

  const handleCommentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPost || !newComment.trim() || addCommentMutation.isPending) return;
    setIsSubmittingComment(true);

    const profilesToSearchForMentions: UserProfileBasic[] = [...generalSuggestibleUsers];
    if (selectedPost.userId && !profilesToSearchForMentions.find(p => p.userId === selectedPost.userId)) {
        const authorProfile = await fetchUserProfileBasic(selectedPost.userId);
        if (authorProfile) profilesToSearchForMentions.push(authorProfile);
    }
    comments.forEach(async (comment) => {
        if (comment.userId && !profilesToSearchForMentions.find(p => p.userId === comment.userId)) {
            const commenterProfile = await fetchUserProfileBasic(comment.userId);
            if(commenterProfile) profilesToSearchForMentions.push(commenterProfile);
        }
    });

    const finalMentionedUids = extractMentionedUids(newComment.trim(), profilesToSearchForMentions);

    const commentData: NewCommentData & { postId: string } = {
      postId: selectedPost.id,
      userId: user.uid,
      text: newComment.trim(),
      mentionName: generateAnonymousName(user.uid),
      mentionedUserIds: finalMentionedUids,
      likeCount: 0,
      likedBy: [],
    };
    addCommentMutation.mutate(commentData);
  }, [user, selectedPost, newComment, addCommentMutation, generalSuggestibleUsers, comments, queryClient, toast]);


  const evaluateNewCommentMentionState = useCallback((text: string, cursorPosition: number) => {
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
      const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(potentialQuery) && !/\n/.test(potentialQuery)) {
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
    evaluateNewCommentMentionState(e.target.value, e.target.selectionStart || 0);
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
      setNewComment(`${textBeforeMention}@${profile.mentionName} ${textAfterCursor}`);
      const newCursorPosition = textBeforeMention.length + `@${profile.mentionName} `.length;
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

  const filteredNewCommentSuggestions = useMemo(() => {
    if (!showNewCommentSuggestions) return [];
    if (isLoadingGeneralSuggestions) return [{ userId: 'loading-main-comment', mentionName: 'loading-main-comment', displayName: 'Loading users...' } as UserProfileBasic];

    let source = generalSuggestibleUsers.filter(p => p.userId !== user?.uid);

    if (debouncedNewCommentMentionQuery.trim() === '') {
        // No query, show from general suggestible list (already fetched)
    } else {
      const queryLower = debouncedNewCommentMentionQuery.toLowerCase();
      source = source.filter(
        p => p.mentionName.toLowerCase().includes(queryLower) ||
             (p.displayName && p.displayName.toLowerCase().includes(queryLower))
      );
    }
    if (source.length === 0 && debouncedNewCommentMentionQuery.trim() !== '') {
      return [{ userId: 'no-match-main-comment', mentionName: 'no-match-main-comment', displayName: `No users matching "@${debouncedNewCommentMentionQuery}"` } as UserProfileBasic];
    }
    if (source.length === 0) {
        return [{ userId: 'no-users-main-comment', mentionName: 'no-users-main-comment', displayName: 'No users to suggest here.' } as UserProfileBasic];
    }
    return source.slice(0, 10);
  }, [showNewCommentSuggestions, isLoadingGeneralSuggestions, generalSuggestibleUsers, debouncedNewCommentMentionQuery, user?.uid]);

  const addBidMutation = useMutation({
    mutationFn: addBidToPost,
    onSuccess: () => {
      if (selectedPost) queryClient.invalidateQueries({ queryKey: ['bids', selectedPost.id] });
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
    else if (selectedPost?.maxBudget != null && numValue > selectedPost.maxBudget) {
      setInlineBidError(`Bid cannot exceed max budget of $${selectedPost.maxBudget.toLocaleString()}.`);
    } else {
      setInlineBidError(null);
    }
  }, [selectedPost?.maxBudget]);

  const handleOfferHelpAndBid = useCallback(async () => {
    if (!user || !selectedPost || selectedPost.userId === user.uid || selectedPost.requestType !== 'help_request' || isProcessingOffer) {
      toast({ variant: "destructive", title: "Action Not Allowed", description: "Cannot perform this action at the moment." });
      return;
    }
    setIsProcessingOffer(true);
    const parsedBidAmount = parseFloat(inlineBidAmount);

    if (inlineBidAmount === "") {
      toast({ variant: "destructive", title: "Bid Required", description: "Please enter a bid amount or select 'Bid FREE'." });
      setIsProcessingOffer(false);
      return;
    }
    if (isNaN(parsedBidAmount) || parsedBidAmount < 0 || (selectedPost.maxBudget != null && parsedBidAmount > selectedPost.maxBudget)) {
      const currentError = isNaN(parsedBidAmount) || parsedBidAmount < 0 ? "Invalid bid amount." : `Bid cannot exceed max budget of $${selectedPost.maxBudget.toLocaleString()}.`;
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
      bidMessage: `Bid placed: $${parsedBidAmount.toLocaleString()}`,
    };

    try {
      await addBidMutation.mutateAsync(bidDetails);
      const conversationId = await findOrCreateConversation(user.uid, selectedPost.userId, selectedPost.id);
      if (conversationId) {
        toast({ title: "Bid Placed & Conversation Started", description: "Redirecting to Messages..." });
        router.push(`/contracts?conversationId=${conversationId}&postId=${selectedPost.id}&initialBidAmount=${parsedBidAmount}`);
        setInlineBidAmount("");
        setInlineBidError(null);
        onClose(); // Close the panel
      } else {
        throw new Error("Failed to initiate conversation after bid.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action Failed", description: error.message || "Could not place bid or start conversation." });
    } finally {
      setIsProcessingOffer(false);
    }
  }, [user, selectedPost, inlineBidAmount, addBidMutation, router, toast, queryClient, onClose, isProcessingOffer]);

  const minimumBidAmount = useMemo(() => {
    if (!bids || bids.length === 0 || !selectedPost || selectedPost.requestType !== 'help_request') return null;
    return Math.min(...bids.map(bid => bid.bidAmount));
  }, [bids, selectedPost]);

  const postDate = selectedPost?.createdAt instanceof Timestamp
    ? selectedPost.createdAt.toDate().toLocaleDateString()
    : selectedPost?.createdAt && typeof (selectedPost.createdAt as any)?.seconds === 'number'
    ? new Timestamp((selectedPost.createdAt as any).seconds, (selectedPost.createdAt as any).nanoseconds).toDate().toLocaleDateString()
    : typeof selectedPost?.createdAt === 'number'
    ? new Date(selectedPost.createdAt).toLocaleDateString()
    : 'Date unavailable';

  const postAuthorMentionName = selectedPost ? (selectedPost.userId ? generateAnonymousName(selectedPost.userId) : 'Unknown User') : 'Loading...';
  const postAuthorProfileLink = selectedPost?.userId ? `/profile/${selectedPost.userId}` : '#';

  const handleCommentDeleted = useCallback(() => {
    if (selectedPost) {
      refetchComments();
    }
  }, [selectedPost, refetchComments]);

  if (!selectedPost) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center h-full border rounded-lg bg-card/50 text-muted-foreground p-8 sticky top-20 max-h-[calc(100vh-6rem)]">
        <MessageCircle className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg">Select a post to view details</p>
        <p className="text-sm mt-1">Details will appear here once you click on a post from the list.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <Card className="flex flex-col flex-1 overflow-hidden bg-card h-full border-border rounded-lg shadow-xl sticky top-20 max-h-[calc(100vh-6rem)]">
      <CardHeader className="p-4 border-b flex-shrink-0">
        <div className="flex justify-between items-start">
          <div className="flex-grow min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
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
            <CardTitle className="text-xl font-semibold line-clamp-3">{selectedPost.question}</CardTitle>
            <CardDescription className="text-sm pt-1">
              Posted by: <Link href={postAuthorProfileLink} className="text-primary hover:underline">{postAuthorMentionName}</Link> on {postDate}
              {selectedPost.requestType === 'help_request' && selectedPost.deadline && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Deadline: {selectedPost.deadline instanceof Date ? selectedPost.deadline.toLocaleDateString() : 'N/A'}
                </span>
              )}
              {selectedPost.ratingScore != null && (
                <span className="ml-2 inline-flex items-center text-xs text-muted-foreground">
                  <Star className={cn("h-3.5 w-3.5 mr-1", selectedPost.ratingScore > 0 ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground")} />
                  {selectedPost.ratingScore.toFixed(1)}/5
                </span>
              )}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close post details" className="flex-shrink-0 ml-2">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <ScrollArea className="flex-grow bg-background">
        <CardContent className="p-4 space-y-4">
          {selectedPost.imageUrls && selectedPost.imageUrls.length > 0 && (
            <div className="mb-4 rounded-lg overflow-hidden shadow-md">
              <Carousel className="w-full">
                <CarouselContent>
                  {selectedPost.imageUrls.map((url, index) => (
                    <CarouselItem key={index}>
                      <div className="aspect-video relative">
                        <Image
                          src={url} alt={`Post image ${index + 1}`} fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          style={{ objectFit: 'contain' }} className="rounded-md"
                          data-ai-hint={selectedPost.tags && selectedPost.tags.length > 0 ? selectedPost.tags.slice(0,2).join(' ') : 'abstract'}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {selectedPost.imageUrls.length > 1 && (
                  <> <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2" /> <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2" /> </>
                )}
              </Carousel>
            </div>
          )}

          {selectedPost.requestType === 'help_request' ? (
            <div className="mt-4">
               <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 border-b-2 border-border rounded-none h-auto">
                     <TabsTrigger value="details" className={cn("text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0")}>Problem Details</TabsTrigger>
                     <TabsTrigger value="tried" disabled={!selectedPost.descriptionTried} className={cn("text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0")}>What I've Tried</TabsTrigger>
                     <TabsTrigger value="outcome" disabled={!selectedPost.descriptionOutcome} className={cn("text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0")}>Expected Outcome</TabsTrigger>
                  </TabsList>
                  <TabsContent value="details" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[100px]">
                    {selectedPost.descriptionDetails ? (<p className="text-muted-foreground whitespace-pre-wrap"><TextWithMentions text={selectedPost.descriptionDetails} mentionedUserIds={selectedPost.mentionedUserIds || []} /></p>) : (<p className="text-muted-foreground italic">No details provided.</p>)}
                  </TabsContent>
                  {selectedPost.descriptionTried && (<TabsContent value="tried" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[100px]"><p className="text-muted-foreground whitespace-pre-wrap">{selectedPost.descriptionTried}</p></TabsContent>)}
                  {selectedPost.descriptionOutcome && (<TabsContent value="outcome" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[100px]"><p className="text-muted-foreground whitespace-pre-wrap">{selectedPost.descriptionOutcome}</p></TabsContent>)}
                </Tabs>
            </div>
          ) : (
            selectedPost.description && (<div><strong className="text-foreground">Details:</strong><p className="text-muted-foreground mt-1 whitespace-pre-wrap"><TextWithMentions text={selectedPost.description} mentionedUserIds={selectedPost.mentionedUserIds || []} /></p></div>)
          )}

          <div className="grid grid-cols-1 gap-y-2 mt-4 border-t pt-4">
            <div> <strong className="block text-foreground">Sector:</strong> <span className="text-muted-foreground">{selectedPost.sector || 'N/A'}</span> </div>
            {selectedPost.subSector && (<div> <strong className="block text-foreground">Sub-Sector:</strong> <span className="text-muted-foreground">{selectedPost.subSector}</span> </div>)}
            {selectedPost.industry && (<div> <strong className="block text-foreground">Industry:</strong> <span className="text-muted-foreground">{selectedPost.industry}</span> </div>)}
            {selectedPost.naicsCode && (<div> <strong className="block text-foreground">NAICS Code:</strong> <Badge variant="outline" className="text-xs ml-1">{selectedPost.naicsCode}</Badge> </div>)}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 border-t pt-4">
            <div> <strong className="block text-foreground">Business Type:</strong> <span className="text-muted-foreground">{selectedPost.businessType || 'N/A'}</span> </div>
            <div className="flex items-center gap-2"> <strong className="text-foreground">Safety Indicator:</strong> <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", selectedPost.safetyIndicator === 'High' ? "bg-primary text-primary-foreground" : selectedPost.safetyIndicator === 'Medium' ? "bg-secondary text-secondary-foreground" : "bg-destructive text-destructive-foreground")}>{selectedPost.safetyIndicator || 'N/A'}</span> </div>
          </div>

           {selectedPost.requestType === 'help_request' && (
            <div className="mt-6 border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-md font-semibold flex items-center gap-2"> <DollarSign className="h-5 w-5 text-green-600" /> Bids ({user && !isLoadingBids ? bids.length : '...'}) </h4>
                <p className="text-xs text-muted-foreground">
                  Minimum bid: <span className="font-semibold text-primary">{isLoadingBids ? '...' : (minimumBidAmount !== null ? `$${minimumBidAmount.toLocaleString()}` : 'N/A')}</span>
                </p>
              </div>
              {isLoadingBids && user ? ( <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading bids...</div>
              ) : !user ? ( <p className="text-sm text-muted-foreground text-center py-4"> <Link href="/login" className="text-primary hover:underline">Log in</Link> to view or place bids. </p>
              ) : bids.length === 0 ? ( <p className="text-sm text-muted-foreground">No bids placed yet.</p>
              ) : (
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
              )}
            </div>
          )}

          <div className="mt-6 border-t pt-4">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2"> <MessageCircle className="h-5 w-5 text-primary" /> Comments ({user && !isLoadingComments ? comments.length : '...'}) </h4>
            {isLoadingComments && user ? ( <div className="space-y-4"> <div className="h-16 w-full bg-muted rounded animate-pulse"></div> <div className="h-16 w-full bg-muted rounded animate-pulse"></div> </div>
            ) : !user ? ( <p className="text-sm text-muted-foreground text-center py-4"> <Link href="/login" className="text-primary hover:underline">Log in</Link> to view and add comments. </p>
            ) : comments.length === 0 ? ( <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id} comment={comment} currentUserId={user?.uid ?? null} postId={selectedPost!.id}
                    onDelete={handleCommentDeleted}
                    postAuthorId={selectedPost.userId}
                    replyingTo={replyingTo} onSetReplyingTo={setReplyingTo}
                    activeReplyInputFor={activeReplyInputFor} onSetActiveReplyInputFor={setActiveReplyInputFor}
                  />
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
                        ref={newCommentInputRef} type="text" placeholder="Add a comment... (@mention someone)" value={newComment}
                        onChange={handleNewCommentInputChange} onFocus={handleNewCommentInputFocus}
                        disabled={!user || addCommentMutation.isPending} className="flex-grow bg-background"
                        aria-label="New comment input" autoComplete="off"
                    />
                    <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" disabled={!newComment.trim() || !user || addCommentMutation.isPending}> {addCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />} <span className="sr-only">Send Comment</span> </Button>
                  </form>
                </PopoverTrigger>
                 <PopoverContent ref={newCommentSuggestionsPopoverRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="top" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    {filteredNewCommentSuggestions.map(profile => {
                       const displayableName = profile.companyName || profile.actualDisplayName || profile.mentionName;
                       const showSecondaryNameLine = (profile.companyName || profile.actualDisplayName) && (profile.companyName || profile.actualDisplayName)!.toLowerCase() !== profile.mentionName.toLowerCase();
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

           {user && selectedPost.requestType === 'help_request' && selectedPost.userId !== user.uid && selectedPost.maxBudget != null && (
            <div className="pt-3 space-y-3">
                <div className="flex items-end gap-2"> {/* Use items-end to align buttons with input */}
                    <div className="flex-grow space-y-2">
                        <Label htmlFor="inlineBidAmountSheet" className="text-xs font-medium flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5 text-green-500"/> Your Bid (USD)
                        </Label>
                        <Input
                            id="inlineBidAmountSheet" type="number" placeholder={`0 - ${selectedPost.maxBudget.toLocaleString()}`} value={inlineBidAmount}
                            onChange={handleInlineBidChange}
                            className={cn("h-9 text-sm w-full bg-background", inlineBidError && "border-destructive ring-destructive focus-visible:ring-destructive")}
                            disabled={isProcessingOffer} min="0" max={selectedPost.maxBudget} step="0.01"
                        />
                         {inlineBidError && (<p className="text-xs text-destructive mt-1 text-left">{inlineBidError}</p>)}
                    </div>
                    <TooltipProvider>
                        <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="default" size="sm" onClick={handleOfferHelpAndBid}
                                    disabled={isProcessingOffer || !!inlineBidError || inlineBidAmount === "" || !user}
                                    className="bg-green-600 hover:bg-green-700 text-white h-9 flex-shrink-0 px-3"
                                >
                                    {isProcessingOffer ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <HandHelping className="mr-1.5 h-4 w-4" />}
                                    Offer Help
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
                <div className="flex items-center gap-2 mt-2">
                    <Button variant="outline" size="xs" className="h-7 text-xs px-2" onClick={() => { setInlineBidAmount("0"); setInlineBidError(null); }}>Bid FREE</Button>
                    {/* Removed Half and Max preset bid buttons */}
                </div>
            </div>
          )}
          {user && (selectedPost.requestType !== 'help_request' || selectedPost.userId === user.uid || selectedPost.maxBudget == null) && (
            <div className="flex justify-end gap-2 pt-1">
              {selectedPost.userId && user.uid !== selectedPost.userId && (
                <Button variant="outline" size="sm" onClick={() => { if (user && selectedPost && selectedPost.userId) { findOrCreateConversation(user.uid, selectedPost.userId, selectedPost.id).then(conversationId => { if (conversationId) router.push(`/contracts?conversationId=${conversationId}&postId=${selectedPost.id}`); }).catch(err => toast({ variant: "destructive", title: "Failed to start conversation", description: err.message })); } }} disabled={!user}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Start Conversation
                </Button>
              )}
              {selectedPost.userId && user.uid !== selectedPost.userId && (
                <ConnectionButton targetUserId={selectedPost.userId} targetUserName={generateAnonymousName(selectedPost.userId)} size="sm" />
              )}
              {user && selectedPost.userId === user.uid && (
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={onDelete && typeof onDelete !== 'function'}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Post
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete your post.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel disabled={false}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(selectedPost.id)} disabled={false} className="bg-destructive hover:bg-destructive/90">Continue</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
    </TooltipProvider>
  );
});
PostDetailPanel.displayName = "PostDetailPanel";

export default PostDetailPanel;
