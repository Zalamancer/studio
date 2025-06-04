
// src/app/messages/page.tsx
"use client";

import React, { useState, useEffect, useCallback, use } from 'react'; // Added use
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
    const searchParamsFromHook = useSearchParams(); // Store promise-like object
    const router = useRouter();
    const isMobile = useIsMobile();

    // Unwrap searchParams using React.use()
    const searchParams = use(searchParamsFromHook);

    const [activeTab, setActiveTab] = useState<string>('chats');
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        document.body.classList.add('overflow-hidden-page');
      }
      return () => {
        if (typeof window !== 'undefined') {
          document.body.classList.remove('overflow-hidden-page');
        }
      };
    }, []);

    useEffect(() => {
        const conversationIdFromUrl = searchParams?.get('conversationId');
        const tabFromUrl = searchParams?.get('tab');
        let newActiveTabState = 'chats';
        let newSelectedConversationIdState: string | null = null;

        if (conversationIdFromUrl) {
            newActiveTabState = 'chats';
            newSelectedConversationIdState = conversationIdFromUrl;
        } else if (tabFromUrl && ['chats', 'requests', 'connections'].includes(tabFromUrl)) {
            newActiveTabState = tabFromUrl;
        }

        setActiveTab(newActiveTabState);
        setSelectedConversationId(newSelectedConversationIdState);

    }, [searchParams]);


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
          queryClient.invalidateQueries({ queryKey: ['postDetails']}); // For conversation list post questions
      }
       toast({
          title: "Refreshing...",
          description: "Fetching latest messages and connection data.",
          duration: 2000,
      });
    }, [refetchRequests, refetchConnections, queryClient, currentUserId, toast]);

    const {
        data: conversationsForTabCount = [],
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

    const handleSelectConversationFromList = useCallback((conversationId: string) => {
        const newParams = new URLSearchParams(searchParams?.toString());
        if (conversationId) {
            newParams.set('conversationId', conversationId);
            newParams.delete('tab'); // Ensure tab is not set if conversationId is present
        } else {
            newParams.delete('conversationId');
            newParams.set('tab', 'chats'); // Default to chats tab if conversation is cleared
        }
        router.replace(`/messages?${newParams.toString()}`, { scroll: false });
    }, [router, searchParams]);
    
    const handleTabChange = useCallback((tabValue: string) => {
        const newParams = new URLSearchParams(searchParams?.toString());
        if (tabValue === 'chats' && selectedConversationId) {
            // If switching to chats and a conversation was already selected, preserve it
            newParams.set('conversationId', selectedConversationId);
            newParams.delete('tab');
        } else if (tabValue === 'chats' && !selectedConversationId) {
            // Switching to chats but no specific conversation, just remove conversationId
            newParams.delete('conversationId');
            newParams.set('tab', 'chats'); // Explicitly set tab to chats
        } else {
            // For other tabs, clear conversationId and set the tab
            newParams.delete('conversationId');
            newParams.set('tab', tabValue);
        }
        router.replace(`/messages?${newParams.toString()}`, { scroll: false });
    }, [router, selectedConversationId, searchParams]);


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
            {(isRequestsError || isConnectionsError || isConversationsErrorTrueForTabCount) && combinedErrorMessage && (
               <div className={cn("my-2 mx-2 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive flex items-center gap-3 flex-shrink-0", isMobile ? "" : "md:mx-4")}>
                   <AlertTriangle className="h-5 w-5" />
                   <div>
                     <p className="font-semibold">Error Loading Data</p>
                     <p className="text-sm">{combinedErrorMessage || "Could not load some data. Please try refreshing."}</p>
                   </div>
               </div>
            )}

            <Tabs
                value={activeTab}
                onValueChange={handleTabChange}
                className="flex flex-col flex-1 overflow-hidden" 
            >
                 <div className={cn("relative flex-shrink-0", isMobile ? "" : "md:mb-4")}>
                    <TabsList className={cn(
                        "grid w-full flex-shrink-0",
                        isMobile ? "grid-cols-3 mx-0 rounded-none border-b" : "grid-cols-3 mx-auto max-w-md"
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
                     {!isMobile && (
                         <div className="absolute top-1/2 right-0 -translate-y-1/2">
                             <Button onClick={handleManualRefetchAll} variant="outline" size="sm" disabled={isLoadingRequests || isLoadingConnections || isLoadingConversationsForTabCount}>
                                 <RefreshCw className={`h-4 w-4 ${isLoadingRequests || isLoadingConnections || isLoadingConversationsForTabCount ? 'animate-spin' : ''} mr-2`} />
                                 Refresh
                             </Button>
                         </div>
                     )}
                </div>

                <TabsContent
                    value="chats"
                    className={cn( 
                        "mt-0 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "relative flex-1" 
                    )}
                >
                    <div className="absolute inset-0 flex flex-col overflow-hidden"> 
                        <MessagingInterface
                            currentUserId={user.uid}
                            activeConversationId={selectedConversationId}
                            onSelectConversation={handleSelectConversationFromList}
                            initialMessageText={searchParams?.get('initialMessageText') || undefined}
                        />
                    </div>
                </TabsContent>

                <TabsContent
                    value="requests"
                    className={cn(
                        "mt-0 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "relative flex-1" 
                    )}
                >
                   <div className="absolute inset-0 flex flex-col overflow-hidden p-1 md:p-0"> 
                        <Card className={cn(
                            "flex-1 flex flex-col overflow-hidden rounded-md md:border md:shadow-md"
                        )}>
                            <CardHeader className={cn("pt-4 pb-3 flex-shrink-0", isMobile ? "px-3" : "px-6 md:pt-6")}>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    Connection Requests
                                </CardTitle>
                                <CardDescription>Review businesses wanting to connect.</CardDescription>
                            </CardHeader>
                            <CardContent className={cn(
                                "pb-4 flex-1 overflow-auto", 
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
                        "mt-0 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "relative flex-1" 
                    )}
                >
                   <div className="absolute inset-0 flex flex-col overflow-hidden p-1 md:p-0"> 
                       <Card className={cn(
                            "flex-1 flex flex-col overflow-hidden rounded-md md:border md:shadow-md"
                        )}>
                            <CardHeader className={cn("pt-4 pb-3 flex-shrink-0", isMobile ? "px-3" : "px-6 md:pt-6")}>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    Your Network
                                </CardTitle>
                                <CardDescription>Businesses you are connected with.</CardDescription>
                            </CardHeader>
                            <CardContent className={cn(
                                "pb-4 flex-1 overflow-auto",
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
