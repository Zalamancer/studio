'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getPendingRequests, getConnections } from '@/services/connectionService';
import { Loader2, AlertTriangle, UserPlus, Users, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ConnectionRequestItem } from '@/components/connect/ConnectionRequestItem'; // New component for requests
import { ConnectionItem } from '@/components/connect/ConnectionItem'; // New component for connections
import Link from 'next/link'; // Import Link

const ConnectPage = () => {
  const { user, loading: authLoading } = useAuth();
  const currentUserId = user?.uid;

  // Fetch Pending Requests
  const {
    data: pendingRequests = [],
    isLoading: isLoadingRequests,
    error: requestsError,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ['pendingRequests', currentUserId],
    queryFn: () => getPendingRequests(currentUserId!),
    enabled: !!currentUserId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Fetch Connections (Mutuals)
  const {
    data: connections = [],
    isLoading: isLoadingConnections,
    error: connectionsError,
    refetch: refetchConnections,
  } = useQuery({
    queryKey: ['connections', currentUserId],
    queryFn: () => getConnections(currentUserId!),
    enabled: !!currentUserId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleStatusChange = () => {
    // Refetch both lists when a connection status changes (request accepted/rejected/removed)
    refetchRequests();
    refetchConnections();
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
        <p className="text-muted-foreground font-semibold">Please log in to manage your connections.</p>
        <Button asChild className="mt-4">
           <Link href="/login">Log In</Link>
        </Button>
      </div>
    );
  }

  const isLoading = isLoadingRequests || isLoadingConnections;
  const isError = !!requestsError || !!connectionsError;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <h1 className="text-3xl font-bold text-foreground mb-6">Manage Connections</h1>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        Review incoming connection requests and manage your existing network of collaborators.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Requests Section */}
        <Card className="shadow-md border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Pending Requests
            </CardTitle>
            <CardDescription>Review requests from businesses wanting to connect.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRequests ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-4"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-muted-foreground">Loading requests...</span></div>
              </div>
            ) : requestsError ? (
              <div className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Error loading requests.
              </div>
            ) : pendingRequests.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No pending requests.</p>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <ConnectionRequestItem
                     key={request.connectionId}
                     request={request}
                     currentUserId={currentUserId!}
                     onAction={handleStatusChange} // Refetch lists on action
                   />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Existing Connections Section */}
        <Card className="shadow-md border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Your Connections
            </CardTitle>
            <CardDescription>Businesses you are currently connected with.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingConnections ? (
               <div className="space-y-4">
                 <div className="flex items-center space-x-4"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-muted-foreground">Loading connections...</span></div>
               </div>
            ) : connectionsError ? (
              <div className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Error loading connections.
              </div>
            ) : connections.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">You haven't made any connections yet.</p>
            ) : (
              <div className="space-y-4">
                 {connections.map((connection) => (
                   <ConnectionItem
                     key={connection.connectionId}
                     connection={connection}
                     currentUserId={currentUserId!}
                     onAction={handleStatusChange} // Refetch lists on action
                   />
                 ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConnectPage;
