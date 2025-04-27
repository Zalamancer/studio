// src/app/profile/[userId]/page.tsx
"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Building, CalendarDays, MapPin, CheckCircle, Mail, Phone, Link2 } from 'lucide-react'; // Added Link2 icon
import { Separator } from '@/components/ui/separator'; // Import Separator component
import { Button } from '@/components/ui/button'; // Import Button
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useToast } from "@/hooks/use-toast"; // Import useToast

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
  const userId = params?.userId as string | undefined;
  const { user } = useAuth(); // Get the currently logged-in user
  const router = useRouter();
  const { toast } = useToast();

  // --- Connect Handler (Placeholder) ---
  const handleConnect = (targetUserId: string | undefined) => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "Please log in to connect." });
      return;
    }
    if (!targetUserId) {
         toast({ variant: "destructive", title: "Error", description: "Target user ID is missing." });
         return;
    }
    if (user.uid === targetUserId) {
        toast({ variant: "default", title: "Action Info", description: "You cannot connect with yourself." });
        return; // Prevent connecting with oneself
    }

    // Placeholder logic: In a real app, this might send a connection request,
    // navigate to a profile, or initiate another type of interaction.
    console.log(`Connect requested with user: ${targetUserId}`);
    toast({
        title: "Connect (Placeholder)",
        description: `Connect functionality with user ${targetUserId.substring(0,6)}... is not yet implemented.`,
    });
    // Example: Maybe navigate to the user's profile?
    // router.push(`/profile/${targetUserId}`);
    // setSelectedPost(null); // Close the sheet
  };
  // --- End Connect Handler ---

  // Handle case where userId is not available (should ideally not happen with proper routing)
  if (!userId) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-destructive">User ID not found.</p>
      </div>
    );
  }

  // Fetch profile data (using placeholder function)
  const profileData = getBusinessProfileData(userId);

  // Handle case where profile data is not found for the user
  if (!profileData) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-muted-foreground">Business profile not found for this user.</p>
      </div>
    );
  }

  const isOwnProfile = user?.uid === profileData.userId; // Check if viewing own profile

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
                 {/* Show Connect Button only if logged in and NOT viewing own profile */}
                  {!isOwnProfile && user && (
                     <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleConnect(profileData.userId)}
                        className="mt-2 w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
                     >
                         <Link2 className="mr-2 h-4 w-4" /> Connect
                     </Button>
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

           {/* Placeholder for further sections: e.g., Team, Portfolio, Reviews */}
           {/*
           <Separator />
           <div>
             <h3 className="text-lg font-semibold text-foreground mb-2">Placeholder Section</h3>
             <p className="text-muted-foreground text-sm">More details about the business...</p>
           </div>
           */}

        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessProfilePage;
