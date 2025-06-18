// src/components/board-page/PostDetailBidding.tsx
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
// ScrollArea is removed as it's no longer used directly here
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, DollarSign } from 'lucide-react';
import type { ClientBid } from '@/types/bid';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import { formatDistanceToNow } from 'date-fns';
import type { User as FirebaseUser } from 'firebase/auth';

interface PostDetailBiddingDisplayProps {
  bids: ClientBid[];
  isLoadingBids: boolean;
  currentUser: FirebaseUser | null;
  postMaxBudget?: number | null;
  minimumBidAmount?: number | null;
}

export const PostDetailBiddingDisplay: React.FC<PostDetailBiddingDisplayProps> = React.memo(({
  bids,
  isLoadingBids,
  currentUser,
  postMaxBudget,
  minimumBidAmount,
}) => {
  return (
    <div className="space-y-3"> {/* Changed from ScrollArea to a simple div with spacing */}
      {isLoadingBids && currentUser ? (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading bids...
        </div>
      ) : !currentUser ? (
        <p className="text-sm text-muted-foreground text-center py-4">Login to view or place bids.</p>
      ) : bids.length === 0 && !isLoadingBids ? (
        <p className="text-sm text-muted-foreground">No bids placed yet. Be the first!</p>
      ) : (
        // The div with space-y-3 directly contains the bid cards
        bids.map(bid => (
          bid && bid.bidderId ? (
            <Card key={bid.id} className="p-3 bg-muted/30 shadow-sm">
              <div className="flex items-start gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={bid.bidderAvatar} alt={bid.bidderName || generateAnonymousName(bid.bidderId)} />
                  <AvatarFallback className="text-xs">{getInitials(bid.bidderName || generateAnonymousName(bid.bidderId))}</AvatarFallback>
                </Avatar>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-medium text-foreground truncate">{bid.bidderName || generateAnonymousName(bid.bidderId)}</p>
                    <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {bid.timestamp ? formatDistanceToNow(new Date(bid.timestamp), { addSuffix: true }) : 'just now'}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-primary">${bid.bidAmount.toLocaleString()}</p>
                  {bid.bidMessage && <p className="text-xs text-muted-foreground mt-0.5 break-words">{bid.bidMessage}</p>}
                </div>
              </div>
            </Card>
          ) : null
        ))
      )}
    </div>
  );
});

PostDetailBiddingDisplay.displayName = 'PostDetailBiddingDisplay';
export { PostDetailBiddingDisplay as PostDetailBidding };

