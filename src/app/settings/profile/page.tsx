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
import { detailedSectorsData } from '@/components/layout/MainLayout'; // Assuming detailedSectorsData is exported
import { updateUserProfileDetails, fetchUserProfileBasic } from '@/services/connectionService'; // Import update service
import { uploadPostImage } from '@/services/storageService'; // Re-use for profile picture uploads
import { updateProfile as updateFirebaseAuthProfile } from 'firebase/auth'; // To update auth object

const MAX_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const getInitials = (name: string | undefined | null): string => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0].substring(0, 1).toUpperCase();
    return (names[0].substring(0, 1) + names[names.length - 1].substring(0, 1)).toUpperCase();
};

// Extract sector names for the dropdown
const availableIndustries = detailedSectorsData.map(sector => sector.name);

const ProfileSettingsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);

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
                const profileData = await fetchUserProfileBasic(user.uid);
                if (profileData) {
                    // Try to get companyName from Firestore if available, otherwise use auth displayName
                    const firestoreUserDoc = await getDoc(doc(db, "users", user.uid)); // Assuming db is imported or accessible
                    let fetchedCompanyName = '';
                    let fetchedIndustry = '';
                    let fetchedDescription = '';

                    if (firestoreUserDoc.exists()) {
                        const firestoreData = firestoreUserDoc.data();
                        fetchedCompanyName = firestoreData.companyName || firestoreData.displayName || '';
                        fetchedIndustry = firestoreData.industry || '';
                        fetchedDescription = firestoreData.description || '';
                         setCurrentAvatarUrl(firestoreData.avatarUrl || user.photoURL || null);
                         setPreviewUrl(firestoreData.avatarUrl || user.photoURL || null);
                    } else {
                        // Fallback if no Firestore doc (should be rare after signup process)
                        fetchedCompanyName = user.displayName || '';
                        setCurrentAvatarUrl(user.photoURL || null);
                        setPreviewUrl(user.photoURL || null);
                    }
                    
                    setCompanyName(fetchedCompanyName);
                    setIndustry(fetchedIndustry);
                    setDescription(fetchedDescription);

                    console.log("[ProfileSettingsPage] Profile data loaded:", { fetchedCompanyName, fetchedIndustry, fetchedDescription, avatarUrl: currentAvatarUrl });
                } else {
                     // User exists in auth, but no profile document yet (should be handled by initializeUserProfile)
                     setCompanyName(user.displayName || ''); // Fallback to auth display name
                     setCurrentAvatarUrl(user.photoURL || null);
                     setPreviewUrl(user.photoURL || null);
                     console.warn("[ProfileSettingsPage] No basic profile found via fetchUserProfileBasic, using auth fallbacks.");
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
             setIsFetchingProfile(false);
        }
    };
    fetchProfile();
   }, [user, authLoading, toast]); // Removed isFetchingProfile


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
            console.log("[ProfileSettingsPage] Uploading new profile picture...");
            newAvatarUrl = await uploadPostImage(selectedFile, user.uid); // Re-use uploadPostImage or create a dedicated one
            console.log("[ProfileSettingsPage] Profile picture uploaded, URL:", newAvatarUrl);
        }

        const profileDataToUpdate = {
            companyName: companyName, // companyName will be used as displayName in Firestore user doc
            industry: industry,
            description: description,
            avatarUrl: newAvatarUrl, // This can be string | null
        };
        console.log('[ProfileSettingsPage] Updating profile with:', profileDataToUpdate);

        await updateUserProfileDetails(user.uid, profileDataToUpdate);

        // Update Firebase Auth profile as well for consistency
        const authUpdates: { displayName?: string; photoURL?: string | null } = {};
        if (companyName !== user.displayName) {
            authUpdates.displayName = companyName;
        }
        if (newAvatarUrl !== user.photoURL) {
            authUpdates.photoURL = newAvatarUrl;
        }
        if (Object.keys(authUpdates).length > 0) {
            await updateFirebaseAuthProfile(user, authUpdates);
            console.log("[ProfileSettingsPage] Firebase Auth profile updated:", authUpdates);
        }

        setCurrentAvatarUrl(newAvatarUrl); // Update local state for current avatar
        setSelectedFile(null); // Reset selected file
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
  if (isFetchingProfile && !authLoading) { // Show profile fetching spinner only after auth is loaded
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


  return (
    <Card className="shadow-md border-border">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Manage your public business profile information. This is visible to others when connected.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
               <div className="space-y-2">
                   <Label>Company Logo</Label>
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
               </div>
           </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your Company Inc." disabled={isSubmitting} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
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
            <Label htmlFor="description">About Your Business</Label>
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
import { db } from '@/lib/firebase/config'; // Assuming this is your initialized db
