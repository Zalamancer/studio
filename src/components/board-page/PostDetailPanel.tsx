
// Tip: If this PostDetailPanel component becomes too large or complex,
// consider further splitting its internal sections (like Bidding, Comments, etc.)
// into their own dedicated components. This file can then act as a bridge,
// importing and orchestrating these smaller, more focused child components.
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Post } from '@/types/post';
import type { User as FirebaseUser } from 'firebase/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, DollarSign, HandHelping, User } from 'lucide-react'; // Added User icon for fallback
import { cn } from '@/lib/utils';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils'; // Changed from getSharedInitials
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
import { PostDetailBidding } from './PostDetailBidding';
import { PostDetailComments } from './PostDetailComments';

interface PostDetailPanelProps {
  post: Post;
  currentUser: FirebaseUser | null;
  onClose: () => void;
  onDelete: (postId: string) => void;
  // deletePostMutationIsPending is implicitly handled by the parent managing the mutation state
}

export const PostDetailPanel: React.FC<PostDetailPanelProps> = React.memo(({
  post,
  currentUser,
  onClose,
  onDelete,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();
  const user = currentUser;

  // --- State and Logic for New Comment Input ---
  const [newComment, setNewComment] = useState('');
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);

  // --- State for Inline Bidding ---
  const [inlineBidAmount, setInlineBidAmount] = useState<string>("");
  const [inlineBidError, setInlineBidError] = useState<string | null>(null);
  const [isProcessingOffer, setIsProcessingOffer] = useState(false);

  // --- Data Fetching ---
  const { data: comments = [], isLoading: isLoadingComments, refetch: refetchComments } = useQuery<ClientComment[]>({
    queryKey: ['comments', post?.id],
    queryFn: () => (post && user) ? getCommentsForPost(post.id) : Promise.resolve([]),
    enabled: !!post?.id && !!user,
  });

  const { data: bids = [], isLoading: isLoadingBids } = useQuery<ClientBid[], Error>({
    queryKey: ['bids', post?.id],
    queryFn: () => post ? getBidsForPost(post.id) : Promise.resolve([]),
    enabled: !!post && post.requestType === 'help_request' && !!user,
  });

  const { data: connectionStatus } = useQuery<ConnectionStatus | null>({
    queryKey: ['connectionStatus', user?.uid, post?.userId],
    queryFn: () => (user && post?.userId) ? getConnectionStatus(user.uid, post.userId) : Promise.resolve(null),
    enabled: !!user && !!post?.userId && user.uid !== post.userId,
  });

  // --- Mutations ---
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
      if (post) queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      if (post) queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Comment Failed", description: `Could not add comment: ${error.message}.` });
    },
  });

  const addBidMutation = useMutation({
    mutationFn: addBidToPost,
    onSuccess: () => {
      toast({ title: "Bid Placed Successfully" });
      if (post) queryClient.invalidateQueries({ queryKey: ['bids', post.id] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Bid Failed", description: error.message });
    },
  });

  // --- Mention Suggestion Logic for New Comment ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNewCommentMentionQuery(newCommentMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);

  const { data: generalSuggestibleUsersForComment = [], isLoading: isLoadingGeneralSuggestionsComment } = useQuery<UserProfileBasic[]>({
    queryKey: ['generalSuggestibleUsersForPanelComment', post?.id, user?.uid, debouncedNewCommentMentionQuery],
    queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, debouncedNewCommentMentionQuery ? 10 : 25),
    enabled: !!post && !!user && showNewCommentSuggestions,
    staleTime: 1000 * 60 * 5,
  });

  const newCommentMentionProfilesMap = useMemo(() => {
    const map = new Map<string, UserProfileBasic>();
    if (generalSuggestibleUsersForComment) {
      generalSuggestibleUsersForComment.forEach(profile => {
        if (user && profile.userId !== user.uid) {
           map.set(profile.userId, profile);
        }
      });
    }
    return map;
  }, [generalSuggestibleUsersForComment, user?.uid]);

  const filteredNewCommentSuggestions = useMemo(() => {
    if (!showNewCommentSuggestions) return [];
    if (isLoadingGeneralSuggestionsComment && debouncedNewCommentMentionQuery) return [{ userId: 'loading-main-comment', mentionName: 'loading...', displayName: 'Loading users...' } as UserProfileBasic];

    let source = Array.from(newCommentMentionProfilesMap.values());
    if (debouncedNewCommentMentionQuery.trim() === '') {
        // Suggest post author and existing commenters first for an empty query
        const relevantUserIds = new Set<string>();
        if (post?.userId && user && post.userId !== user.uid) relevantUserIds.add(post.userId);
        comments.forEach(c => { if (user && c.userId !== user.uid) relevantUserIds.add(c.userId); });
        
        const relevantProfiles = Array.from(relevantUserIds).map(uid => newCommentMentionProfilesMap.get(uid)).filter(Boolean) as UserProfileBasic[];
        source = relevantProfiles.length > 0 ? relevantProfiles : source.slice(0,5); // Fallback to first 5 general if no thread participants
    } else {
      const queryLower = debouncedNewCommentMentionQuery.toLowerCase();
      source = source.filter(p =>
        (p.mentionName && p.mentionName.toLowerCase().includes(queryLower)) ||
        (p.displayName && p.displayName.toLowerCase().includes(queryLower))
      );
    }
    if (source.length === 0 && debouncedNewCommentMentionQuery.trim() !== '') return [{ userId: 'no-match-main-comment', mentionName: 'no-match', displayName: `No users matching "@${debouncedNewCommentMentionQuery}"` } as UserProfileBasic];
    if (source.length === 0) return [{ userId: 'no-users-main-comment', mentionName: 'no-users', displayName: 'No users to suggest.' } as UserProfileBasic];
    return source.slice(0, 10);
  }, [showNewCommentSuggestions, isLoadingGeneralSuggestionsComment, newCommentMentionProfilesMap, debouncedNewCommentMentionQuery, post?.userId, comments, user]);

  // --- Event Handlers ---
  const handleCommentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !post || !newComment.trim() || addCommentMutation.isPending) return;

    const profilesToSearch = Array.from(newCommentMentionProfilesMap.values());
    if (post.userId && !profilesToSearch.find(p => p.userId === post.userId)) {
      const authorProfile = await fetchUserProfileBasic(post.userId);
      if (authorProfile) profilesToSearch.push(authorProfile);
    }
    comments.forEach(async c => {
      if (c.userId && !profilesToSearch.find(p => p.userId === c.userId)) {
        const commenterProfile = await fetchUserProfileBasic(c.userId);
        if (commenterProfile) profilesToSearch.push(commenterProfile);
      }
    });

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
  }, [user, post, newComment, addCommentMutation, newCommentMentionProfilesMap, comments, queryClient, toast]); // Added missing dependencies

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
  }, [setNewCommentMentionQuery, setShowNewCommentSuggestions]);

  const handleNewCommentInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    evaluateNewCommentMentionState(value, e.target.selectionStart || 0);
  }, [setNewComment, evaluateNewCommentMentionState]);

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
      setNewComment(`@${profile.mentionName} ${textAfterCursor}`); // Corrected: Insert from beginning of mention
      const newCursorPosition = `@${profile.mentionName} `.length;
      setTimeout(() => {
        newCommentInputRef.current?.focus();
        newCommentInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    }
    setShowNewCommentSuggestions(false);
    setNewCommentMentionQuery('');
  }, [newComment, setNewComment, setShowNewCommentSuggestions, setNewCommentMentionQuery]); // Removed newCommentInputRef from deps as ref.current can be stale

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNewCommentSuggestions && newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(event.target as Node) && newCommentInputRef.current && !newCommentInputRef.current.contains(event.target as Node)) {
        setShowNewCommentSuggestions(false);
      }
    };
    if (showNewCommentSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNewCommentSuggestions]);


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
  }, [post?.maxBudget, setInlineBidAmount, setInlineBidError]);

  const handleOfferHelpAndBid = useCallback(async () => {
    if (!user || !post || post.userId === user.uid || post.requestType !== 'help_request' || isProcessingOffer) {
      toast({ variant: "destructive", title: "Action Not Allowed", description: "Cannot perform this action." });
      return;
    }
    setIsProcessingOffer(true);

    if (inlineBidAmount === "") {
      setInlineBidError("Bid amount is required to offer help.");
      toast({ variant: "destructive", title: "Bid Required", description: "Please enter a bid amount or select 'Bid FREE'." });
      setIsProcessingOffer(false);
      return;
    }

    const parsedBidAmount = parseFloat(inlineBidAmount);
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
        router.push(`/contracts?conversationId=${conversationId}&postId=${post.id}&initialMessageText=${encodeURIComponent(`My bid for your request '${post.question.substring(0,30)}...' is $${parsedBidAmount.toLocaleString()}. Let's discuss!`)}`);
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
  }, [user, post, inlineBidAmount, isProcessingOffer, addBidMutation, router, toast, queryClient, onClose, setInlineBidError]); // Added missing dependencies


  if (!post) {
    return (
      <Card className="flex-1 flex items-center justify-center p-8 bg-card border rounded-lg shadow-xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading post...</p>
      </Card>
    );
  }

  const minimumBidAmount = useMemo(() => {
    if (!bids || bids.length === 0) return null;
    return Math.min(...bids.map(bid => bid.bidAmount));
  }, [bids]);


  return (
    <Card className="flex flex-col flex-1 overflow-hidden bg-card border-border rounded-lg shadow-xl sticky top-20 max-h-[calc(100vh-6rem)]">
      <PostDetailHeader
        post={post}
        currentUser={user}
        onClose={onClose}
        onDelete={() => onDelete(post.id)} // Pass post.id to onDelete
        connectionStatus={connectionStatus}
      />
      <ScrollArea className="flex-grow bg-background">
        <div className="p-4"> {/* Padding for scrollable content */}
          <PostDetailContentBody post={post} />
          {post.requestType === 'help_request' && post.userId !== user?.uid && post.maxBudget != null && (
             <PostDetailBidding
                post={post}
                currentUser={user}
                bids={bids}
                isLoadingBids={isLoadingBids}
                minimumBidAmount={minimumBidAmount}
                addBidMutation={addBidMutation} // Pass the mutation directly
                onClosePanel={onClose}
             />
          )}
          <PostDetailComments
            post={post}
            currentUser={user}
            comments={comments}
            isLoadingComments={isLoadingComments}
            refetchComments={refetchComments}
          />
        </div>
      </ScrollArea>

      {/* Footer for New Comment Input */}
      <CardFooter className="p-3 border-t bg-card flex-shrink-0">
        {user ? (
           <Popover
            open={showNewCommentSuggestions && filteredNewCommentSuggestions.length > 0 && (filteredNewCommentSuggestions[0]?.userId !== 'loading-main-comment' && filteredNewCommentSuggestions[0]?.userId !== 'no-users-main-comment' && filteredNewCommentSuggestions[0]?.userId !== 'no-match-main-comment')}
            onOpenChange={(open) => { setShowNewCommentSuggestions(open); if (!open) setNewCommentMentionQuery(''); }}
          >
            <PopoverTrigger asChild>
              <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 w-full">
                <Input
                  ref={newCommentInputRef}
                  type="text"
                  placeholder="Add a comment... (@mention someone)"
                  value={newComment}
                  onChange={handleNewCommentInputChange}
                  onFocus={handleNewCommentInputFocus}
                  disabled={!user || addCommentMutation.isPending}
                  className="flex-grow bg-background h-9 text-sm"
                  aria-label="New comment input"
                  autoComplete="off"
                />
                <Button type="submit" size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0" disabled={!newComment.trim() || !user || addCommentMutation.isPending}>
                  {addCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />}
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
        ) : (
          <p className="text-xs text-muted-foreground text-center w-full">
            <a href="/login" className="text-primary hover:underline">Log in</a> to add comments or bids.
          </p>
        )}
      </CardFooter>
    </Card>
  );
});

PostDetailPanel.displayName = "PostDetailPanel";
export default PostDetailPanel;
