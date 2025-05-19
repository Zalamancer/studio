// src/components/messaging/MessagingInterface.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getConversationsForUser,
  getMessagesForConversation,
  sendMessage,
  getPostDetails,
  getUserDetails,
} from '@/services/messagingService';
import type { ClientConversation, SerializableMessage, NewMessageData } from '@/types/messaging';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, User, Users, AlertTriangle, Eye, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface MessagingInterfaceProps {
  currentUserId: string;
  initialConversationId?: string | null;
  highlightPostId?: string | null;
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

interface ConversationListItemProps {
  conversation: ClientConversation;
  isSelected: boolean;
  currentUserId: string;
  onSelect: (conversationId: string) => void;
  postQuestion?: string | null;
  highlight?: boolean;
}

const ConversationListItem: React.FC<ConversationListItemProps> = React.memo(({
  conversation,
  isSelected,
  currentUserId,
  onSelect,
  postQuestion,
  highlight,
}) => {
    const queryClient = useQueryClient();
    const otherParticipantId = conversation.participants.find(p => p !== currentUserId);

    const { data: otherParticipantDetails, isLoading: isLoadingDetails } = useQuery({
        queryKey: ['userDetails', otherParticipantId],
        queryFn: () => otherParticipantId ? getUserDetails(otherParticipantId) : null,
        enabled: !!otherParticipantId,
        staleTime: Infinity,
    });

    const participantName = isLoadingDetails
        ? 'Loading...'
        : otherParticipantDetails?.name || `@${otherParticipantId || 'Unknown'}`;
    const initials = getInitials(participantName);

    const formattedTime = conversation.lastMessageTimestamp
        ? new Date(conversation.lastMessageTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : '';

  return (
    <div className={cn("relative group", highlight ? "ring-2 ring-primary ring-offset-2 rounded-lg" : "")}>
      <button
        onClick={() => onSelect(conversation.id)}
        className={cn(
          "w-full text-left p-3 hover:bg-muted/50 transition-colors rounded-lg flex items-center gap-3",
          isSelected ? "bg-muted" : ""
        )}
        aria-current={isSelected ? "page" : undefined}
      >
         <Avatar className="h-9 w-9 flex-shrink-0"> {/* Added flex-shrink-0 */}
          <AvatarImage src={otherParticipantDetails?.avatar} alt={participantName} />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
         </Avatar>
        <div className="flex-grow overflow-hidden min-w-0"> {/* Added min-w-0 here */}
          <p className="text-sm font-medium text-foreground truncate">{participantName}</p>
          {postQuestion && (
              <p className="text-xs text-primary truncate font-medium mt-0.5">
                  Re: {postQuestion}
              </p>
          )}
          <p className={cn("text-xs text-muted-foreground truncate mt-0.5", isSelected ? "font-medium" : "")}>
              {conversation.lastMessage || 'No messages yet'}
          </p>
        </div>
        {formattedTime && (
          <span className="text-xs text-muted-foreground self-start pt-1 flex-shrink-0"> {/* Added flex-shrink-0 */}
            {formattedTime}
          </span>
        )}
      </button>
       {conversation.postId && conversation.postId !== 'general_connection' && (
           <Link href={`/?postId=${conversation.postId}`}
                 className={cn(
                     "absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity",
                     "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                     "p-1 rounded-md",
                     "focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring"
                 )}
                 title="View Post Details"
                 aria-label="View Post Details"
            >
               <Eye className="h-3.5 w-3.5" />
           </Link>
        )}
    </div>
  );
});
ConversationListItem.displayName = 'ConversationListItem';

interface MessageBubbleProps {
  message: SerializableMessage;
  isOwnMessage: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, isOwnMessage }) => {
  const timestamp = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Sending...';

  return (
    <div className={cn("flex mb-3", isOwnMessage ? "justify-end" : "justify-start")}>
      <div className={cn(
        "rounded-lg px-3 py-2 max-w-[75%] break-words shadow-sm",
        isOwnMessage
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground"
      )}>
        <p className="text-sm">{message.text}</p>
        <p className={cn(
             "text-xs mt-1",
             isOwnMessage ? "text-primary-foreground/80 text-right" : "text-muted-foreground/80 text-left"
        )}>
            {timestamp}
        </p>
      </div>
    </div>
  );
});
MessageBubble.displayName = 'MessageBubble';

