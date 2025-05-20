// src/app/profile/[userId]/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, CalendarDays, MapPin, CheckCircle, Mail, Phone, Loader2, AlertTriangle, Lock, Star, MessageSquare, Edit3, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ConnectionButton } from '@/components/ConnectionButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConnectionStatus, fetchFullUserProfile, type UserProfileData, type VisibilitySetting } from '@/services/connectionService';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import type { ConnectionStatus } from '@/types/connection';
import { ProfilePostsSection } from '@/components/profile/ProfilePostsSection';
import { cn } from '@/lib/utils';
import { addReview, getReviewsForProfile, updateReview, deleteReview } from '@/services/reviewService';
import type { ClientReview, NewReviewData, UpdateReviewData } from '@/types/review';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';

const IS_UID_REGEX_PROFILE_PAGE = /^[a-zA-Z0-9]{20,}$/;

const StarDisplay: React.FC<{ rating: number; totalStars?: number, size?: string }> = ({ rating, totalStars = 5, size="h-5 w-5" }) => {
  const fullStars = Math.floor(rating);
  const emptyStars = totalStars - fullStars;

  return (
    <div className="flex items-center">
      {[...Array(fullStars)].map((_, i) => <Star key={`full-${i}`} className={cn(size, "text-yellow-400 fill-yellow-400")} />)}
      {[...Array(emptyStars)].map((_, i) => <Star key={`empty-${i}`} className={cn(size, "text-gray-300")} />)}
    </div>
  );
};

// getInitials is now imported from pseudonymUtils

