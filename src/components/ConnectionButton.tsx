
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, UserCheck, UserX, Ban, Hourglass } from 'lucide-react';
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
  targetUserId: string; // Should always be a UID
  targetUserName?: string;
  onStatusChange?: (newStatus: ConnectionStatus | null) => void;
  size?: 'sm' | 'default' | 'lg' | 'xs';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
  className?: string;
}

// Helper to check if a string looks like a Firebase UID
const IS_UID_REGEX = /^[a-zA-Z0-9]{20,}$/; // Basic check, Firebase UIDs are typically 28 chars

export const ConnectionButton: React.FC<ConnectionButtonProps> = ({
  targetUserId: initialTargetUserId,
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
  const [isValidTarget, setIsValidTarget] = useState<boolean>(false);

  const currentAuthUserId = user?.uid;

  console.log(`%c[ConnectionButton] Render/Init - Props received: initialTargetUserId='${initialTargetUserId}', initialTargetUserName='${initialTargetUserName}'`, "color: purple; font-weight: bold;");

  useEffect(() => {
    if (!initialTargetUserId) {
      console.warn("[ConnectionButton] useEffect for initialTargetUserId validation: initialTargetUserId is undefined or empty. Setting isValidTarget to false.");
      setIsValidTarget(false);
      setStatus('not_connected'); 
      setIsLoading(false);
      return;
    }
    if (!IS_UID_REGEX.test(initialTargetUserId)) {
      console.error(`%c[ConnectionButton] CRITICAL WARNING: initialTargetUserId '${initialTargetUserId}' prop does NOT look like a Firebase UID. This component requires a UID for targetUserId. Connection features will be disabled for this target. Please check the parent component passing this prop.`, "color: red; font-size: 14px; font-weight: bold;");
      setIsValidTarget(false);
      setStatus('not_connected'); 
      setIsLoading(false);
      return;
    }
    console.log(`[ConnectionButton] useEffect for initialTargetUserId validation: initialTargetUserId '${initialTargetUserId}' is valid. Setting isValidTarget to true.`);
    setIsValidTarget(true);
  }, [initialTargetUserId]);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      console.log(`%c[ConnectionButton] fetchStatus Effect - currentAuthUserId='${currentAuthUserId}', initialTargetUserId (validated)='${initialTargetUserId}', isValidTarget=${isValidTarget}`, "color: blue;");

      if (!currentAuthUserId || !isValidTarget || !initialTargetUserId) {
        console.log(`[ConnectionButton] fetchStatus: Skipping due to missing authUser, invalid target, or missing initialTargetUserId. currentAuthUserId=${currentAuthUserId}, isValidTarget=${isValidTarget}, initialTargetUserId=${initialTargetUserId}`);
        setStatus('not_connected');
        setIsLoading(false);
        return;
      }
      if (currentAuthUserId === initialTargetUserId) {
        setStatus('self');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const fetchedStatus = await getConnectionStatus(currentAuthUserId, initialTargetUserId);
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

    if (isValidTarget) { // Only fetch if target is confirmed valid
      fetchStatus();
    } else if (initialTargetUserId) { 
        // If initialTargetUserId was provided but deemed invalid by the other effect, 
        // we ensure isLoading is false and status is 'not_connected'
        console.log("[ConnectionButton] fetchStatus: Skipping because isValidTarget is false, though initialTargetUserId was provided.");
        setIsLoading(false);
        if (status !== 'not_connected') setStatus('not_connected');
    } else {
        // If no initialTargetUserId at all
        setIsLoading(false);
        setStatus('not_connected');
    }

    return () => { isMounted = false; };
  }, [currentAuthUserId, initialTargetUserId, isValidTarget, onStatusChange, status]); // Added status to dependency array to re-evaluate if it gets externally changed.

  const getConnectionDocIdForAction = (): string | null => {
    if (!currentAuthUserId || !initialTargetUserId || !isValidTarget) return null;
    return [currentAuthUserId, initialTargetUserId].sort().join('_');
  };

  const handleAction = async (
    actionFn: (currentUid: string, targetUid: string, connId: string) => Promise<void>,
    successStatus: ConnectionStatus,
    successMessage: string,
    errorMessage: string
  ) => {
    if (!currentAuthUserId || !initialTargetUserId || !isValidTarget) {
      toast({ variant: "destructive", title: "Error", description: "User or target ID missing or invalid." });
      return;
    }
    const connectionId = getConnectionDocIdForAction();
    if (!connectionId) {
        toast({ variant: "destructive", title: "Error", description: "Connection identifier is missing." });
        return;
    }

    console.log(`%c[ConnectionButton] handleAction: User='${currentAuthUserId}', Target='${initialTargetUserId}', ActionMessage='${successMessage}'`, "color: darkgreen;");

    setIsActing(true);
    try {
      await actionFn(currentAuthUserId, initialTargetUserId, connectionId);
      setStatus(successStatus);
      if (onStatusChange) onStatusChange(successStatus);
      toast({ title: "Success", description: successMessage });
    } catch (error: any) {
      console.error(`[ConnectionButton] Error during action (${errorMessage}):`, error);
      toast({ variant: "destructive", title: "Action Failed", description: error.message || errorMessage });
      if (currentAuthUserId && initialTargetUserId && isValidTarget) {
        const freshStatus = await getConnectionStatus(currentAuthUserId, initialTargetUserId);
        setStatus(freshStatus ?? 'not_connected');
      }
    } finally {
      setIsActing(false);
    }
  };

  const handleSendRequest = () => {
    if (!currentAuthUserId || !initialTargetUserId || !isValidTarget) {
        toast({ variant: "destructive", title: "Error", description: "Cannot send request: User or target ID missing/invalid." });
        return;
    }
    handleAction(
        (authUid, targetUid) => sendConnectionRequest(authUid, targetUid),
        'pending_sent',
        `Connection request sent to ${initialTargetUserName}.`,
        'Could not send connection request.'
    );
  };

  const handleAcceptRequest = () => handleAction(
    (authUid, _targetUid, connId) => acceptConnectionRequest(connId!, authUid),
    'connected',
    `You are now connected with ${initialTargetUserName}.`,
    'Could not accept connection request.'
  );

  const handleRejectRequest = () => handleAction(
    (authUid, _targetUid, connId) => rejectOrCancelConnectionRequest(connId!, authUid),
    'not_connected',
    `Connection request from ${initialTargetUserName} rejected.`,
    'Could not reject connection request.'
  );

  const handleCancelRequest = () => handleAction(
    (authUid, _targetUid, connId) => rejectOrCancelConnectionRequest(connId!, authUid),
    'not_connected',
    `Connection request to ${initialTargetUserName} cancelled.`,
    'Could not cancel connection request.'
  );

  const handleRemoveConnection = () => handleAction(
    (authUid, _targetUid, connId) => removeConnection(connId!, authUid),
    'not_connected',
    `Connection with ${initialTargetUserName} removed.`,
    'Could not remove connection.'
  );


  if (!initialTargetUserId && !isLoading) { 
    return null; // If no target ID at all and not loading, don't render
  }

  if (!isValidTarget && !isLoading) { 
      return <Button size={size} variant="outline" disabled className={cn("flex items-center", className)}> Invalid Target ID </Button>;
  }

  if (isLoading) {
    return <Button size={size} variant="outline" disabled className={cn("flex items-center", className)}> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</Button>;
  }

  if (status === 'self') {
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
                        Are you sure you want to remove your connection with {initialTargetUserName}? This action cannot be undone.
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
        buttonContent = <Button size={size} variant="outline" disabled> Error / Invalid State </Button>;
        break;
  }

  return (
    <Button {...buttonProps}>
      {buttonContent}
    </Button>
  );
};
