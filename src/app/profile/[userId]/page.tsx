// src/app/profile/[userId]/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Building, CalendarDays, MapPin, CheckCircle, Mail, Phone, Loader2, AlertTriangle, Lock, Star } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { ConnectionButton } from '@/components/ConnectionButton';
import { useQuery } from '@tanstack/react-query';
import { getConnectionStatus } from '@/services/connectionService';
import type { ConnectionStatus } from '@/types/connection';
import { ProfilePostsSection } from '@/components/profile/ProfilePostsSection';
import { cn } from '@/lib/utils';

// Placeholder function to get user data (replace with actual data fetching)
const getBusinessProfileData = (userId: string) => {
  // In a real app, fetch this data from Firestore or your backend
  // based on the userId
  console.log(`Fetching profile data for userId: ${userId}`);
  // Return mock data for now, including rating info
  return {
    companyName: `Business ${userId.substring(0, 6)}`,
    industry: "Tech",
    location: "San Francisco, CA",
    established: "2018",
    description: "Innovative tech solutions provider focused on B2B collaboration. We strive to connect businesses seamlessly and foster growth through shared opportunities.",
    avatarUrl: `https://picsum.photos/seed/${userId}/100`,
    contactEmail: `contact@business-${userId.substring(0, 4)}.com`,
    contactPhone: "+1 (555) 123-4567",
    verified: Math.random() > 0.5,
    tags: ["Software", "SaaS", "Collaboration Tools", "B2B Solutions", "Innovation"],
    userId: userId,
    // Initialize with 0 for profiles with no ratings yet
    averageRating: 0,
    ratingCount: 0,
  };
};

// Helper to render stars
const StarDisplay: React.FC<{ rating: number; totalStars?: number, size?: string }> = ({ rating, totalStars = 5, size="h-5 w-5" }) => {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5 ? 1 : 0;
  const emptyStars = totalStars - fullStars - halfStar;

  return (
    <div className="flex items-center">
      {[...Array(fullStars)].map((_, i) => <Star key={`full-${i}`} className={cn(size, "text-yellow-400 fill-yellow-400")} />)}
      {halfStar === 1 && <Star key="half" className={cn(size, "text-yellow-400")} />} {/* Simplification: show as empty for half for now, or use a half-star icon */}
      {[...Array(emptyStars)].map((_, i) => <Star key={`empty-${i}`} className={cn(size, "text-yellow-400")} />)}
    </div>
  );
};


const BusinessProfilePage = () => {
  const params = useParams();
  const profileUserId = params?.userId as string | undefined;
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  // Fetch profile data (could be from a service in a real app)
  const profileData = profileUserId ? getBusinessProfileData(profileUserId) : null;


  const {
    data: connectionStatus,
    isLoading: isLoadingStatus,
    error: statusError,
  } = useQuery<ConnectionStatus | null, Error>({
    queryKey: ['connectionStatus', currentUser?.uid, profileUserId],
    queryFn: async () => {
      if (!currentUser?.uid || !profileUserId || currentUser.uid === profileUserId) {
        return 'self';
      }
      return getConnectionStatus(currentUser.uid, profileUserId);
    },
    enabled: !!currentUser?.uid && !!profileUserId && currentUser.uid !== profileUserId,
    staleTime: 1000 * 60 * 1,
  });

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

  if (!profileUserId) {
    return (
      <div className="container mx-auto p-4 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
        <p className="text-destructive-foreground font-semibold">User ID not found.</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="container mx-auto p-4 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
        <p className="text-muted-foreground font-semibold">Business profile not found for this user.</p>
         <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const isOwnProfile = currentUser?.uid === profileData.userId;

  const handleRateProfile = (rating: number) => {
    setUserRating(rating);
    // In a real app, you'd call a service to submit the rating to the backend.
    console.log(`User ${currentUser?.uid} rated profile ${profileUserId} with ${rating} stars.`);
    toast({
      title: "Rating Submitted (Mock)",
      description: `You submitted a rating of ${rating} stars for ${profileData.companyName}.`,
    });
  };


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
            <div className="flex flex-col items-center md:items-end gap-2 ml-auto mt-4 md:mt-0 w-full md:w-auto">
                 {/* Always render the average rating section */}
                 <div className="text-center md:text-right">
                    <p className="text-sm text-muted-foreground">Average Rating</p>
                    <div className="flex items-center gap-1 justify-center md:justify-end">
                        <StarDisplay rating={profileData.averageRating} size="h-5 w-5" />
                        <span className="text-lg font-semibold text-primary ml-1">
                            {profileData.averageRating !== undefined ? profileData.averageRating.toFixed(1) : 'N/A'}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        ({profileData.ratingCount !== undefined ? profileData.ratingCount : '0'} ratings)
                    </p>
                 </div>
                 {currentUser && !isOwnProfile && (
                    <ConnectionButton
                      targetUserId={profileData.userId}
                      targetUserName={profileData.companyName}
                      size="default"
                      className="mt-2 w-full md:w-auto"
                    />
                 )}
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
          <div>
             <h3 className="text-lg font-semibold text-foreground mb-2">About Us</h3>
             <p className="text-muted-foreground text-sm leading-relaxed">
               {profileData.description}
             </p>
          </div>

          <Separator />

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

          {/* Rating Submission Section */}
          {currentUser && !isOwnProfile && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Rate this Business</h3>
                <div className="flex items-center gap-2 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "h-7 w-7 cursor-pointer transition-colors",
                        (hoverRating || userRating) >= star ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-300"
                      )}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => handleRateProfile(star)}
                    />
                  ))}
                </div>
                {userRating > 0 && (
                  <Button onClick={() => handleRateProfile(userRating)} size="sm">
                    Submit Your Rating ({userRating} Stars)
                  </Button>
                )}
                 <p className="text-xs text-muted-foreground mt-2">
                    {/* Placeholder for "You previously rated X stars" - needs backend integration */}
                 </p>
              </div>
            </>
          )}

           <Separator />

           <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Posts by {profileData.companyName}</h3>
              {isLoadingStatus && !isOwnProfile ? ( // Show loading only if connection status is relevant and loading
                  <div className="flex items-center justify-center p-6">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      <p className="text-muted-foreground">Checking connection status...</p>
                  </div>
              ) : statusError && !isOwnProfile ? ( // Show error only if connection status is relevant and errored
                   <div className="flex items-center justify-center p-6 text-destructive gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      <p>Could not load connection status.</p>
                   </div>
              ) : connectionStatus === 'connected' || isOwnProfile ? (
                  <ProfilePostsSection userId={profileUserId} />
              ) : (
                  <div className="text-center p-6 border rounded-lg bg-muted/50">
                     <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                     <p className="text-muted-foreground font-medium">Connect to view posts</p>
                     <p className="text-xs text-muted-foreground mt-1">Posts are only visible to connected businesses.</p>
                  </div>
              )}
           </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessProfilePage;

```