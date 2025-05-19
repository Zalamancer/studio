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
import { generateAnonymousName } from '@/lib/pseudonymUtils'; // Import generateAnonymousName

const MAX_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const getInitials = (name: string | undefined | null): string => {
    if (!name) return '?';
    // Use a simple first-letter initial for generated names or fallback for other names
    const generatedNamePattern = /^[A-Z][a-z]+[A-Z][a-z]+[0-9]{3}$/;
    if (generatedNamePattern.test(name)) {
        return name.charAt(0).toUpperCase();
    }
    const names = name.split(' ');
    if (names.length === 1) return names[0].substring(0, 1).toUpperCase();
    return (names[0].substring(0, 1) + names[names.length - 1].substring(0, 1)).toUpperCase();
};

const visibilityOptions: { value: VisibilitySetting; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'connected', label: 'Connected Users Only' },
  { value: 'only_me', label: 'Only Me' },
];

const ProfileSettingsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [actualDisplayName, setActualDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);

  const [actualDisplayNameVisibility, setActualDisplayNameVisibility] = useState<VisibilitySetting>('everyone'); // Placeholder, not yet used
  const [companyNameVisibility, setCompanyNameVisibility] = useState<VisibilitySetting>('everyone');
  const [industryVisibility, setIndustryVisibility] = useState<VisibilitySetting>('everyone');
  const [descriptionVisibility, setDescriptionVisibility] = useState<VisibilitySetting>('everyone');
  const [avatarVisibility, setAvatarVisibility] = useState<VisibilitySetting>('everyone');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);

  const availableIndustries = detailedSectorsData.map(sector => sector.name);

  useEffect(() => {
    const fetchProfile = async () => {
      if (authLoading) {
        console.log("[ProfileSettingsPage] Auth is loading, waiting...");
        return;
      }
      if (user && !isFetchingProfile) {
        setIsFetchingProfile(true);
        console.log("[ProfileSettingsPage] Fetching profile for user:", user.uid);
        try {
          // Fetch the full profile data including visibility settings
          const fullProfileData = await fetchFullUserProfile(user.uid);

          if (fullProfileData) {
            setActualDisplayName(fullProfileData.actualDisplayName || '');
            setCompanyName(fullProfileData.companyName || '');
            setIndustry(fullProfileData.industry || '');
            setDescription(fullProfileData.description || '');
            setCurrentAvatarUrl(fullProfileData.avatarUrl || null); // Use avatarUrl from Firestore
            setPreviewUrl(fullProfileData.avatarUrl || null);

            setCompanyNameVisibility(fullProfileData.companyNameVisibility || 'everyone');
            setIndustryVisibility(fullProfileData.industryVisibility || 'everyone');
            setDescriptionVisibility(fullProfileData.descriptionVisibility || 'everyone');
            setAvatarVisibility(fullProfileData.avatarVisibility || 'everyone');
            // Note: actualDisplayNameVisibility not set here, but you can add if needed

            console.log("[ProfileSettingsPage] Full profile data loaded:", fullProfileData);
          } else {
             // Fallback if no Firestore doc (should be rare after signup process from initializeUserProfile)
             setCompanyName(user.displayName || ''); // Use auth.displayName as a last resort
             setCurrentAvatarUrl(user.photoURL || null);
             setPreviewUrl(user.photoURL || null);
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
        }
      } else if (!user && !authLoading) {
         console.log("[ProfileSettingsPage] No user and auth not loading. Clearing fields.");
         setActualDisplayName('');
         setCompanyName('');
         setIndustry('');
         setDescription('');
         setCurrentAvatarUrl(null);
         setPreviewUrl(null);
         setCompanyNameVisibility('everyone');
         setIndustryVisibility('everyone');
         setDescriptionVisibility('everyone');
         setAvatarVisibility('everyone');
         setIsFetchingProfile(false);
      }
    };
    fetchProfile();
   }, [user, authLoading, toast]); // isFetchingProfile removed to prevent loops


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            toast({ variant: "destructive", title: "Invalid File Type", description: "Please select an image file (JPG, PNG, GIF)." });
             setSelectedFile(null); setOriginalFile(null); setPreviewUrl(currentAvatarUrl);
             if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            setOriginalFile(file); setShowCompressionDialog(true);
            setSelectedFile(null); setPreviewUrl(currentAvatarUrl);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
            setSelectedFile(file); setOriginalFile(null); setShowCompressionDialog(false);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    } else {
        setSelectedFile(null); setOriginalFile(null); setPreviewUrl(currentAvatarUrl);
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
            setSelectedFile(null); setOriginalFile(null); setPreviewUrl(currentAvatarUrl);
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
    let newAvatarUrl = currentAvatarUrl;

    try {
        if (selectedFile) {
            newAvatarUrl = await uploadPostImage(selectedFile, user.uid);
        }

        // Prepare data for Firestore update
        const profileDataToUpdate: Partial<UserProfileData> = {
            actualDisplayName: actualDisplayName || null, // Send null if empty to clear
            companyName: companyName || null, // Send null if empty to clear
            industry: industry || null,
            description: description || null,
            avatarUrl: newAvatarUrl, // This could be the old one, a new one, or null if cleared
            companyNameVisibility,
            industryVisibility,
            descriptionVisibility,
            avatarVisibility,
            // generatedAnonymousName is managed by initializeUserProfile, not directly set here
        };

        await updateUserProfileDetails(user.uid, profileDataToUpdate);

        setCurrentAvatarUrl(newAvatarUrl);
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
  if (isFetchingProfile && !authLoading) { // Only show this if auth is done but profile is fetching
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
    fieldId: string
  ) => (
    <Select value={value} onValueChange={(v) => onChange(v as VisibilitySetting)} disabled={isSubmitting}>
      <SelectTrigger id={`${fieldId}Visibility`} className="w-full sm:w-[180px] text-xs h-8 mt-1 sm:mt-0">
        <SelectValue placeholder="Set visibility" />
      </SelectTrigger>
      <SelectContent>
        {visibilityOptions.map(opt => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const displayInitialName = actualDisplayName || companyName || (user ? generateAnonymousName(user.uid) : 'User');


  return (
    <Card className="shadow-md border-border">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Manage your public business profile information and visibility.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
           <div className="space-y-2">
               <Label>Company Logo / Avatar</Label>
               <div className="flex items-center gap-4">
                   <Avatar className="h-20 w-20 border">
                        <AvatarImage src={previewUrl ?? undefined} alt={displayInitialName} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-xl">
                            {previewUrl ? <User className="h-10 w-10" /> : getInitials(displayInitialName)}
                        </AvatarFallback>
                   </Avatar>
                   <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" style={{ display: 'none' }} disabled={isSubmitting || isCompressing} />
                   <Button type="button" variant="outline" size="sm" onClick={handleAvatarChangeClick} disabled={isSubmitting || isCompressing}>
                        {isCompressing ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Compressing... </> : <> <Upload className="mr-2 h-4 w-4" /> Change </>}
                    </Button>
               </div>
                <p className="text-xs text-muted-foreground">Upload a JPG, PNG, or GIF. Max size {MAX_FILE_SIZE_MB}MB.</p>
                <div className="mt-2 flex sm:items-center flex-col sm:flex-row gap-2 sm:gap-4">
                    <span className="text-xs text-muted-foreground self-start sm:self-center">Visibility:</span>
                    {renderVisibilitySelect(avatarVisibility, setAvatarVisibility, 'avatar')}
                </div>
           </div>

            <div className="space-y-2">
                <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-2">
                    <Label htmlFor="actualDisplayName" className="flex-grow">Your Display Name (Optional)</Label>
                    {/* Placeholder for actualDisplayNameVisibility if needed later */}
                </div>
                <Input id="actualDisplayName" value={actualDisplayName} onChange={(e) => setActualDisplayName(e.target.value)} placeholder="e.g., John Doe or Marketing Team" disabled={isSubmitting} />
                <p className="text-xs text-muted-foreground">This can be your name or team name. If blank, Company Name or your anonymous name will be used.</p>
            </div>

          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-2">
                <Label htmlFor="companyName" className="flex-grow">Company Name</Label>
                {renderVisibilitySelect(companyNameVisibility, setCompanyNameVisibility, 'companyName')}
            </div>
            <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your Company Inc." disabled={isSubmitting} />
          </div>

          <div className="space-y-2">
             <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-2">
                <Label htmlFor="industry" className="flex-grow">Industry</Label>
                {renderVisibilitySelect(industryVisibility, setIndustryVisibility, 'industry')}
             </div>
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
          </div>

          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-2">
                <Label htmlFor="description" className="flex-grow">About Your Business</Label>
                {renderVisibilitySelect(descriptionVisibility, setDescriptionVisibility, 'description')}
            </div>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell others a bit about your company..." rows={4} disabled={isSubmitting} className="resize-y" />
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
                         The selected image exceeds {MAX_FILE_SIZE_MB}MB ({(originalFile?.size ? originalFile.size / 1024 / 1024 : 0).toFixed(2)}MB).
                         Would you like to compress it to fit? Compression may slightly reduce quality.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => { setSelectedFile(null); setOriginalFile(null); setPreviewUrl(currentAvatarUrl); if (fileInputRef.current) fileInputRef.current.value = ''; setShowCompressionDialog(false); }}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCompressImage} className="bg-primary hover:bg-primary/90"><ImageDown className="mr-2 h-4 w-4" /> Compress Image</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </CardContent>
    </Card>
  );
};

export default ProfileSettingsPage;
