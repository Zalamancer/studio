
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
import type { ClientConversation, SerializableMessage, NewMessageData, Message } from '@/types/messaging';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, MessageSquare, AlertTriangle, Eye, Building, X, CornerDownLeft, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { useIsMobile } from '@/hooks/use-mobile';

interface MessagingInterfaceProps {
  currentUserId: string;
  activeConversationId?: string | null;
  onSelectConversation: (conversationId: string) => void;
  initialMessageText?: string;
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
        staleTime: Infinity,
    });

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
        <div className="flex-grow overflow-hidden min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{participantName}</p>
          {postQuestion && (
              <p className="text-xs text-primary truncate font-medium mt-0.5">
                  Re: {postQuestion}
              </p>
          )}
          <p className={cn("text-xs text-muted-foreground truncate mt-0.5", isSelected && conversation.lastMessage ? "font-semibold" : "")}>
              {conversation.lastMessage || 'No messages yet'}
          </p>
        </div>
        {formattedTime && (
          <span className="text-xs text-muted-foreground self-start pt-1 flex-shrink-0">
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
                     "focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring",
                     "hidden md:flex"
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
  currentUserId: string;
  onStartReply: (message: SerializableMessage) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, currentUserId, onStartReply }) => {
  const isOwnMessage = !message.isBotMessage && message.senderId === currentUserId;

  const timestamp = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Sending...';

  let bubbleClasses = cn(
    "rounded-lg px-3 py-2 max-w-[75%] break-words shadow-sm relative",
    isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
  );

  if (message.isBotMessage) {
    bubbleClasses = cn("rounded-lg px-3 py-2 max-w-[75%] break-words shadow-sm relative", "bg-muted text-foreground");
  }


  return (
    <div className={cn("flex group mb-1", isOwnMessage ? "justify-end" : "justify-start")}>
       {!isOwnMessage && (
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
      <div className={bubbleClasses}>
        {message.replyToMessageId && message.repliedToTextSnippet && (
          <div className={cn(
            "text-xs p-1.5 rounded-md mb-1 border-l-2",
             isOwnMessage
              ? "bg-card text-primary border-primary/30"
              : "bg-accent/50 text-accent-foreground/80 border-accent/50"
          )}>
            <p className="italic truncate opacity-80">{message.repliedToTextSnippet}</p>
          </div>
        )}
        <p className="text-sm">
          {message.text}
        </p>
        <p className={cn(
             "text-xs mt-1",
             isOwnMessage ? "text-primary-foreground/80 text-right" : "text-muted-foreground/80 text-left"
        )}>
            {timestamp}
        </p>
      </div>
      {isOwnMessage && (
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
    activeConversationId,
    onSelectConversation,
    initialMessageText,
}) => {
  const isMobile = useIsMobile();
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<SerializableMessage | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<SerializableMessage[]>([]);
  const [isLoadingMessagesState, setIsLoadingMessagesState] = useState(true);
  const [messagesErrorState, setMessagesErrorState] = useState<Error | null>(null);


  useEffect(() => {
    if (initialMessageText && activeConversationId && newMessage === '') {
      setNewMessage(initialMessageText);
      setTimeout(() => messageInputRef.current?.focus(), 0);
    }
  }, [initialMessageText, activeConversationId, newMessage]);


  const {
      data: conversations = [],
      isLoading: isLoadingConversations,
      error: conversationsError,
      isError: isConversationsError
    } = useQuery<ClientConversation[], Error>({
    queryKey: ['conversations', currentUserId],
    queryFn: () => getConversationsForUser(currentUserId),
    enabled: !!currentUserId,
    staleTime: 1000 * 60 * 1,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  useEffect(() => {
      if (isConversationsError && conversationsError) {
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
       if (postIds.length === 0) return detailsMap;
       await Promise.all(postIds.map(async (postId) => {
         const details = await getPostDetails(postId);
         detailsMap.set(postId, details);
       }));
       return detailsMap;
     },
     enabled: conversations.length > 0 && conversations.some(c => c.postId && c.postId !== 'general_connection'),
     staleTime: 1000 * 60 * 10,
   });

   const postDetailsMap = postDetailsQueries.data;

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setIsLoadingMessagesState(false);
      setMessagesErrorState(null);
      return;
    }

    setIsLoadingMessagesState(true);
    setMessagesErrorState(null);

    const unsubscribe = getMessagesForConversation(
      activeConversationId,
      (newMessagesFromListener) => {
        setMessages(newMessagesFromListener);
        setIsLoadingMessagesState(false);
      },
      (error) => {
        setMessagesErrorState(error);
        setIsLoadingMessagesState(false);
        toast({
            variant: "destructive",
            title: "Error Loading Messages",
            description: error.message || "Could not load messages in real-time.",
        });
      }
    );

    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, [activeConversationId, toast]);

  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
        setNewMessage('');
        setReplyingTo(null);
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

   useEffect(() => {
       if (messagesEndRef.current) {
           const timer = setTimeout(() => {
               messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
           }, 100);
           return () => clearTimeout(timer);
       }
   }, [messages]);


  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversationId || sendMessageMutation.isPending) {
        return;
    }
    const messageData: NewMessageData = {
        conversationId: activeConversationId,
        senderId: currentUserId,
        text: newMessage.trim(),
        isBotMessage: false,
        ...(replyingTo && {
          replyToMessageId: replyingTo.id,
          repliedToTextSnippet: replyingTo.text.substring(0, 75) + (replyingTo.text.length > 75 ? "..." : "")
        }),
    };
    sendMessageMutation.mutate(messageData);
  };

   const selectedConversation = conversations.find(c => c.id === activeConversationId);
   const otherParticipantId = selectedConversation?.participants.find(p => p !== currentUserId);

   const { data: headerParticipantDetails, isLoading: isLoadingHeaderDetails } = useQuery({
       queryKey: ['userDetails', otherParticipantId, 'messagingInterfaceHeader'],
       queryFn: () => otherParticipantId ? getUserDetails(otherParticipantId) : Promise.resolve(null),
       enabled: !!otherParticipantId,
       staleTime: Infinity,
   });

   const otherParticipantName = isLoadingHeaderDetails
       ? 'Loading...'
       : headerParticipantDetails?.name || generateAnonymousName(otherParticipantId || 'Select Conversation');
   const otherParticipantInitials = getInitials(otherParticipantName);
   const otherParticipantAvatar = headerParticipantDetails?.avatar;
   const selectedPostQuestion = selectedConversation?.postId && selectedConversation.postId !== 'general_connection' && postDetailsMap
        ? postDetailsMap.get(selectedConversation.postId)?.question
        : null;

  const handleStartReply = useCallback((message: SerializableMessage) => {
    setReplyingTo(message);
    setTimeout(() => messageInputRef.current?.focus(), 0);
  }, [messageInputRef]);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {/* Conversation List (Left Panel) */}
      {(!isMobile || !activeConversationId) && (
        <div
          className={cn(
            "flex flex-col border-r bg-background min-w-0",
            isMobile ? (activeConversationId ? "hidden" : "w-full flex-1") : "md:w-2/5 lg:w-1/3 flex-1"
          )}
        >
          <div className={cn("border-b flex-shrink-0", isMobile ? "p-3" : "p-4")}>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> All Messages
            </h2>
          </div>
          <ScrollArea className={cn("flex-1 overflow-y-auto min-h-0", isMobile ? "bg-background" : "bg-card")}>
            <div className={cn(isMobile ? "p-1" : "p-2", "space-y-1")}>
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
               ) : isConversationsError ? (
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
                   const postQuestionText = conv.postId && conv.postId !== 'general_connection' && postDetailsMap ? postDetailsMap.get(conv.postId)?.question : null;
                   return (
                       <ConversationListItem
                           key={conv.id}
                           conversation={conv}
                           isSelected={activeConversationId === conv.id}
                           currentUserId={currentUserId}
                           onSelect={onSelectConversation}
                           postQuestion={postQuestionText}
                           highlight={activeConversationId === conv.id}
                       />
                   );
               })
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Chat View (Right Panel) */}
      {activeConversationId && (
        <div
          className={cn(
            "flex flex-1 flex-col overflow-hidden", 
            isMobile ? (activeConversationId ? "w-full flex" : "hidden") : "md:flex"
          )}
        >
            <>
              <div className={cn("border-b flex items-center gap-3 bg-muted/50 flex-shrink-0", isMobile ? "p-3" : "p-4")}>
                 {isMobile && (
                   <Button variant="ghost" size="icon" className="mr-1" onClick={() => onSelectConversation('')}>
                     <ArrowLeft className="h-5 w-5" />
                   </Button>
                 )}
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
                              className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1 mt-0.5"
                          >
                              <Building className="h-3 w-3" /> View Profile
                          </Link>
                      )}
                 </div>
                 {selectedConversation?.postId && selectedConversation.postId !== 'general_connection' && (
                     <Link href={`/?postId=${selectedConversation.postId}`}
                           className={cn(
                               "text-primary hover:underline text-xs items-center gap-1 ml-auto flex-shrink-0",
                               "focus:outline-none focus:ring-1 focus:ring-ring rounded p-1",
                               "hidden md:flex"
                           )}
                           title="View Post Details"
                           aria-label="View Post Details"
                      >
                          <Eye className="h-3.5 w-3.5" /> View Post
                     </Link>
                  )}
              </div>

              <ScrollArea className="flex-1 overflow-y-auto bg-background min-h-0">
                <div className={cn(isMobile ? "px-2 py-3" : "p-4")}>
                  {isLoadingMessagesState ? (
                       <div className="flex justify-center items-center h-full">
                           <Loader2 className="h-6 w-6 animate-spin text-primary" />
                       </div>
                   ) : messagesErrorState ? (
                       <p className="text-sm text-destructive text-center">{messagesErrorState.message || "Error loading messages."}</p>
                   ) : messages.length === 0 ? (
                       <p className="text-sm text-muted-foreground text-center h-full flex items-center justify-center">
                            Start the conversation!
                       </p>
                   ) : (
                     messages.map((msg) => {
                       return (
                         <MessageBubble
                           key={msg.id}
                           message={msg}
                           currentUserId={currentUserId}
                           onStartReply={handleStartReply}
                         />
                       );
                     })
                   )}
                   <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className={cn("border-t bg-muted/50 flex-shrink-0", isMobile ? "p-2 pb-16" : "p-4")}>
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
                    disabled={sendMessageMutation.isPending || isLoadingMessagesState}
                    className="flex-grow bg-background"
                    aria-label="Message input"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!newMessage.trim() || sendMessageMutation.isPending || isLoadingMessagesState}
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
          
        </div>
      )}
      {/* Placeholder if no active conversation on desktop (and not mobile, because mobile handles list view) */}
      {!activeConversationId && !isMobile && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-background">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground">Select or Start a Conversation</h3>
              <p className="text-sm text-muted-foreground mt-1">Choose a conversation from the list or start a new one from a post.</p>
          </div>
      )}
    </div>
  );
};
