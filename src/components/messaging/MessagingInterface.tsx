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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Users, AlertTriangle, Eye, Building, MessageSquare, X, CornerDownLeft, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Unsubscribe } from 'firebase/firestore';

interface MessagingInterfaceProps {
  currentUserId: string;
  initialConversationId?: string | null;
  highlightPostId?: string | null; // For highlighting a conversation related to a specific post
  initialMessageText?: string; // For pre-filling the message input
}

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
    const otherParticipantId = conversation.participants.find(p => p !== currentUserId);

    const { data: otherParticipantDetails, isLoading: isLoadingDetails } = useQuery({
        queryKey: ['userDetails', otherParticipantId, 'messagingInterfaceList'],
        queryFn: () => otherParticipantId ? getUserDetails(otherParticipantId) : Promise.resolve(null),
        enabled: !!otherParticipantId,
        staleTime: Infinity, // Cache user details indefinitely as they are unlikely to change frequently here
    });

    // Prioritize fetched name, then generated name.
    const participantName = isLoadingDetails
        ? 'Loading...'
        : otherParticipantDetails?.name || generateAnonymousName(otherParticipantId || 'unknown_user');
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
         <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarImage src={otherParticipantDetails?.avatar} alt={participantName} />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
         </Avatar>
        <div className="flex-grow overflow-hidden min-w-0"> {/* Ensure this div can shrink and allow truncation */}
          <p className="text-sm font-medium text-foreground truncate">{participantName}</p>
          {postQuestion && ( // Display post context if available
              <p className="text-xs text-primary truncate font-medium mt-0.5">
                  Re: {postQuestion}
              </p>
          )}
          <p className={cn("text-xs text-muted-foreground truncate mt-0.5", isSelected ? "font-medium" : "")}>
              {conversation.lastMessage || 'No messages yet'}
          </p>
        </div>
        {formattedTime && (
          <span className="text-xs text-muted-foreground self-start pt-1 flex-shrink-0">
            {formattedTime}
          </span>
        )}
      </button>
       {conversation.postId && conversation.postId !== 'general_connection' && ( // Only show if postId is relevant
           <Link href={`/?postId=${conversation.postId}`} // Link to the post page
                 className={cn(
                     "absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity",
                     "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                     "p-1 rounded-md", // Make it a small clickable area
                     "focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring" // Accessibility
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
  onStartReply: (message: SerializableMessage) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, isOwnMessage, onStartReply }) => {
  const timestamp = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Sending...';

  return (
    <div className={cn("flex group mb-1", isOwnMessage ? "justify-end" : "justify-start")}>
       {!isOwnMessage && ( // Show reply button on the left for other's messages
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-1 mr-1 opacity-0 group-hover:opacity-50 focus-within:opacity-50 hover:opacity-100 self-center"
          onClick={() => onStartReply(message)}
          aria-label="Reply to message"
        >
          <CornerDownLeft className="h-3.5 w-3.5" />
        </Button>
      )}
      <div className={cn(
        "rounded-lg px-3 py-2 max-w-[75%] break-words shadow-sm relative",
        isOwnMessage
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground",
        message.isBotMessage && !isOwnMessage ? "bg-pink-500 text-white border-2 border-red-500" : "" // Debug style for bot messages
      )}>
        {/* Display replied-to message snippet */}
        {message.replyToMessageId && message.repliedToTextSnippet && (
          <div className={cn(
            "text-xs p-1.5 rounded-md mb-1 border-l-2",
            isOwnMessage
              ? "bg-card text-primary border-primary/30" // Style for own message reply snippet
              : "bg-accent text-accent-foreground border-accent/50", // Style for other's message reply snippet
             message.isBotMessage && !isOwnMessage ? "border-primary/50 bg-pink-300 text-pink-800" : "" // Debug style for bot reply snippet
          )}>
            <p className="italic truncate opacity-80">{message.repliedToTextSnippet}</p>
          </div>
        )}
        <p className="text-sm">{message.text}</p>
        <p className={cn(
             "text-xs mt-1",
             isOwnMessage ? "text-primary-foreground/80 text-right" : "text-muted-foreground/80 text-left"
        )}>
            {timestamp}
        </p>
      </div>
      {isOwnMessage && ( // Show reply button on the right for own messages
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-1 ml-1 opacity-0 group-hover:opacity-50 focus-within:opacity-50 hover:opacity-100 self-center"
          onClick={() => onStartReply(message)}
          aria-label="Reply to message"
        >
          <CornerDownLeft className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
});
MessageBubble.displayName = 'MessageBubble';

export const MessagingInterface: React.FC<MessagingInterfaceProps> = ({
    currentUserId,
    initialConversationId,
    highlightPostId, // For highlighting a conversation related to a specific post
    initialMessageText,
}) => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId || null);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<SerializableMessage | null>(null); // State for replied-to message
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null); // Ref for message input
  const isMobile = useIsMobile();
  const [activeMobileView, setActiveMobileView] = useState<'list' | 'chat'>(initialConversationId ? 'chat' : 'list');


  const [messages, setMessages] = useState<SerializableMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [messagesError, setMessagesError] = useState<Error | null>(null);

  // Fetch conversations for the current user
  const {
      data: conversations = [],
      isLoading: isLoadingConversations,
      error: conversationsError,
      isError: isConversationsError
    } = useQuery<ClientConversation[], Error>({
    queryKey: ['conversations', currentUserId],
    queryFn: () => getConversationsForUser(currentUserId),
    enabled: !!currentUserId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch on window focus
    retry: 1, // Retry once on failure
  });

  useEffect(() => {
      if (isConversationsError && conversationsError) {
          console.error("[MessagingInterface] Error fetching conversations:", conversationsError);
           toast({
               variant: "destructive",
               title: "Error Loading Conversations",
               description: conversationsError.message || "Could not load conversations.",
               duration: 7000, // Show longer
           });
      }
  }, [isConversationsError, conversationsError, toast]);

   // Fetch post details for conversations that have a postId
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

  // Real-time listener for messages in the selected conversation
  useEffect(() => {
    console.log("[MessagingInterface] Messages useEffect. SelectedConversationId:", selectedConversationId);
    if (!selectedConversationId) {
      setMessages([]);
      setIsLoadingMessages(false);
      setMessagesError(null);
      return;
    }

    setIsLoadingMessages(true);
    setMessagesError(null);

    // Call getMessagesForConversation which sets up the onSnapshot listener
    const unsubscribe = getMessagesForConversation(
      selectedConversationId,
      (newMessages) => {
        // This callback is fired by onSnapshot within getMessagesForConversation
        console.log(`%c[MessagingInterface] onUpdate FROM SERVICE called for conv ${selectedConversationId}. New messages count: ${newMessages.length}`, "color: green; font-weight: bold;", newMessages);
        setMessages(newMessages);
        setIsLoadingMessages(false);
      },
      (error) => {
        // This error callback is for errors from the onSnapshot listener itself
        console.error(`%c[MessagingInterface] Error fetching real-time messages for ${selectedConversationId}:`, "color: red;", error);
        setMessagesError(error);
        setIsLoadingMessages(false);
        toast({
            variant: "destructive",
            title: "Error Loading Messages",
            description: error.message || "Could not load messages in real-time.",
        });
      }
    );

    // Cleanup function for the useEffect hook
    return () => {
        console.log(`%c[MessagingInterface] Unsubscribing from messages for conv ${selectedConversationId}`, "color: orange;");
        unsubscribe(); // Call the unsubscribe function returned by getMessagesForConversation
    };
  }, [selectedConversationId, toast]); // Re-run effect when selectedConversationId changes

  // Mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
        // Message sent successfully
        setNewMessage(''); // Clear the input field
        setReplyingTo(null); // Clear reply context
        // Optionally, refetch conversations to update last message, or rely on real-time update if configured
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

   // Scroll to the bottom of the messages list when new messages are added
   useEffect(() => {
       if (messagesEndRef.current) {
           // Using a slight delay can help ensure the DOM has updated
           const timer = setTimeout(() => {
               messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
           }, 100); // Adjust delay if needed
           return () => clearTimeout(timer);
       }
   }, [messages]); // Dependency on messages array

  // Handle sending a new message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversationId || sendMessageMutation.isPending) {
        return;
    }
    const messageData: NewMessageData = {
        conversationId: selectedConversationId,
        senderId: currentUserId,
        text: newMessage.trim(),
        ...(replyingTo && { // Add reply context if available
          replyToMessageId: replyingTo.id,
          repliedToTextSnippet: replyingTo.text.substring(0, 75) + (replyingTo.text.length > 75 ? "..." : "")
        }),
    };
    sendMessageMutation.mutate(messageData);
  };

  // Effect to handle initialConversationId and pre-fill message
  useEffect(() => {
     // Handle initial conversation selection
     if (!isLoadingConversations && !isConversationsError && conversations && conversations.length > 0) {
         if (initialConversationId && conversations.some(c => c.id === initialConversationId)) {
             // If initialConversationId is valid and exists, select it
             if (selectedConversationId !== initialConversationId) {
                setSelectedConversationId(initialConversationId);
                if (isMobile) setActiveMobileView('chat');
             }
         } else if (!selectedConversationId && !isMobile) {
            // For desktop, if no initial one is selected, maybe select the first one.
            // setSelectedConversationId(conversations[0].id); // Or keep null to show "Select a conversation"
         }
     } else if (!isLoadingConversations && !selectedConversationId && !isConversationsError) {
         // If no conversations or error, ensure no conversation is selected
         setSelectedConversationId(null);
     }

     // Handle initialMessageText for pre-filling
     if (initialMessageText && selectedConversationId && newMessage === '') { // Only set if newMessage is empty
        console.log(`%c[MessagingInterface] Setting initial message text from prop: "${initialMessageText}"`, "color: blue;");
        setNewMessage(initialMessageText);
        if (messageInputRef.current) {
            messageInputRef.current.focus(); // Focus the input field
        }
     }

     // Mobile view logic based on initialConversationId
     if (isMobile) {
         if (initialConversationId && activeMobileView !== 'chat') {
             setActiveMobileView('chat');
         } else if (!initialConversationId && activeMobileView !== 'list') {
             // Don't automatically switch back to list if user navigates manually within mobile chat
             // This part might need adjustment based on desired UX
         }
     }
   }, [
       conversations,
       selectedConversationId,
       isLoadingConversations,
       isConversationsError,
       initialConversationId,
       isMobile,
       activeMobileView, // Added to dependency array
       initialMessageText, // Added to dependency array
       newMessage // Added to dependency array
    ]);

   const handleConversationSelect = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    if (isMobile) {
      setActiveMobileView('chat');
    }
  }, [isMobile, setActiveMobileView, setSelectedConversationId]);


   // Find the selected conversation details for the header
   const selectedConversation = conversations.find(c => c.id === selectedConversationId);
   const otherParticipantId = selectedConversation?.participants.find(p => p !== currentUserId);

   // Fetch details for the participant in the header
   const { data: headerParticipantDetails, isLoading: isLoadingHeaderDetails } = useQuery({
       queryKey: ['userDetails', otherParticipantId, 'messagingInterfaceHeader'], // More specific query key
       queryFn: () => otherParticipantId ? getUserDetails(otherParticipantId) : Promise.resolve(null),
       enabled: !!otherParticipantId,
       staleTime: Infinity,
   });

   const otherParticipantName = isLoadingHeaderDetails
       ? 'Loading...'
       : headerParticipantDetails?.name || generateAnonymousName(otherParticipantId || 'Select Conversation');
   const otherParticipantInitials = getInitials(otherParticipantName);
   const otherParticipantAvatar = headerParticipantDetails?.avatar;
   const selectedPostQuestion = selectedConversation?.postId && selectedConversation.postId !== 'general_connection'
        ? postDetailsMap?.get(selectedConversation.postId)?.question
        : null;

  // Handlers for message replies
  const handleStartReply = useCallback((message: SerializableMessage) => {
    setReplyingTo(message);
    messageInputRef.current?.focus();
  }, [messageInputRef]); // messageInputRef is stable

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []); // No dependencies

  return (
    <div className="flex h-full">
      {/* Conversations List Panel */}
      <div
        className={cn(
          "flex flex-col border-r bg-background",
          isMobile
            ? activeMobileView === 'list' ? "w-full flex" : "hidden"
            : "w-1/3 lg:w-1/4 flex" // Adjusted desktop width
        )}
      >
        <div className={cn("border-b", isMobile ? "p-3" : "p-4")}>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> All Messages
          </h2>
        </div>
        <ScrollArea className="flex-grow">
          <div className={cn(isMobile ? "p-1" : "p-2", "space-y-1")}>
            {isLoadingConversations ? (
              // Skeleton loader for conversation list
              Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-grow space-y-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                      </div>
                  </div>
              ))
             ) : isConversationsError ? ( // Display error message if conversations query fails
                 <div className="p-4 text-center text-destructive">
                     <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
                     <p className="text-sm font-medium">Error Loading Conversations</p>
                     <p className="text-xs mt-1">
                         {conversationsError?.message || "An unknown error occurred."}
                     </p>
                 </div>
             ) : conversations.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">No messages yet.</p>
            ) : (
              conversations.map((conv) => {
                 // Get post question from the fetched postDetailsMap
                 const postQuestion = conv.postId && conv.postId !== 'general_connection' ? postDetailsMap?.get(conv.postId)?.question : null;
                 // Determine if this conversation should be highlighted
                 const shouldHighlight = highlightPostId === conv.postId && selectedConversationId === conv.id;
                 return (
                     <ConversationListItem
                         key={conv.id}
                         conversation={conv}
                         isSelected={selectedConversationId === conv.id}
                         currentUserId={currentUserId}
                         onSelect={handleConversationSelect}
                         postQuestion={postQuestion} // Pass the fetched post question
                         highlight={shouldHighlight}
                     />
                 );
             })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Messages Panel */}
      <div
        className={cn(
          "flex flex-col",
          isMobile
            ? activeMobileView === 'chat' ? "w-full flex" : "hidden"
            : "w-2/3 lg:w-3/4 flex" // Adjusted desktop width
        )}
      >
        {selectedConversationId ? (
          <>
            {/* Chat Header */}
            <div className={cn("border-b flex items-center gap-3 bg-muted/50", isMobile ? "p-3" : "p-4")}>
               {isMobile && activeMobileView === 'chat' && (
                 <Button variant="ghost" size="icon" className="mr-1" onClick={() => setActiveMobileView('list')}>
                   <ArrowLeft className="h-5 w-5" />
                 </Button>
               )}
               <Avatar className="h-9 w-9 flex-shrink-0">
                   <AvatarImage src={otherParticipantAvatar} alt={otherParticipantName} />
                   <AvatarFallback className="bg-primary text-primary-foreground text-xs">{otherParticipantInitials}</AvatarFallback>
               </Avatar>
               <div className="flex-grow min-w-0"> {/* Ensure this div can shrink */}
                  <h3 className="text-lg font-semibold text-foreground truncate">{otherParticipantName}</h3>
                  {selectedPostQuestion && ( // Display post context if available
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Regarding: <span className="font-medium text-primary">{selectedPostQuestion}</span>
                      </p>
                   )}
                    {otherParticipantId && ( // Link to other participant's profile
                        <Link
                            href={`/profile/${otherParticipantId}`}
                            className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1 mt-0.5"
                        >
                            <Building className="h-3 w-3" /> View Profile
                        </Link>
                    )}
               </div>
               {/* View Post Link - Hidden on mobile for cleaner interface */}
               {selectedConversation?.postId && selectedConversation.postId !== 'general_connection' && (
                   <Link href={`/?postId=${selectedConversation.postId}`} // Link to the post page
                         className={cn(
                             "text-primary hover:underline text-xs items-center gap-1 ml-auto flex-shrink-0",
                             "focus:outline-none focus:ring-1 focus:ring-ring rounded p-1",
                             "hidden md:flex" // Hide on mobile, show on md+
                         )}
                         title="View Post Details"
                         aria-label="View Post Details"
                    >
                        <Eye className="h-3.5 w-3.5" /> View Post
                   </Link>
                )}
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-grow bg-background">
              <div className={cn(isMobile ? "px-2 py-3" : "p-4")}>
                {console.log(`[MessagingInterface RENDER] isLoadingMessages: ${isLoadingMessages}, messagesError: ${!!messagesError}, messages Count: ${messages.length}, Last Message: ${messages.length > 0 ? messages[messages.length - 1]?.text?.substring(0,20) : 'N/A'}`)}
                {isLoadingMessages ? (
                     <div className="flex justify-center items-center h-full">
                         <Loader2 className="h-6 w-6 animate-spin text-primary" />
                     </div>
                 ) : messagesError ? (
                     <p className="text-sm text-destructive text-center">{messagesError.message || "Error loading messages."}</p>
                 ) : messages.length === 0 ? (
                     <p className="text-sm text-muted-foreground text-center h-full flex items-center justify-center">
                          Start the conversation!
                     </p>
                 ) : (
                   messages.map((msg) => {
                     console.log(`[MessagingInterface] Rendering message: ID=${msg.id}, Sender=${msg.senderId}, IsBot=${msg.isBotMessage}, Text="${msg.text.substring(0,20)}..."`);
                     return (
                       <MessageBubble
                         key={msg.id}
                         message={msg}
                         isOwnMessage={msg.senderId === currentUserId}
                         onStartReply={handleStartReply} // Pass handler to bubble
                       />
                     );
                   })
                 )}
                 <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input Area */}
            <div className={cn("border-t bg-muted/50", isMobile ? "p-2" : "p-4")}>
              {/* Display "Replying to..." UI */}
              {replyingTo && (
                <div className="mb-2 p-2 bg-secondary/50 rounded-md text-xs text-secondary-foreground relative">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium opacity-70">Replying to: <span className="italic">"{replyingTo.text.substring(0,50)}{replyingTo.text.length > 50 ? '...' : ''}"</span></p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-5 w-5 absolute top-1 right-1" onClick={handleCancelReply} aria-label="Cancel reply">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                  ref={messageInputRef}
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
             {isConversationsError ? ( // Show error if conversation query failed and no chat is selected
                  <>
                     <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                     <h3 className="text-lg font-medium text-destructive">Could Not Load Conversations</h3>
                     <p className="text-sm text-muted-foreground mt-2">
                         {conversationsError?.message || "Please try again later or check your connection/permissions."}
                     </p>
                  </>
             ) : isLoadingConversations ? ( // Show loading if conversations are still loading
                 <>
                     <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                     <h3 className="text-lg font-medium text-muted-foreground">Loading Messages...</h3>
                 </>
             ) : ( // Default placeholder
                  <>
                     <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                     <h3 className="text-lg font-medium text-foreground">Select or Start a Conversation</h3>
                     <p className="text-sm text-muted-foreground mt-1">Choose a conversation from the list or start a new one from a post.</p>
                  </>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
