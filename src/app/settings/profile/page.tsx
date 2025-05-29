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
import { Loader2, Upload, ImageDown, AtSign, Building, Briefcase, Info, User, DollarSign, CheckCircle } from 'lucide-react'; // Added CheckCircle
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
import { updateUserProfileDetails, fetchFullUserProfile, type UserProfileUpdateData } from '@/services/connectionService';
import type { VisibilitySetting, UserProfileData } from '@/types/connection';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import { uploadPostImage } from '@/services/storageService'; // Assuming this service exists

const MAX_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

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

  // State for editable fields
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [established, setEstablished] = useState('');
  const [establishedError, setEstablishedError] = useState<string | null>(null);
  const [incomeRange, setIncomeRange] = useState<string>('Prefer not to say');

  // State for visibility settings
  const [descriptionVisibility, setDescriptionVisibility] = useState<VisibilitySetting>('everyone');
  
  // State for displaying non-editable fields
  const [fetchedMentionName, setFetchedMentionName] = useState('');
  const [fetchedCompanyName, setFetchedCompanyName] = useState('');
  const [fetchedActualDisplayName, setFetchedActualDisplayName] = useState('');


  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentDbAvatarUrl, setCurrentDbAvatarUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalTooLargeFile, setOriginalTooLargeFile] = useState<File | null>(null);

  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (authLoading) {
      console.log("[ProfileSettingsPage] useEffect: Auth is loading, waiting...");
      return;
    }

    const fetchProfile = async () => {
      if (!user) {
        setIsFetchingProfile(false);
        return;
      }
      setIsFetchingProfile(true);
      console.log("[ProfileSettingsPage] useEffect: Fetching profile for user:", user.uid);
      try {
        // Removed artificial delay
        const fullProfileData = await fetchFullUserProfile(user.uid);
        console.log("[ProfileSettingsPage] useEffect: Raw fullProfileData from service:", fullProfileData);

        if (fullProfileData) {
          setIndustry(fullProfileData.industry || '');
          setDescription(fullProfileData.description || '');
          setDescriptionVisibility(fullProfileData.descriptionVisibility || 'everyone');
          setEstablished(fullProfileData.established || '');
          setIncomeRange(fullProfileData.incomeRange || 'Prefer not to say');
          
          setFetchedCompanyName(fullProfileData.companyName || '');
          setFetchedActualDisplayName(fullProfileData.actualDisplayName || '');
          setFetchedMentionName(fullProfileData.mentionName || generateAnonymousName(user.uid));

          const avatarToDisplay = fullProfileData.avatarUrl || null;
          setPreviewUrl(avatarToDisplay);
          setCurrentDbAvatarUrl(avatarToDisplay);
          console.log("[ProfileSettingsPage] Full profile data loaded and state set.");
        } else {
          console.warn("[ProfileSettingsPage] No full profile document found, setting defaults.");
          setFetchedMentionName(generateAnonymousName(user.uid));
          // Set other fields to defaults if necessary
          setIndustry('');
          setDescription('');
          setDescriptionVisibility('everyone');
          setEstablished('');
          setIncomeRange('Prefer not to say');
          setPreviewUrl(null);
          setCurrentDbAvatarUrl(null);
          setFetchedCompanyName('');
          setFetchedActualDisplayName('');
        }
      } catch (error) {
        console.error("[ProfileSettingsPage] useEffect: Error fetching profile:", error);
        toast({ variant: "destructive", title: "Error Fetching Profile", description: "Could not load your profile data." });
        setFetchedMentionName(generateAnonymousName(user?.uid || "")); // Use user.uid if available
      } finally {
        setIsFetchingProfile(false);
        console.log("[ProfileSettingsPage] useEffect: Finished fetching profile attempt, isFetchingProfile set to false.");
      }
    };

    if (user && !isFetchingProfile) { // Fetch only if user exists and not already fetching
      console.log("[ProfileSettingsPage] useEffect: Auth not loading, user present. Fetching profile because isFetchingProfile is false.");
      fetchProfile();
    } else if (!user && !authLoading) { // Auth loaded, but no user
      console.log("[ProfileSettingsPage] useEffect: Auth loaded, no user. Clearing form.");
      // Clear form fields
      setIndustry('');
      setDescription('');
      setDescriptionVisibility('everyone');
      setEstablished('');
      setIncomeRange('Prefer not to say');
      setPreviewUrl(null);
      setCurrentDbAvatarUrl(null);
      setFetchedCompanyName('');
      setFetchedActualDisplayName('');
      setFetchedMentionName('');
      setIsFetchingProfile(false);
    }
  }, [user, authLoading]); // Removed toast from dependencies

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            toast({ variant: "destructive", title: "Invalid File Type", description: "Please select an image file (JPG, PNG, GIF, WebP)." });
             setSelectedFile(null); setOriginalTooLargeFile(null); setPreviewUrl(currentDbAvatarUrl);
             if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            setOriginalTooLargeFile(file); setShowCompressionDialog(true);
            setSelectedFile(null); setPreviewUrl(currentDbAvatarUrl);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
            setSelectedFile(file); setOriginalTooLargeFile(null); setShowCompressionDialog(false);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    } else {
        setSelectedFile(null); setOriginalTooLargeFile(null); setPreviewUrl(currentDbAvatarUrl);
    }
  };

   const handleCompressImage = async () => {
       if (!originalTooLargeFile) {
            toast({ variant: "destructive", title: "Compression Error", description: "No file selected for compression." });
            return;
        }
       setIsCompressing(true); setShowCompressionDialog(false);
        toast({ title: "Compressing...", description: "Please wait while the image is being compressed.", duration: 3000 });
        try {
            const compressedFile = await imageCompression(originalTooLargeFile, { maxSizeMB: MAX_FILE_SIZE_MB, maxWidthOrHeight: 1024, useWebWorker: true });
            setSelectedFile(compressedFile); setOriginalTooLargeFile(null);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(compressedFile);
            toast({ title: "Compression Successful", description: "The image has been compressed." });
        } catch (error) {
            console.error("[ProfileSettingsPage] Image compression error:", error);
            toast({ variant: "destructive", title: "Compression Failed", description: "Could not compress image." });
            setSelectedFile(null); setOriginalTooLargeFile(null); setPreviewUrl(currentDbAvatarUrl);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } finally {
            setIsCompressing(false);
        }
    };

  const handleAvatarChangeClick = () => fileInputRef.current?.click();
  
  const handleEstablishedYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const yearValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setEstablished(yearValue);
    if (yearValue.length === 4) {
      const yearNum = parseInt(yearValue, 10);
      if (yearNum < 1613 || yearNum > currentYear) {
        setEstablishedError(`Year must be between 1613 and ${currentYear}.`);
      } else {
        setEstablishedError(null);
      }
    } else if (yearValue.length > 0 && yearValue.length < 4) {
      setEstablishedError("Year must be 4 digits.");
    } else {
      setEstablishedError(null); 
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in to update your profile." });
        return;
    }
    if (establishedError) {
        toast({ variant: "destructive", title: "Invalid Input", description: establishedError });
        return;
    }
    if (established && established.length > 0 && established.length < 4) {
        const estErr = "Year Established must be 4 digits.";
        setEstablishedError(estErr);
        toast({ variant: "destructive", title: "Invalid Input", description: estErr });
        return;
    }

    setIsSubmitting(true);
    let newAvatarUrlForFirestore: string | null | undefined = undefined; 

    try {
        if (selectedFile) { 
            console.log("[ProfileSettingsPage] handleSubmit: Uploading new avatar...");
            newAvatarUrlForFirestore = await uploadPostImage(selectedFile, user.uid); // Assuming uploadPostImage is now available
            console.log("[ProfileSettingsPage] handleSubmit: New avatar URL:", newAvatarUrlForFirestore);
        } else if (previewUrl === null && currentDbAvatarUrl !== null) { 
            console.log("[ProfileSettingsPage] handleSubmit: Avatar explicitly removed by user.");
            newAvatarUrlForFirestore = null; // Signal to remove the avatar
        }
        
        const profileDataToUpdate: UserProfileUpdateData = {
            industry: industry || null,
            description: description || null,
            descriptionVisibility: descriptionVisibility,
            established: established || null,
            incomeRange: incomeRange === "Prefer not to say" ? null : incomeRange,
            // No longer sending actualDisplayName, companyName, or their visibility settings
        };

        if (newAvatarUrlForFirestore !== undefined) { // Only include avatarUrl if it changed or was explicitly removed
            profileDataToUpdate.avatarUrl = newAvatarUrlForFirestore;
        }
        
        console.log("[ProfileSettingsPage] handleSubmit: Data to update in Firestore:", profileDataToUpdate);
        await updateUserProfileDetails(user.uid, profileDataToUpdate);

        if (newAvatarUrlForFirestore !== undefined) {
            setCurrentDbAvatarUrl(newAvatarUrlForFirestore); 
            setPreviewUrl(newAvatarUrlForFirestore);
        }
        setSelectedFile(null); 
        setOriginalTooLargeFile(null);

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

  const nameForAvatar = fetchedCompanyName || fetchedActualDisplayName || fetchedMentionName || user?.email || 'U';
  
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

  // Helper to render visibility select
  const renderVisibilitySelect = (
    id: string, 
    value: VisibilitySetting, 
    onChange: (value: VisibilitySetting) => void,
    label: string
  ) => (
     <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-2 mt-1">
        <Label htmlFor={id} className="text-xs text-muted-foreground whitespace-nowrap">{label} visibility:</Label>
        <Select value={value} onValueChange={(v) => onChange(v as VisibilitySetting)} disabled={isSubmitting}>
            <SelectTrigger id={id} className="w-full sm:w-[180px] text-xs h-8">
                <SelectValue placeholder="Set visibility" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="everyone" className="text-xs">Everyone</SelectItem>
                <SelectItem value="connected" className="text-xs">Connected Users Only</SelectItem>
                <SelectItem value="only_me" className="text-xs">Only Me (Private)</SelectItem>
            </SelectContent>
        </Select>
    </div>
  );
  
  return (
    <Card className="shadow-md border-border">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Manage your public business profile information and visibility.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Identifiers Section (Read-Only) */}
          <div className="space-y-4 p-4 border rounded-md bg-muted/20">
            <Label className="text-base font-medium text-foreground">Your Identifiers</Label>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="mentionNameDisplay" className="text-sm font-medium flex items-center text-foreground/90">
                  <AtSign className="mr-2 h-4 w-4 text-primary" /> Mention Name (@)
                </Label>
                <Input id="mentionNameDisplay" value={fetchedMentionName ? `@${fetchedMentionName}` : "Generating..."} disabled className="bg-background/50 cursor-not-allowed text-sm"/>
                <p className="text-xs text-muted-foreground">Your unique anonymous identifier for mentions. Auto-generated and cannot be changed.</p>
              </div>

              {fetchedCompanyName && (
                <div className="space-y-1">
                  <Label htmlFor="companyNameDisplay" className="text-sm font-medium flex items-center text-foreground/90">
                    <Building className="mr-2 h-4 w-4 text-primary" /> Company Name
                  </Label>
                  <Input id="companyNameDisplay" value={fetchedCompanyName} disabled className="bg-background/50 cursor-not-allowed text-sm"/>
                   <p className="text-xs text-muted-foreground">Set during sign-up (for email/password accounts). Not editable here.</p>
                </div>
              )}
              {fetchedActualDisplayName && fetchedActualDisplayName !== fetchedCompanyName && (
                 <div className="space-y-1">
                    <Label htmlFor="actualDisplayNameDisplay" className="text-sm font-medium flex items-center text-foreground/90">
                       <User className="mr-2 h-4 w-4 text-primary" /> Display Name
                    </Label>
                    <Input id="actualDisplayNameDisplay" value={fetchedActualDisplayName} disabled className="bg-background/50 cursor-not-allowed text-sm"/>
                    <p className="text-xs text-muted-foreground">Typically from your Google profile, or a previously set display name. Not editable here.</p>
                 </div>
              )}
            </div>
          </div>
          
          {/* Avatar Section */}
          <div className="space-y-3 p-4 border rounded-md bg-muted/20">
            <Label className="text-base font-medium">Company Logo / Avatar</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border">
                <AvatarImage src={previewUrl ?? undefined} alt={nameForAvatar} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xl">
                  {getInitials(nameForAvatar)}
                </AvatarFallback>
              </Avatar>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/gif, image/webp" style={{ display: 'none' }} disabled={isSubmitting || isCompressing} />
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
            <p className="text-xs text-muted-foreground">Upload a JPG, PNG, GIF, or WebP. Max size {MAX_FILE_SIZE_MB}MB. Your avatar is always visible if set.</p>
          </div>

          {/* Industry Section */}
          <div className="space-y-1 p-4 border rounded-md bg-muted/20">
            <Label htmlFor="industry" className="text-base font-medium flex items-center">
              <Briefcase className="mr-2 h-4 w-4 text-primary" /> Industry
            </Label>
            <Select value={industry} onValueChange={setIndustry} disabled={isSubmitting}>
              <SelectTrigger id="industry" className="w-full text-sm">
                <SelectValue placeholder="Select your industry" />
              </SelectTrigger>
              <SelectContent>
                {detailedSectorsData.map((sector) => ( // Using detailedSectorsData for consistency
                  <SelectItem key={sector.code} value={sector.name} className="text-sm">{sector.name}</SelectItem>
                ))}
                <SelectItem value="Other" className="text-sm">Other</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground pt-1">Your industry is always visible if set.</p>
          </div>

          {/* Established Year Section */}
          <div className="space-y-1 p-4 border rounded-md bg-muted/20">
            <Label htmlFor="established" className="text-base font-medium">Year Established</Label>
            <Input
              id="established"
              type="text" 
              placeholder="e.g., 2010"
              value={established}
              onChange={handleEstablishedYearChange}
              maxLength={4}
              disabled={isSubmitting}
              className="text-sm"
            />
            {establishedError && <p className="text-xs text-destructive pt-1">{establishedError}</p>}
            <p className="text-xs text-muted-foreground pt-1">Enter the 4-digit year. Must be between 1613 and {currentYear}. Always visible if set.</p>
          </div>
          
          {/* Income Range Section */}
          <div className="space-y-1 p-4 border rounded-md bg-muted/20">
            <Label htmlFor="incomeRange" className="text-base font-medium flex items-center">
              <DollarSign className="mr-2 h-4 w-4 text-primary" /> Annual Income Range (Optional)
            </Label>
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
             <p className="text-xs text-muted-foreground pt-1">This information is always private and not displayed on your public profile.</p>
          </div>

          {/* Description Section */}
          <div className="space-y-1 p-4 border rounded-md bg-muted/20">
            <Label htmlFor="description" className="text-base font-medium">About Your Business</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell others a bit about your company..." rows={4} disabled={isSubmitting} className="resize-y text-sm" />
            {renderVisibilitySelect("descriptionVisibility", descriptionVisibility, setDescriptionVisibility, "About section")}
          </div>


          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting || isFetchingProfile || isCompressing || !!establishedError}>
              {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : ('Save Changes')}
            </Button>
          </div>
        </form>

        <AlertDialog open={showCompressionDialog} onOpenChange={setShowCompressionDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Image Too Large</AlertDialogTitle>
              <AlertDialogDescription>
                The selected image exceeds {MAX_FILE_SIZE_MB}MB ({(originalTooLargeFile?.size ? originalTooLargeFile.size / (1024 * 1024) : 0).toFixed(2)}MB).
                Would you like to compress it to fit? Compression may slightly reduce quality.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setSelectedFile(null); setOriginalTooLargeFile(null); setPreviewUrl(currentDbAvatarUrl); if (fileInputRef.current) fileInputRef.current.value = ''; setShowCompressionDialog(false); }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleCompressImage} className="bg-primary hover:bg-primary/90"><ImageDown className="mr-2 h-4 w-4" /> Compress Image</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </CardContent>
    </Card>
  );
};

