
// src/components/notifications/NotificationDropdown.tsx
"use client";

import React, { useEffect, useMemo } from 'react';
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
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getNotificationsForUser, markNotificationAsRead, markAllNotificationsAsRead } from '@/services/notificationService';
import type { ClientNotification, NotificationType } from '@/types/notification';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link'; // Keep Link for router type, but usage changes
import { useRouter } from 'next/navigation'; // Import useRouter
import { useToast } from '@/hooks/use-toast';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { getUserPreferences } from '@/services/userPreferenceService'; // Import preference service
import type { UserPreference } from '@/types/userPreferences'; // Import preference type

interface NotificationDropdownProps {
  userId: string;
}

const NotificationIcon: React.FC<{ type: NotificationType }> = React.memo(({ type }) => {
  switch (type) {
    case 'reply': return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case 'mention': return <AtSign className="h-4 w-4 text-purple-500" />;
    case 'connection_request': return <UserPlus className="h-4 w-4 text-orange-500" />;
    case 'connection_accepted': return <UserCheck className="h-4 w-4 text-green-500" />;
    case 'new_message': return <Mail className="h-4 w-4 text-sky-500" />;
    default: return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
});
NotificationIcon.displayName = 'NotificationIcon';

const NotificationItem: React.FC<{ notification: ClientNotification; onRead: (id: string) => void }> = React.memo(({ notification, onRead }) => {
    const router = useRouter(); // Initialize useRouter
    const timeAgo = formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true });
    const senderDisplayName = notification.senderName || generateAnonymousName(notification.senderId);

    let title = '';
    let description = '';
    let linkHref: string = '/messages'; // Default fallback

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
            linkHref = '/messages?tab=requests';
            break;
        case 'connection_accepted':
            title = `Connected with ${senderDisplayName}`;
            description = 'View their profile or start a chat.';
            linkHref = notification.senderId ? `/profile/${notification.senderId}` : '/messages?tab=connections';
            break;
        case 'new_message':
            title = `New message from ${senderDisplayName}`;
            description = notification.textSnippet || 'View message';
            linkHref = notification.conversationId ? `/messages?conversationId=${notification.conversationId}` : '/messages';
            break;
        default:
            title = 'New Notification';
            description = 'You have a new notification.';
    }

    const handleSelect = (event: Event) => {
      // Do not call event.preventDefault() to allow Radix to close the menu
      setTimeout(() => {
        if (!notification.isRead) {
          onRead(notification.id);
        }
        router.push(linkHref); // Programmatic navigation
      }, 50); // Small delay for Radix to finish processing
    };

     return (
       <DropdownMenuItem
          // Remove asChild prop
          onSelect={handleSelect}
          className={cn(
            "flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 rounded-md relative focus:bg-muted/60",
            !notification.isRead && "bg-primary/5 font-medium"
          )}
          aria-label={`Notification: ${title}`}
       >
          {/* Content directly inside DropdownMenuItem */}
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
       </DropdownMenuItem>
    );
});
NotificationItem.displayName = 'NotificationItem';


export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ userId }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: fetchedNotifications = [], isLoading: isLoadingNotifications, error: notificationsError } = useQuery<ClientNotification[]>({
    queryKey: ['notifications', userId],
    queryFn: () => {
        console.log(`[NotificationDropdown] useQuery: Fetching notifications for userId: ${userId}`);
        return getNotificationsForUser(userId, 20);
    },
    enabled: !!userId,
    refetchInterval: 1000 * 60 * 5, // Changed from 1 minute to 5 minutes
    staleTime: 1000 * 60 * 2, // Changed from 30 seconds to 2 minutes
  });

  const { data: userPreferences, isLoading: isLoadingPreferences, error: preferencesError } = useQuery<UserPreference | null>({
    queryKey: ['userPreferences', userId],
    queryFn: () => getUserPreferences(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, 
  });

  useEffect(() => {
    if (notificationsError) {
        console.error("[NotificationDropdown] Error fetching notifications:", notificationsError);
    }
    if (preferencesError) {
        console.error("[NotificationDropdown] Error fetching user preferences:", preferencesError);
    }
  }, [notificationsError, preferencesError]);

  const filteredNotifications = useMemo(() => {
    if (!userPreferences || isLoadingNotifications || isLoadingPreferences) {
      return fetchedNotifications;
    }
    console.log("[NotificationDropdown] Filtering notifications based on preferences:", userPreferences);
    return fetchedNotifications.filter(notification => {
      switch (notification.type) {
        case 'new_message':
          return userPreferences.notifyOnNewMessage !== false;
        case 'reply':
          return userPreferences.notifyOnReply !== false;
        case 'mention':
          return userPreferences.notifyOnMention !== false;
        case 'connection_request':
          return userPreferences.notifyOnNewConnectionRequest !== false;
        case 'connection_accepted':
          return userPreferences.notifyOnConnectionAccepted !== false;
        default:
          return true;
      }
    });
  }, [fetchedNotifications, userPreferences, isLoadingNotifications, isLoadingPreferences]);

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: (data, variables) => {
      // The timeout from previous attempt can remain here, it shouldn't hurt.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        console.log(`[NotificationDropdown] Marked notification ${variables} as read and invalidated query.`);
      }, 100); 
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
    const notification = fetchedNotifications.find(n => n.id === notificationId);
    if (notification && !notification.isRead) {
        markReadMutation.mutate(notificationId);
    }
  };

  const handleMarkAllAsRead = () => {
     if (unreadCount > 0) {
         markAllReadMutation.mutate(userId);
     }
  };

  const unreadCount = filteredNotifications.filter(n => !n.isRead).length;
  const isLoading = isLoadingNotifications || isLoadingPreferences;

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
            ) : notificationsError || preferencesError ? (
              <p className="p-4 text-sm text-destructive text-center">Error loading notifications or preferences.</p>
            ) : filteredNotifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No notifications yet.</p>
            ) : (
              filteredNotifications.map(notification => (
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

