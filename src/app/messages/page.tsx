
// src/app/messages/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Users, UserPlus, MessageSquare, RefreshCw } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MessagingInterface } from '@/components/messaging/MessagingInterface';
import { getPendingRequests, getConnections } from '@/services/connectionService';
import { ConnectionRequestItem } from '@/components/connect/ConnectionRequestItem';
import { ConnectionItem } from '@/components/connect/ConnectionItem';
import type { ConnectionRequest, Connection } from '@/types/connection';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useIsMobile } from "@/hooks/use-mobile";
import { getConversationsForUser } from '@/services/messagingService';
import type { ClientConversation } from '@/types/messaging';

const MessagesPage = () => {
    const { user, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const isMobile = useIsMobile();

    const initialConversationId = searchParams?.get('conversationId');
    const initialMessageText = searchParams?.get('initialMessageText');

    const [activeTab, setActiveTab] = useState<string>(() => {
        if (initialConversationId) return 'chats';
        return 'chats';
    });

    useEffect(() => {
        if (initialConversationId && activeTab !== 'chats') {
            setActiveTab('chats');
        }
    }, [initialConversationId, activeTab]);

    const currentUserId = user?.uid;

    const {
        data: pendingRequests = [],
        isLoading: isLoadingRequests,
        error: requestsError,
        isError: isRequestsError,
        refetch: refetchRequests,
    } = useQuery<ConnectionRequest[], Error>({
        queryKey: ['pendingRequests', currentUserId],
        queryFn: async () => {
            if (!currentUserId) return [];
            return getPendingRequests(currentUserId);
        },
        enabled: !!currentUserId,
        staleTime: 1000 * 60 * 2,
        retry: 1,
    });

    const {
        data: connections = [],
        isLoading: isLoadingConnections,
        error: connectionsError,
        isError: isConnectionsError,
        refetch: refetchConnections,
    } = useQuery<Connection[], Error>({
        queryKey: ['connections', currentUserId],
        queryFn: async () => {
            if (!currentUserId) return [];
            return getConnections(currentUserId);
        },
        enabled: !!currentUserId,
        staleTime: 1000 * 60 * 5,
        retry: 1,
    });

    const handleConnectionStatusChange = useCallback(() => {
        refetchRequests();
        refetchConnections();
        if (currentUserId) {
            queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
        }
    }, [refetchRequests, refetchConnections, queryClient, currentUserId]);

    const handleManualRefetchAll = useCallback(() => {
      refetchRequests();
      refetchConnections();
      if (currentUserId) {
          queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
      }
       toast({
          title: "Refreshing...",
          description: "Fetching latest messages and connection data.",
          duration: 2000,
      });
    }, [refetchRequests, refetchConnections, queryClient, currentUserId, toast]);

    const {
        data: conversations = [], 
        isLoading: isLoadingConversationsForTabCount, 
        error: conversationsErrorForTabCount,
        isError: isConversationsErrorTrueForTabCount,
      } = useQuery<ClientConversation[], Error>({
      queryKey: ['conversationsForTabCount', currentUserId], 
      queryFn: () => currentUserId ? getConversationsForUser(currentUserId) : Promise.resolve([]),
      enabled: !!currentUserId,
      staleTime: 1000 * 60 * 5, 
      refetchOnWindowFocus: false, 
      retry: 1,
    });


    if (authLoading) {
        return (
            <div className={cn(
                "flex flex-col flex-grow items-center justify-center h-full",
                 isMobile ? "p-0" : "md:container md:mx-auto md:p-6"
            )}>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground mt-2">Loading user...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className={cn(
                "flex flex-col flex-grow items-center justify-center text-center h-full",
                 isMobile ? "p-4" : "md:container md:mx-auto md:p-6"
            )}>
                <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
                <p className="text-muted-foreground font-semibold">Please log in to view messages and connections.</p>
                <Button onClick={() => router.push('/login')} className="mt-4">Log In</Button>
            </div>
        );
    }

    const combinedErrorMessage = [
       requestsError?.message,
       connectionsError?.message,
       conversationsErrorForTabCount?.message,
    ].filter(Boolean).join('; ');

    return (
        <div className={cn(
            "flex flex-col flex-grow h-full", 
            isMobile ? "" : "md:container md:mx-auto md:py-6 md:px-4"
        )}>
             {!isMobile && (
                 <div className={cn("flex justify-end items-center flex-shrink-0", isMobile ? "p-2" : "p-4 pb-2")}>
                     <Button onClick={handleManualRefetchAll} variant="outline" size="sm" disabled={isLoadingRequests || isLoadingConnections || isLoadingConversationsForTabCount}>
                         <RefreshCw className={`h-4 w-4 ${isLoadingRequests || isLoadingConnections || isLoadingConversationsForTabCount ? 'animate-spin' : ''} mr-2`} />
                         Refresh
                     </Button>
                 </div>
             )}

            {(isRequestsError || isConnectionsError || isConversationsErrorTrueForTabCount) && combinedErrorMessage && (
               <div className={cn("my-2 mx-2 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive flex items-center gap-3 flex-shrink-0", isMobile ? "" : "md:mx-4")}>
                   <AlertTriangle className="h-5 w-5" />
                   <div>
                     <p className="font-semibold">Error Loading Data</p>
                     <p className="text-sm">{combinedErrorMessage || "Could not load some data. Please try refreshing."}</p>
                   </div>
               </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden"> {/* This <Tabs> will take up available height */}
                <TabsList className={cn(
                    "grid w-full flex-shrink-0", 
                    isMobile ? "grid-cols-3 mx-0 rounded-none border-b" : "grid-cols-3 mx-auto max-w-md md:mb-4"
                )}>
                    <TabsTrigger value="chats" className="flex items-center gap-1.5"><MessageSquare className="h-4 w-4"/>Messages</TabsTrigger>
                    <TabsTrigger value="requests" className="flex items-center gap-1.5">
                        <UserPlus className="h-4 w-4"/>Requests
                        {pendingRequests.length > 0 && (
                            <span className="ml-1.5 inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground">
                                {pendingRequests.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="connections" className="flex items-center gap-1.5"><Users className="h-4 w-4"/>Network</TabsTrigger>
                </TabsList>

                <TabsContent
                    value="chats"
                    className={cn(
                        "mt-0 flex-1", // flex-1 to grow
                         isMobile ? "" : "md:p-4 md:pt-0" // Keep padding for desktop
                    )}
                >
                    {/* Inner div now handles full height and layout for MessagingInterface */}
                    <div className="h-full flex flex-col overflow-hidden rounded-md border bg-background">
                        <MessagingInterface
                            currentUserId={user.uid}
                            initialConversationId={initialConversationId}
                            initialMessageText={initialMessageText}
                        />
                    </div>
                </TabsContent>

                <TabsContent
                    value="requests"
                    className={cn(
                        "mt-0 flex-1", // flex-1 to grow
                        isMobile ? "p-1" : "md:p-4 md:pt-0"
                    )}
                >
                   {/* Inner div now handles full height and layout for Card */}
                  <div className="h-full flex flex-col overflow-hidden">
                        <Card className={cn(
                            "flex-1 flex flex-col overflow-hidden h-full", // Card itself fills the inner div
                            !isMobile && "md:border md:shadow-md"
                        )}>
                            <CardHeader className={cn("pt-4 pb-3 flex-shrink-0", isMobile ? "px-3" : "px-6 md:pt-6")}>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    Connection Requests
                                </CardTitle>
                                <CardDescription>Review businesses wanting to connect.</CardDescription>
                            </CardHeader>
                            <CardContent className={cn(
                                "pb-4 flex-1 overflow-auto", // CardContent scrolls
                                isMobile ? "px-3" : "px-6 md:pb-6"
                            )}>
                                {isLoadingRequests ? (
                                    <div className="flex items-center space-x-4 py-4"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-muted-foreground">Loading requests...</span></div>
                                ) : pendingRequests.length === 0 ? (
                                    <p className="text-muted-foreground text-sm text-center py-4">No pending requests.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {pendingRequests.map((request) => (
                                            <ConnectionRequestItem
                                                key={request.connectionId}
                                                request={request}
                                                currentUserId={currentUserId!}
                                                onAction={handleConnectionStatusChange}
                                            />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent
                    value="connections"
                    className={cn(
                        "mt-0 flex-1", // flex-1 to grow
                        isMobile ? "p-1" : "md:p-4 md:pt-0"
                    )}
                >
                  {/* Inner div now handles full height and layout for Card */}
                   <div className="h-full flex flex-col overflow-hidden">
                       <Card className={cn(
                            "flex-1 flex flex-col overflow-hidden h-full", // Card itself fills the inner div
                            !isMobile && "md:border md:shadow-md"
                        )}>
                            <CardHeader className={cn("pt-4 pb-3 flex-shrink-0", isMobile ? "px-3" : "px-6 md:pt-6")}>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    Your Network
                                </CardTitle>
                                <CardDescription>Businesses you are connected with.</CardDescription>
                            </CardHeader>
                            <CardContent className={cn(
                                "pb-4 flex-1 overflow-auto", // CardContent scrolls
                                isMobile ? "px-3" : "px-6 md:pb-6"
                            )}>
                                {isLoadingConnections ? (
                                    <div className="flex items-center space-x-4 py-4"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-muted-foreground">Loading connections...</span></div>
                                ) : connections.length === 0 ? (
                                    <p className="text-muted-foreground text-sm text-center py-4">You haven't made any connections yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {connections.map((connection) => (
                                            <ConnectionItem
                                                key={connection.connectionId}
                                                connection={connection}
                                                currentUserId={currentUserId!}
                                                onAction={handleConnectionStatusChange}
                                            />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default MessagesPage;


    