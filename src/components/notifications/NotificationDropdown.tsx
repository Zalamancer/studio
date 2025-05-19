
// src/components/notifications/NotificationDropdown.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Loader2, Mail, UserPlus, UserCheck, MessageSquare, AtSign, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'; // Removed unused group/sub imports
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getNotificationsForUser, markNotificationAsRead, markAllNotificationsAsRead } from '@/services/notificationService';
import type { ClientNotification, NotificationType } from '@/types/notification';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { generateAnonymousName } from '@/lib/pseudonymUtils'; // For fallback names

interface NotificationDropdownProps {
  userId: string;
}

const NotificationIcon: React.FC<{ type: NotificationType }> = React.memo(({ type }) => {
  switch (type) {
    case 'reply': return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case 'mention': return <AtSign className="h-4 w-4 text-purple-500" />;
    case 'connection_request': return <UserPlus className="h-4 w-4 text-orange-500" />;
    case 'connection_accepted': return <UserCheck className="h-4 w-4 text-green-500" />;
    default: return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
});
NotificationIcon.displayName = 'NotificationIcon';

const NotificationItem: React.FC<{ notification: ClientNotification; onRead: (id: string) => void }> = React.memo(({ notification, onRead }) => {
    const timeAgo = formatDistanceToNow(notification.timestamp, { addSuffix: true });
    const senderDisplayName = notification.senderName || generateAnonymousName(notification.senderId);


    const handleClick = () => {
        if (!notification.isRead) {
            onRead(notification.id);
        }
    };

    let title = '';
    let description = '';
    let linkHref: string = '/';

    switch (notification.type) {
        case 'reply':
            title = `${senderDisplayName} replied`;
            description = notification.textSnippet || 'View reply';
            linkHref = notification.postId ? `/?postId=${notification.postId}${notification.commentId ? `#comment-${notification.commentId}`: ''}${notification.subCommentId ? `&subCommentId=${notification.subCommentId}` : ''}` : '/';
            break;
        case 'mention':
            title = `${senderDisplayName} mentioned you`;
            description = notification.textSnippet || 'View mention';
            linkHref = notification.postId ? `/?postId=${notification.postId}${notification.commentId ? `#comment-${notification.commentId}`: ''}${notification.subCommentId ? `&subCommentId=${notification.subCommentId}` : ''}` : '/';
            break;
        case 'connection_request':
            title = `${senderDisplayName} wants to connect`;
            description = 'Review the connection request.';
            linkHref = '/connect';
            break;
        case 'connection_accepted':
            title = `Connected with ${senderDisplayName}`;
            description = 'View their profile or start a chat.';
            linkHref = notification.senderId ? `/profile/${notification.senderId}` : '/connect';
            break;
        default:
            title = 'New Notification';
            description = 'You have a new notification.';
    }

     return (
       <DropdownMenuItem
          asChild
          className={cn(
            "flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 rounded-md relative focus:bg-muted/60",
            !notification.isRead && "bg-primary/5 font-medium"
          )}
          onClick={handleClick}
          aria-label={`Notification: ${title}`}
       >
          <Link href={linkHref}>
              {!notification.isRead && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
              )}
              <div className="flex-shrink-0 pt-1">
                 <NotificationIcon type={notification.type} />
              </div>
              <div className="flex-grow min-w-0">
                 <p className="text-sm font-medium text-foreground truncate">{title}</p>
                 <p className="text-xs text-muted-foreground truncate">{description}</p>
                 <p className="text-xs text-muted-foreground/80 mt-1">{timeAgo}</p>
              </div>
          </Link>
       </DropdownMenuItem>
    );
});
NotificationItem.displayName = 'NotificationItem';


export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ userId }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications = [], isLoading, error } = useQuery<ClientNotification[]>({
    queryKey: ['notifications', userId],
    queryFn: () => {
        console.log(`[NotificationDropdown] useQuery: Fetching notifications for userId: ${userId}`);
        return getNotificationsForUser(userId, 20);
    },
    enabled: !!userId,
    refetchInterval: 1000 * 60, // Refetch every minute
    staleTime: 1000 * 30, // Consider data stale after 30 seconds
  });

  useEffect(() => {
    if (error) {
        console.error("[NotificationDropdown] Error fetching notifications:", error);
        // Optionally show a toast if persistent errors occur, but be mindful of repeated toasts on refetch intervals
    }
  }, [error, toast]);

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
       console.log(`[NotificationDropdown] Marked notification ${variables} as read`);
    },
    onError: (error: Error, variables) => {
      console.error(`[NotificationDropdown] Failed to mark notification ${variables} as read:`, error);
      toast({ variant: "destructive", title: "Error", description: "Could not update notification status." });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      toast({ title: "Notifications marked as read." });
    },
    onError: (error: Error) => {
      console.error("[NotificationDropdown] Failed to mark all notifications as read:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not mark all notifications as read." });
    },
  });

  const handleMarkAsRead = (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.isRead) {
        markReadMutation.mutate(notificationId);
    }
  };

  const handleMarkAllAsRead = () => {
     if (unreadCount > 0) {
         markAllReadMutation.mutate(userId);
     }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 flex items-center justify-center text-xs rounded-full"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <DropdownMenuLabel className="flex justify-between items-center p-3 border-b">
          <span className="text-base font-semibold">Notifications</span>
          {unreadCount > 0 && (
             <Button
                variant="ghost"
                size="xs"
                className="text-xs text-primary h-auto p-1 hover:underline"
                onClick={handleMarkAllAsRead}
                disabled={markAllReadMutation.isPending}
             >
                {markAllReadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : <CheckCheck className="h-3 w-3 mr-1"/>}
                Mark all read
             </Button>
           )}
        </DropdownMenuLabel>
        <ScrollArea className="h-[400px]">
          <div className="p-1 space-y-1">
            {isLoading ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <p className="p-4 text-sm text-destructive text-center">Error loading notifications.</p>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No notifications yet.</p>
            ) : (
              notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={handleMarkAsRead}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

