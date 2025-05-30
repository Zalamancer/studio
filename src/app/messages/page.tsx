// src/app/messages/page.tsx
"use client";

import React from 'react';
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

const MessagesPage = () => {
    const { user, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialConversationId = searchParams?.get('conversationId');
    const currentUserId = user?.uid;

    // --- Fetch Pending Requests ---
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
            try {
                return await getPendingRequests(currentUserId);
            } catch (err: any) {
                toast({
                    variant: "destructive",
                    title: "Error Loading Requests",
                    description: err.message || "Could not load pending requests.",
                });
                throw err;
            }
        },
        enabled: !!currentUserId,
        staleTime: 1000 * 60 * 2,
        retry: 1,
    });

    // --- Fetch Connections (Mutuals) ---
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
            try {
                return await getConnections(currentUserId);
            } catch (err: any) {
                toast({
                    variant: "destructive",
                    title: "Error Loading Connections",
                    description: err.message || "Could not load connections.",
                });
                throw err;
            }
        },
        enabled: !!currentUserId,
        staleTime: 1000 * 60 * 5,
        retry: 1,
    });

    const handleConnectionStatusChange = () => {
        refetchRequests();
        refetchConnections();
        // Potentially invalidate conversation list in MessagingInterface if actions affect it
        queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
    };
    
    const handleManualRefetchAll = () => {
      refetchRequests();
      refetchConnections();
      // Potentially trigger refetch for conversations in MessagingInterface if possible,
      // or rely on its own refetch mechanisms.
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
       toast({
          title: "Refreshing...",
          description: "Fetching latest messages and connection data.",
          duration: 2000,
      });
    };

    if (authLoading) {
        return (
            <div className="container mx-auto p-4 flex justify-center items-center min-h-[calc(100vh-10rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading user...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="container mx-auto p-4 text-center">
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
        <div className="flex flex-col flex-grow h-full">
            <div className="container mx-auto p-4 md:p-6 flex flex-col flex-grow h-full">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Messages & Connections</h1>
                        <p className="text-muted-foreground mt-1 max-w-2xl">
                            Manage your chats, connection requests, and established network.
                        </p>
                    </div>
                     <Button onClick={handleManualRefetchAll} variant="outline" size="sm" disabled={isLoadingRequests || isLoadingConnections}>
                       <RefreshCw className={`h-4 w-4 ${isLoadingRequests || isLoadingConnections ? 'animate-spin' : ''} mr-2`} />
                       Refresh All
                    </Button>
                </div>

                {isRequestsError || isConnectionsError ? (
                   <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive flex items-center gap-3">
                       <AlertTriangle className="h-5 w-5" />
                       <div>
                         <p className="font-semibold">Error Loading Connection Data</p>
                         <p className="text-sm">{combinedErrorMessage || "Could not load some connection data. Please try refreshing."}</p>
                       </div>
                   </div>
                ) : null}

                <Tabs defaultValue="chats" className="flex flex-col flex-grow h-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="chats" className="flex items-center gap-1.5"><MessageSquare className="h-4 w-4"/>Chats</TabsTrigger>
                        <TabsTrigger value="requests" className="flex items-center gap-1.5">
                            <UserPlus className="h-4 w-4"/>Requests
                            {pendingRequests.length > 0 && (
                                <span className="ml-1.5 inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground">
                                    {pendingRequests.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="connections" className="flex items-center gap-1.5"><Users className="h-4 w-4"/>Connections</TabsTrigger>
                    </TabsList>

                    <TabsContent value="chats" className="flex-grow overflow-hidden border rounded-lg shadow-sm bg-card">
                        <MessagingInterface
                            currentUserId={user.uid}
                            initialConversationId={initialConversationId}
                        />
                    </TabsContent>

                    <TabsContent value="requests" className="flex-grow overflow-auto p-1">
                        <Card className="shadow-none border-0 md:border md:shadow-md">
                            <CardHeader className="px-3 md:px-6 pt-4 md:pt-6 pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    Pending Connection Requests
                                </CardTitle>
                                <CardDescription>Review requests from businesses wanting to connect.</CardDescription>
                            </CardHeader>
                            <CardContent className="px-3 md:px-6 pb-4 md:pb-6">
                                {isLoadingRequests ? (
                                    <div className="flex items-center space-x-4 py-4"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-muted-foreground">Loading requests...</span></div>
                                ) : pendingRequests.length === 0 ? (
                                    <p className="text-muted-foreground text-sm text-center py-4">No pending requests.</p>
                                ) : (
                                    <div className="space-y-4">
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

                    <TabsContent value="connections" className="flex-grow overflow-auto p-1">
                       <Card className="shadow-none border-0 md:border md:shadow-md">
                            <CardHeader className="px-3 md:px-6 pt-4 md:pt-6 pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    Your Connections
                                </CardTitle>
                                <CardDescription>Businesses you are currently connected with.</CardDescription>
                            </CardHeader>
                            <CardContent className="px-3 md:px-6 pb-4 md:pb-6">
                                {isLoadingConnections ? (
                                    <div className="flex items-center space-x-4 py-4"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-muted-foreground">Loading connections...</span></div>
                                ) : connections.length === 0 ? (
                                    <p className="text-muted-foreground text-sm text-center py-4">You haven't made any connections yet.</p>
                                ) : (
                                    <div className="space-y-4">
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
        </div>
    );
};

export default MessagesPage;
