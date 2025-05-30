// src/app/messages/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Users, UserPlus, MessageSquare, RefreshCw, ArrowLeft } from 'lucide-react';
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

const MessagesPage = () => {
    const { user, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const isMobile = useIsMobile();
    
    const initialConversationId = searchParams?.get('conversationId');
    
    const [activeTab, setActiveTab] = useState<string>(() => {
        // Set initial tab based on URL or default to 'chats'
        if (isMobile && !initialConversationId) return 'list'; // On mobile, default to list if no specific chat
        return initialConversationId ? 'chats' : 'chats'; // Default to chats, especially if a chat is pre-selected
    });

    useEffect(() => {
        if (initialConversationId && activeTab !== 'chats') {
            console.log("[MessagesPage] conversationId in URL, ensuring 'chats' tab is active.");
            setActiveTab('chats');
        }
        // If on mobile and a conversationId appears, switch activeMobileView in MessagingInterface
        // This is now handled internally by MessagingInterface based on initialConversationId
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
        queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
    }, [refetchRequests, refetchConnections, queryClient, currentUserId]);
    
    const handleManualRefetchAll = useCallback(() => {
      refetchRequests();
      refetchConnections();
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
       toast({
          title: "Refreshing...",
          description: "Fetching latest messages and connection data.",
          duration: 2000,
      });
    }, [refetchRequests, refetchConnections, queryClient, currentUserId, toast]);

    if (authLoading) {
        return (
            <div className="flex flex-col flex-grow items-center justify-center p-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground mt-2">Loading user...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col flex-grow items-center justify-center p-6 text-center">
                <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
                <p className="text-muted-foreground font-semibold">Please log in to view messages and connections.</p>
                <Button onClick={() => router.push('/login')} className="mt-4">Log In</Button>
            </div>
        );
    }

    const combinedErrorMessage = [
       requestsError?.message,
       connectionsError?.message,
    ].filter(Boolean).join('; ');

    return (
        <div className={cn(
            "flex flex-col flex-grow", // Takes available height from MainLayout's main tag
            isMobile ? "p-0" : "md:container md:mx-auto md:p-6"
        )}>
            <div className="hidden md:block mb-6">
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Messages & Connections</h1>
                <p className="text-muted-foreground mt-1 max-w-2xl">
                    Manage your chats, connection requests, and established network.
                </p>
            </div>
            <div className={cn("flex justify-end", isMobile ? "p-2 border-b md:border-none" : "mb-4 md:mb-0")}>
                <Button onClick={handleManualRefetchAll} variant="outline" size="sm" disabled={isLoadingRequests || isLoadingConnections}>
                    <RefreshCw className={`h-4 w-4 ${isLoadingRequests || isLoadingConnections ? 'animate-spin' : ''} mr-2`} />
                    Refresh
                </Button>
            </div>

            {isRequestsError || isConnectionsError ? (
               <div className={cn("my-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive flex items-center gap-3", isMobile ? "mx-2" : "")}>
                   <AlertTriangle className="h-5 w-5" />
                   <div>
                     <p className="font-semibold">Error Loading Connection Data</p>
                     <p className="text-sm">{combinedErrorMessage || "Could not load some connection data. Please try refreshing."}</p>
                   </div>
               </div>
            ) : null}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-grow h-full">
                <TabsList className={cn("grid w-full mb-0", isMobile ? "grid-cols-3 mx-0 rounded-none border-b" : "grid-cols-3 mx-auto max-w-md md:mb-4")}>
                    <TabsTrigger value="chats" className="flex items-center gap-1.5"><MessageSquare className="h-4 w-4"/>Chats</TabsTrigger>
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

                <TabsContent value="chats" className={cn("mt-0 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-grow")}>
                    <div className={cn(
                        "flex-grow flex flex-col overflow-hidden h-full", // This div will control the height
                        !isMobile && "border rounded-lg shadow-sm bg-card"
                    )}>
                        <MessagingInterface
                            currentUserId={user.uid}
                            initialConversationId={initialConversationId}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="requests" className={cn("flex-grow overflow-auto", isMobile ? "p-1" : "p-1 md:mt-2")}>
                    <Card className={cn("shadow-none border-0 h-full", !isMobile && "md:border md:shadow-md")}>
                        <CardHeader className={cn("pt-4 pb-3", isMobile ? "px-3" : "px-6 md:pt-6")}>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                Connection Requests
                            </CardTitle>
                            <CardDescription>Review businesses wanting to connect.</CardDescription>
                        </CardHeader>
                        <CardContent className={cn("pb-4", isMobile ? "px-3" : "px-6 md:pb-6")}>
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
                </TabsContent>

                <TabsContent value="connections" className={cn("flex-grow overflow-auto", isMobile ? "p-1" : "p-1 md:mt-2")}>
                   <Card className={cn("shadow-none border-0 h-full", !isMobile && "md:border md:shadow-md")}>
                        <CardHeader className={cn("pt-4 pb-3", isMobile ? "px-3" : "px-6 md:pt-6")}>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                Your Network
                            </CardTitle>
                            <CardDescription>Businesses you are connected with.</CardDescription>
                        </CardHeader>
                        <CardContent className={cn("pb-4", isMobile ? "px-3" : "px-6 md:pb-6")}>
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
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default MessagesPage;
