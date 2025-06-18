
// src/components/board-page/PostDetailBidding.tsx
"use client";

import React, { useMemo } from 'react'; // Removed useState, useCallback
import { Card, CardContent } from "@/components/ui/card"; // Only CardContent used here
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, DollarSign } from 'lucide-react'; // Removed HandHelping, Info
import type { ClientBid } from '@/types/bid';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import { formatDistanceToNow } from 'date-fns';
import type { User as FirebaseUser } from 'firebase/auth'; // Keep for currentUser prop type

interface PostDetailBiddingDisplayProps {
  bids: ClientBid[];
  isLoadingBids: boolean;
  currentUser: FirebaseUser | null;
  postMaxBudget?: number | null; // Pass this for context if needed, but form is removed
  minimumBidAmount?: number | null; // Pass this for display
}

export const PostDetailBiddingDisplay: React.FC<PostDetailBiddingDisplayProps> = React.memo(({
  bids,
  isLoadingBids,
  currentUser,
  postMaxBudget, // Not directly used in display list, but kept if needed
  minimumBidAmount,
}) => {
  // Bid submission form and its logic have been moved to PostDetailPanel.tsx
  // This component now only focuses on displaying the list of bids.

  return (
    <div className="mt-0"> {/* Removed border-t and pt-4, assuming parent will handle separation */}
      {/* Header section for bids is now part of TabsTrigger in PostDetailPanel */}
      {isLoadingBids && currentUser ? (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading bids...
        </div>
      ) : !currentUser ? (
        <p className="text-sm text-muted-foreground text-center py-4">Login to view or place bids.</p>
      ) : bids.length === 0 && !isLoadingBids ? (
        <p className="text-sm text-muted-foreground">No bids placed yet. Be the first!</p>
      ) : (
        <ScrollArea className="max-h-60 pr-3 mb-0"> {/* Adjusted max-h if needed */}
          <div className="space-y-3">
            {bids.map(bid => (
              bid && bid.bidderId ? ( // Added check for bid and bidderId
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
            ))}
          </div>
        </ScrollArea>
      )}
      {/* Bid submission form is now handled by PostDetailPanel's footer */}
    </div>
  );
});

PostDetailBiddingDisplay.displayName = 'PostDetailBiddingDisplay';
// Export as PostDetailBiddingDisplay to avoid naming conflicts if old PostDetailBidding is still imported elsewhere temporarily
// Ensure imports in PostDetailPanel.tsx are updated to PostDetailBiddingDisplay
export { PostDetailBiddingDisplay as PostDetailBidding }; // Also export as PostDetailBidding for backward compatibility if needed during refactor
