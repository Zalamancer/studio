
// src/components/board-page/PostDetailBidding.tsx
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from "@/components/ui/card"; // Assuming CardContent for bid items
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DollarSign, HandHelping, Loader2, Info } from 'lucide-react';
import type { Post } from '@/types/post';
import type { User as FirebaseUser } from 'firebase/auth';
import type { ClientBid, NewBidData } from '@/types/bid';
import { addBidToPost, getBidsForPost } from '@/services/bidService';
import { findOrCreateConversation } from '@/services/messagingService';
import { useToast } from '@/hooks/use-toast';
import { getInitials } from '@/lib/pseudonymUtils';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface PostDetailBiddingProps {
  post: Post;
  currentUser: FirebaseUser | null;
  onClosePanel: () => void;
}

export const PostDetailBidding: React.FC<PostDetailBiddingProps> = React.memo(({ post, currentUser, onClosePanel }) => {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [inlineBidAmount, setInlineBidAmount] = useState<string>("");
  const [inlineBidError, setInlineBidError] = useState<string | null>(null);
  const [isProcessingOffer, setIsProcessingOffer] = useState(false);

  const { data: bids = [], isLoading: isLoadingBids } = useQuery<ClientBid[], Error>({
    queryKey: ['bids', post.id],
    queryFn: () => getBidsForPost(post.id),
    enabled: !!post && post.requestType === 'help_request' && !!currentUser,
  });

  const addBidMutation = useMutation({
    mutationFn: addBidToPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bids', post.id] });
      toast({ title: "Bid Placed Successfully" });
      // Do not clear inlineBidAmount here if we redirect immediately
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Bid Failed", description: error.message });
    },
  });

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
    if (isNaN(numValue)) setInlineBidError("Please enter a valid number.");
    else if (numValue < 0) setInlineBidError("Bid cannot be negative.");
    else if (post.maxBudget != null && numValue > post.maxBudget) {
      setInlineBidError(`Bid cannot exceed max budget of $${post.maxBudget.toLocaleString()}.`);
    } else {
      setInlineBidError(null);
    }
  }, [post.maxBudget]);

  const handleOfferHelpAndBid = useCallback(async () => {
    if (!currentUser || !post || post.userId === currentUser.uid || post.requestType !== 'help_request' || isProcessingOffer) {
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
      bidderId: currentUser.uid,
      bidAmount: parsedBidAmount,
      bidMessage: `Bid placed: $${parsedBidAmount.toLocaleString()}`,
    };

    try {
      await addBidMutation.mutateAsync(bidDetails);
      const conversationId = await findOrCreateConversation(currentUser.uid, post.userId, post.id);
      if (conversationId) {
        toast({ title: "Bid Placed & Conversation Started", description: "Redirecting to Messages..." });
        router.push(`/contracts?conversationId=${conversationId}&postId=${post.id}&initialMessageText=${encodeURIComponent(`My bid for your request '${post.question.substring(0,30)}...' is $${parsedBidAmount.toLocaleString()}. Let's discuss!`)}`);
        setInlineBidAmount(""); 
        setInlineBidError(null);
        onClosePanel();
      } else {
        throw new Error("Failed to initiate conversation after bid.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action Failed", description: error.message || "Could not place bid or start conversation." });
    } finally {
      setIsProcessingOffer(false);
    }
  }, [currentUser, post, inlineBidAmount, isProcessingOffer, addBidMutation, router, toast, queryClient, onClosePanel]);

  if (post.requestType !== 'help_request' || post.userId === currentUser?.uid || post.maxBudget == null) {
    return null; // Don't show bidding UI if not a help request, user is owner, or no maxBudget
  }

  return (
    <div className="mt-6 border-t pt-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-md font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" /> Bids ({currentUser && !isLoadingBids ? bids.length : '...'})
          <span className="text-xs text-muted-foreground font-normal ml-1">
            (Min. bid: {minimumBidAmount !== null ? `$${minimumBidAmount.toLocaleString()}` : 'N/A'})
          </span>
        </h4>
      </div>
      {isLoadingBids && currentUser ? (
        <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading bids...</div>
      ) : !currentUser ? (
        <p className="text-sm text-muted-foreground text-center py-4">Login to view or place bids.</p>
      ) : bids.length === 0 && !isLoadingBids ? (
        <p className="text-sm text-muted-foreground">No bids placed yet. Be the first!</p>
      ) : (
        <ScrollArea className="max-h-40 pr-3 mb-3">
          <div className="space-y-3">
            {bids.map(bid => (
              <Card key={bid.id} className="p-3 bg-muted/30 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-8 w-8">
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
        </ScrollArea>
      )}

      <div className="pt-3 space-y-3 mt-3 border-t">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs" onClick={() => { setInlineBidAmount("0"); setInlineBidError(null); }} disabled={isProcessingOffer}>Bid FREE</Button>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-grow space-y-1">
            <Label htmlFor={`inlineBidAmount-${post.id}`} className="text-xs font-medium flex items-center gap-1">
              Your Bid (0 - ${post.maxBudget.toLocaleString()})
            </Label>
            <Input
              id={`inlineBidAmount-${post.id}`}
              type="number"
              placeholder="Custom amount"
              value={inlineBidAmount}
              onChange={handleInlineBidChange}
              className={cn("h-9 text-sm w-full bg-background", inlineBidError && "border-destructive ring-destructive focus-visible:ring-destructive")}
              disabled={isProcessingOffer}
              min="0"
              max={post.maxBudget}
              step="0.01"
            />
          </div>
          <TooltipProvider>
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleOfferHelpAndBid}
                  disabled={isProcessingOffer || !!inlineBidError || inlineBidAmount === "" || !currentUser}
                  className="bg-green-600 hover:bg-green-700 text-white h-9 flex-shrink-0 px-3"
                >
                  {isProcessingOffer ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <HandHelping className="mr-1.5 h-4 w-4" />}
                  Offer Help
                </Button>
              </TooltipTrigger>
              {(!!inlineBidError || inlineBidAmount === "" || !currentUser) && (
                <TooltipContent side="top" className="bg-destructive text-destructive-foreground text-xs p-1.5">
                  <p>{!currentUser ? "Log in to offer help" : inlineBidError || "Please enter a valid bid amount."}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
        {inlineBidError && (<p className="text-xs text-destructive mt-1 text-left">{inlineBidError}</p>)}
      </div>
    </div>
  );
});

PostDetailBidding.displayName = 'PostDetailBidding';
