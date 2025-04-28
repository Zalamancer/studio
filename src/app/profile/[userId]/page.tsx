// src/app/profile/[userId]/page.tsx
"use client";

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Building, CalendarDays, MapPin, CheckCircle, Mail, Phone, Loader2, AlertTriangle, Lock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button'; // Import Button component
import { ConnectionButton } from '@/components/ConnectionButton';
import { useQuery } from '@tanstack/react-query';
import { getConnectionStatus } from '@/services/connectionService';
import type { ConnectionStatus } from '@/types/connection';
import { ProfilePostsSection } from '@/components/profile/ProfilePostsSection'; // Import the new component

// Placeholder function to get user data (replace with actual data fetching)
const getBusinessProfileData = (userId: string) => {
  // In a real app, fetch this data from Firestore or your backend
  // based on the userId
  console.log(`Fetching profile data for userId: ${userId}`);
  // Return mock data for now
  return {
    companyName: `Business ${userId.substring(0, 6)}`,
    industry: "Tech", // Example
    location: "San Francisco, CA", // Example
    established: "2018", // Example
    description: "Innovative tech solutions provider focused on B2B collaboration.", // Example
    avatarUrl: `https://picsum.photos/seed/${userId}/100`, // Placeholder avatar
    contactEmail: `contact@business-${userId.substring(0, 4)}.com`, // Example
    contactPhone: "+1 (555) 123-4567", // Example
    verified: true, // Example
    rating: 4.5, // Example
    tags: ["Software", "SaaS", "Collaboration Tools"], // Example
    userId: userId, // Include the userId in the fetched data
  };
};

