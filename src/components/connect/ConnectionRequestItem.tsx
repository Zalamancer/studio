'use client';

import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, UserCheck, UserX } from 'lucide-react';
import type { ConnectionRequest } from '@/types/connection';
import { acceptConnectionRequest, rejectOrCancelConnectionRequest } from '@/services/connectionService';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns'; // For displaying time ago
import Link from 'next/link';

interface ConnectionRequestItemProps {
  request: ConnectionRequest;
  currentUserId: string;
  onAction: () => void; // Callback after action is successful
}

const getInitials = (name: string | undefined | null): string => {
  if (!name) return '?';
  const names = name.split(' ');
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

  const handleAccept = async () => {
    setIsLoadingAccept(true);
    try {
      await acceptConnectionRequest(request.connectionId, currentUserId);
      toast({ title: "Request Accepted", description: `You are now connected with ${request.requesterDisplayName}.` });
      onAction(); // Trigger refetch in parent
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
      toast({ title: "Request Rejected", description: `Connection request from ${request.requesterDisplayName} rejected.` });
      onAction(); // Trigger refetch in parent
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
        <Link href={`/profile/${request.requesterId}`}>
          <Avatar className="h-10 w-10 cursor-pointer">
            <AvatarImage src={request.requesterAvatarUrl} alt={request.requesterDisplayName} />
            <AvatarFallback className="bg-secondary text-secondary-foreground">{getInitials(request.requesterDisplayName)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-grow min-w-0">
          <Link href={`/profile/${request.requesterId}`}>
             <p className="text-sm font-medium text-foreground truncate hover:underline">{request.requesterDisplayName}</p>
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
          aria-label={`Accept connection request from ${request.requesterDisplayName}`}
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
          aria-label={`Reject connection request from ${request.requesterDisplayName}`}
        >
          {isLoadingReject ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
           <span className="hidden sm:inline ml-1">Reject</span>
        </Button>
      </div>
    </div>
  );
};
