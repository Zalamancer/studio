
// src/components/messaging/MessagingInterface.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getConversationsForUser,
  getMessagesForConversation,
  sendMessage,
  findOrCreateConversation, // Added this import
} from '@/services/messagingService';
import type { Conversation, Message, NewMessageData } from '@/types/messaging';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, User, Users } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface MessagingInterfaceProps {
  currentUserId: string;
}

// Helper function to get the initials from a name or email
const getInitials = (id: string | undefined | null): string => {
    if (!id) return '?';
    // In a real app, you'd fetch user details (name/email) based on the ID
    // For now, we'll use the first 2 chars of the ID or a placeholder
    const nameOrEmail = id.substring(0, 2).toUpperCase(); // Placeholder
    return nameOrEmail || '?';
};

// --- Conversation List Item ---
interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  currentUserId: string;
  onSelect: (conversationId: string) => void;
}

const ConversationListItem: React.FC<ConversationListItemProps> = React.memo(({
  conversation,
  isSelected,
  currentUserId,
  onSelect
}) => {
    // Determine the other participant's ID
    const otherParticipantId = conversation.participants.find(p => p !== currentUserId);
    // In a real app, fetch the participant's name/avatar based on otherParticipantId
    const participantName = otherParticipantId ? `User ${otherParticipantId.substring(0, 4)}...` : 'Unknown User';
    const initials = getInitials(otherParticipantId);

    const lastMessageTimestamp = conversation.lastMessageTimestamp instanceof Timestamp
      ? conversation.lastMessageTimestamp.toDate()
      : null;

    const formattedTime = lastMessageTimestamp
        ? lastMessageTimestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : '';


  return (
    <button
      onClick={() => onSelect(conversation.id)}
      className={cn(
        "w-full text-left p-3 hover:bg-muted transition-colors rounded-lg flex items-center gap-3",
        isSelected ? "bg-muted" : ""
      )}
      aria-current={isSelected ? "page" : undefined}
    >
       <Avatar className="h-9 w-9">
        {/* <AvatarImage src={participantAvatar} alt={participantName} /> */}
        <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
       </Avatar>
      <div className="flex-grow overflow-hidden">
        <p className="text-sm font-medium text-foreground truncate">{participantName}</p>
        <p className={cn("text-xs text-muted-foreground truncate", isSelected ? "font-medium" : "")}>
            {conversation.lastMessage || 'No messages yet'}
        </p>
      </div>
      {formattedTime && (
        <span className="text-xs text-muted-foreground self-start pt-1">{formattedTime}</span>
      )}
    </button>
  );
});
ConversationListItem.displayName = 'ConversationListItem';


// --- Message Bubble ---
interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, isOwnMessage }) => {
  const timestamp = message.timestamp instanceof Timestamp
    ? message.timestamp.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Sending...'; // Or handle invalid timestamp

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


// --- Main Messaging Interface Component ---
export const MessagingInterface: React.FC<MessagingInterfaceProps> = ({ currentUserId }) => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for scrolling to bottom

  // --- Query: Fetch Conversations ---
  const {
      data: conversations = [],
      isLoading: isLoadingConversations,
      error: conversationsError
    } = useQuery<Conversation[]>({
    queryKey: ['conversations', currentUserId],
    queryFn: () => getConversationsForUser(currentUserId),
    enabled: !!currentUserId, // Only run if userId is available
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // --- Query: Fetch Messages for Selected Conversation ---
   const {
      data: messages = [],
      isLoading: isLoadingMessages,
      error: messagesError
   } = useQuery<Message[]>({
       queryKey: ['messages', selectedConversationId],
       queryFn: () => getMessagesForConversation(selectedConversationId!), // Add non-null assertion
       enabled: !!selectedConversationId, // Only fetch if a conversation is selected
       staleTime: 1000 * 15, // 15 seconds (messages might update more often)
       refetchInterval: 1000 * 30, // Refetch every 30 seconds
   });

  // --- Mutation: Send Message ---
  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
        setNewMessage(''); // Clear input field
        // Invalidate messages for the current conversation to refetch
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConversationId] });
        // Optionally invalidate conversations to update last message preview
        queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
    },
    onError: (error: Error) => {
        toast({
            variant: "destructive",
            title: "Send Failed",
            description: `Could not send message: ${error.message}`,
        });
    },
  });

  // --- Scroll to bottom when messages load or new message arrives ---
   useEffect(() => {
       messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
   }, [messages]);

  // --- Handle Sending Message ---
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

   // --- Select the first conversation by default if none is selected ---
   useEffect(() => {
       if (!selectedConversationId && conversations && conversations.length > 0) {
           setSelectedConversationId(conversations[0].id);
       }
   }, [conversations, selectedConversationId]);

  // --- Derive Selected Conversation Details ---
   const selectedConversation = conversations.find(c => c.id === selectedConversationId);
   const otherParticipantId = selectedConversation?.participants.find(p => p !== currentUserId);
   const otherParticipantName = otherParticipantId ? `User ${otherParticipantId.substring(0, 4)}...` : 'Select a Conversation';
   const otherParticipantInitials = getInitials(otherParticipantId);


  return (
    <div className="flex h-full border rounded-lg overflow-hidden bg-card">
      {/* Conversation List Sidebar */}
      <div className="w-1/3 border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5" /> Conversations
          </h2>
        </div>
        <ScrollArea className="flex-grow">
          <div className="p-2 space-y-1">
            {isLoadingConversations ? (
              Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-grow space-y-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                      </div>
                  </div>
              ))
            ) : conversationsError ? (
              <p className="p-4 text-sm text-destructive text-center">Error loading conversations.</p>
            ) : conversations.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">No conversations yet.</p>
            ) : (
              conversations.map((conv) => (
                <ConversationListItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedConversationId === conv.id}
                    currentUserId={currentUserId}
                    onSelect={setSelectedConversationId}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Message Area */}
      <div className="w-2/3 flex flex-col">
        {selectedConversationId ? (
          <>
            {/* Message Header */}
            <div className="p-4 border-b flex items-center gap-3 bg-muted/50">
               <Avatar className="h-9 w-9">
                   {/* <AvatarImage src={otherParticipantAvatar} alt={otherParticipantName} /> */}
                   <AvatarFallback className="bg-primary text-primary-foreground text-xs">{otherParticipantInitials}</AvatarFallback>
               </Avatar>
              <h3 className="text-lg font-semibold text-foreground">{otherParticipantName}</h3>
            </div>

            {/* Message List */}
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
               <div ref={messagesEndRef} /> {/* Anchor for scrolling */}
            </ScrollArea>

            {/* Message Input */}
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
          // Placeholder when no conversation is selected
          <div className="flex-grow flex flex-col items-center justify-center text-center p-4 bg-background">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">Select a Conversation</h3>
            <p className="text-sm text-muted-foreground">Choose a conversation from the list to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
};
