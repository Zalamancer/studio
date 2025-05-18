// src/components/ConnectionButton.tsx
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
  getUserProfileBasic // Import to get target user's UID if only name is passed
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
  targetUserId: string; // Should always be a UID
  targetUserName?: string; // Optional name for better toasts/dialogs
  onStatusChange?: (newStatus: ConnectionStatus | null) => void; // Optional callback
  size?: 'sm' | 'default' | 'lg' | 'xs'; // Added 'xs'
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link'; // Button variant
  className?: string; // Additional styling
}

export const ConnectionButton: React.FC<ConnectionButtonProps> = ({
  targetUserId: initialTargetUserId, // Rename prop to avoid conflict with state
  targetUserName: initialTargetUserName = 'this user',
  onStatusChange,
  size = 'sm',
  variant = 'default',
  className,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActing, setIsActing] = useState<boolean>(false);

  // State for resolved target user info
  const [resolvedTargetUserId, setResolvedTargetUserId] = useState<string>(initialTargetUserId);
  const [resolvedTargetUserName, setResolvedTargetUserName] = useState<string>(initialTargetUserName);


  const currentAuthUserId = user?.uid;
  const connectionId = currentAuthUserId && resolvedTargetUserId ? [currentAuthUserId, resolvedTargetUserId].sort().join('_') : null;

  // Effect to resolve targetUserId if a name was passed initially (less ideal)
  // This is a fallback, ideally targetUserId prop should always be a UID.
  useEffect(() => {
    const resolveUser = async () => {
      // Basic check if initialTargetUserId looks like a UID (long, alphanumeric) vs a display name
      // This is a heuristic and might not be perfect.
      const looksLikeUid = /^[a-zA-Z0-9]{20,}$/.test(initialTargetUserId);

      if (!looksLikeUid && initialTargetUserName === 'this user') {
        // If initialTargetUserId doesn't look like a UID and no better name was provided,
        // it's possible initialTargetUserId was a display name. Try to resolve.
        // This scenario is less ideal. ConnectionButton should ideally always receive a UID.
        console.warn(`[ConnectionButton] targetUserId '${initialTargetUserId}' doesn't look like a UID. Attempting to resolve. This is not optimal.`);
        // In a real scenario, you might need a searchByName function if UIDs are not passed.
        // For now, we'll assume if it's not a UID, we can't proceed safely without a proper resolution mechanism.
        // setStatus('not_connected'); // Or some error state
        // setIsLoading(false);
        // For now, we'll proceed assuming initialTargetUserId IS the UID if it doesn't get resolved otherwise.
        // This part of the logic is tricky if UIDs are not consistently passed.
      }
      // If initialTargetUserId is already a UID, or initialTargetUserName is specific, use them.
      setResolvedTargetUserId(initialTargetUserId);
      setResolvedTargetUserName(initialTargetUserName);
    };
    resolveUser();
  }, [initialTargetUserId, initialTargetUserName]);


  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      console.log(`%c[ConnectionButton] Render: currentAuthUserId='${currentAuthUserId}', targetUserId (prop)='${initialTargetUserId}', resolvedTargetUserId='${resolvedTargetUserId}'`, "color: purple");

      if (!currentAuthUserId || !resolvedTargetUserId) {
        setStatus('not_connected');
        setIsLoading(false);
        return;
      }
      if (currentAuthUserId === resolvedTargetUserId) {
        setStatus('self');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const fetchedStatus = await getConnectionStatus(currentAuthUserId, resolvedTargetUserId);
        if (isMounted) {
          setStatus(fetchedStatus ?? 'not_connected');
          if (onStatusChange && fetchedStatus) onStatusChange(fetchedStatus);
        }
      } catch (error) {
        console.error("[ConnectionButton] Error fetching connection status:", error);
        if (isMounted) setStatus('not_connected');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (resolvedTargetUserId) { // Only fetch if resolvedTargetUserId is set
        fetchStatus();
    } else {
        setIsLoading(false); // Not enough info to fetch status
        setStatus('not_connected');
    }


    return () => { isMounted = false; };
  }, [currentAuthUserId, resolvedTargetUserId, onStatusChange, initialTargetUserId]);


  const handleAction = async (
    actionFn: (currentUid: string, targetUid: string, connId?: string) => Promise<void>,
    successStatus: ConnectionStatus,
    successMessage: string,
    errorMessage: string
  ) => {
    if (!currentAuthUserId || !resolvedTargetUserId) {
      toast({ variant: "destructive", title: "Error", description: "User or target ID missing." });
      return;
    }
     // connectionId might be null if not 'pending' or 'connected' status, generate if needed for accept/reject/remove
    const currentConnectionId = connectionId || (currentAuthUserId && resolvedTargetUserId ? getConnectionDocId(currentAuthUserId, resolvedTargetUserId) : null);
    if (!currentConnectionId && (successStatus === 'connected' || successStatus === 'not_connected')) { // Actions like accept/reject/remove need it
        toast({ variant: "destructive", title: "Error", description: "Connection identifier is missing." });
        return;
    }


    setIsActing(true);
    try {
      await actionFn(currentAuthUserId, resolvedTargetUserId, currentConnectionId!); // Pass IDs
      setStatus(successStatus);
      if (onStatusChange) onStatusChange(successStatus);
      toast({ title: "Success", description: successMessage });
    } catch (error: any) {
      console.error(`[ConnectionButton] Error during action (${errorMessage}):`, error);
      toast({ variant: "destructive", title: "Action Failed", description: error.message || errorMessage });
      if (currentAuthUserId && resolvedTargetUserId) {
        const freshStatus = await getConnectionStatus(currentAuthUserId, resolvedTargetUserId);
        setStatus(freshStatus ?? 'not_connected');
      }
    } finally {
      setIsActing(false);
    }
  };


  const handleSendRequest = () => {
    console.log(`[ConnectionButton] handleSendRequest: currentAuthUserId='${currentAuthUserId}', resolvedTargetUserId='${resolvedTargetUserId}'`);
    if (!currentAuthUserId || !resolvedTargetUserId) {
        toast({ variant: "destructive", title: "Error", description: "Cannot send request: User or target ID missing." });
        return;
    }
    handleAction(
        (authUid, targetUid) => sendConnectionRequest(authUid, targetUid), // Pass correct params
        'pending_sent',
        `Connection request sent to ${resolvedTargetUserName}.`,
        'Could not send connection request.'
    );
  };

  const handleAcceptRequest = () => handleAction(
    (authUid, _targetUid, connId) => acceptConnectionRequest(connId!, authUid),
    'connected',
    `You are now connected with ${resolvedTargetUserName}.`,
    'Could not accept connection request.'
  );

  const handleRejectRequest = () => handleAction(
    (authUid, _targetUid, connId) => rejectOrCancelConnectionRequest(connId!, authUid),
    'not_connected',
    `Connection request from ${resolvedTargetUserName} rejected.`,
    'Could not reject connection request.'
  );

  const handleCancelRequest = () => handleAction(
    (authUid, _targetUid, connId) => rejectOrCancelConnectionRequest(connId!, authUid),
    'not_connected',
    `Connection request to ${resolvedTargetUserName} cancelled.`,
    'Could not cancel connection request.'
  );

  const handleRemoveConnection = () => handleAction(
    (authUid, _targetUid, connId) => removeConnection(connId!, authUid),
    'not_connected',
    `Connection with ${resolvedTargetUserName} removed.`,
    'Could not remove connection.'
  );


  if (isLoading) {
    return <Button size={size} variant="outline" disabled className={cn("flex items-center", className)}> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</Button>;
  }

  if (status === 'self' || !resolvedTargetUserId) { // Also hide if targetId couldn't be resolved
    return null;
  }

  if (status === 'blocked') {
    return <Button size={size} variant="destructive" disabled className={cn("flex items-center", className)}> <Ban className="mr-2 h-4 w-4" /> Blocked</Button>;
  }

  let buttonContent: React.ReactNode = null;
  let buttonProps: Partial<React.ComponentProps<typeof Button>> = { variant: variant, size: size, className: className };

  switch (status) {
    case 'not_connected':
      buttonProps.onClick = handleSendRequest;
      buttonProps.disabled = isActing;
      buttonProps.variant = 'default';
      buttonProps.className = cn(buttonProps.className, "bg-accent hover:bg-accent/90 text-accent-foreground");
      buttonContent = (
        <> {isActing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Connect </>
      );
      break;
    case 'pending_sent':
      buttonProps.onClick = handleCancelRequest;
      buttonProps.disabled = isActing;
      buttonProps.variant = 'outline';
      buttonContent = (
        <> {isActing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hourglass className="mr-2 h-4 w-4" />} Request Sent </>
      );
      break;
    case 'pending_received':
      buttonProps.variant = 'secondary';
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
      buttonProps.variant = 'secondary';
      buttonProps.disabled = isActing;
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
                        Are you sure you want to remove your connection with {resolvedTargetUserName}? This action cannot be undone.
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
      return <>{buttonContent}</>;
    default:
        buttonContent = <Button size={size} variant="outline" disabled>Error</Button>;
        break;
  }

  return (
    <Button {...buttonProps}>
      {buttonContent}
    </Button>
  );
};