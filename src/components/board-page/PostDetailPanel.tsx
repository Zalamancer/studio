
// Tip: If this component becomes too large or complex,
// consider further splitting its internal sections (like Bidding, Comments, etc.)
// into their own dedicated components within this 'board-page' sub-directory.
// This file can then act as a bridge, importing and orchestrating these smaller components.
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Post } from '@/types/post';
import type { User as FirebaseUser } from 'firebase/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send, DollarSign, HandHelping, User, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import { IS_VALID_FIREBASE_UID_REGEX as IS_UID_REGEX_COMPONENT } from '@/lib/utils';
import { extractMentionedUids } from '@/lib/mentionUtils';
import { addCommentToPost, getCommentsForPost } from '@/services/commentService';
import type { NewCommentData, ClientComment } from '@/types/comment';
import { fetchUserProfileBasic, getSuggestibleUsers, getConnectionStatus } from '@/services/connectionService';
import type { UserProfileBasic, ConnectionStatus } from '@/types/connection';
import { addBidToPost, getBidsForPost } from '@/services/bidService';
import type { ClientBid, NewBidData } from '@/types/bid';
import { findOrCreateConversation } from '@/services/messagingService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { PostDetailHeader } from './PostDetailHeader';
import { PostDetailContentBody } from './PostDetailContentBody';
// PostDetailBidding is integrated below
import { PostDetailComments } from './PostDetailComments';
// PostDetailActions was removed


interface PostDetailPanelProps {
  post: Post;
  currentUser: FirebaseUser | null;
  onClose: () => void;
  onDelete: (postId: string) => void;
  deletePostMutationIsPending: boolean;
}