export default ProfileSettingsPage;
```

**Reasoning for the Changes:**
1.  **Removed `toast` from `useEffect` Dependency Array**: The `toast` function provided by `useToast` is generally stable and doesn't need to be a dependency for an effect that fetches data based on `user` and `authLoading`.
2.  **Removed Artificial Delay**: The `await new Promise(resolve => setTimeout(resolve, 100));` was removed from the `fetchProfile` function. This was likely for simulating network latency but isn't needed for the actual functionality and contributes to the delay.
3.  **Clarified Fetch Condition**: The condition `if (user && !isFetchingProfile)` inside the `useEffect` ensures that `fetchProfile` is called only when there's a user and a fetch isn't already in progress. The `setIsFetchingProfile(true)` at the start of `fetchProfile` and `setIsFetchingProfile(false)` in its `finally` block manage this guard.

If the settings page still feels slow to open *after* these changes, the delay is more likely due to:
*   The inherent time taken by `onAuthStateChanged` in `AuthProvider` to resolve the initial user state.
*   The cumulative rendering time of the `MainLayout`, `SettingsLayout`, `SettingsSidebar`, and the form itself.
*   The actual Firestore read (`fetchFullUserProfile`), though usually fast for a single document, still involves a network request.

These changes focus on optimizing the data fetching trigger on the `ProfileSettingsPage`.