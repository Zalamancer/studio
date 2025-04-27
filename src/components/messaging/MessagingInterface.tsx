// src/components/messaging/MessagingInterface.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getConversationsForUser,
  getMessagesForConversation,
  sendMessage,
  getPostDetails, // Import getPostDetails
} from '@/services/messagingService';
import type { ClientConversation, SerializableMessage, NewMessageData } from '@/types/messaging'; // Use ClientConversation & SerializableMessage
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, User, Users, AlertTriangle, Eye } from 'lucide-react'; // Added AlertTriangle, Eye
// Timestamp import no longer needed here as we work with numbers
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation'; // Import useSearchParams
import Link from 'next/link'; // Import Link for navigation

interface MessagingInterfaceProps {
  currentUserId: string;
  initialConversationId?: string | null; // Optional initial conversation to select
  highlightPostId?: string | null; // Optional post to highlight
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
  conversation: ClientConversation; // Use ClientConversation
  isSelected: boolean;
  currentUserId: string;
  onSelect: (conversationId: string) => void;
  postQuestion?: string | null; // Optional post question for context
  highlight?: boolean; // Flag to highlight this item
}

const ConversationListItem: React.FC<ConversationListItemProps> = React.memo(({
  conversation,
  isSelected,
  currentUserId,
  onSelect,
  postQuestion, // Receive post question
  highlight, // Receive highlight flag
}) => {
    // Determine the other participant's ID
    const otherParticipantId = conversation.participants.find(p => p !== currentUserId);
    // In a real app, fetch the participant's name/avatar based on otherParticipantId
    const participantName = otherParticipantId ? `User ${otherParticipantId.substring(0, 4)}...` : 'Unknown User';
    const initials = getInitials(otherParticipantId);

    // Format timestamp (now a number)
    const formattedTime = conversation.lastMessageTimestamp
        ? new Date(conversation.lastMessageTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : '';

  return (
    <div className={cn("relative group", highlight ? "ring-2 ring-primary ring-offset-2 rounded-lg" : "")}>
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
          {/* Display Post Question if available */}
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
          <span className="text-xs text-muted-foreground self-start pt-1">{formattedTime}</span>
        )}
      </button>
        {/* "View Details" button - only shown if postId exists */}
       {conversation.postId && (
           <Link href={`/?postId=${conversation.postId}`} // Link back to home page, potentially highlighting the post
                 className={cn(
                     "absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity",
                     "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                     "p-1 rounded-md",
                     "focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring" // Ensure visibility on focus
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


// --- Message Bubble ---
interface MessageBubbleProps {
  message: SerializableMessage; // Use SerializableMessage
  isOwnMessage: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, isOwnMessage }) => {
  // Format the timestamp (which is now a number)
  const timestamp = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
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
export const MessagingInterface: React.FC<MessagingInterfaceProps> = ({
    currentUserId,
    initialConversationId,
    highlightPostId,
}) => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId || null);
  const [newMessage, setNewMessage] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for scrolling to bottom

  // --- Query: Fetch Conversations ---
  const {
      data: conversations = [],
      isLoading: isLoadingConversations,
      error: conversationsError, // Capture the error object
      isError: isConversationsError // Boolean flag for error state
    } = useQuery<ClientConversation[], Error>({ // Expect ClientConversation[] now
    queryKey: ['conversations', currentUserId],
    queryFn: () => getConversationsForUser(currentUserId), // Service returns ClientConversation[]
    enabled: !!currentUserId, // Only run if userId is available
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    retry: 1, // Retry only once on error
  });

  // Log error if conversations fetch fails
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

  // --- Query: Fetch Post Details for each conversation's postId ---
   const postDetailsQueries = useQuery({
     queryKey: ['postDetails', conversations.map(c => c.postId).filter(Boolean)], // Key depends on postIds
     queryFn: async () => {
       const postIds = conversations.map(c => c.postId).filter((id): id is string => !!id);
       const detailsMap = new Map<string, { question: string } | null>();
       await Promise.all(postIds.map(async (postId) => {
         const details = await getPostDetails(postId);
         detailsMap.set(postId, details);
       }));
       return detailsMap;
     },
     enabled: conversations.length > 0 && conversations.some(c => c.postId), // Only run if there are conversations with postIds
     staleTime: 1000 * 60 * 10, // Cache post details for 10 minutes
   });

   const postDetailsMap = postDetailsQueries.data;


  // --- Query: Fetch Messages for Selected Conversation ---
   const {
      data: messages = [],
      isLoading: isLoadingMessages,
      error: messagesError
   } = useQuery<SerializableMessage[]>({ // Expect SerializableMessage[]
       queryKey: ['messages', selectedConversationId],
       queryFn: () => getMessagesForConversation(selectedConversationId!), // Service fn returns SerializableMessage[]
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
        // Invalidate post details if necessary, although less likely to change frequently
        // queryClient.invalidateQueries({ queryKey: ['postDetails'] });
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
       // Use timeout to ensure DOM is updated before scrolling
       const timer = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
       }, 100); // Adjust delay if needed
       return () => clearTimeout(timer);
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
        // No timestamp needed here, service layer adds serverTimestamp
    };
    sendMessageMutation.mutate(messageData);
  };

   // --- Select conversation based on initialConversationId or default to first ---
   useEffect(() => {
     if (!isLoadingConversations && !isConversationsError && conversations && conversations.length > 0) {
         if (initialConversationId && conversations.some(c => c.id === initialConversationId)) {
             // If a valid initial ID is provided and exists, select it
             if (selectedConversationId !== initialConversationId) {
                setSelectedConversationId(initialConversationId);
             }
         } else if (!selectedConversationId) {
             // Otherwise, if no conversation is selected, select the first one
             setSelectedConversationId(conversations[0].id);
         }
     } else if (!isLoadingConversations && !selectedConversationId) {
         // Handle case with no conversations or still loading
         setSelectedConversationId(null);
     }
     // Ensure this runs only when conversations load or initialConversationId changes
   }, [conversations, selectedConversationId, isLoadingConversations, isConversationsError, initialConversationId]);


  // --- Derive Selected Conversation Details ---
   const selectedConversation = conversations.find(c => c.id === selectedConversationId);
   const otherParticipantId = selectedConversation?.participants.find(p => p !== currentUserId);
   const otherParticipantName = otherParticipantId ? `User ${otherParticipantId.substring(0, 4)}...` : 'Select a Conversation';
   const otherParticipantInitials = getInitials(otherParticipantId);
   const selectedPostQuestion = selectedConversation?.postId ? postDetailsMap?.get(selectedConversation.postId)?.question : null;


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
             ) : isConversationsError ? ( // Check the isError flag
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
                 const postQuestion = conv.postId ? postDetailsMap?.get(conv.postId)?.question : null;
                 const shouldHighlight = highlightPostId === conv.postId && initialConversationId === conv.id;
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
               <div className="flex-grow">
                  <h3 className="text-lg font-semibold text-foreground">{otherParticipantName}</h3>
                  {/* Display post question in header if available */}
                  {selectedPostQuestion && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                          Regarding: <span className="font-medium text-primary">{selectedPostQuestion}</span>
                      </p>
                   )}
               </div>
               {/* Optional: Link to post details from header */}
               {selectedConversation?.postId && (
                   <Link href={`/?postId=${selectedConversation.postId}`}
                         className={cn(
                             "text-primary hover:underline text-xs flex items-center gap-1 ml-auto",
                             "focus:outline-none focus:ring-1 focus:ring-ring rounded p-1"
                         )}
                         title="View Post Details"
                         aria-label="View Post Details"
                    >
                        <Eye className="h-3.5 w-3.5" /> View Post
                   </Link>
                )}
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
           // Placeholder when no conversation is selected OR if there was an error loading convos
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
