
// src/app/settings/profile/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Upload, ImageDown, Building, Briefcase, Info, User, DollarSign, CheckCircle, Edit3, AtSign } from 'lucide-react';
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
import { detailedSectorsData, type SectorWithSubSectors, type SubSector, type Industry as SectorIndustryType } from '@/components/layout/MainLayout'; // Import detailedSectorsData
import { updateUserProfileDetails, fetchFullUserProfile } from '@/services/connectionService';
import type { VisibilitySetting, UserProfileData, UserProfileUpdateData } from '@/types/connection';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import { uploadPostImage } from '@/services/storageService';

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
  const [description, setDescription] = useState('');
  const [established, setEstablished] = useState('');
  const [establishedError, setEstablishedError] = useState<string | null>(null);
  const [incomeRange, setIncomeRange] = useState<string>('Prefer not to say');

  // State for visibility settings
  const [descriptionVisibility, setDescriptionVisibility] = useState<VisibilitySetting>('everyone');
  const [avatarVisibility, setAvatarVisibility] = useState<VisibilitySetting>('everyone');

  // State for displaying non-editable fields from Firestore
  const [fetchedMentionName, setFetchedMentionName] = useState('');
  const [fetchedCompanyName, setFetchedCompanyName] = useState('');

  // State for NAICS selection
  const [selectedSectorCode, setSelectedSectorCode] = useState<string | undefined>(undefined);
  const [selectedSubSectorCode, setSelectedSubSectorCode] = useState<string | undefined>(undefined);
  const [selectedIndustryCode, setSelectedIndustryCode] = useState<string | undefined>(undefined);

  const [availableSubSectors, setAvailableSubSectors] = useState<SubSector[]>([]);
  const [availableIndustries, setAvailableIndustries] = useState<SectorIndustryType[]>([]);


  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentDbAvatarUrl, setCurrentDbAvatarUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalTooLargeFile, setOriginalTooLargeFile] = useState<File | null>(null);

  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);

  const currentYear = new Date().getFullYear();
  
  const displayedNameForAvatar = fetchedCompanyName || fetchedMentionName || user?.email || 'U';


  useEffect(() => {
    if (authLoading) {
      return;
    }

    const fetchProfile = async () => {
      if (!user) { 
        setIsFetchingProfile(false);
        return;
      }
      setIsFetchingProfile(true);
      try {
        const fullProfileData = await fetchFullUserProfile(user.uid);

        if (fullProfileData) {
          setDescription(fullProfileData.description || '');
          setDescriptionVisibility(fullProfileData.descriptionVisibility || 'everyone');
          setEstablished(fullProfileData.established || '');
          setIncomeRange(fullProfileData.incomeRange || 'Prefer not to say');
          
          setFetchedCompanyName(fullProfileData.companyName || '');
          setFetchedMentionName(fullProfileData.mentionName || generateAnonymousName(user.uid));
          
          // Set NAICS selections
          if (fullProfileData.sectorName) {
            const sector = detailedSectorsData.find(s => s.name === fullProfileData.sectorName);
            if (sector) setSelectedSectorCode(sector.code);
          }
          if (fullProfileData.subSectorName && selectedSectorCode) {
            const sector = detailedSectorsData.find(s => s.code === selectedSectorCode);
            const subSector = sector?.subSectors.find(ss => ss.name === fullProfileData.subSectorName);
            if (subSector) setSelectedSubSectorCode(subSector.code);
          }
          if (fullProfileData.industryName && selectedSubSectorCode) {
            const sector = detailedSectorsData.find(s => s.code === selectedSectorCode);
            const subSector = sector?.subSectors.find(ss => ss.code === selectedSubSectorCode);
            const industry = subSector?.industries.find(ind => ind.name === fullProfileData.industryName);
            if (industry) setSelectedIndustryCode(industry.code);
          }


          const avatarToDisplay = fullProfileData.avatarUrl || null;
          setPreviewUrl(avatarToDisplay);
          setCurrentDbAvatarUrl(avatarToDisplay);
        } else {
          setFetchedMentionName(generateAnonymousName(user.uid));
          setDescription(''); setDescriptionVisibility('everyone');
          setEstablished(''); setIncomeRange('Prefer not to say');
          setSelectedSectorCode(undefined); setSelectedSubSectorCode(undefined); setSelectedIndustryCode(undefined);
          setPreviewUrl(null); setCurrentDbAvatarUrl(null);
          setFetchedCompanyName('');
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Error Fetching Profile", description: "Could not load your profile data." });
        setFetchedMentionName(generateAnonymousName(user?.uid || ""));
      } finally {
        setIsFetchingProfile(false);
      }
    };
    
    if (user && !isFetchingProfile) {
        fetchProfile();
    } else if (!user) {
        setDescription(''); setDescriptionVisibility('everyone');
        setEstablished(''); setIncomeRange('Prefer not to say');
        setSelectedSectorCode(undefined); setSelectedSubSectorCode(undefined); setSelectedIndustryCode(undefined);
        setPreviewUrl(null); setCurrentDbAvatarUrl(null);
        setFetchedCompanyName(''); setFetchedMentionName('');
        setIsFetchingProfile(false);
    }
  // Only re-fetch if user changes or if authLoading transitions from true to false
  }, [user, authLoading, toast]); 


  // Effect for cascading Sector -> SubSectors
  useEffect(() => {
    if (selectedSectorCode) {
      const sector = detailedSectorsData.find(s => s.code === selectedSectorCode);
      setAvailableSubSectors(sector?.subSectors || []);
      setSelectedSubSectorCode(undefined); // Reset sub-sector
      setAvailableIndustries([]);          // Reset industries
      setSelectedIndustryCode(undefined);  // Reset industry
    } else {
      setAvailableSubSectors([]);
      setAvailableIndustries([]);
    }
  }, [selectedSectorCode]);

  // Effect for cascading SubSector -> Industries
  useEffect(() => {
    if (selectedSubSectorCode) {
      const subSector = availableSubSectors.find(ss => ss.code === selectedSubSectorCode);
      setAvailableIndustries(subSector?.industries || []);
      setSelectedIndustryCode(undefined); // Reset industry
    } else {
      setAvailableIndustries([]);
    }
  }, [selectedSubSectorCode, availableSubSectors]);


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
            newAvatarUrlForFirestore = await uploadPostImage(selectedFile, user.uid);
        } else if (previewUrl === null && currentDbAvatarUrl !== null) {
            newAvatarUrlForFirestore = null;
        }

        const sectorObj = detailedSectorsData.find(s => s.code === selectedSectorCode);
        const subSectorObj = sectorObj?.subSectors.find(ss => ss.code === selectedSubSectorCode);
        const industryObj = subSectorObj?.industries.find(i => i.code === selectedIndustryCode);

        const profileDataToUpdate: UserProfileUpdateData = {
            description: description || null,
            descriptionVisibility: descriptionVisibility,
            established: established || null,
            incomeRange: incomeRange === "Prefer not to say" ? null : incomeRange,
            sectorName: sectorObj?.name || null,
            subSectorName: subSectorObj?.name || null,
            industryName: industryObj?.name || null,
            naicsCode: selectedIndustryCode || selectedSubSectorCode || selectedSectorCode || null,
            avatarVisibility: avatarVisibility, // Still needed for the avatar's visibility setting
        };

        if (newAvatarUrlForFirestore !== undefined) {
            profileDataToUpdate.avatarUrl = newAvatarUrlForFirestore;
        }

        await updateUserProfileDetails(user.uid, profileDataToUpdate);

        if (newAvatarUrlForFirestore !== undefined) {
            setCurrentDbAvatarUrl(newAvatarUrlForFirestore);
            setPreviewUrl(newAvatarUrlForFirestore);
        }
        setSelectedFile(null);
        setOriginalTooLargeFile(null);

        toast({ title: "Profile Updated", description: "Your profile information has been saved." });

    } catch (error: any) {
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

          <div className="space-y-4 p-4 border rounded-md bg-muted/20">
            <Label className="text-base font-medium text-foreground">Your Identifiers (Read-Only)</Label>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="mentionNameDisplay" className="text-sm font-medium flex items-center text-foreground/90">
                  <AtSign className="mr-2 h-4 w-4 text-primary" /> Mention Name (@)
                </Label>
                <Input id="mentionNameDisplay" value={fetchedMentionName ? `@${fetchedMentionName}` : "Loading..."} disabled className="bg-background/50 cursor-not-allowed text-sm"/>
                <p className="text-xs text-muted-foreground">Your unique anonymous identifier. Auto-generated.</p>
              </div>

              {fetchedCompanyName && (
                <div className="space-y-1">
                  <Label htmlFor="companyNameDisplay" className="text-sm font-medium flex items-center text-foreground/90">
                    <Building className="mr-2 h-4 w-4 text-primary" /> Company Name
                  </Label>
                  <Input id="companyNameDisplay" value={fetchedCompanyName} disabled className="bg-background/50 cursor-not-allowed text-sm"/>
                   <p className="text-xs text-muted-foreground">Set during sign-up (for email/password accounts). Not directly editable here.</p>
                </div>
              )}
            </div>
          </div>


          <div className="space-y-3 p-4 border rounded-md bg-muted/20">
            <Label className="text-base font-medium">Company Logo / Avatar</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border">
                <AvatarImage src={previewUrl ?? undefined} alt={displayedNameForAvatar} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xl">
                  {getInitials(displayedNameForAvatar)}
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
            <p className="text-xs text-muted-foreground">Upload a JPG, PNG, GIF, or WebP. Max size {MAX_FILE_SIZE_MB}MB. Avatar is always visible if set.</p>
          </div>

          {/* Cascading NAICS Selectors */}
          <div className="space-y-4 p-4 border rounded-md bg-muted/20">
            <Label className="text-base font-medium flex items-center">
              <Briefcase className="mr-2 h-4 w-4 text-primary" /> Business Classification
            </Label>
            
            <div className="space-y-2">
              <Label htmlFor="sector" className="text-sm font-medium">Sector</Label>
              <Select value={selectedSectorCode} onValueChange={setSelectedSectorCode} disabled={isSubmitting}>
                <SelectTrigger id="sector"><SelectValue placeholder="Select main sector" /></SelectTrigger>
                <SelectContent>
                  {detailedSectorsData.map(sector => (
                    <SelectItem key={sector.code} value={sector.code}>{sector.name} ({sector.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subSector" className="text-sm font-medium">Sub-Sector (Optional)</Label>
              <Select value={selectedSubSectorCode} onValueChange={setSelectedSubSectorCode} disabled={isSubmitting || availableSubSectors.length === 0}>
                <SelectTrigger id="subSector">
                  <SelectValue placeholder={availableSubSectors.length > 0 ? "Select sub-sector" : "Select sector first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableSubSectors.map(sub => (
                    <SelectItem key={sub.code} value={sub.code}>{sub.name} ({sub.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry" className="text-sm font-medium">Industry (Optional)</Label>
              <Select value={selectedIndustryCode} onValueChange={setSelectedIndustryCode} disabled={isSubmitting || availableIndustries.length === 0}>
                <SelectTrigger id="industry">
                  <SelectValue placeholder={availableIndustries.length > 0 ? "Select industry" : "Select sub-sector first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableIndustries.map(ind => (
                    <SelectItem key={ind.code} value={ind.code}>{ind.name} ({ind.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground pt-1">Your business classification is always visible if set.</p>
          </div>


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
            <p className="text-xs text-muted-foreground pt-1">Enter the 4-digit year. Must be between 1613 and ${currentYear}. Always visible if set.</p>
          </div>


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
                The selected image exceeds ${MAX_FILE_SIZE_MB}MB (${(originalTooLargeFile?.size ? originalTooLargeFile.size / (1024 * 1024) : 0).toFixed(2)}MB).
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
