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
import { updateUserProfileDetails, fetchUserProfileBasic } from '@/services/connectionService'; 
import { uploadPostImage } from '@/services/storageService'; 
import { updateProfile as updateFirebaseAuthProfile } from 'firebase/auth'; 
import type { UserProfileData, VisibilitySetting } from '@/types/connection';

const MAX_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const getInitials = (name: string | undefined | null): string => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0].substring(0, 1).toUpperCase();
    return (names[0].substring(0, 1) + names[names.length - 1].substring(0, 1)).toUpperCase();
};

const availableIndustries = detailedSectorsData.map(sector => sector.name);
const visibilityOptions: { value: VisibilitySetting; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'connected', label: 'Connected Users Only' },
  { value: 'only_me', label: 'Only Me' },
];

const ProfileSettingsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);

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
          const profileData = await fetchUserProfileBasic(user.uid); // This fetches limited data
          // For settings, we need the full UserProfileData including visibility settings
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const fullProfileData = userDocSnap.data() as UserProfileData;
            setCompanyName(fullProfileData.companyName || fullProfileData.displayName || '');
            setIndustry(fullProfileData.industry || '');
            setDescription(fullProfileData.description || '');
            setCurrentAvatarUrl(fullProfileData.avatarUrl || user.photoURL || null);
            setPreviewUrl(fullProfileData.avatarUrl || user.photoURL || null);

            setCompanyNameVisibility(fullProfileData.companyNameVisibility || 'everyone');
            setIndustryVisibility(fullProfileData.industryVisibility || 'everyone');
            setDescriptionVisibility(fullProfileData.descriptionVisibility || 'everyone');
            setAvatarVisibility(fullProfileData.avatarVisibility || 'everyone');

            console.log("[ProfileSettingsPage] Full profile data loaded:", fullProfileData);
          } else {
             // Fallback if no Firestore doc (should be rare after signup process from initializeUserProfile)
             setCompanyName(user.displayName || ''); 
             setCurrentAvatarUrl(user.photoURL || null);
             setPreviewUrl(user.photoURL || null);
             // Default visibilities will be used
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
   }, [user, authLoading, toast]);


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

        const profileDataToUpdate: Partial<UserProfileData> = {
            // Use companyName as primary display name if set, otherwise keep existing displayName logic in service
            companyName: companyName || undefined, 
            displayName: companyName || user.displayName || undefined, // Ensures displayName is also set
            industry: industry,
            description: description,
            avatarUrl: newAvatarUrl, 
            companyNameVisibility,
            industryVisibility,
            descriptionVisibility,
            avatarVisibility,
        };
        
        await updateUserProfileDetails(user.uid, profileDataToUpdate);

        const authUpdates: { displayName?: string; photoURL?: string | null } = {};
        if (companyName && companyName !== user.displayName) { // Prefer companyName for auth displayName
            authUpdates.displayName = companyName;
        } else if (!companyName && (user.displayName !== (profileDataToUpdate.displayName || ''))) {
            authUpdates.displayName = profileDataToUpdate.displayName || undefined; // Fallback if companyName cleared
        }

        if (newAvatarUrl !== user.photoURL) {
            authUpdates.photoURL = newAvatarUrl;
        }
        if (Object.keys(authUpdates).length > 0 && auth.currentUser) {
            await updateFirebaseAuthProfile(auth.currentUser, authUpdates);
        }

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
  if (!authLoading && isFetchingProfile) { 
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
      <SelectTrigger id={`${fieldId}Visibility`} className="w-[180px] text-xs h-8">
        <SelectValue placeholder="Set visibility" />
      </SelectTrigger>
      <SelectContent>
        {visibilityOptions.map(opt => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );


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
                        <AvatarImage src={previewUrl ?? undefined} alt={companyName || 'Company Logo'} />
                        <AvatarFallback className="bg-muted text-muted-foreground">
                            {previewUrl ? <User className="h-10 w-10" /> : getInitials(companyName || user?.displayName)}
                        </AvatarFallback>
                   </Avatar>
                   <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" style={{ display: 'none' }} disabled={isSubmitting || isCompressing} />
                   <Button type="button" variant="outline" size="sm" onClick={handleAvatarChangeClick} disabled={isSubmitting || isCompressing}>
                        {isCompressing ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Compressing... </> : <> <Upload className="mr-2 h-4 w-4" /> Change </>}
                    </Button>
               </div>
                <p className="text-xs text-muted-foreground">Upload a JPG, PNG, or GIF. Max size {MAX_FILE_SIZE_MB}MB.</p>
                <div className="mt-2">
                    {renderVisibilitySelect(avatarVisibility, setAvatarVisibility, 'avatar')}
                </div>
           </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
                <Label htmlFor="companyName">Company Name</Label>
                {renderVisibilitySelect(companyNameVisibility, setCompanyNameVisibility, 'companyName')}
            </div>
            <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your Company Inc." disabled={isSubmitting} required />
          </div>

          <div className="space-y-2">
             <div className="flex justify-between items-end">
                <Label htmlFor="industry">Industry</Label>
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
            <div className="flex justify-between items-end">
                <Label htmlFor="description">About Your Business</Label>
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

// Need to import doc and getDoc from firestore for profile fetching example
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config'; 
