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
import { Loader2, Upload, ImageDown, AtSign, Building, Briefcase, Info } from 'lucide-react';
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
import type { UserProfileData, VisibilitySetting } from '@/types/connection';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import { uploadPostImage } from '@/services/storageService';

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

  // State for editable fields
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionVisibility, setDescriptionVisibility] = useState<VisibilitySetting>('everyone');
  const [established, setEstablished] = useState(''); // For 'Year Established'
  const [incomeRange, setIncomeRange] = useState<string>("Prefer not to say");

  // State for read-only fetched data
  const [fetchedCompanyName, setFetchedCompanyName] = useState('');
  const [fetchedActualDisplayName, setFetchedActualDisplayName] = useState('');
  const [fetchedMentionName, setFetchedMentionName] = useState('');
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentDbAvatarUrl, setCurrentDbAvatarUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);

  const availableIndustries = detailedSectorsData.map(sector => sector.name);

  useEffect(() => {
    if (authLoading) {
      console.log("[ProfileSettingsPage] useEffect: Auth is loading, waiting...");
      return;
    }
    if (!user) {
      console.log("[ProfileSettingsPage] useEffect: No user, clearing form and stopping fetch.");
      setIndustry('');
      setDescription('');
      setDescriptionVisibility('everyone');
      setEstablished('');
      setIncomeRange("Prefer not to say");
      setPreviewUrl(null);
      setCurrentDbAvatarUrl(null);
      setFetchedCompanyName('');
      setFetchedActualDisplayName('');
      setFetchedMentionName('');
      setIsFetchingProfile(false);
      return;
    }

    const fetchProfile = async () => {
      if (isFetchingProfile) return; // Prevent re-fetch if already fetching
      setIsFetchingProfile(true);
      console.log("[ProfileSettingsPage] useEffect: Fetching profile for user:", user.uid);
      try {
        const fullProfileData = await fetchFullUserProfile(user.uid);
        console.log("[ProfileSettingsPage] useEffect: Raw fullProfileData from service:", fullProfileData);

        if (fullProfileData) {
          setIndustry(fullProfileData.industry || '');
          setDescription(fullProfileData.description || '');
          setDescriptionVisibility(fullProfileData.descriptionVisibility || 'everyone');
          setEstablished(fullProfileData.established || '');
          setIncomeRange(fullProfileData.incomeRange || "Prefer not to say");
          
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
          // Reset other fields to defaults if no profile found
          setIndustry('');
          setDescription('');
          setDescriptionVisibility('everyone');
          setEstablished('');
          setIncomeRange("Prefer not to say");
          setPreviewUrl(null);
          setCurrentDbAvatarUrl(null);
          setFetchedCompanyName('');
          setFetchedActualDisplayName('');
        }
      } catch (error) {
        console.error("[ProfileSettingsPage] useEffect: Error fetching profile:", error);
        toast({ variant: "destructive", title: "Error Fetching Profile", description: "Could not load your profile data." });
        setFetchedMentionName(generateAnonymousName(user.uid)); // Ensure mention name is set even on error
      } finally {
        setIsFetchingProfile(false);
        console.log("[ProfileSettingsPage] useEffect: Finished fetching profile attempt, isFetchingProfile set to false.");
      }
    };

    if (user && !isFetchingProfile) { // Only fetch if user is present and not already fetching
      fetchProfile();
    }

  }, [user, authLoading, toast]); // Removed isFetchingProfile from deps

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
            newAvatarUrlForFirestore = null;
        }
        
        const profileDataToUpdate: UserProfileUpdateData = {
            industry: industry || null,
            description: description || null,
            descriptionVisibility: descriptionVisibility,
            established: established || null,
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
   
  if (isFetchingProfile && !authLoading && user) { // Show profile fetching only after auth is done and user exists
      return (
          <Card>
              <CardHeader><CardTitle>Profile Settings</CardTitle><CardDescription>Manage your public business profile.</CardDescription></CardHeader>
              <CardContent className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Fetching profile data...</p>
              </CardContent>
          </Card>
      );
  }

  if (!user && !authLoading) { // Check after authLoading is false
      return (
          <Card>
              <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground">Please log in to access settings.</p></CardContent>
          </Card>
      );
  }
  
  const nameForAvatar = fetchedCompanyName || fetchedActualDisplayName || fetchedMentionName || user?.email || 'U';

  return (
    <Card className="shadow-md border-border">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Manage your public business profile information and visibility.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
           {/* Avatar Section */}
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

            {/* Read-only Name Fields */}
            <div className="space-y-4 p-4 border rounded-md bg-muted/20">
                <Label className="text-base font-medium text-foreground">Your Identifiers</Label>
                <div className="space-y-2">
                    <Label htmlFor="mentionNameDisplay" className="text-sm font-medium flex items-center">
                      <AtSign className="mr-2 h-4 w-4 text-primary" /> Mention Name (@)
                    </Label>
                    <Input id="mentionNameDisplay" value={fetchedMentionName ? `@${fetchedMentionName}` : "Generating..."} disabled className="bg-background/50 cursor-not-allowed text-sm"/>
                    <p className="text-xs text-muted-foreground">Your unique anonymous identifier for mentions. Auto-generated.</p>
                </div>

                {fetchedCompanyName && (
                    <div className="space-y-1">
                        <Label htmlFor="companyNameDisplay" className="text-sm font-medium flex items-center">
                            <Building className="mr-2 h-4 w-4 text-primary" /> Company Name
                        </Label>
                        <Input id="companyNameDisplay" value={fetchedCompanyName} disabled className="bg-background/50 cursor-not-allowed text-sm"/>
                        <p className="text-xs text-muted-foreground">Your registered company name (from sign-up or Google). Visible to everyone.</p>
                    </div>
                )}
                
                {fetchedActualDisplayName && fetchedActualDisplayName !== fetchedCompanyName && (
                     <div className="space-y-1">
                        <Label htmlFor="actualDisplayNameDisplay" className="text-sm font-medium flex items-center">
                            <User className="mr-2 h-4 w-4 text-primary" /> Display Name
                        </Label>
                        <Input id="actualDisplayNameDisplay" value={fetchedActualDisplayName} disabled className="bg-background/50 cursor-not-allowed text-sm"/>
                        <p className="text-xs text-muted-foreground">Your display name (e.g., from Google). Visible to everyone.</p>
                    </div>
                )}
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
                    {availableIndustries.map((ind) => (
                        <SelectItem key={ind} value={ind} className="text-sm">{ind}</SelectItem>
                    ))}
                    <SelectItem value="Other" className="text-sm">Other</SelectItem>
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground pt-1">Your industry is always visible if set.</p>
          </div>

           {/* Year Established Section */}
           <div className="space-y-1 p-4 border rounded-md bg-muted/20">
            <Label htmlFor="established" className="text-base font-medium">Year Established (Optional)</Label>
            <Input 
              id="established" 
              type="text" // Use text to allow 4-digit year easily
              placeholder="e.g., 2010"
              value={established} 
              onChange={(e) => setEstablished(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} // Allow only numbers, max 4 chars
              maxLength={4}
              pattern="\d{4}"
              disabled={isSubmitting} 
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground pt-1">Enter the year your business was established. Visible to everyone.</p>
          </div>

          {/* Income Range Section */}
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
            <p className="text-xs text-muted-foreground pt-1">This information is optional and currently not displayed on your public profile.</p>
          </div>

          {/* Description Section */}
          <div className="space-y-1 p-4 border rounded-md bg-muted/20">
            <Label htmlFor="description" className="text-base font-medium">About Your Business</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell others a bit about your company..." rows={4} disabled={isSubmitting} className="resize-y text-sm" />
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-2 mt-1">
                <Label htmlFor="descriptionVisibility" className="text-xs text-muted-foreground whitespace-nowrap">About section visibility:</Label>
                <Select value={descriptionVisibility} onValueChange={(v) => setDescriptionVisibility(v as VisibilitySetting)} disabled={isSubmitting}>
                <SelectTrigger id="descriptionVisibility" className="w-full sm:w-[180px] text-xs h-8">
                    <SelectValue placeholder="Set visibility" />
                </SelectTrigger>
                <SelectContent>
                    {visibilityOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
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