const BusinessProfilePage = () => {
  const params = useParams();
  const profileUserIdFromParams = params?.userId as string | undefined;
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [editingReview, setEditingReview] = useState<ClientReview | null>(null);

  const isProfileIdValidUid = useMemo(() => {
    if (!profileUserIdFromParams) return false;
    const isValid = IS_UID_REGEX_PROFILE_PAGE.test(profileUserIdFromParams);
    console.log(`[BusinessProfilePage] isProfileIdValidUid for '${profileUserIdFromParams}': ${isValid}`);
    return isValid;
  }, [profileUserIdFromParams]);

  const profileUserId = profileUserIdFromParams;

  useEffect(() => {
    if (profileUserId && !isProfileIdValidUid) {
        console.warn(`[BusinessProfilePage] Effect: Invalid profileUserId '${profileUserId}' from URL. UI should show error.`);
    }
  }, [profileUserId, isProfileIdValidUid]);


  const { data: viewedUserProfileData, isLoading: isLoadingProfile, error: profileError } = useQuery<UserProfileData | null, Error>({
    queryKey: ['fullUserProfile', profileUserId],
    queryFn: async () => {
      console.log(`[BusinessProfilePage] queryFn for fullUserProfile: Fetching for targetUserId: '${profileUserId}'`);
      if (!profileUserId || !IS_UID_REGEX_PROFILE_PAGE.test(profileUserId)) {
        console.warn(`[BusinessProfilePage] queryFn for fullUserProfile: Invalid profileUserId '${profileUserId}', returning null.`);
        return null;
      }
      return fetchFullUserProfile(profileUserId);
    },
    enabled: !!profileUserId && isProfileIdValidUid,
  });

  const connectionStatusQueryEnabled = !!currentUser?.uid && !!profileUserId && IS_UID_REGEX_PROFILE_PAGE.test(profileUserId) && currentUser.uid !== profileUserId;
  
  useEffect(() => {
    console.log(`[BusinessProfilePage] Debug: connectionStatusQueryEnabled: ${connectionStatusQueryEnabled}`);
    console.log(`  currentUser?.uid: ${currentUser?.uid}`);
    console.log(`  profileUserId: ${profileUserId}`);
    console.log(`  isProfileIdValidUid: ${isProfileIdValidUid}`);
    console.log(`  currentUser?.uid !== profileUserId: ${currentUser?.uid !== profileUserId}`);
  }, [connectionStatusQueryEnabled, currentUser?.uid, profileUserId, isProfileIdValidUid]);

  const { data: connectionStatus, isLoading: isLoadingStatus, error: statusError } = useQuery<ConnectionStatus | null, Error>({
    queryKey: ['connectionStatus', currentUser?.uid, profileUserId],
    queryFn: async () => {
        console.log(`[BusinessProfilePage] queryFn for connectionStatus - Parameters: currentUser='${currentUser?.uid}', profileUser='${profileUserId}'`);
        if (!currentUser?.uid || !profileUserId || !IS_UID_REGEX_PROFILE_PAGE.test(profileUserId) || currentUser.uid === profileUserId) {
            console.error(`[BusinessProfilePage] queryFn for connectionStatus: CRITICAL FALLBACK - Invalid conditions for fetch. CurrentUser: ${currentUser?.uid}, ProfileUser: ${profileUserId}`);
            return 'not_connected';
        }
        return getConnectionStatus(currentUser.uid, profileUserId);
    },
    enabled: connectionStatusQueryEnabled,
  });

  const reviewsQueryEnabled = !!profileUserId && isProfileIdValidUid && !!currentUser;
  const { data: reviews = [], isLoading: isLoadingReviews, error: reviewsError } = useQuery<ClientReview[], Error>({
    queryKey: ['reviews', profileUserId],
    queryFn: () => {
      console.log(`%c[BusinessProfilePage] getReviewsForProfile queryFn: Fetching for targetUserId: '${profileUserId}'. Auth UID: '${currentUser?.uid || 'NULL'}'`, "color: dodgerblue;");
      if (!profileUserId || !isProfileIdValidUid ) {
        console.warn(`[BusinessProfilePage] getReviewsForProfile queryFn: Invalid profileUserId '${profileUserId}' or not a valid UID format. Skipping fetch.`);
        return Promise.resolve([]);
      }
      return getReviewsForProfile(profileUserId);
    },
    enabled: reviewsQueryEnabled,
  });


  const currentUserReview = useMemo(() => {
    if (!currentUser) return null;
    return reviews.find(r => r.reviewerId === currentUser.uid);
  }, [reviews, currentUser]);

  useEffect(() => {
    if (currentUserReview) {
      setUserRating(currentUserReview.rating);
      setReviewComment(currentUserReview.comment);
      setEditingReview(currentUserReview);
    } else {
      setUserRating(0);
      setReviewComment('');
      setEditingReview(null);
    }
  }, [currentUserReview]);

  const averageRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    return totalRating / reviews.length;
  }, [reviews]);
  const ratingCount = reviews.length;

  const addOrUpdateReviewMutation = useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      if (!currentUser || !profileUserId || !isProfileIdValidUid) throw new Error("User, profile ID missing, or invalid profile ID.");
      if (editingReview) {
        const updateData: UpdateReviewData = { rating: data.rating, comment: data.comment };
        await updateReview(editingReview.id, currentUser.uid, updateData);
        return "Review updated successfully!";
      } else {
        // Fetch current user's profile to get their mentionName for the review
        const reviewerProfile = await fetchFullUserProfile(currentUser.uid);
        const reviewerMentionName = reviewerProfile?.mentionName || generateAnonymousName(currentUser.uid);

        const newReviewData: NewReviewData = {
          targetUserId: profileUserId,
          reviewerId: currentUser.uid,
          reviewerName: reviewerMentionName, // Use mentionName for anonymity
          reviewerAvatar: viewedUserProfileData?.avatarUrl || undefined, // Or use currentUser.photoURL if preferred
          rating: data.rating,
          comment: data.comment,
        };
        await addReview(newReviewData);
        return "Review submitted successfully!";
      }
    },
    onSuccess: (message) => {
      toast({ title: "Success", description: message });
      if (profileUserId) queryClient.invalidateQueries({ queryKey: ['reviews', profileUserId] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Could not submit review." });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId: string) => {
      if (!currentUser) throw new Error("User not authenticated.");
      return deleteReview(reviewId, currentUser.uid);
    },
    onSuccess: () => {
      toast({ title: "Review Deleted" });
      if (profileUserId) queryClient.invalidateQueries({ queryKey: ['reviews', profileUserId] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Could not delete review." });
    },
  });

  const handleRateProfileSubmit = () => {
    if (userRating === 0) {
      toast({ variant: "destructive", title: "Rating Required", description: "Please select a star rating." });
      return;
    }
    addOrUpdateReviewMutation.mutate({ rating: userRating, comment: reviewComment });
  };

  const handleDeleteReview = (reviewId: string) => {
    deleteReviewMutation.mutate(reviewId);
  };

  if (profileUserIdFromParams && !isProfileIdValidUid) {
    return (
      <div className="container mx-auto p-4 md:p-8 max-w-4xl text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold text-destructive mb-2">Invalid Profile Identifier</h1>
        <p className="text-muted-foreground">
          The user identifier in the URL (<code>{profileUserIdFromParams}</code>) does not seem to be valid.
          Please check the link or try navigating from a valid user link.
        </p>
        <Button onClick={() => router.push('/')} className="mt-6">Go to Homepage</Button>
      </div>
    );
  }


  if (authLoading || (isLoadingProfile && !viewedUserProfileData && isProfileIdValidUid)) {
     return (
       <div className="container mx-auto p-4 md:p-8 max-w-4xl">
         <Card className="overflow-hidden shadow-lg rounded-lg border-border">
           <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 p-6 border-b">
             <div className="flex flex-col md:flex-row items-start md:items-center gap-4 animate-pulse">
               <Skeleton className="h-20 w-20 rounded-full bg-muted"></Skeleton>
               <div className="flex-grow space-y-2">
                  <Skeleton className="h-6 bg-muted rounded w-3/4"></Skeleton>
                  <Skeleton className="h-4 bg-muted rounded w-1/2"></Skeleton>
                  <Skeleton className="h-4 bg-muted rounded w-1/3"></Skeleton>
               </div>
               <Skeleton className="h-10 w-24 bg-muted rounded"></Skeleton>
             </div>
           </CardHeader>
            <CardContent className="p-6 space-y-4">
                <Skeleton className="h-8 w-1/3 mb-4" />
                <Skeleton className="h-20 w-full mb-6" />
                <Skeleton className="h-6 w-1/4 mb-2" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                 <Skeleton className="h-8 w-1/3 mt-6 mb-4" />
                 <Skeleton className="h-24 w-full mb-6" />
                 <Skeleton className="h-8 w-1/3 mt-6 mb-4" />
                 <Skeleton className="h-32 w-full" />
            </CardContent>
         </Card>
       </div>
     );
  }

  if (!profileUserId || !viewedUserProfileData) {
    return (
      <div className="container mx-auto p-4 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
        <p className="text-muted-foreground font-semibold">Business profile data could not be loaded or profile ID is missing/invalid.</p>
         <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  if (profileError) {
      return (
          <div className="container mx-auto p-4 text-center">
             <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
             <p className="text-muted-foreground font-semibold">Error loading profile: {profileError.message}</p>
             <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
          </div>
      );
  }

  const isOwnProfile = currentUser?.uid === viewedUserProfileData.uid;

  const canViewDescription = isOwnProfile || 
                           !viewedUserProfileData.descriptionVisibility || // Default to everyone if not set
                           viewedUserProfileData.descriptionVisibility === 'everyone' ||
                           (viewedUserProfileData.descriptionVisibility === 'connected' && connectionStatus === 'connected');

  const canViewContactInfo = isOwnProfile || connectionStatus === 'connected';


  const generatedNameForProfile = generateAnonymousName(viewedUserProfileData.uid);
  const headerDisplayNameForTitle = viewedUserProfileData.companyName || viewedUserProfileData.mentionName || generatedNameForProfile;
  const headerDisplayNameForAvatar = viewedUserProfileData.companyName || viewedUserProfileData.mentionName || generatedNameForProfile;
  
  const displayCompanyNameForAboutHeading = viewedUserProfileData.companyName || headerDisplayNameForTitle;

  const headerAvatarUrl = viewedUserProfileData.avatarUrl || undefined;
  const headerIndustry = viewedUserProfileData.industry || "Industry Not Specified";
  
  let nameForConnectionButton: string;
  if (viewedUserProfileData.companyName) {
    nameForConnectionButton = viewedUserProfileData.companyName;
  } else {
    nameForConnectionButton = headerDisplayNameForAvatar; 
  }

  const displayIndustry = viewedUserProfileData.industry || "Not specified";
  const displayDescription = canViewDescription ? (viewedUserProfileData.description || "No profile description provided.") : "[Description Hidden]";
  const displayLocation = viewedUserProfileData.location || "Location not set";
  const displayEstablished = viewedUserProfileData.established || "Year not set";
  const displayContactEmail = canViewContactInfo ? (viewedUserProfileData.contactEmail || "Email not available") : "[Contact Email Hidden]";
  const displayContactPhone = canViewContactInfo ? (viewedUserProfileData.contactPhone) : undefined;


  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <Card className="overflow-hidden shadow-lg rounded-lg border-border">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 p-6 border-b">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary">
              <AvatarImage src={headerAvatarUrl} alt={headerDisplayNameForTitle} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {getInitials(headerDisplayNameForAvatar)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-grow text-center md:text-left">
              <CardTitle className="text-3xl font-bold text-foreground">
                {headerDisplayNameForTitle}
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1 flex items-center justify-center md:justify-start gap-1">
                 <Building className="h-4 w-4" /> {headerIndustry}
                 {viewedUserProfileData.verified && (
                    <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" /> Verified
                    </span>
                 )}
              </CardDescription>
               <div className="mt-2 flex flex-wrap gap-2 justify-center md:justify-start">
                  {(viewedUserProfileData.tags || []).map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2 ml-auto mt-4 md:mt-0 w-full md:w-auto">
                 {(averageRating > 0 || ratingCount > 0 || isOwnProfile) && (
                     <div className="text-center md:text-right">
                        <p className="text-sm text-muted-foreground">Average Rating</p>
                        <div className="flex items-center gap-1 justify-center md:justify-end">
                            <StarDisplay rating={averageRating} size="h-5 w-5" />
                            <span className="text-lg font-semibold text-primary ml-1">
                                {averageRating.toFixed(1)}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            ({ratingCount} ratings)
                        </p>
                     </div>
                  )}
                 {currentUser && !isOwnProfile && profileUserId && IS_UID_REGEX_PROFILE_PAGE.test(profileUserId) && (
                    <ConnectionButton
                      targetUserId={profileUserId}
                      targetUserName={nameForConnectionButton}
                      size="default"
                      className="mt-2 w-full md:w-auto"
                    />
                 )}
                 {isLoadingStatus && !isOwnProfile && profileUserId && IS_UID_REGEX_PROFILE_PAGE.test(profileUserId) && (
                     <Button disabled size="default" className="mt-2 w-full md:w-auto">
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                     </Button>
                 )}
                 {statusError && !isOwnProfile && profileUserId && IS_UID_REGEX_PROFILE_PAGE.test(profileUserId) && (
                     <p className="text-xs text-destructive mt-2 text-right">Error loading connection status</p>
                 )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 grid gap-6">
          <div>
             <h3 className="text-lg font-semibold text-foreground mb-2">About {displayCompanyNameForAboutHeading}</h3>
             <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
               {displayDescription}
             </p>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
               <MapPin className="h-4 w-4 text-primary" />
               <span>{displayLocation}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
               <CalendarDays className="h-4 w-4 text-primary" />
               <span>Established: {displayEstablished}</span>
            </div>
             <div className="flex items-center gap-2 text-muted-foreground">
               <Mail className="h-4 w-4 text-primary" />
               {canViewContactInfo && viewedUserProfileData.contactEmail ? (
                  <a href={`mailto:${viewedUserProfileData.contactEmail}`} className="hover:underline hover:text-primary">
                    {viewedUserProfileData.contactEmail}
                  </a>
               ) : (
                  <span>{displayContactEmail}</span>
               )}
            </div>
            {displayContactPhone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 text-primary" />
                    <span>{displayContactPhone}</span>
                 </div>
             )}
          </div>

          {currentUser && !isOwnProfile && isProfileIdValidUid && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  {editingReview ? "Update Your Review" : "Rate this Business"}
                </h3>
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
                      onClick={() => setUserRating(star)}
                    />
                  ))}
                </div>
                <div className="space-y-2 mb-4">
                    <Label htmlFor="reviewComment" className="text-sm font-medium">Add a comment (optional)</Label>
                    <Textarea
                        id="reviewComment"
                        placeholder="Share your experience with this business..."
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={3}
                        className="resize-y"
                        disabled={addOrUpdateReviewMutation.isPending}
                    />
                </div>
                <Button
                  onClick={handleRateProfileSubmit}
                  size="sm"
                  disabled={userRating === 0 || addOrUpdateReviewMutation.isPending}
                >
                   {addOrUpdateReviewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                   {editingReview ? "Update Review" : "Submit Review"}
                </Button>
              </div>
            </>
          )}

          <Separator />

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" /> Customer Reviews ({ratingCount})
            </h3>
            {isLoadingReviews ? (
                 <div className="flex justify-center items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : reviewsError ? (
                <p className="text-sm text-destructive text-center py-4">Error loading reviews: {reviewsError.message}</p>
            ) : reviews.length > 0 ? (
                <div className="space-y-6">
                    {reviews.map((review) => (
                        <Card key={review.id} className="bg-muted/50 p-4 shadow-sm border-border">
                           <CardHeader className="p-0 pb-2 flex flex-row justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={review.reviewerAvatar || undefined} alt={review.reviewerName || 'Reviewer'} />
                                        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                                            {getInitials(review.reviewerName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{review.reviewerName}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <StarDisplay rating={review.rating} size="h-4 w-4" />
                           </CardHeader>
                           <CardContent className="p-0 pt-2">
                                <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                           </CardContent>
                           {currentUser?.uid === review.reviewerId && (
                               <CardFooter className="p-0 pt-3 flex justify-end gap-2">
                                   <AlertDialog>
                                       <AlertDialogTrigger asChild>
                                           <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={deleteReviewMutation.isPending && deleteReviewMutation.variables === review.id}>
                                               {deleteReviewMutation.isPending && deleteReviewMutation.variables === review.id ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : <Trash2 className="h-3 w-3 mr-1"/>}
                                               Delete
                                           </Button>
                                       </AlertDialogTrigger>
                                       <AlertDialogContent>
                                           <AlertDialogHeader>
                                               <AlertDialogTitle>Delete Your Review?</AlertDialogTitle>
                                               <AlertDialogDescription>
                                                   Are you sure you want to delete your review? This action cannot be undone.
                                               </AlertDialogDescription>
                                           </AlertDialogHeader>
                                           <AlertDialogFooter>
                                               <AlertDialogCancel disabled={deleteReviewMutation.isPending && deleteReviewMutation.variables === review.id}>Cancel</AlertDialogCancel>
                                               <AlertDialogAction onClick={() => handleDeleteReview(review.id)} className="bg-destructive hover:bg-destructive/90" disabled={deleteReviewMutation.isPending && deleteReviewMutation.variables === review.id}>
                                                   {deleteReviewMutation.isPending && deleteReviewMutation.variables === review.id ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                                                   Delete
                                               </AlertDialogAction>
                                           </AlertDialogFooter>
                                       </AlertDialogContent>
                                   </AlertDialog>
                               </CardFooter>
                           )}
                        </Card>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                    No reviews yet for this business.
                </p>
            )}
          </div>

           <Separator />

           <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Posts by {displayCompanyNameForAboutHeading}</h3>
              {profileUserId && IS_UID_REGEX_PROFILE_PAGE.test(profileUserId) && (isOwnProfile || (connectionStatus === 'connected' )) ? (
                  <ProfilePostsSection userId={profileUserId} />
              ) : isLoadingStatus && !isOwnProfile && profileUserId && IS_UID_REGEX_PROFILE_PAGE.test(profileUserId) ? (
                  <div className="flex items-center justify-center p-6">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      <p className="text-muted-foreground">Checking connection status...</p>
                  </div>
              ) : statusError && !isOwnProfile && profileUserId && IS_UID_REGEX_PROFILE_PAGE.test(profileUserId) ? (
                   <div className="flex items-center justify-center p-6 text-destructive gap-2 border rounded-lg bg-destructive/10">
                      <AlertTriangle className="h-5 w-5" />
                      <p>Could not load connection status for posts.</p>
                   </div>
              ) : profileUserId && IS_UID_REGEX_PROFILE_PAGE.test(profileUserId) ? (
                  <div className="text-center p-6 border rounded-lg bg-muted/50">
                     <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                     <p className="text-muted-foreground font-medium">Connect to view posts</p>
                     <p className="text-xs text-muted-foreground mt-1">Posts by this user are only visible to connected businesses or the business owner.</p>
                  </div>
              ) : (
                 <div className="text-center p-6 border rounded-lg bg-destructive/10">
                     <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
                     <p className="text-destructive-foreground font-medium">Cannot display posts due to invalid profile identifier or other error.</p>
                  </div>
              )}
           </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessProfilePage;
