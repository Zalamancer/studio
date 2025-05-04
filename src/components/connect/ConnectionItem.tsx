'use client';

import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, UserX } from 'lucide-react';
import type { Connection } from '@/types/connection';
import { removeConnection } from '@/services/connectionService';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns'; // For displaying time ago
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // For navigating to chat
import { findOrCreateConversation } from '@/services/messagingService'; // Import messaging service
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

interface ConnectionItemProps {
  connection: Connection;
  currentUserId: string;
  onAction: () => void; // Callback after action is successful
}

const getInitials = (name: string | undefined | null): string => {
  if (!name) return '?';
  const names = name.split(' ');
  if (names.length === 1) return names[0].substring(0, 1).toUpperCase();
  return (names[0].substring(0, 1) + names[names.length - 1].substring(0, 1)).toUpperCase();
};

export const ConnectionItem: React.FC<ConnectionItemProps> = ({
  connection,
  currentUserId,
  onAction,
}) => {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoadingRemove, setIsLoadingRemove] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  const handleRemove = async () => {
    setIsLoadingRemove(true);
    try {
      await removeConnection(connection.connectionId, currentUserId);
      toast({ title: "Connection Removed", description: `You are no longer connected with ${connection.otherUserDisplayName}.` });
      onAction(); // Trigger refetch in parent
    } catch (error: any) {
      console.error("Error removing connection:", error);
      toast({ variant: "destructive", title: "Error", description: `Could not remove connection: ${error.message}` });
    } finally {
      setIsLoadingRemove(false);
    }
  };

  const handleStartChat = async () => {
    setIsLoadingChat(true);
    try {
      // Find or create a general conversation (no specific postId)
      // NOTE: Adjust findOrCreateConversation if it strictly requires postId
      // You might need a variation or handle null postId gracefully
      const conversationId = await findOrCreateConversation(currentUserId, connection.otherUserId, 'general_connection'); // Use a placeholder like 'general_connection' or adapt service
       if (conversationId) {
           router.push(`/contracts?conversationId=${conversationId}`);
       } else {
           throw new Error("Failed to get conversation ID.");
       }
    } catch (error: any) {
        console.error("Error starting chat:", error);
        toast({
            variant: "destructive",
            title: "Failed to Start Chat",
            description: error.message || "Could not initiate chat. Please try again.",
        });
    } finally {
        setIsLoadingChat(false);
    }
  };

  const timeAgo = connection.connectedAt ? formatDistanceToNow(new Date(connection.connectedAt), { addSuffix: true }) : '';

  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
       <div className="flex items-center gap-3 flex-grow min-w-0">
          <Link href={`/profile/${connection.otherUserId}`} passHref>
             <Avatar className="h-10 w-10 cursor-pointer">
                <AvatarImage src={connection.otherUserAvatarUrl} alt={connection.otherUserDisplayName} />
                <AvatarFallback className="bg-primary text-primary-foreground">{getInitials(connection.otherUserDisplayName)}</AvatarFallback>
             </Avatar>
          </Link>
          <div className="flex-grow min-w-0">
             <Link href={`/profile/${connection.otherUserId}`} passHref>
                 <p className="text-sm font-medium text-foreground truncate hover:underline cursor-pointer">{connection.otherUserDisplayName}</p>
             </Link>
             <p className="text-xs text-muted-foreground">Connected {timeAgo}</p>
          </div>
       </div>
      <div className="flex gap-2 flex-shrink-0 ml-2">
         <Button
           size="sm"
           variant="outline"
           onClick={handleStartChat}
           disabled={isLoadingChat || isLoadingRemove}
           aria-label={`Message ${connection.otherUserDisplayName}`}
         >
           {isLoadingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
           <span className="hidden sm:inline ml-1">Message</span>
         </Button>
         <AlertDialog>
           <AlertDialogTrigger asChild>
             <Button
               size="sm"
               variant="destructive"
               disabled={isLoadingRemove || isLoadingChat}
               aria-label={`Remove connection with ${connection.otherUserDisplayName}`}
             >
               {isLoadingRemove ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                <span className="hidden sm:inline ml-1">Remove</span>
             </Button>
           </AlertDialogTrigger>
           <AlertDialogContent>
             <AlertDialogHeader>
               <AlertDialogTitle>Remove Connection?</AlertDialogTitle>
               <AlertDialogDescription>
                 Are you sure you want to remove your connection with {connection.otherUserDisplayName}? This action cannot be undone.
               </AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter>
               <AlertDialogCancel disabled={isLoadingRemove}>Cancel</AlertDialogCancel>
               <AlertDialogAction onClick={handleRemove} disabled={isLoadingRemove} className="bg-destructive hover:bg-destructive/90">
                 {isLoadingRemove ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Remove'}
               </AlertDialogAction>
             </AlertDialogFooter>
           </AlertDialogContent>
         </AlertDialog>
      </div>
    </div>
  );
};
