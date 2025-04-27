'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, UserCheck, UserX, Ban, Hourglass } from 'lucide-react'; // Import icons
import { useToast } from '@/hooks/use-toast';
import {
  getConnectionStatus,
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectOrCancelConnectionRequest,
  removeConnection,
} from '@/services/connectionService';
import type { ConnectionStatus } from '@/types/connection';
import { cn } from '@/lib/utils';
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

interface ConnectionButtonProps {
  targetUserId: string;
  targetUserName?: string; // Optional name for better toasts/dialogs
  onStatusChange?: (newStatus: ConnectionStatus | null) => void; // Optional callback
  size?: 'sm' | 'default' | 'lg'; // Button size
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link'; // Button variant
  className?: string; // Additional styling
}

export const ConnectionButton: React.FC<ConnectionButtonProps> = ({
  targetUserId,
  targetUserName = 'this user',
  onStatusChange,
  size = 'sm',
  variant = 'default',
  className,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading initially
  const [isActing, setIsActing] = useState<boolean>(false); // Loading state for actions

  const currentUserId = user?.uid;
  const connectionId = currentUserId ? [currentUserId, targetUserId].sort().join('_') : null;

  // Fetch initial connection status
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      if (!currentUserId || !targetUserId) {
        setStatus('not_connected'); // Default if no user or target
        setIsLoading(false);
        return;
      }
      if (currentUserId === targetUserId) {
        setStatus('self');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const fetchedStatus = await getConnectionStatus(currentUserId, targetUserId);
         if (isMounted) {
             setStatus(fetchedStatus ?? 'not_connected'); // Handle potential null from error
             if (onStatusChange && fetchedStatus) onStatusChange(fetchedStatus);
         }
      } catch (error) {
        console.error("Error fetching connection status:", error);
         if (isMounted) setStatus('not_connected'); // Fallback on error
      } finally {
         if (isMounted) setIsLoading(false);
      }
    };

    fetchStatus();
    return () => { isMounted = false }; // Cleanup on unmount
  }, [currentUserId, targetUserId, onStatusChange]);

  const handleAction = async (action: () => Promise<void>, successStatus: ConnectionStatus, successMessage: string, errorMessage: string) => {
    if (!currentUserId || !targetUserId || !connectionId) {
      toast({ variant: "destructive", title: "Error", description: "User or target ID missing." });
      return;
    }
    setIsActing(true);
    try {
      await action();
      setStatus(successStatus);
      if (onStatusChange) onStatusChange(successStatus);
      toast({ title: "Success", description: successMessage });
    } catch (error: any) {
      console.error(`Error during action (${errorMessage}):`, error);
      toast({ variant: "destructive", title: "Action Failed", description: error.message || errorMessage });
      // Optionally refetch status on error to ensure UI consistency
      const freshStatus = await getConnectionStatus(currentUserId, targetUserId);
      setStatus(freshStatus ?? 'not_connected');
    } finally {
      setIsActing(false);
    }
  };

  const handleSendRequest = () => handleAction(
    () => sendConnectionRequest(currentUserId!, targetUserId),
    'pending_sent',
    `Connection request sent to ${targetUserName}.`,
    'Could not send connection request.'
  );

  const handleAcceptRequest = () => handleAction(
    () => acceptConnectionRequest(connectionId!, currentUserId!),
    'connected',
    `You are now connected with ${targetUserName}.`,
    'Could not accept connection request.'
  );

  const handleRejectRequest = () => handleAction(
    () => rejectOrCancelConnectionRequest(connectionId!, currentUserId!),
    'not_connected',
    `Connection request from ${targetUserName} rejected.`,
    'Could not reject connection request.'
  );

  const handleCancelRequest = () => handleAction(
    () => rejectOrCancelConnectionRequest(connectionId!, currentUserId!),
    'not_connected',
    `Connection request to ${targetUserName} cancelled.`,
    'Could not cancel connection request.'
  );

  const handleRemoveConnection = () => handleAction(
    () => removeConnection(connectionId!, currentUserId!),
    'not_connected',
    `Connection with ${targetUserName} removed.`,
    'Could not remove connection.'
  );


  if (isLoading) {
    return <Button size={size} variant="outline" disabled className={cn("flex items-center", className)}> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</Button>;
  }

  if (status === 'self') {
    return null; // Don't show button for own profile
  }

  if (status === 'blocked') {
    return <Button size={size} variant="destructive" disabled className={cn("flex items-center", className)}> <Ban className="mr-2 h-4 w-4" /> Blocked</Button>;
  }

  // Determine button content based on status
  let buttonContent: React.ReactNode = null;
  let buttonProps: Partial<React.ComponentProps<typeof Button>> = { variant: variant, size: size, className: className };

  switch (status) {
    case 'not_connected':
      buttonProps.onClick = handleSendRequest;
      buttonProps.disabled = isActing;
      buttonProps.variant = 'default'; // Primary action
       buttonProps.className = cn(buttonProps.className, "bg-accent hover:bg-accent/90 text-accent-foreground"); // Use accent color
      buttonContent = (
        <> {isActing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Connect </>
      );
      break;
    case 'pending_sent':
      buttonProps.onClick = handleCancelRequest;
      buttonProps.disabled = isActing;
      buttonProps.variant = 'outline'; // Secondary action
      buttonContent = (
        <> {isActing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hourglass className="mr-2 h-4 w-4" />} Request Sent </>
      );
      break;
    case 'pending_received':
       buttonProps.variant = 'secondary'; // Highlight incoming request
      // Show two buttons for accept/reject
      return (
          <div className={cn("flex gap-2", className)}>
             <Button size={size} variant="default" onClick={handleAcceptRequest} disabled={isActing} className="flex-1">
                {isActing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />} Accept
             </Button>
             <Button size={size} variant="outline" onClick={handleRejectRequest} disabled={isActing} className="flex-1">
                {isActing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />} Reject
             </Button>
          </div>
      );
    case 'connected':
       buttonProps.variant = 'secondary'; // Indicate existing connection
       buttonProps.disabled = isActing;
      // Use AlertDialog for removal confirmation
      buttonContent = (
         <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button size={size} variant={buttonProps.variant} disabled={isActing} className={cn("flex items-center w-full", buttonProps.className)}>
                    {isActing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4 text-green-600" />} Connected
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                 <AlertDialogHeader>
                    <AlertDialogTitle>Remove Connection?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to remove your connection with {targetUserName}? This action cannot be undone.
                    </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                    <AlertDialogCancel disabled={isActing}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveConnection} disabled={isActing} className="bg-destructive hover:bg-destructive/90">
                        {isActing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />} Remove
                    </AlertDialogAction>
                 </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      );
      // We return directly here because the button is inside the AlertDialogTrigger
      return <>{buttonContent}</>;

    default:
        // Fallback or error state - maybe show a disabled button or nothing
        buttonContent = <Button size={size} variant="outline" disabled>Error</Button>;
        break;
  }

  return (
    <Button {...buttonProps}>
      {buttonContent}
    </Button>
  );
};
