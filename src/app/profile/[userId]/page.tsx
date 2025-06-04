
// Tip: If this BusinessProfilePage component becomes too large or complex,
// consider further splitting its internal sections (like Review Submission, Review List, etc.)
// into their own dedicated components within a 'profile' sub-directory,
// similar to how PostDetailPanel was refactored.
// This file can then act as a bridge, importing and orchestrating these smaller components.
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Removed 'use'
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, CalendarDays, CheckCircle, Loader2, AlertTriangle, Star, MessageSquare, Edit3, Trash2, Briefcase, Info, AtSign, DollarSign, UserX } from 'lucide-react'; // Added UserX
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConnectionButton } from '@/components/ConnectionButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFullUserProfile, getConnectionStatus } from '@/services/connectionService';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import type { ConnectionStatus, UserProfileData, VisibilitySetting } from '@/types/connection';
import { ProfilePostsSection } from '@/components/profile/ProfilePostsSection';
import { cn } from '@/lib/utils';
import { addReview, getReviewsForProfile, updateReview, deleteReview, getReviewsGivenByUserId } from '@/services/reviewService';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";

const StarDisplay: React.FC<{ rating: number; totalStars?: number, size?: string }> = ({ rating, totalStars = 5, size="h-5 w-5" }) => {
  const fullStars = Math.floor(rating);
  const emptyStars = totalStars - Math.ceil(rating);
  const halfStar = !Number.isInteger(rating) && rating % 1 !== 0;

  return (
    <div className="flex items-center">
      {[...Array(fullStars)].map((_, i) => <Star key={`full-${i}`} className={cn(size, "text-yellow-400 fill-yellow-400")} />)}
      {halfStar && <Star key="half" className={cn(size, "text-yellow-400")} style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0% 100%)' }} />}
      {[...Array(emptyStars)].map((_, i) => <Star key={`empty-${i}`} className={cn(size, "text-gray-300")} />)}
    </div>
  );
};