export const PostDetailPanel: React.FC<PostDetailPanelProps> = React.memo(({
  post,
  currentUser,
  onClose,
  onDelete,
  deletePostMutationIsPending,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();
  const user = currentUser; // Alias for clarity

  // State for New Comment Input
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);

  // State for Inline Bidding
  const [inlineBidAmount, setInlineBidAmount] = useState<string>("");
  const [inlineBidError, setInlineBidError] = useState<string | null>(null);
  const [isProcessingOffer, setIsProcessingOffer] = useState(false);

  // Debounce mention query for new comments
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNewCommentMentionQuery(newCommentMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);

  const { data: generalSuggestibleUsers = [], isLoading: isLoadingGeneralSuggestions } = useQuery<UserProfileBasic[]>({
    queryKey: ['generalSuggestibleUsersForPanel', post?.id, user?.uid, debouncedNewCommentMentionQuery],
    queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, debouncedNewCommentMentionQuery ? 10 : 25),
    enabled: !!post && !!user && showNewCommentSuggestions,
    staleTime: 1000 * 60 * 5,
  });
  
  const newCommentMentionProfilesMap = useMemo(() => {
    const map = new Map<string, UserProfileBasic>();
    if (generalSuggestibleUsers) {
      generalSuggestibleUsers.forEach(profile => {
        if (profile.userId !== user?.uid) {
           map.set(profile.userId, profile);
        }
      });
    }
    return map;
  }, [generalSuggestibleUsers, user?.uid]);


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
      if (post) {
        queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
        queryClient.invalidateQueries({ queryKey: ['posts'] }); 
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Comment Failed", description: `Could not add comment: ${error.message}.` });
    },
    onSettled: () => setIsSubmittingComment(false),
  });

  const handleCommentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !post || !newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);

    const profilesToSearch = generalSuggestibleUsers || [];
    const finalMentionedUids = extractMentionedUids(newComment.trim(), profilesToSearch);

    const commentData: NewCommentData & { postId: string } = {
      postId: post.id,
      userId: user.uid,
      text: newComment.trim(),
      mentionName: generateAnonymousName(user.uid),
      mentionedUserIds: finalMentionedUids,
      likeCount: 0,
      likedBy: [],
    };
    addCommentMutation.mutate(commentData);
  }, [user, post, newComment, isSubmittingComment, generalSuggestibleUsers, addCommentMutation, toast, queryClient]);


  const evaluateNewCommentMentionState = useCallback((text: string, cursorPosition: number) => {
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
      const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(potentialQuery) && !/\r\n|\r|\n/.test(potentialQuery)) {
        activeQuery = potentialQuery;
      }
    }
    setNewCommentMentionQuery(activeQuery !== null ? activeQuery : '');
    setShowNewCommentSuggestions(activeQuery !== null);
  }, [setNewCommentMentionQuery, setShowNewCommentSuggestions]);

  const handleNewCommentInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    if (newCommentInputRef.current) {
      evaluateNewCommentMentionState(value, newCommentInputRef.current.selectionStart || 0);
    }
  }, [evaluateNewCommentMentionState, setNewComment, newCommentInputRef]);

  const handleNewCommentInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (newCommentInputRef.current) {
      evaluateNewCommentMentionState(e.target.value, newCommentInputRef.current.selectionStart || 0);
    }
  }, [evaluateNewCommentMentionState, newCommentInputRef]);

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
  }, [newComment, setNewComment, setShowNewCommentSuggestions, setNewCommentMentionQuery, newCommentInputRef]);

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
    if (showNewCommentSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNewCommentSuggestions, newCommentSuggestionsPopoverRef, newCommentInputRef]);
  
  const filteredNewCommentSuggestions = useMemo(() => {
    if (!showNewCommentSuggestions) return [];
    if (isLoadingGeneralSuggestions && debouncedNewCommentMentionQuery) {
      return [{ userId: 'loading-main-comment', mentionName: 'loading-main-comment', displayName: 'Loading users...' } as UserProfileBasic];
    }
    
    let source = generalSuggestibleUsers || [];
    if (debouncedNewCommentMentionQuery.trim() === '') {
       // Show all fetched generalSuggestibleUsers if no query
    } else {
      const queryLower = debouncedNewCommentMentionQuery.toLowerCase();
      source = source.filter(p => 
        p.mentionName.toLowerCase().includes(queryLower) ||
        (p.displayName && p.displayName.toLowerCase().includes(queryLower))
      );
    }
    if (source.length === 0 && debouncedNewCommentMentionQuery.trim() !== '') return [{ userId: 'no-match-main-comment', mentionName: 'no-match-main-comment', displayName: `No users matching "@${debouncedNewCommentMentionQuery}"` } as UserProfileBasic];
    if (source.length === 0) return [{ userId: 'no-users-main-comment', mentionName: 'no-users-main-comment', displayName: 'No users to suggest.' } as UserProfileBasic];
    return source.slice(0, 10);
  }, [showNewCommentSuggestions, isLoadingGeneralSuggestions, generalSuggestibleUsers, debouncedNewCommentMentionQuery]);

  // Bidding Logic
  const { data: bids = [], isLoading: isLoadingBids } = useQuery<ClientBid[], Error>({
    queryKey: ['bids', post?.id],
    queryFn: () => post ? getBidsForPost(post.id) : Promise.resolve([]),
    enabled: !!post && post.requestType === 'help_request' && !!user,
  });

  const addBidMutation = useMutation({
    mutationFn: addBidToPost,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bids', variables.postId] });
      toast({ title: "Bid Process Initiated" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Bid Failed", description: error.message });
    },
    onSettled: () => setIsProcessingOffer(false)
  });

  const currentUserHasBid = useMemo(() => {
    if (!user || !bids || bids.length === 0) return false;
    return bids.some(bid => bid.bidderId === user.uid);
  }, [user, bids]);

  const currentUserBid = useMemo(() => {
    if (!currentUserHasBid || !user) return null;
    return bids.find(bid => bid.bidderId === user.uid);
  }, [currentUserHasBid, user, bids]);

  const minimumBidAmount = useMemo(() => {
    if (!bids || bids.length === 0) return null;
    return Math.min(...bids.map(bid => bid.bidAmount));
  }, [bids]);

  const handleInlineBidChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInlineBidAmount(value);
    if (value === "") {
      setInlineBidError(null);
      return;
    }
    const numValue = parseFloat(value);
    if (post?.maxBudget == null) {
        setInlineBidError("Max budget not set for this request.");
        return;
    }
    if (isNaN(numValue)) setInlineBidError("Please enter a valid number.");
    else if (numValue < 0) setInlineBidError("Bid cannot be negative.");
    else if (numValue > post.maxBudget) {
      setInlineBidError(`Bid cannot exceed max budget of $${post.maxBudget.toLocaleString()}.`);
    } else {
      setInlineBidError(null);
    }
  }, [post?.maxBudget, setInlineBidAmount, setInlineBidError]);

  const handleOfferHelpAndBid = useCallback(async () => {
    if (!user || !post || isProcessingOffer || post.userId === user.uid || post.maxBudget == null) {
      toast({ variant: "destructive", title: "Action Not Allowed", description: "Cannot perform this action at the moment." });
      return;
    }
    setIsProcessingOffer(true);

    let parsedBidAmount: number;
    if (inlineBidAmount.trim() === "") {
      toast({ variant: "destructive", title: "Bid Required", description: "Please enter a bid amount or click 'Bid FREE'."});
      setIsProcessingOffer(false);
      return;
    }
    parsedBidAmount = parseFloat(inlineBidAmount);

    if (isNaN(parsedBidAmount) || parsedBidAmount < 0 || parsedBidAmount > post.maxBudget) {
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
        toast({ title: "Bid Placed & Conversation Ready", description: "Redirecting to Messages..." });
        router.push(`/contracts?conversationId=${conversationId}&postId=${post.id}&initialBidAmount=${parsedBidAmount}`);
        setInlineBidAmount("");
        setInlineBidError(null);
        if (onClose) onClose();
      } else {
        throw new Error("Failed to initiate conversation after bid.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action Failed", description: error.message || "Could not place bid or start conversation." });
    } finally {
      setIsProcessingOffer(false);
    }
  }, [user, post, isProcessingOffer, inlineBidAmount, addBidMutation, router, toast, onClose, queryClient, setInlineBidError]);

  const { data: connectionStatus } = useQuery<ConnectionStatus | null>({
    queryKey: ['connectionStatus', user?.uid, post?.userId],
    queryFn: () => (user && post?.userId && IS_UID_REGEX_COMPONENT.test(post.userId)) ? getConnectionStatus(user.uid, post.userId) : Promise.resolve(null),
    enabled: !!user && !!post?.userId && user.uid !== post.userId && IS_UID_REGEX_COMPONENT.test(post.userId),
  });

  if (!post) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const showBiddingUI = post.requestType === 'help_request' && user && post.userId !== user.uid && post.maxBudget != null;
  const halfPrice = useMemo(() => post.maxBudget ? Math.floor(post.maxBudget / 2) : 0, [post.maxBudget]);


  return (
    <TooltipProvider>
      <Card className="flex flex-col flex-1 overflow-hidden sticky top-20 h-[calc(100vh-6.5rem)] max-h-[calc(100vh-6.5rem)] border-border rounded-lg shadow-xl bg-card">
        <PostDetailHeader
          post={post}
          currentUser={user}
          onClose={onClose}
          onDelete={() => onDelete(post.id)}
          deletePostMutationIsPending={deletePostMutationIsPending}
          connectionStatus={connectionStatus}
        />
        <ScrollArea className="flex-grow bg-background">
          <PostDetailContentBody post={post} />
          {showBiddingUI && !currentUserHasBid && (
            <div className="px-4 pt-4 mt-4 border-t">
              <div className="flex justify-between items-center mb-3">
                 <h4 className="text-md font-semibold flex items-center gap-2">
                     <DollarSign className="h-5 w-5 text-green-600" /> Bids ({isLoadingBids ? '...' : bids.length})
                 </h4>
                  <span className="text-xs text-muted-foreground font-normal">
                    Min. bid: {bids.length > 0 && minimumBidAmount !== null ? `$${minimumBidAmount.toLocaleString()}` : 'N/A'}
                  </span>
              </div>
              {isLoadingBids ? (
                <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading bids...</div>
              ) : bids.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No bids placed yet. Be the first!</p>
              ) : (
                <div className="max-h-32 space-y-2 pr-1 overflow-y-auto">
                  {bids.map(bid => (
                    <Card key={bid.id} className="p-2.5 bg-muted/40 shadow-sm">
                      <div className="flex items-start gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={bid.bidderAvatar} alt={bid.bidderName} />
                          <AvatarFallback className="text-xs">{getInitials(bid.bidderName || 'U')}</AvatarFallback>
                        </Avatar>
                        <div className="flex-grow min-w-0">
                          <div className="flex justify-between items-center">
                            <p className="text-xs font-medium text-foreground truncate">{bid.bidderName}</p>
                            <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">{formatDistanceToNow(new Date(bid.timestamp), { addSuffix: true })}</p>
                          </div>
                          <p className="text-sm font-semibold text-primary">${bid.bidAmount.toLocaleString()}</p>
                          {bid.bidMessage && <p className="text-xs text-muted-foreground mt-0.5 break-words">{bid.bidMessage}</p>}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
          {currentUserHasBid && currentUserBid && showBiddingUI && (
             <div className="px-4 pt-4 mt-4 border-t">
                <h4 className="text-md font-semibold mb-1">Your Current Bid</h4>
                <Card className="p-3 bg-primary/10 border-primary/30">
                    <p className="text-lg font-bold text-primary">${currentUserBid.bidAmount.toLocaleString()}</p>
                    {currentUserBid.bidMessage && <p className="text-sm text-muted-foreground mt-1">{currentUserBid.bidMessage}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                        Placed: {formatDistanceToNow(new Date(currentUserBid.timestamp), { addSuffix: true })}
                    </p>
                    {/* Add "Update Bid" / "Retract Bid" buttons here if needed in future */}
                </Card>
            </div>
          )}
          <PostDetailComments post={post} currentUser={user} />
        </ScrollArea>

        <CardFooter className="p-3 border-t bg-card flex-shrink-0 flex-col items-stretch gap-2">
          {/* Bidding Controls in Footer */}
          {showBiddingUI && !currentUserHasBid && (
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => { setInlineBidAmount("0"); setInlineBidError(null); }}
                  disabled={isProcessingOffer}
                  className="h-7 px-2 text-xs"
                >
                  Bid FREE
                </Button>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-grow space-y-1">
                  <Label htmlFor={`inlineBidAmount-${post.id}`} className="text-xs font-medium">
                    Your Bid (0 - ${post.maxBudget!.toLocaleString()})
                  </Label>
                  <Input
                    id={`inlineBidAmount-${post.id}`}
                    type="number"
                    placeholder="Custom amount"
                    value={inlineBidAmount}
                    onChange={handleInlineBidChange}
                    className={cn("h-8 text-sm w-full bg-background", inlineBidError && "border-destructive ring-destructive focus-visible:ring-destructive")}
                    disabled={isProcessingOffer}
                    min="0"
                    max={post.maxBudget!}
                    step="any"
                  />
                </div>
                <TooltipProvider>
                  <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleOfferHelpAndBid}
                        disabled={isProcessingOffer || !!inlineBidError || inlineBidAmount.trim() === "" || !user}
                        className="bg-green-600 hover:bg-green-700 text-white h-8 flex-shrink-0 px-3"
                      >
                        {isProcessingOffer ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <HandHelping className="mr-1.5 h-4 w-4" />}
                        Offer Help & Submit Bid
                      </Button>
                    </TooltipTrigger>
                    {(!!inlineBidError || inlineBidAmount.trim() === "" || !user) && (
                      <TooltipContent side="top" className="bg-destructive text-destructive-foreground text-xs p-1.5">
                        <p>{!user ? "Log in to offer help" : (inlineBidError || "Please enter a valid bid amount.")}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
              {inlineBidError && (<p className="text-xs text-destructive mt-1 text-left">{inlineBidError}</p>)}
            </div>
          )}

          {showBiddingUI && currentUserHasBid && (
             <div className="pt-1">
                 <TooltipProvider>
                     <Tooltip delayDuration={100}>
                         <TooltipTrigger asChild>
                             <Button
                                 variant="default"
                                 size="sm"
                                 onClick={handleOfferHelpAndBid} // Should actually be handleStartChatAfterBid or similar
                                 disabled={isProcessingOffer || !user}
                                 className="bg-green-600 hover:bg-green-700 text-white h-9 w-full"
                             >
                                 {isProcessingOffer ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />}
                                 Message About Your Bid
                             </Button>
                         </TooltipTrigger>
                         {!user && (
                             <TooltipContent side="top" className="bg-destructive text-destructive-foreground text-xs p-1.5">
                                 <p>Log in to message</p>
                             </TooltipContent>
                         )}
                     </Tooltip>
                 </TooltipProvider>
             </div>
          )}


          {/* Comment Input Area - Always visible if user is logged in */}
          {user && (
            <Popover
              open={showNewCommentSuggestions && filteredNewCommentSuggestions.length > 0 && !['loading-main-comment', 'no-users-main-comment', 'no-match-main-comment'].includes(filteredNewCommentSuggestions[0]?.userId)}
              onOpenChange={(open) => { setShowNewCommentSuggestions(open); if (!open) setNewCommentMentionQuery(''); }}
            >
              <PopoverTrigger asChild>
                <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 w-full pt-2">
                  <Input
                    ref={newCommentInputRef}
                    type="text"
                    placeholder="Add a comment... (@mention someone)"
                    value={newComment}
                    onChange={handleNewCommentInputChange}
                    onFocus={handleNewCommentInputFocus}
                    onKeyDownCapture={(e) => {
                      if (showNewCommentSuggestions && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
                        if (e.key !== 'Escape') e.preventDefault();
                      }
                    }}
                    onBlurCapture={() => setTimeout(() => {
                      if (newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(document.activeElement as Node) && newCommentInputRef.current !== document.activeElement) {
                        if (showNewCommentSuggestions) setShowNewCommentSuggestions(false);
                      }
                    }, 150)}
                    disabled={!user || isSubmittingComment}
                    className="flex-grow bg-background h-9 text-sm"
                    aria-label="New comment input"
                    autoComplete="off"
                  />
                  <Button type="submit" size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0" disabled={!newComment.trim() || !user || isSubmittingComment}>
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
                  const displayableName = profile.companyName || profile.mentionName;
                  const showSecondaryNameLine = profile.companyName && profile.companyName.toLowerCase() !== profile.mentionName.toLowerCase();
                  
                  return (
                    (profile.userId === 'loading-main-comment' || profile.userId === 'no-users-main-comment' || profile.userId === 'no-match-main-comment') ? (
                      <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>
                    ) : (
                      <Button
                        key={profile.userId}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-auto px-2 py-1 text-xs"
                        onMouseDown={(e) => e.preventDefault()} 
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
          )}
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
});

PostDetailPanel.displayName = "PostDetailPanel";
```

I've removed the trailing backticks and corrected the default export name in `src/components/board-page/PostDetailPanel.tsx`. The file should now parse correctly.