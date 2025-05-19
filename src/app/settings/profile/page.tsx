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
import { Loader2, User, Upload, ImageDown } from 'lucide-react';
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
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { uploadPostImage } from '@/services/storageService'; // Assuming this service exists and works for general image uploads

const MAX_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const getInitials = (name: string | undefined | null): string => {
    if (!name) return '?';
    const nameToProcess = name.startsWith('@') ? name.substring(1) : name;

    // Check for ColorAnimalNumber format first (for mentionName)
    const mentionNameRegex = /^[A-Z][a-z]+[A-Z][a-z]+[0-9]{3}$/;
    if (mentionNameRegex.test(nameToProcess)) {
        const match = nameToProcess.match(/^([A-Z])[a-z]+([A-Z])/);
        if (match && match[1] && match[2]) return match[1] + match[2];
        if (match && match[1]) return match[1];
    }
    // Fallback for other names (actualDisplayName, companyName)
    const parts = nameToProcess.split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};


const visibilityOptions: { value: VisibilitySetting; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'connected', label: 'Connected Users Only' },
  { value: 'only_me', label: 'Only Me (Private)' },
];

const ProfileSettingsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for editable fields
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  // State for read-only display
  const [fetchedActualDisplayName, setFetchedActualDisplayName] = useState('');
  const [fetchedCompanyName, setFetchedCompanyName] = useState('');
  const [fetchedMentionName, setFetchedMentionName] = useState('');


  // Current avatar shown in UI (can be existing or preview of new upload)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Stores the original avatar URL from Firestore to compare if it changed
  const [currentDbAvatarUrl, setCurrentDbAvatarUrl] = useState<string | null>(null);


  // Visibility settings state
  const [actualDisplayNameVisibility, setActualDisplayNameVisibility] = useState<VisibilitySetting>('everyone');
  const [companyNameVisibility, setCompanyNameVisibility] = useState<VisibilitySetting>('everyone');
  const [industryVisibility, setIndustryVisibility] = useState<VisibilitySetting>('everyone');
  const [descriptionVisibility, setDescriptionVisibility] = useState<VisibilitySetting>('everyone');
  const [avatarVisibility, setAvatarVisibility] = useState<VisibilitySetting>('everyone');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);

  const availableIndustries = detailedSectorsData.map(sector => sector.name); // Using main sector names as industries

  useEffect(() => {
    const fetchProfile = async () => {
      if (authLoading) {
        console.log("[ProfileSettingsPage] Auth is loading, waiting...");
        return;
      }
      if (!user && !authLoading) {
         console.log("[ProfileSettingsPage] No user and auth not loading. Clearing fields.");
         setIndustry('');
         setDescription('');
         setFetchedActualDisplayName('');
         setFetchedCompanyName('');
         setFetchedMentionName('');
         setPreviewUrl(null);
         setCurrentDbAvatarUrl(null);
         setActualDisplayNameVisibility('everyone');
         setCompanyNameVisibility('everyone');
         setIndustryVisibility('everyone');
         setDescriptionVisibility('everyone');
         setAvatarVisibility('everyone');
         setIsFetchingProfile(false);
         return;
      }

      if (user && !isFetchingProfile) {
        setIsFetchingProfile(true);
        console.log("[ProfileSettingsPage] Fetching profile for user:", user.uid);
        try {
          const fullProfileData = await fetchFullUserProfile(user.uid);
          console.log("[ProfileSettingsPage] Raw fullProfileData from service:", fullProfileData);

          if (fullProfileData) {
            setIndustry(fullProfileData.industry || '');
            setDescription(fullProfileData.description || '');
            setFetchedActualDisplayName(fullProfileData.actualDisplayName || '');
            setFetchedCompanyName(fullProfileData.companyName || '');
            setFetchedMentionName(fullProfileData.mentionName || generateAnonymousName(user.uid));

            const avatarToDisplay = fullProfileData.avatarUrl || user.photoURL || null;
            setPreviewUrl(avatarToDisplay);
            setCurrentDbAvatarUrl(fullProfileData.avatarUrl || null); // Store what's in DB for avatar

            setActualDisplayNameVisibility(fullProfileData.actualDisplayNameVisibility || 'everyone');
            setCompanyNameVisibility(fullProfileData.companyNameVisibility || 'everyone');
            setIndustryVisibility(fullProfileData.industryVisibility || 'everyone');
            setDescriptionVisibility(fullProfileData.descriptionVisibility || 'everyone');
            setAvatarVisibility(fullProfileData.avatarVisibility || 'everyone');
            console.log("[ProfileSettingsPage] Full profile data loaded.");

          } else {
             setIndustry('');
             setDescription('');
             setFetchedActualDisplayName('');
             setFetchedCompanyName('');
             setFetchedMentionName(generateAnonymousName(user.uid));
             setPreviewUrl(user.photoURL || null);
             setCurrentDbAvatarUrl(null);
             setActualDisplayNameVisibility('everyone');
             setCompanyNameVisibility('everyone');
             setIndustryVisibility('everyone');
             setDescriptionVisibility('everyone');
             setAvatarVisibility('everyone');
             console.warn("[ProfileSettingsPage] No full profile document found, using auth fallbacks and default visibilities.");
          }
        } catch (error) {
          console.error("[ProfileSettingsPage] Error fetching profile:", error);
          toast({
            variant: "destructive",
            title: "Error Fetching Profile",
            description: "Could not load your profile data.",
          });
        } finally {
          setIsFetchingProfile(false);
          console.log("[ProfileSettingsPage] Finished fetching profile attempt.");
        }
      }
    };
    fetchProfile();
   }, [user, authLoading, toast]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            toast({ variant: "destructive", title: "Invalid File Type", description: "Please select an image file (JPG, PNG, GIF)." });
             setSelectedFile(null); setOriginalFile(null); setPreviewUrl(currentDbAvatarUrl); // Revert to DB avatar or null
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
    let newAvatarUrlForFirestore: string | null | undefined = undefined; // undefined means "don't change"

    try {
        if (selectedFile) { // A new file was selected and processed
            newAvatarUrlForFirestore = await uploadPostImage(selectedFile, user.uid); // Using uploadPostImage, ensure path is appropriate
        } else if (previewUrl === null && currentDbAvatarUrl !== null) {
            // If preview is null (meaning user cleared it) and there was a DB avatar, set to null to delete
            newAvatarUrlForFirestore = null;
        }
        // If selectedFile is null AND previewUrl is same as currentDbAvatarUrl, newAvatarUrlForFirestore remains undefined (no change)

        const profileDataToUpdate: Partial<Pick<UserProfileData,
            'industry' | 'description' | 'avatarUrl' |
            'actualDisplayNameVisibility' | 'companyNameVisibility' |
            'industryVisibility' | 'descriptionVisibility' | 'avatarVisibility'
        >> = {
            industry: industry || null,
            description: description || null,
            // Only include avatarUrl in update if it has changed or is being cleared
            ...(newAvatarUrlForFirestore !== undefined && { avatarUrl: newAvatarUrlForFirestore }),
            actualDisplayNameVisibility,
            companyNameVisibility,
            industryVisibility,
            descriptionVisibility,
            avatarVisibility,
        };

        await updateUserProfileDetails(user.uid, profileDataToUpdate);

        if (newAvatarUrlForFirestore !== undefined) {
            setCurrentDbAvatarUrl(newAvatarUrlForFirestore); // Update currentDbAvatarUrl to the new saved one
        }
        setSelectedFile(null); // Clear selected file after successful save
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
  if (isFetchingProfile && !authLoading) {
      return (
          <Card>
              <CardHeader><CardTitle>Profile Settings</CardTitle><CardDescription>Manage your public business profile.</CardDescription></CardHeader>
              <CardContent className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Fetching profile...</p>
              </CardContent>
          </Card>
      );
  }


  if (!user && !authLoading) {
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
    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-2">
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
                        <AvatarImage src={previewUrl ?? undefined} alt={fetchedActualDisplayName || fetchedCompanyName || fetchedMentionName} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-xl">
                            {previewUrl ? <User className="h-10 w-10" /> : getInitials(fetchedActualDisplayName || fetchedCompanyName || fetchedMentionName)}
                        </AvatarFallback>
                   </Avatar>
                   <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" style={{ display: 'none' }} disabled={isSubmitting || isCompressing} />
                   <Button type="button" variant="outline" size="sm" onClick={handleAvatarChangeClick} disabled={isSubmitting || isCompressing}>
                        {isCompressing ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Compressing... </> : <> <Upload className="mr-2 h-4 w-4" /> Change </>}
                    </Button>
               </div>
                <p className="text-xs text-muted-foreground">Upload a JPG, PNG, or GIF. Max size {MAX_FILE_SIZE_MB}MB.</p>
                {renderVisibilitySelect(avatarVisibility, setAvatarVisibility, 'avatar', 'Avatar')}
           </div>

            <div className="space-y-3 p-4 border rounded-md bg-muted/20">
                <Label htmlFor="actualDisplayName" className="text-base font-medium">Display Name</Label>
                <Input id="actualDisplayName" value={fetchedActualDisplayName} disabled={true} className="bg-background/50 cursor-not-allowed"/>
                <p className="text-xs text-muted-foreground">Your primary public name (e.g., from Google). Not directly editable here.</p>
                {renderVisibilitySelect(actualDisplayNameVisibility, setActualDisplayNameVisibility, 'actualDisplayName', 'Display Name')}
            </div>


            <div className="space-y-3 p-4 border rounded-md bg-muted/20">
                <Label htmlFor="companyName" className="text-base font-medium">Company Name</Label>
                <Input id="companyName" value={fetchedCompanyName} disabled={true} className="bg-background/50 cursor-not-allowed"/>
                <p className="text-xs text-muted-foreground">Your company's name (e.g., from email sign-up). Not directly editable here.</p>
                {renderVisibilitySelect(companyNameVisibility, setCompanyNameVisibility, 'companyName', 'Company Name')}
            </div>

            <div className="space-y-3 p-4 border rounded-md bg-muted/20">
                <Label htmlFor="mentionName" className="text-base font-medium">Mention Name (@)</Label>
                <Input id="mentionName" value={`@${fetchedMentionName}`} disabled={true} className="bg-background/50 cursor-not-allowed"/>
                <p className="text-xs text-muted-foreground">Your unique anonymous identifier for mentions. Automatically generated.</p>
            </div>


          <div className="space-y-3 p-4 border rounded-md bg-muted/20">
             <Label htmlFor="industry" className="text-base font-medium">Industry</Label>
            <Select value={industry} onValueChange={setIndustry} disabled={isSubmitting}>
                <SelectTrigger id="industry" className="w-full">
                    <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                    {availableIndustries.map((ind) => (
                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {renderVisibilitySelect(industryVisibility, setIndustryVisibility, 'industry', 'Industry')}
          </div>

          <div className="space-y-3 p-4 border rounded-md bg-muted/20">
            <Label htmlFor="description" className="text-base font-medium">About Your Business</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell others a bit about your company..." rows={4} disabled={isSubmitting} className="resize-y" />
            {renderVisibilitySelect(descriptionVisibility, setDescriptionVisibility, 'description', 'Description')}
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
