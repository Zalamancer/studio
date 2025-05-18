// src/components/connect/ConnectionRequestItem.tsx
'use client';

import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, UserCheck, UserX } from 'lucide-react';
import type { ConnectionRequest } from '@/types/connection';
import { acceptConnectionRequest, rejectOrCancelConnectionRequest } from '@/services/connectionService';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
// Removed: import { generateAnonymousName } from '@/lib/pseudonymUtils';

interface ConnectionRequestItemProps {
  request: ConnectionRequest;
  currentUserId: string;
  onAction: () => void;
}

const getInitials = (displayNameOrUid: string | undefined | null): string => {
    if (!displayNameOrUid) return '?';
    if (displayNameOrUid.startsWith('@')) { // Handle "@UID" format
        return displayNameOrUid.length > 1 ? displayNameOrUid.charAt(1).toUpperCase() : '?';
    }
    const names = displayNameOrUid.split(' ');
    if (names.length === 1) return names[0].substring(0, 1).toUpperCase();
    return (names[0].substring(0, 1) + names[names.length - 1].substring(0, 1)).toUpperCase();
};


export const ConnectionRequestItem: React.FC<ConnectionRequestItemProps> = ({
  request,
  currentUserId,
  onAction,
}) => {
  const { toast } = useToast();
  const [isLoadingAccept, setIsLoadingAccept] = useState(false);
  const [isLoadingReject, setIsLoadingReject] = useState(false);
  const displayName = request.requesterDisplayName || `@${request.requesterId}`;

  const handleAccept = async () => {
    setIsLoadingAccept(true);
    try {
      await acceptConnectionRequest(request.connectionId, currentUserId);
      toast({ title: "Request Accepted", description: `You are now connected with ${displayName}.` });
      onAction();
    } catch (error: any) {
      console.error("Error accepting request:", error);
      toast({ variant: "destructive", title: "Error", description: `Could not accept request: ${error.message}` });
    } finally {
      setIsLoadingAccept(false);
    }
  };

  const handleReject = async () => {
    setIsLoadingReject(true);
    try {
      await rejectOrCancelConnectionRequest(request.connectionId, currentUserId);
      toast({ title: "Request Rejected", description: `Connection request from ${displayName} rejected.` });
      onAction();
    } catch (error: any) {
      console.error("Error rejecting request:", error);
      toast({ variant: "destructive", title: "Error", description: `Could not reject request: ${error.message}` });
    } finally {
      setIsLoadingReject(false);
    }
  };

  const timeAgo = request.requestedAt ? formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true }) : '';

  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
      <div className="flex items-center gap-3 flex-grow min-w-0">
        <Link href={`/profile/${request.requesterId}`} passHref>
          <Avatar className="h-10 w-10 cursor-pointer">
            <AvatarImage src={request.requesterAvatarUrl} alt={displayName} />
            <AvatarFallback className="bg-secondary text-secondary-foreground">{getInitials(displayName)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-grow min-w-0">
          <Link href={`/profile/${request.requesterId}`} passHref>
             <p className="text-sm font-medium text-foreground truncate hover:underline cursor-pointer">{displayName}</p>
          </Link>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0 ml-2">
        <Button
          size="sm"
          variant="default"
          onClick={handleAccept}
          disabled={isLoadingAccept || isLoadingReject}
          aria-label={`Accept connection request from ${displayName}`}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isLoadingAccept ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
          <span className="hidden sm:inline ml-1">Accept</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReject}
          disabled={isLoadingAccept || isLoadingReject}
          aria-label={`Reject connection request from ${displayName}`}
        >
          {isLoadingReject ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
           <span className="hidden sm:inline ml-1">Reject</span>
        </Button>
      </div>
    </div>
  );
};
