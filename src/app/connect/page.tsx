
'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getPendingRequests, getConnections } from '@/services/connectionService';
import { Loader2, AlertTriangle, UserPlus, Users, Mail, RefreshCw } from 'lucide-react'; // Added RefreshCw
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ConnectionRequestItem } from '@/components/connect/ConnectionRequestItem'; // New component for requests
import { ConnectionItem } from '@/components/connect/ConnectionItem'; // New component for connections
import Link from 'next/link'; // Import Link
import { useToast } from '@/hooks/use-toast'; // Import useToast
import type { ConnectionRequest, Connection } from '@/types/connection'; // Import types

const ConnectPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast(); // Initialize toast
  const currentUserId = user?.uid;

  // --- Fetch Pending Requests ---
  const {
    data: pendingRequests = [],
    isLoading: isLoadingRequests,
    error: requestsError, // Capture error object
    isError: isRequestsError, // Boolean flag
    refetch: refetchRequests,
  } = useQuery<ConnectionRequest[], Error>({ // Specify expected data and error types
    queryKey: ['pendingRequests', currentUserId],
    queryFn: async () => {
        console.log(`Querying pending requests for user: ${currentUserId}`);
        if (!currentUserId) return [];
        try {
            const data = await getPendingRequests(currentUserId);
            console.log("Pending requests query successful, data:", data);
            return data;
        } catch (err: any) {
            console.error("Error in queryFn for pending requests:", err);
            toast({ // Show toast on error
                variant: "destructive",
                title: "Error Loading Requests",
                description: err.message || "Could not load pending requests. Check console for details.",
            });
            // Re-throwing the error is handled by react-query's error state
            throw err; // Make sure react-query knows it failed
        }
    },
    enabled: !!currentUserId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 1, // Retry once on failure
  });

  // --- Fetch Connections (Mutuals) ---
  const {
    data: connections = [],
    isLoading: isLoadingConnections,
    error: connectionsError, // Capture error object
    isError: isConnectionsError, // Boolean flag
    refetch: refetchConnections,
  } = useQuery<Connection[], Error>({ // Specify expected data and error types
    queryKey: ['connections', currentUserId],
    queryFn: async () => {
        console.log(`Querying connections for user: ${currentUserId}`);
        if (!currentUserId) return [];
        try {
            const data = await getConnections(currentUserId);
            console.log("Connections query successful, data:", data);
            return data;
        } catch (err: any) {
            console.error("Error in queryFn for connections:", err);
            toast({ // Show toast on error
                 variant: "destructive",
                 title: "Error Loading Connections",
                 description: err.message || "Could not load connections. Check console for details.",
             });
             // Re-throwing the error is handled by react-query's error state
             throw err; // Make sure react-query knows it failed
         }
     },
    enabled: !!currentUserId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1, // Retry once on failure
  });

  const handleStatusChange = () => {
    // Refetch both lists when a connection status changes (request accepted/rejected/removed)
    console.log("Connection status changed, refetching lists...");
    refetchRequests();
    refetchConnections();
  };

  const handleManualRefetch = () => {
      console.log("Manual refetch triggered...");
      refetchRequests();
      refetchConnections();
       toast({
          title: "Refreshing...",
          description: "Fetching latest requests and connections.",
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
        <p className="text-muted-foreground font-semibold">Please log in to manage your connections.</p>
        <Button asChild className="mt-4">
           <Link href="/login">Log In</Link>
        </Button>
      </div>
    );
  }

  const isLoading = isLoadingRequests || isLoadingConnections;
  const isError = isRequestsError || isConnectionsError; // Use boolean flags

  // Combine error messages for display
   const combinedErrorMessage = [
       requestsError?.message,
       connectionsError?.message,
   ].filter(Boolean).join(' ');

  return (
    <div className="container mx-auto p-4 md:p-6">
       <div className="flex justify-between items-center mb-6">
          <div>
              <h1 className="text-3xl font-bold text-foreground">Manage Connections</h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Review incoming connection requests and manage your existing network of collaborators.
              </p>
          </div>
          <Button onClick={handleManualRefetch} variant="outline" size="sm" disabled={isLoading}>
             <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''} mr-2`} />
             Refresh
          </Button>
      </div>


       {isError && ( // Display a general error message at the top if any query fails
           <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive flex items-center gap-3">
               <AlertTriangle className="h-5 w-5" />
               <div>
                 <p className="font-semibold">Error Loading Data</p>
                 <p className="text-sm">{combinedErrorMessage || "Could not load connection data. Please try refreshing or check the console."}</p>
               </div>
           </div>
       )}

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
            ) : isRequestsError ? ( // Use boolean flag
              <div className="text-destructive flex items-center gap-2 text-sm p-4 bg-destructive/5 rounded-md">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <div>
                  Error loading requests. <br />
                  <span className="text-xs">{requestsError?.message}</span> {/* Show specific error message */}
                </div>
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
            ) : isConnectionsError ? ( // Use boolean flag
              <div className="text-destructive flex items-center gap-2 text-sm p-4 bg-destructive/5 rounded-md">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                 <div>
                   Error loading connections. <br />
                   <span className="text-xs">{connectionsError?.message}</span> {/* Show specific error message */}
                 </div>
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