const BusinessProfilePage = () => {
  const params = useParams();
  const profileUserId = params?.userId as string | undefined; // Rename to avoid conflict
  const { user: currentUser, loading: authLoading } = useAuth(); // Get the currently logged-in user
  const router = useRouter();
  const { toast } = useToast();

  // Handle case where profileUserId is not available
  if (!profileUserId) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-destructive">User ID not found.</p>
      </div>
    );
  }

  // Fetch profile data (using placeholder function)
  // In a real app, this might also use useQuery
  const profileData = getBusinessProfileData(profileUserId);

  // --- Fetch Connection Status ---
  const {
    data: connectionStatus,
    isLoading: isLoadingStatus,
    error: statusError,
  } = useQuery<ConnectionStatus | null, Error>({
    queryKey: ['connectionStatus', currentUser?.uid, profileUserId],
    queryFn: async () => {
      if (!currentUser?.uid || !profileUserId || currentUser.uid === profileUserId) {
        return 'self'; // Or null if self shouldn't trigger status check
      }
      return getConnectionStatus(currentUser.uid, profileUserId);
    },
    enabled: !!currentUser?.uid && !!profileUserId && currentUser.uid !== profileUserId, // Only run if logged in, profile user exists, and not viewing own profile
    staleTime: 1000 * 60 * 1, // 1 minute stale time
  });
  // --- End Fetch Connection Status ---


  // Handle case where profile data is not found for the user
  if (!profileData) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-muted-foreground">Business profile not found for this user.</p>
      </div>
    );
  }

  const isOwnProfile = currentUser?.uid === profileData.userId; // Check if viewing own profile

  if (authLoading) {
     return (
       <div className="container mx-auto p-4 md:p-8 max-w-4xl">
         <Card className="overflow-hidden shadow-lg rounded-lg border-border">
           <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 p-6 border-b">
             <div className="flex flex-col md:flex-row items-start md:items-center gap-4 animate-pulse">
               <div className="h-20 w-20 rounded-full bg-muted"></div>
               <div className="flex-grow space-y-2">
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-4 bg-muted rounded w-1/3"></div>
               </div>
               <div className="h-10 w-24 bg-muted rounded"></div>
             </div>
           </CardHeader>
           <CardContent className="p-6 grid gap-6 animate-pulse">
              <div className="space-y-2">
                 <div className="h-5 bg-muted rounded w-1/4"></div>
                 <div className="h-4 bg-muted rounded w-full"></div>
                 <div className="h-4 bg-muted rounded w-5/6"></div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm space-y-2">
                 <div className="h-4 bg-muted rounded w-1/2"></div>
                 <div className="h-4 bg-muted rounded w-1/2"></div>
                 <div className="h-4 bg-muted rounded w-1/2"></div>
                 <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
           </CardContent>
         </Card>
       </div>
     );
  }


  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <Card className="overflow-hidden shadow-lg rounded-lg border-border">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 p-6 border-b">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary">
              <AvatarImage src={profileData.avatarUrl} alt={profileData.companyName} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {profileData.companyName?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-grow text-center md:text-left">
              <CardTitle className="text-3xl font-bold text-foreground">
                {profileData.companyName}
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1 flex items-center justify-center md:justify-start gap-1">
                 <Building className="h-4 w-4" /> {profileData.industry} Industry
                 {profileData.verified && (
                    <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" /> Verified
                    </span>
                 )}
              </CardDescription>
               <div className="mt-2 flex flex-wrap gap-2 justify-center md:justify-start">
                  {profileData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
            </div>
            {/* Optional Rating & Connect Button */}
            <div className="flex flex-col items-center md:items-end gap-2 ml-auto mt-4 md:mt-0 w-full md:w-auto">
                 {profileData.rating && (
                     <div className="text-center md:text-right">
                        <p className="text-sm text-muted-foreground">Trust Rating</p>
                        <p className="text-2xl font-semibold text-primary">{profileData.rating.toFixed(1)} / 5.0</p>
                     </div>
                 )}
                  {/* Use ConnectionButton component */}
                 {currentUser && !isOwnProfile && (
                    <ConnectionButton
                      targetUserId={profileData.userId}
                      targetUserName={profileData.companyName}
                      size="default" // Make it a bit larger on profile page
                      className="mt-2 w-full md:w-auto"
                    />
                 )}
                 {/* Show loading/error state for connection button area */}
                 {isLoadingStatus && !isOwnProfile && (
                     <Button disabled size="default" className="mt-2 w-full md:w-auto">
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                     </Button>
                 )}
                 {statusError && !isOwnProfile && (
                     <p className="text-xs text-destructive mt-2 text-right">Error loading status</p>
                 )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 grid gap-6">
          {/* About Section */}
          <div>
             <h3 className="text-lg font-semibold text-foreground mb-2">About Us</h3>
             <p className="text-muted-foreground text-sm leading-relaxed">
               {profileData.description}
             </p>
          </div>

          <Separator />

          {/* Details Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
               <MapPin className="h-4 w-4 text-primary" />
               <span>{profileData.location}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
               <CalendarDays className="h-4 w-4 text-primary" />
               <span>Established: {profileData.established}</span>
            </div>
             <div className="flex items-center gap-2 text-muted-foreground">
               <Mail className="h-4 w-4 text-primary" />
               <a href={`mailto:${profileData.contactEmail}`} className="hover:underline hover:text-primary">
                 {profileData.contactEmail}
               </a>
            </div>
            {profileData.contactPhone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 text-primary" />
                    <span>{profileData.contactPhone}</span>
                 </div>
             )}
          </div>

           <Separator />

           {/* Posts Section - Conditionally Rendered */}
           <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Posts by {profileData.companyName}</h3>
              {isLoadingStatus ? (
                  <div className="flex items-center justify-center p-6">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      <p className="text-muted-foreground">Checking connection status...</p>
                  </div>
              ) : statusError ? (
                   <div className="flex items-center justify-center p-6 text-destructive gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      <p>Could not load connection status.</p>
                   </div>
              ) : connectionStatus === 'connected' || isOwnProfile ? (
                  // If connected OR it's the user's own profile, show the posts section
                  <ProfilePostsSection userId={profileUserId} />
              ) : (
                   // If not connected and not own profile, show lock message
                  <div className="text-center p-6 border rounded-lg bg-muted/50">
                     <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                     <p className="text-muted-foreground font-medium">Connect to view posts</p>
                     <p className="text-xs text-muted-foreground mt-1">Posts are only visible to connected businesses.</p>
                  </div>
              )}
           </div>

           {/* Placeholder for further sections */}
           {/* ... */}

        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessProfilePage;

