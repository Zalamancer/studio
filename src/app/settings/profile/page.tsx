// src/app/settings/profile/page.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, User, Upload, ImageDown, AtSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import imageCompression from 'browser-image-compression';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { detailedSectorsData } from '@/components/layout/MainLayout';
import { updateUserProfileDetails, fetchFullUserProfile } from '@/services/connectionService';
import type { UserProfileData, VisibilitySetting } from '@/types/connection';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import { uploadPostImage } from '@/services/storageService'; // Assuming this is for avatar uploads

const MAX_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const visibilityOptions: { value: VisibilitySetting; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'connected', label: 'Connected Users Only' },
  { value: 'only_me', label: 'Only Me (Private)' },
];

const incomeRangeOptions = [
  "Prefer not to say",
  "$0 - $50,000",
  "$50,001 - $100,000",
  "$100,001 - $250,000",
  "$250,001 - $500,000",
  "$500,001 - $1,000,000",
  "$1,000,000+",
];

const ProfileSettingsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionVisibility, setDescriptionVisibility] = useState<VisibilitySetting>('everyone');
  const [incomeRange, setIncomeRange] = useState<string>("Prefer not to say");

  const [fetchedCompanyName, setFetchedCompanyName] = useState('');
  const [fetchedActualDisplayName, setFetchedActualDisplayName] = useState('');
  const [fetchedMentionName, setFetchedMentionName] = useState('');
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentDbAvatarUrl, setCurrentDbAvatarUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  const [isFetchingProfile, setIsFetchingProfile] = useState(false); // Initialize to false
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);

  const availableIndustries = detailedSectorsData.map(sector => sector.name);

  // Fetch profile data when user is available
  useEffect(() => {
    // If auth is still loading, don't do anything yet
    if (authLoading) {
      console.log("[ProfileSettingsPage] useEffect: Auth is loading, waiting...");
      return;
    }

    // If auth is resolved, but no user, clear fields and stop.
    if (!user) {
      console.log("[ProfileSettingsPage] useEffect: No user, clearing form and stopping fetch.");
      setIndustry('');
      setDescription('');
      setDescriptionVisibility('everyone');
      setIncomeRange("Prefer not to say");
      setPreviewUrl(null);
      setCurrentDbAvatarUrl(null);
      setFetchedCompanyName('');
      setFetchedActualDisplayName('');
      setFetchedMentionName('');
      setIsFetchingProfile(false); // Ensure this is false
      return;
    }

    // If user is present and we are not already fetching
    if (user && !isFetchingProfile) {
      const fetchProfile = async () => {
        setIsFetchingProfile(true); // Set fetching to true *before* the async operation
        console.log("[ProfileSettingsPage] useEffect: Fetching profile for user:", user.uid);
        try {
          const fullProfileData = await fetchFullUserProfile(user.uid);
          console.log("[ProfileSettingsPage] useEffect: Raw fullProfileData from service:", fullProfileData);

          if (fullProfileData) {
            setIndustry(fullProfileData.industry || '');
            setDescription(fullProfileData.description || '');
            setDescriptionVisibility(fullProfileData.descriptionVisibility || 'everyone');
            setIncomeRange(fullProfileData.incomeRange || "Prefer not to say");
            
            setFetchedCompanyName(fullProfileData.companyName || '');
            // actualDisplayName is no longer a direct field in UserProfileData
            // We derive a display name for avatar from companyName or mentionName
            setFetchedActualDisplayName(fullProfileData.companyName || ''); // Or a different logic if needed
            setFetchedMentionName(fullProfileData.mentionName || generateAnonymousName(user.uid));

            const avatarToDisplay = fullProfileData.avatarUrl || null;
            setPreviewUrl(avatarToDisplay);
            setCurrentDbAvatarUrl(avatarToDisplay);
            console.log("[ProfileSettingsPage] Full profile data loaded and state set.");
          } else {
            console.warn("[ProfileSettingsPage] No full profile document found, setting defaults.");
            setIndustry('');
            setDescription('');
            setDescriptionVisibility('everyone');
            setIncomeRange("Prefer not to say");
            setPreviewUrl(null);
            setCurrentDbAvatarUrl(null);
            setFetchedCompanyName('');
            setFetchedActualDisplayName('');
            setFetchedMentionName(generateAnonymousName(user.uid));
          }
          // Removed toast for profile loaded to reduce noise during debugging loop
        } catch (error) {
          console.error("[ProfileSettingsPage] useEffect: Error fetching profile:", error);
          toast({ variant: "destructive", title: "Error Fetching Profile", description: "Could not load your profile data." });
          setFetchedMentionName(generateAnonymousName(user.uid));
        } finally {
          setIsFetchingProfile(false);
          console.log("[ProfileSettingsPage] useEffect: Finished fetching profile attempt, isFetchingProfile set to false.");
        }
      };
      fetchProfile();
    }
  // The effect should run when authLoading completes, or when the user object reference changes.
  // isFetchingProfile is managed internally to prevent re-fetch loops.
  }, [user, authLoading, toast]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            toast({ variant: "destructive", title: "Invalid File Type", description: "Please select an image file (JPG, PNG, GIF)." });
             setSelectedFile(null); setOriginalFile(null); setPreviewUrl(currentDbAvatarUrl);
             if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            setOriginalFile(file); setShowCompressionDialog(true);
            setSelectedFile(null); setPreviewUrl(currentDbAvatarUrl);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
            setSelectedFile(file); setOriginalFile(null); setShowCompressionDialog(false);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    } else {
        setSelectedFile(null); setOriginalFile(null); setPreviewUrl(currentDbAvatarUrl);
    }
  };

   const handleCompressImage = async () => {
       if (!originalFile) {
            toast({ variant: "destructive", title: "Compression Error", description: "No file selected for compression." });
            return;
        }
       setIsCompressing(true); setShowCompressionDialog(false);
        toast({ title: "Compressing...", description: "Please wait while the image is being compressed.", duration: 3000 });
        try {
            const compressedFile = await imageCompression(originalFile, { maxSizeMB: MAX_FILE_SIZE_MB, maxWidthOrHeight: 1024, useWebWorker: true });
            setSelectedFile(compressedFile); setOriginalFile(null);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(compressedFile);
            toast({ title: "Compression Successful", description: "The image has been compressed." });
        } catch (error) {
            console.error("[ProfileSettingsPage] Image compression error:", error);
            toast({ variant: "destructive", title: "Compression Failed", description: "Could not compress image." });
            setSelectedFile(null); setOriginalFile(null); setPreviewUrl(currentDbAvatarUrl);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } finally {
            setIsCompressing(false);
        }
    };

  const handleAvatarChangeClick = () => fileInputRef.current?.click();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in to update your profile." });
        return;
    }
    setIsSubmitting(true);
    let newAvatarUrlForFirestore: string | null | undefined = undefined; 

    try {
        if (selectedFile) { 
            console.log("[ProfileSettingsPage] handleSubmit: Uploading new avatar...");
            newAvatarUrlForFirestore = await uploadPostImage(selectedFile, user.uid);
            console.log("[ProfileSettingsPage] handleSubmit: New avatar URL:", newAvatarUrlForFirestore);
        } else if (previewUrl === null && currentDbAvatarUrl !== null) { 
            console.log("[ProfileSettingsPage] handleSubmit: Avatar explicitly removed by user.");
            newAvatarUrlForFirestore = null; // User explicitly cleared the avatar
        }
        
        const profileDataToUpdate: Partial<UserProfileData> = {
            industry: industry || null,
            description: description || null,
            descriptionVisibility: descriptionVisibility,
            incomeRange: incomeRange === "Prefer not to say" ? null : incomeRange,
        };

        if (newAvatarUrlForFirestore !== undefined) {
            profileDataToUpdate.avatarUrl = newAvatarUrlForFirestore;
        }
        
        console.log("[ProfileSettingsPage] handleSubmit: Data to update in Firestore:", profileDataToUpdate);
        await updateUserProfileDetails(user.uid, profileDataToUpdate);

        if (newAvatarUrlForFirestore !== undefined) {
            setCurrentDbAvatarUrl(newAvatarUrlForFirestore); 
            setPreviewUrl(newAvatarUrlForFirestore);
        }
        setSelectedFile(null); 
        setOriginalFile(null);

        toast({ title: "Profile Updated", description: "Your profile information has been saved." });

    } catch (error: any) {
        console.error('[ProfileSettingsPage] Error updating profile:', error);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: `Could not update your profile: ${error.message}`,
        });
    } finally {
        setIsSubmitting(false);
    }
  };


  if (authLoading) {
      return (
          <Card>
              <CardHeader><CardTitle>Profile Settings</CardTitle><CardDescription>Manage your public business profile.</CardDescription></CardHeader>
              <CardContent className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Loading user...</p>
              </CardContent>
          </Card>
      );
  }
   // This spinner will only show if authLoading is false, but we are actively fetching profile data
  if (isFetchingProfile) {
      return (
          <Card>
              <CardHeader><CardTitle>Profile Settings</CardTitle><CardDescription>Manage your public business profile.</CardDescription></CardHeader>
              <CardContent className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Fetching profile...</p>
              </CardContent>
          </Card>
      );
  }

  if (!user) {
      return (
          <Card>
              <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground">Please log in to access settings.</p></CardContent>
          </Card>
      );
  }

  const renderVisibilitySelect = (
    value: VisibilitySetting,
    onChange: (value: VisibilitySetting) => void,
    fieldId: string,
    labelPrefix: string
  ) => (
    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-2 mt-1">
        <Label htmlFor={`${fieldId}Visibility`} className="text-xs text-muted-foreground whitespace-nowrap">{labelPrefix} Visibility:</Label>
        <Select value={value} onValueChange={(v) => onChange(v as VisibilitySetting)} disabled={isSubmitting}>
        <SelectTrigger id={`${fieldId}Visibility`} className="w-full sm:w-[180px] text-xs h-8">
            <SelectValue placeholder="Set visibility" />
        </SelectTrigger>
        <SelectContent>
            {visibilityOptions.map(opt => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
            ))}
        </SelectContent>
        </Select>
    </div>
  );

  const nameForAvatar = fetchedCompanyName || fetchedActualDisplayName || fetchedMentionName || user?.email || 'U';

  return (
    <Card className="shadow-md border-border">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Manage your public business profile information and visibility.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
           <div className="space-y-3 p-4 border rounded-md bg-muted/20">
               <Label className="text-base font-medium">Avatar / Logo</Label>
               <div className="flex items-center gap-4">
                   <Avatar className="h-20 w-20 border">
                        <AvatarImage src={previewUrl ?? undefined} alt={nameForAvatar} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-xl">
                            {previewUrl ? <User className="h-10 w-10" /> : getInitials(nameForAvatar)}
                        </AvatarFallback>
                   </Avatar>
                   <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" style={{ display: 'none' }} disabled={isSubmitting || isCompressing} />
                   <div className="flex flex-col gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleAvatarChangeClick} disabled={isSubmitting || isCompressing}>
                            {isCompressing ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Compressing... </> : <> <Upload className="mr-2 h-4 w-4" /> Change Avatar </>}
                        </Button>
                        {previewUrl && (
                            <Button type="button" variant="ghost" size="xs" onClick={() => { setPreviewUrl(null); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} disabled={isSubmitting || isCompressing} className="text-destructive hover:text-destructive">
                                Remove Avatar
                            </Button>
                        )}
                   </div>
               </div>
                <p className="text-xs text-muted-foreground">Upload a JPG, PNG, or GIF. Max size {MAX_FILE_SIZE_MB}MB.</p>
           </div>

            <div className="space-y-1 p-4 border rounded-md bg-muted/20">
                <Label htmlFor="mentionName" className="text-base font-medium flex items-center">
                  <AtSign className="mr-2 h-4 w-4 text-primary" /> Mention Name (@)
                </Label>
                <Input id="mentionName" value={fetchedMentionName ? `@${fetchedMentionName}` : "Not generated"} disabled={true} className="bg-background/50 cursor-not-allowed text-sm"/>
                <p className="text-xs text-muted-foreground">Your unique anonymous identifier for mentions. This is automatically generated and cannot be changed.</p>
            </div>
            
            {fetchedCompanyName && (
                <div className="space-y-1 p-4 border rounded-md bg-muted/20">
                    <Label htmlFor="displayCompanyName" className="text-base font-medium">Company Name</Label>
                    <Input id="displayCompanyName" value={fetchedCompanyName} disabled={true} className="bg-background/50 cursor-not-allowed text-sm"/>
                    <p className="text-xs text-muted-foreground">Your registered company name (from sign-up or Google). Not editable here. Always visible if set.</p>
                </div>
            )}

            {/* Removed actualDisplayName field and its visibility as per previous request to simplify */}


          <div className="space-y-1 p-4 border rounded-md bg-muted/20">
            <Label htmlFor="industry" className="text-base font-medium">Industry</Label>
            <Select value={industry} onValueChange={setIndustry} disabled={isSubmitting}>
                <SelectTrigger id="industry" className="w-full text-sm">
                    <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                    {availableIndustries.map((ind) => (
                        <SelectItem key={ind} value={ind} className="text-sm">{ind}</SelectItem>
                    ))}
                    <SelectItem value="Other" className="text-sm">Other</SelectItem>
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground pt-1">Your industry is always visible if set.</p>
          </div>

          <div className="space-y-1 p-4 border rounded-md bg-muted/20">
            <Label htmlFor="incomeRange" className="text-base font-medium">Annual Income Range</Label>
            <Select value={incomeRange} onValueChange={setIncomeRange} disabled={isSubmitting}>
                <SelectTrigger id="incomeRange" className="w-full text-sm">
                    <SelectValue placeholder="Select your income range" />
                </SelectTrigger>
                <SelectContent>
                    {incomeRangeOptions.map((range) => (
                        <SelectItem key={range} value={range} className="text-sm">{range}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground pt-1">This information is optional. Its visibility on your public profile can be controlled if such a feature is added later.</p>
          </div>

          <div className="space-y-1 p-4 border rounded-md bg-muted/20">
            <Label htmlFor="description" className="text-base font-medium">About Your Business</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell others a bit about your company..." rows={4} disabled={isSubmitting} className="resize-y text-sm" />
            {renderVisibilitySelect(descriptionVisibility, setDescriptionVisibility, 'description', 'About section')}
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting || isFetchingProfile || isCompressing}>
              {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : ('Save Changes')}
            </Button>
          </div>
        </form>

        <AlertDialog open={showCompressionDialog} onOpenChange={setShowCompressionDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Image Too Large</AlertDialogTitle>
                    <AlertDialogDescription>
                         The selected image exceeds {MAX_FILE_SIZE_MB}MB ({(originalFile?.size ? originalFile.size / (1024*1024) : 0).toFixed(2)}MB).
                         Would you like to compress it to fit? Compression may slightly reduce quality.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => { setSelectedFile(null); setOriginalFile(null); setPreviewUrl(currentDbAvatarUrl); if (fileInputRef.current) fileInputRef.current.value = ''; setShowCompressionDialog(false); }}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCompressImage} className="bg-primary hover:bg-primary/90"><ImageDown className="mr-2 h-4 w-4" /> Compress Image</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </CardContent>
    </Card>
  );
};

export default ProfileSettingsPage;