export const MessagingInterface: React.FC<MessagingInterfaceProps> = ({
    currentUserId,
    initialConversationId,
    highlightPostId,
}) => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId || null);
  const [newMessage, setNewMessage] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
      data: conversations = [],
      isLoading: isLoadingConversations,
      error: conversationsError,
      isError: isConversationsError
    } = useQuery<ClientConversation[], Error>({
    queryKey: ['conversations', currentUserId],
    queryFn: () => getConversationsForUser(currentUserId),
    enabled: !!currentUserId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  useEffect(() => {
      if (isConversationsError && conversationsError) {
          console.error("Error fetching conversations in UI:", conversationsError);
           toast({
               variant: "destructive",
               title: "Error Loading Conversations",
               description: conversationsError.message || "Could not load conversations.",
               duration: 7000,
           });
      }
  }, [isConversationsError, conversationsError, toast]);

   const postDetailsQueries = useQuery({
     queryKey: ['postDetails', conversations.map(c => c.postId).filter(Boolean)],
     queryFn: async () => {
       const postIds = conversations.map(c => c.postId).filter((id): id is string => !!id && id !== 'general_connection');
       const detailsMap = new Map<string, { question: string } | null>();
       await Promise.all(postIds.map(async (postId) => {
         const details = await getPostDetails(postId);
         detailsMap.set(postId, details);
       }));
       return detailsMap;
     },
     enabled: conversations.length > 0 && conversations.some(c => c.postId && c.postId !== 'general_connection'),
     staleTime: 1000 * 60 * 10, // Cache post details for 10 minutes
   });

   const postDetailsMap = postDetailsQueries.data;

   const {
      data: messages = [],
      isLoading: isLoadingMessages,
      error: messagesError
   } = useQuery<SerializableMessage[]>({
       queryKey: ['messages', selectedConversationId],
       queryFn: () => getMessagesForConversation(selectedConversationId!),
       enabled: !!selectedConversationId,
       staleTime: 1000 * 15, // Messages can be more dynamic
       refetchInterval: 1000 * 30, // Refetch messages every 30 seconds
   });

  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
        setNewMessage('');
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConversationId] });
        queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] }); // To update last message
    },
    onError: (error: Error) => {
        toast({
            variant: "destructive",
            title: "Send Failed",
            description: `Could not send message: ${error.message}`,
        });
    },
  });

   useEffect(() => {
       // Scroll to bottom when messages change or when a new conversation is selected
       const timer = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
       }, 100); // Small delay to allow DOM update
       return () => clearTimeout(timer);
   }, [messages, selectedConversationId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversationId || sendMessageMutation.isPending) {
        return;
    }
    const messageData: NewMessageData = {
        conversationId: selectedConversationId,
        senderId: currentUserId,
        text: newMessage.trim(),
    };
    sendMessageMutation.mutate(messageData);
  };

   useEffect(() => {
     if (!isLoadingConversations && !isConversationsError && conversations && conversations.length > 0) {
         // If an initialConversationId is provided and exists, select it.
         if (initialConversationId && conversations.some(c => c.id === initialConversationId)) {
             if (selectedConversationId !== initialConversationId) {
                setSelectedConversationId(initialConversationId);
             }
         } else if (!selectedConversationId) {
             // Otherwise, if no conversation is selected, select the first one by default.
             setSelectedConversationId(conversations[0].id);
         }
         // If a conversation is already selected, do nothing to respect user's current selection.
     } else if (!isLoadingConversations && !selectedConversationId) {
         // If there are no conversations, or loading finished with no conversations, ensure none is selected.
         setSelectedConversationId(null);
     }
   }, [conversations, selectedConversationId, isLoadingConversations, isConversationsError, initialConversationId]);

   const selectedConversation = conversations.find(c => c.id === selectedConversationId);
   const otherParticipantId = selectedConversation?.participants.find(p => p !== currentUserId);

   const { data: headerParticipantDetails, isLoading: isLoadingHeaderDetails } = useQuery({
       queryKey: ['userDetails', otherParticipantId],
       queryFn: () => otherParticipantId ? getUserDetails(otherParticipantId) : null,
       enabled: !!otherParticipantId,
       staleTime: Infinity, // User details (name, avatar) are unlikely to change frequently within a session
   });

   const otherParticipantName = isLoadingHeaderDetails
       ? 'Loading...'
       : headerParticipantDetails?.name || `@${otherParticipantId || 'Select Conversation'}`;
   const otherParticipantInitials = getInitials(otherParticipantName);
   const otherParticipantAvatar = headerParticipantDetails?.avatar;
   const selectedPostQuestion = selectedConversation?.postId && selectedConversation.postId !== 'general_connection'
        ? postDetailsMap?.get(selectedConversation.postId)?.question
        : null;

  return (
    <div className="flex h-full border rounded-lg overflow-hidden bg-card">
      {/* Conversations List Panel */}
      <div className="w-1/3 border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5" /> Conversations
          </h2>
        </div>
        <ScrollArea className="flex-grow bg-background"> {/* ADDED bg-background to match right panel */}
          <div className="p-2 space-y-1"> {/* Padding for the list container */}
            {isLoadingConversations ? (
              // Skeleton loaders for conversations list
              Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-grow space-y-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                      </div>
                  </div>
              ))
             ) : isConversationsError ? (
                 <div className="p-4 text-center text-destructive">
                     <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
                     <p className="text-sm font-medium">Error Loading Conversations</p>
                     <p className="text-xs mt-1">
                         {conversationsError?.message || "An unknown error occurred."}
                     </p>
                      <p className="text-xs mt-1">
                         Please check console and Firestore Rules.
                      </p>
                 </div>
             ) : conversations.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">No conversations yet.</p>
            ) : (
              conversations.map((conv) => {
                 // Fetch post question only if postId is valid and not 'general_connection'
                 const postQuestion = conv.postId && conv.postId !== 'general_connection' ? postDetailsMap?.get(conv.postId)?.question : null;
                 const shouldHighlight = highlightPostId === conv.postId && initialConversationId === conv.id; // Highlight specific conversation
                 return (
                     <ConversationListItem
                         key={conv.id}
                         conversation={conv}
                         isSelected={selectedConversationId === conv.id}
                         currentUserId={currentUserId}
                         onSelect={setSelectedConversationId}
                         postQuestion={postQuestion}
                         highlight={shouldHighlight}
                     />
                 );
             })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Messages Panel */}
      <div className="w-2/3 flex flex-col">
        {selectedConversationId ? (
          <>
            {/* Header for the selected conversation */}
            <div className="p-4 border-b flex items-center gap-3 bg-muted/50">
               <Avatar className="h-9 w-9 flex-shrink-0">
                   <AvatarImage src={otherParticipantAvatar} alt={otherParticipantName} />
                   <AvatarFallback className="bg-primary text-primary-foreground text-xs">{otherParticipantInitials}</AvatarFallback>
               </Avatar>
               <div className="flex-grow min-w-0">
                  <h3 className="text-lg font-semibold text-foreground truncate">{otherParticipantName}</h3>
                  {selectedPostQuestion && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Regarding: <span className="font-medium text-primary">{selectedPostQuestion}</span>
                      </p>
                   )}
                    {otherParticipantId && (
                        <Link
                            href={`/profile/${otherParticipantId}`}
                            className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1 mt-1"
                        >
                            <Building className="h-3 w-3" /> View Profile
                        </Link>
                    )}
               </div>
               {selectedConversation?.postId && selectedConversation.postId !== 'general_connection' && (
                   <Link href={`/?postId=${selectedConversation.postId}`}
                         className={cn(
                             "text-primary hover:underline text-xs flex items-center gap-1 ml-auto flex-shrink-0", // Added flex-shrink-0
                             "focus:outline-none focus:ring-1 focus:ring-ring rounded p-1"
                         )}
                         title="View Post Details"
                         aria-label="View Post Details"
                    >
                        <Eye className="h-3.5 w-3.5" /> View Post
                   </Link>
                )}
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-grow p-4 bg-background">
               {isLoadingMessages ? (
                   <div className="flex justify-center items-center h-full">
                       <Loader2 className="h-6 w-6 animate-spin text-primary" />
                   </div>
               ) : messagesError ? (
                   <p className="text-sm text-destructive text-center">Error loading messages.</p>
               ) : messages.length === 0 ? (
                   <p className="text-sm text-muted-foreground text-center h-full flex items-center justify-center">
                        Start the conversation!
                   </p>
               ) : (
                 messages.map((msg) => (
                   <MessageBubble
                     key={msg.id}
                     message={msg}
                     isOwnMessage={msg.senderId === currentUserId}
                   />
                 ))
               )}
               <div ref={messagesEndRef} /> {/* For auto-scrolling */}
            </ScrollArea>

            {/* Message Input Area */}
            <div className="p-4 border-t bg-muted/50">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={sendMessageMutation.isPending || isLoadingMessages}
                  className="flex-grow bg-background"
                  aria-label="Message input"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newMessage.trim() || sendMessageMutation.isPending || isLoadingMessages}
                  aria-label="Send message"
                >
                   {sendMessageMutation.isPending ? (
                       <Loader2 className="h-4 w-4 animate-spin" />
                   ) : (
                       <Send className="h-4 w-4" />
                   )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          // Placeholder if no conversation is selected
          <div className="flex-grow flex flex-col items-center justify-center text-center p-4 bg-background">
             {isConversationsError ? (
                  <>
                     <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                     <h3 className="text-lg font-medium text-destructive">Could Not Load Conversations</h3>
                     <p className="text-sm text-muted-foreground mt-2">
                         {conversationsError?.message || "Please try again later or check your connection/permissions."}
                     </p>
                  </>
             ) : isLoadingConversations ? (
                 <>
                     <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                     <h3 className="text-lg font-medium text-muted-foreground">Loading Conversations...</h3>
                 </>
             ) : (
                  <>
                     <Users className="h-12 w-12 text-muted-foreground mb-4" />
                     <h3 className="text-lg font-medium text-foreground">Select a Conversation</h3>
                     <p className="text-sm text-muted-foreground">Choose a conversation from the list to start chatting.</p>
                  </>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