const BusinessProfilePage = () => {
  const params = useParams(); // Direct usage
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const profileUserIdFromParams = params?.userId as string | undefined;

  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [editingReview, setEditingReview] = useState<ClientReview | null>(null);

  const profileUserId = profileUserIdFromParams;

  const isProfileIdValidUid = useMemo(() => {
    if (!profileUserIdFromParams) return false;
    const isValid = IS_VALID_FIREBASE_UID_REGEX.test(profileUserIdFromParams);
    console.log(`%c[BusinessProfilePage] isProfileIdValidUid for '${profileUserIdFromParams}': ${isValid}`, isValid ? "color: green" : "color: orange");
    return isValid;
  }, [profileUserIdFromParams]);

  useEffect(() => {
    console.log(`%c[BusinessProfilePage] DEBUG: isProfileIdValidUid changed or component mounted. Value: ${isProfileIdValidUid}`, "color: purple");
  }, [isProfileIdValidUid]);


  const { data: viewedUserProfileData, isLoading: isLoadingProfile, error: profileError } = useQuery<UserProfileData | null, Error>({
    queryKey: ['fullUserProfile', profileUserId],
    queryFn: async () => {
      if (!profileUserId || !IS_VALID_FIREBASE_UID_REGEX.test(profileUserId)) {
        console.warn(`%c[BusinessProfilePage] fetchFullUserProfile queryFn: Invalid profileUserId '${profileUserId}', or regex test failed. Aborting fetch.`, "color: orange;");
        return null;
      }
      console.log(`%c[BusinessProfilePage] fetchFullUserProfile queryFn: Fetching for profileUserId '${profileUserId}'`, "color: dodgerblue;");
      return fetchFullUserProfile(profileUserId);
    },
    enabled: !!profileUserId && isProfileIdValidUid,
  });

  const connectionStatusQueryEnabled = useMemo(() => {
    const enabled = !!currentUser?.uid && !!profileUserId && IS_VALID_FIREBASE_UID_REGEX.test(profileUserId) && currentUser.uid !== profileUserId;
    console.log(`%c[BusinessProfilePage] CONNECTION STATUS QUERY CHECK:
      - currentUser.uid: ${currentUser?.uid || 'NULL'}
      - profileUserId: ${profileUserId || 'NULL'}
      - IS_VALID_FIREBASE_UID_REGEX.test(profileUserId): ${profileUserId ? IS_VALID_FIREBASE_UID_REGEX.test(profileUserId) : 'N/A'}
      - currentUser.uid !== profileUserId: ${currentUser && profileUserId ? currentUser.uid !== profileUserId : 'N/A'}
      - FINAL enabled flag for connectionStatus query: ${enabled}`,
    "color: cyan; background: #eee; padding: 2px;");
    return enabled;
  }, [currentUser?.uid, profileUserId]);


  const { data: connectionStatus, isLoading: isLoadingStatus, error: statusError } = useQuery<ConnectionStatus | null, Error>({
    queryKey: ['connectionStatus', currentUser?.uid, profileUserId],
    queryFn: async () => {
       if (!currentUser?.uid || !profileUserId || currentUser.uid === profileUserId) {
         console.error(`%c[BusinessProfilePage] queryFn for connectionStatus: CRITICAL FALLBACK - Invalid conditions for calling service. CurrentUser: ${currentUser?.uid}, ProfileUser: ${profileUserId}`, "color: red;");
         return 'not_connected';
       }
       if (!IS_VALID_FIREBASE_UID_REGEX.test(profileUserId)) {
            console.error(`[BusinessProfilePage] queryFn for connectionStatus: CRITICAL FALLBACK - Attempting to call with invalid profileUserId format: '${profileUserId}'. Aborting fetch, returning 'not_connected'.`);
            return 'not_connected';
        }
        console.log(`%c[BusinessProfilePage] Querying connection status between ${currentUser.uid} and ${profileUserId}`, "color: dodgerblue;");
       return getConnectionStatus(currentUser.uid, profileUserId);
    },
    enabled: connectionStatusQueryEnabled,
  });

  const reviewsQueryEnabled = useMemo(() => {
    const enabled = !!profileUserId && IS_VALID_FIREBASE_UID_REGEX.test(profileUserId);
    console.log(`%c[BusinessProfilePage] REVIEWS QUERY CHECK:
      - profileUserId: ${profileUserId || 'NULL'}
      - IS_VALID_FIREBASE_UID_REGEX.test(profileUserId): ${profileUserId ? IS_VALID_FIREBASE_UID_REGEX.test(profileUserId) : 'N/A'}
      - FINAL enabled flag for reviews query: ${enabled}`,
    "color: mediumpurple; background: #eee; padding: 2px;");
    return enabled;
  }, [profileUserId]);

  const { data: reviewsReceived = [], isLoading: isLoadingReviews, error: reviewsError } = useQuery<ClientReview[], Error>({
    queryKey: ['reviews', profileUserId, 'received'],
    queryFn: () => {
        console.log(`%c[BusinessProfilePage] getReviewsForProfile queryFn: Fetching for profileUserId '${profileUserId}'`, "color: dodgerblue;");
        if (!profileUserId || !IS_VALID_FIREBASE_UID_REGEX.test(profileUserId)) {
          console.warn("[BusinessProfilePage] getReviewsForProfile: Invalid profileUserId, returning empty array.");
          return Promise.resolve([]);
        }
        return getReviewsForProfile(profileUserId);
    },
    enabled: reviewsQueryEnabled,
  });

  const { data: reviewsGivenByThisProfile = [], isLoading: isLoadingReviewsGiven, error: reviewsGivenError } = useQuery<ClientReview[], Error>({
    queryKey: ['reviews', profileUserId, 'givenBy'],
    queryFn: () => {
        if (!profileUserId || !IS_VALID_FIREBASE_UID_REGEX.test(profileUserId)) {
          console.warn("[BusinessProfilePage] getReviewsGivenByUserId: Invalid profileUserId, returning empty array.");
          return Promise.resolve([]);
        }
        return getReviewsGivenByUserId(profileUserId);
    },
    enabled: reviewsQueryEnabled && !!currentUser,
  });


  const currentUserReview = useMemo(() => {
    if (!currentUser) return null;
    return reviewsReceived.find(r => r.reviewerId === currentUser.uid);
  }, [reviewsReceived, currentUser]);

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

  const weightedAverageRatingReceived = useMemo(() => {
    if (!reviewsReceived || reviewsReceived.length === 0) return 0;
    let totalWeightedRating = 0;
    let totalWeight = 0;
    console.log(`%c[BusinessProfilePage] Calculating weightedAverageRatingReceived. Found ${reviewsReceived.length} reviews.`, "color: darkorange; font-weight: bold;");
    reviewsReceived.forEach((review, index) => {
      let weight = 1.0;
      const histAvg = review.reviewerHistoricalAvgRating;

      if (histAvg === null) {
        weight = 0.9;
        console.log(`  Review ${index + 1} (ID: ${review.id}) by ${review.reviewerName || generateAnonymousName(review.reviewerId)}: Rating=${review.rating}, ReviewerHistAvg=NULL, AssignedWeight=${weight.toFixed(1)}`);
      } else if (typeof histAvg === 'number') {
        if (histAvg < 2.5) {
          weight = 0.6;
           console.log(`  Review ${index + 1} (ID: ${review.id}) by ${review.reviewerName || generateAnonymousName(review.reviewerId)}: Rating=${review.rating}, ReviewerHistAvg=${histAvg.toFixed(1)} (Harsh), AssignedWeight=${weight.toFixed(1)}`);
        } else if (histAvg >= 4.0) {
          weight = 1.1;
           console.log(`  Review ${index + 1} (ID: ${review.id}) by ${review.reviewerName || generateAnonymousName(review.reviewerId)}: Rating=${review.rating}, ReviewerHistAvg=${histAvg.toFixed(1)} (Lenient), AssignedWeight=${weight.toFixed(1)}`);
        } else {
            console.log(`  Review ${index + 1} (ID: ${review.id}) by ${review.reviewerName || generateAnonymousName(review.reviewerId)}: Rating=${review.rating}, ReviewerHistAvg=${histAvg.toFixed(1)} (Neutral), AssignedWeight=${weight.toFixed(1)}`);
        }
      } else {
        console.log(`  Review ${index + 1} (ID: ${review.id}) by ${review.reviewerName || generateAnonymousName(review.reviewerId)}: Rating=${review.rating}, ReviewerHistAvg=UNEXPECTED_TYPE (${typeof histAvg}), AssignedWeight=${weight.toFixed(1)}`);
      }
      totalWeightedRating += review.rating * weight;
      totalWeight += weight;
    });

    if (totalWeight === 0) return 0;
    const average = totalWeightedRating / totalWeight;
    console.log(`%c  Final Weighted: TotalWeightedRating=${totalWeightedRating.toFixed(2)}, TotalWeight=${totalWeight.toFixed(2)}, WeightedAverage=${average.toFixed(2)}`, "color: darkorange; font-weight: bold;");
    return average;
  }, [reviewsReceived]);

  const ratingReceivedCount = reviewsReceived.length;

  const averageRatingGivenByThisProfile = useMemo(() => {
    if (!reviewsGivenByThisProfile || reviewsGivenByThisProfile.length === 0) return 0;
    const totalRating = reviewsGivenByThisProfile.reduce((sum, review) => sum + review.rating, 0);
    return totalRating / reviewsGivenByThisProfile.length;
  }, [reviewsGivenByThisProfile]);
  const ratingGivenCount = reviewsGivenByThisProfile.length;


  const addOrUpdateReviewMutation = useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      if (!currentUser || !profileUserId || !IS_VALID_FIREBASE_UID_REGEX.test(profileUserId)) throw new Error("User, profile ID missing, or invalid profile ID.");

      const reviewerProfileData = await fetchFullUserProfile(currentUser.uid);

      if (editingReview) {
        const updateData: UpdateReviewData = { rating: data.rating, comment: data.comment };
        await updateReview(editingReview.id, currentUser.uid, updateData);
        return "Review updated successfully!";
      } else {
        const newReviewData: NewReviewData = {
          targetUserId: profileUserId,
          reviewerId: currentUser.uid,
          reviewerName: reviewerProfileData?.mentionName || generateAnonymousName(currentUser.uid),
          reviewerAvatar: reviewerProfileData?.avatarUrl || undefined,
          rating: data.rating,
          comment: data.comment,
        };
        await addReview(newReviewData);
        return "Review submitted successfully!";
      }
    },
    onSuccess: (message) => {
      toast({ title: "Success", description: message });
      if (profileUserId) queryClient.invalidateQueries({ queryKey: ['reviews', profileUserId, 'received'] });
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
      if (profileUserId) queryClient.invalidateQueries({ queryKey: ['reviews', profileUserId, 'received'] });
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
      <div className="w-full flex flex-col items-center justify-center p-8 min-h-[calc(100vh-10rem)]">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold text-destructive mb-2">Invalid Profile Identifier</h1>
        <p className="text-muted-foreground text-center">
          The user identifier in the URL (<code>{profileUserIdFromParams}</code>) does not seem to be valid.
          <br />
          Please check the link or try navigating from a valid user link.
        </p>
        <Button onClick={() => router.push('/')} className="mt-6">Go to Homepage</Button>
      </div>
    );
  }

  if (authLoading || (isLoadingProfile && isProfileIdValidUid && !viewedUserProfileData)) {
     return (
      <div className="w-full container mx-auto p-4 md:p-8 max-w-4xl">
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

  if (!viewedUserProfileData && isProfileIdValidUid && !isLoadingProfile) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 min-h-[calc(100vh-10rem)] text-center">
        <UserX className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold text-foreground mb-2">Profile Unavailable</h1>
        <p className="text-muted-foreground max-w-md">
          The user profile you are trying to view (ID: <code>{profileUserId}</code>) no longer exists or could not be found on our platform.
          This can happen if the user has deleted their account or the link is incorrect.
        </p>
         <Button onClick={() => router.push('/')} className="mt-8">Return to Homepage</Button>
      </div>
    );
  }
  
  if (!viewedUserProfileData) { 
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 min-h-[calc(100vh-10rem)]">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
        <p className="text-muted-foreground font-semibold">Profile data could not be loaded.</p>
         <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }


  if (profileError && isProfileIdValidUid) {
      return (
          <div className="w-full flex flex-col items-center justify-center p-8 min-h-[calc(100vh-10rem)]">
             <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
             <p className="text-muted-foreground font-semibold">Error loading profile: {profileError.message}</p>
             <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
          </div>
      );
  }

  const isOwnProfile = currentUser?.uid === viewedUserProfileData.uid;
  const generatedNameForProfile = generateAnonymousName(viewedUserProfileData.uid);
  
  const headerDisplayNameForTitle = viewedUserProfileData.companyName || viewedUserProfileData.mentionName || generatedNameForProfile;
  const headerDisplayNameForAvatar = viewedUserProfileData.companyName || viewedUserProfileData.mentionName || generatedNameForProfile;
  const displayCompanyNameForAboutHeading = viewedUserProfileData.companyName || headerDisplayNameForTitle;
  
  let nameForConnectionButton = headerDisplayNameForAvatar;
  if (viewedUserProfileData.companyName) {
      nameForConnectionButton = viewedUserProfileData.companyName;
  }


  const canViewDescription = isOwnProfile ||
    !viewedUserProfileData.descriptionVisibility ||
    viewedUserProfileData.descriptionVisibility === 'everyone' ||
    (viewedUserProfileData.descriptionVisibility === 'connected' && connectionStatus === 'connected');

  const displayDescription = canViewDescription ? (viewedUserProfileData.description || "No profile description provided.") : "[Description Hidden by User]";
  const headerAvatarUrl = viewedUserProfileData.avatarUrl || undefined;
  const displayEstablished = viewedUserProfileData.established || "Year not set";
  const displayableSectorInfo = viewedUserProfileData.industryName || viewedUserProfileData.subSectorName || viewedUserProfileData.sectorName;


  return (
    <TooltipProvider>
      <div className="w-full container mx-auto p-4 md:p-8 max-w-4xl">
        <Card className="overflow-hidden shadow-lg rounded-lg border-border">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 p-6 border-b">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-primary">
                <AvatarImage src={headerAvatarUrl} alt={headerDisplayNameForAvatar} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {getInitials(headerDisplayNameForAvatar)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-grow text-center md:text-left">
                <CardTitle className="text-3xl font-bold text-foreground">
                   {displayCompanyNameForAboutHeading}
                </CardTitle>
                <div className="flex items-center justify-center md:justify-start gap-x-3 gap-y-1 mt-1 flex-wrap text-sm">
                  {viewedUserProfileData.mentionName && (
                       <span className="text-muted-foreground flex items-center gap-1">
                          <AtSign className="h-4 w-4" /> {viewedUserProfileData.mentionName}
                       </span>
                  )}
                  {displayableSectorInfo && (
                      <span className="text-muted-foreground flex items-center gap-1">
                          <Briefcase className="h-4 w-4" /> {displayableSectorInfo}
                      </span>
                  )}
                   {displayEstablished !== "Year not set" && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" /> Est: {displayEstablished}
                    </span>
                  )}
                 {viewedUserProfileData.verified && (
                    <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" /> Verified
                    </span>
                 )}
                </div>
              </div>
              <div className="flex flex-col items-center md:items-end gap-2 ml-auto mt-4 md:mt-0 w-full md:w-auto">
                  <div className="text-center md:text-right mb-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-muted-foreground">Profile Rating (Weighted)</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground">
                              <Info className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs p-2">
                            This is a weighted average score, considering the typical rating behavior of reviewers.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-1 justify-center md:justify-end">
                          <StarDisplay rating={weightedAverageRatingReceived} size="h-5 w-5" />
                          <span className="text-lg font-semibold text-primary ml-1">
                              {weightedAverageRatingReceived.toFixed(1)}
                          </span>
                          <span className="text-xs text-muted-foreground ml-0.5">({ratingReceivedCount} ratings)</span>
                      </div>
                  </div>
                   {(ratingGivenCount > 0 || isOwnProfile) && (
                       <div className="text-center md:text-right">
                          <p className="text-sm text-muted-foreground">Avg. Rating Given (to others)</p>
                          <div className="flex items-center gap-1 justify-center md:justify-end">
                              <StarDisplay rating={averageRatingGivenByThisProfile} size="h-4 w-4" />
                              <span className="text-md font-semibold text-primary/80 ml-1">
                                  {averageRatingGivenByThisProfile.toFixed(1)}
                              </span>
                               <span className="text-xs text-muted-foreground ml-0.5">({ratingGivenCount} reviews)</span>
                          </div>
                       </div>
                    )}
                   {currentUser && !isOwnProfile && profileUserId && IS_VALID_FIREBASE_UID_REGEX.test(profileUserId) && (
                      <ConnectionButton
                        targetUserId={profileUserId}
                        targetUserName={nameForConnectionButton}
                        size="default"
                        className="mt-2 w-full md:w-auto"
                      />
                   )}
                   {isLoadingStatus && !isOwnProfile && profileUserId && IS_VALID_FIREBASE_UID_REGEX.test(profileUserId) && (
                       <Button disabled size="default" className="mt-2 w-full md:w-auto">
                           <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                       </Button>
                   )}
                   {statusError && !isOwnProfile && profileUserId && IS_VALID_FIREBASE_UID_REGEX.test(profileUserId) && (
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
            
            {(viewedUserProfileData.sectorName || viewedUserProfileData.subSectorName || viewedUserProfileData.industryName) && (
                <>
                    <hr className="border-border"/>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-primary" /> Business Classification
                        </h3>
                        <div className="space-y-1 text-sm">
                           {viewedUserProfileData.sectorName && <p><strong className="text-foreground/80">Sector:</strong> {viewedUserProfileData.sectorName}</p>}
                           {viewedUserProfileData.subSectorName && <p><strong className="text-foreground/80">Sub-Sector:</strong> {viewedUserProfileData.subSectorName}</p>}
                           {viewedUserProfileData.industryName && <p><strong className="text-foreground/80">Industry:</strong> {viewedUserProfileData.industryName}</p>}
                           {viewedUserProfileData.naicsCode && <p><strong className="text-foreground/80">NAICS Code:</strong> <Badge variant="outline">{viewedUserProfileData.naicsCode}</Badge></p>}
                        </div>
                    </div>
                </>
            )}


            {isOwnProfile && viewedUserProfileData.incomeRange && viewedUserProfileData.incomeRange !== "Prefer not to say" && (
              <>
                <hr className="border-border" />
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" /> Income Information (Private)
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <strong>Annual Income Range:</strong> {viewedUserProfileData.incomeRange}
                  </p>
                </div>
              </>
            )}


            {currentUser && !isOwnProfile && IS_VALID_FIREBASE_UID_REGEX.test(profileUserId) && (
              <>
                <hr className="border-border" />
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

            <hr className="border-border" />

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" /> Reviews Received ({ratingReceivedCount})
              </h3>
              {isLoadingReviews ? (
                   <div className="flex justify-center items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : reviewsError ? (
                  <p className="text-sm text-destructive text-center py-4">Error loading reviews: {reviewsError.message}</p>
              ) : reviewsReceived.length > 0 ? (
                  <div className="space-y-6">
                      {reviewsReceived.map((review) => (
                          <Card key={review.id} className="bg-muted/50 p-4 shadow-sm border-border">
                             <CardHeader className="p-0 pb-2 flex flex-row justify-between items-start">
                                  <div className="flex items-center gap-3">
                                      <Avatar className="h-9 w-9">
                                          <AvatarImage src={review.reviewerAvatar || undefined} alt={review.reviewerName} />
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
                                  {review.reviewerHistoricalAvgRating !== null && review.reviewerHistoricalAvgRating !== undefined && (
                                      <p className="text-xs text-muted-foreground/70 mt-1.5 italic">
                                          (Reviewer's avg. rating given at time of review: {review.reviewerHistoricalAvgRating.toFixed(1)})
                                      </p>
                                  )}
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

             <hr className="border-border" />

             <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Posts by {displayCompanyNameForAboutHeading}</h3>
                {profileUserId && IS_VALID_FIREBASE_UID_REGEX.test(profileUserId) && (isOwnProfile || connectionStatus === 'connected' ) ? (
                    <ProfilePostsSection userId={profileUserId} />
                ) : isLoadingStatus && !isOwnProfile && profileUserId && IS_VALID_FIREBASE_UID_REGEX.test(profileUserId) ? (
                    <div className="flex items-center justify-center p-6">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                        <p className="text-muted-foreground">Checking connection status...</p>
                    </div>
                ) : statusError && !isOwnProfile && profileUserId && IS_VALID_FIREBASE_UID_REGEX.test(profileUserId) ? (
                     <div className="flex items-center justify-center p-6 text-destructive gap-2 border rounded-lg bg-destructive/10">
                        <AlertTriangle className="h-5 w-5" />
                        <p>Could not load connection status for posts.</p>
                     </div>
                ) : profileUserId && IS_VALID_FIREBASE_UID_REGEX.test(profileUserId) ? (
                    <div className="text-center p-6 border rounded-lg bg-muted/50">
                       <Info className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                       <p className="text-muted-foreground font-medium">
                          {isOwnProfile ? "You haven't posted anything yet." : `Connect with ${displayCompanyNameForAboutHeading} to view their posts.`}
                       </p>
                       {!isOwnProfile && <p className="text-xs text-muted-foreground mt-1">Posts by this user are only visible to connected businesses or the business owner.</p>}
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
    </TooltipProvider>
  );
};

export default BusinessProfilePage;

