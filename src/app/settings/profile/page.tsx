
// src/app/settings/profile/page.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Import Avatar components
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, User, Upload, ImageDown } from 'lucide-react'; // Added ImageDown
import { useToast } from '@/hooks/use-toast'; // Import useToast
import imageCompression from 'browser-image-compression'; // Import compression library
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger, // We won't use trigger directly, but keep import for consistency
} from "@/components/ui/alert-dialog"; // Import AlertDialog

// Placeholder: Import functions for fetching profile, updating profile, and uploading image
// import { getUserProfile, updateUserProfile, uploadProfilePicture } from '@/services/userService';

const MAX_FILE_SIZE_MB = 1; // Max file size in MB before prompting for compression
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Helper to get initials
const getInitials = (name: string | undefined | null): string => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0].substring(0, 1).toUpperCase();
    return (names[0].substring(0, 1) + names[names.length - 1].substring(0, 1)).toUpperCase();
};

const ProfileSettingsPage = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for form fields
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // Store fetched avatar URL

  // State for file upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Can be original or compressed
  const [originalFile, setOriginalFile] = useState<File | null>(null); // Keep track of the originally selected large file
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // State for loading/submitting/compressing
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false); // New state for compression loading
  const [showCompressionDialog, setShowCompressionDialog] = useState(false); // State to control the dialog

  useEffect(() => {
    // Fetch user profile data when component mounts and user is available
    const fetchProfile = async () => {
        if (user && !isFetchingProfile) {
            setIsFetchingProfile(true);
            console.log("Fetching profile for user:", user.uid);
            try {
                // --- Placeholder: Replace with actual profile fetching ---
                // const profileData = await getUserProfile(user.uid);
                // Mock data:
                await new Promise(res => setTimeout(res, 500)); // Simulate fetch delay
                const profileData = {
                    companyName: user.displayName || "Example Corp",
                    industry: "Tech", // Replace with actual fetched data
                    description: "Leading innovator...", // Replace with actual fetched data
                    avatarUrl: user.photoURL // Use photoURL from Firebase auth as initial avatar
                };
                // --- End Placeholder ---

                console.log("Profile data fetched:", profileData);
                setCompanyName(profileData.companyName || '');
                setIndustry(profileData.industry || '');
                setDescription(profileData.description || '');
                setAvatarUrl(profileData.avatarUrl || null); // Set fetched avatar URL
                setPreviewUrl(profileData.avatarUrl || null); // Set initial preview to fetched URL

            } catch (error) {
                console.error("Error fetching profile:", error);
                toast({
                    variant: "destructive",
                    title: "Error Fetching Profile",
                    description: "Could not load your profile data.",
                });
            } finally {
                setIsFetchingProfile(false);
            }
        }
    };
    fetchProfile();
   }, [user, toast]); // Add toast to dependency array if used inside effect directly


  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        // Validate type first
        if (!file.type.startsWith('image/')) {
            toast({ variant: "destructive", title: "Invalid File Type", description: "Please select an image file (JPG, PNG, GIF)." });
             setSelectedFile(null);
             setOriginalFile(null);
             setPreviewUrl(avatarUrl); // Reset preview to current avatar
             // Reset file input value
             if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Check size
        if (file.size > MAX_FILE_SIZE_BYTES) {
            // File is too large, prompt for compression
            setOriginalFile(file); // Store the original large file
            setShowCompressionDialog(true);
            // Clear selected file and preview until compression is confirmed/done
            setSelectedFile(null);
            setPreviewUrl(avatarUrl); // Reset preview
            // Reset file input value to allow re-selection if needed
             if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
            // File is within size limits, proceed normally
            setSelectedFile(file);
            setOriginalFile(null); // No need for original file storage
            setShowCompressionDialog(false); // Ensure dialog is closed
            // Create a preview URL
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    } else {
        // No file selected, reset states
        setSelectedFile(null);
        setOriginalFile(null);
        setPreviewUrl(avatarUrl); // Reset preview to current avatar
    }
  };


  // Handle image compression
   const handleCompressImage = async () => {
       if (!originalFile) {
            toast({ variant: "destructive", title: "Compression Error", description: "No file selected for compression." });
            return;
        }

       setIsCompressing(true);
       setShowCompressionDialog(false); // Close the dialog
        toast({ title: "Compressing...", description: "Please wait while the image is being compressed.", duration: 3000 });

        try {
            const options = {
                maxSizeMB: MAX_FILE_SIZE_MB, // Target size
                maxWidthOrHeight: 1024, // Resize limit
                useWebWorker: true, // Use web worker for better performance
            };
            console.log(`Compressing image: ${originalFile.name} (${(originalFile.size / 1024 / 1024).toFixed(2)} MB)`);
            const compressedFile = await imageCompression(originalFile, options);
             console.log(`Compressed image: ${compressedFile.name} (${(compressedFile.size / 1024 / 1024).toFixed(2)} MB)`);

            // Update state with the compressed file
            setSelectedFile(compressedFile);
            setOriginalFile(null); // Clear original file reference

            // Create preview URL for the compressed file
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(compressedFile);

            toast({ title: "Compression Successful", description: "The image has been compressed and is ready for upload." });

        } catch (error) {
            console.error("Image compression error:", error);
            toast({
                variant: "destructive",
                title: "Compression Failed",
                description: "Could not compress the image. Please try a smaller file or a different image.",
            });
            // Reset file input and selections
            setSelectedFile(null);
             setOriginalFile(null);
             setPreviewUrl(avatarUrl);
             if (fileInputRef.current) fileInputRef.current.value = '';

        } finally {
            setIsCompressing(false);
        }
    };


  // Trigger hidden file input
  const handleAvatarChangeClick = () => {
    fileInputRef.current?.click();
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return; // Should not happen if UI is correct, but good practice

    setIsSubmitting(true);
    let uploadedAvatarUrl = avatarUrl; // Start with the current or initially fetched URL

    try {
        // 1. If a new file was selected (original or compressed), upload it
        if (selectedFile) {
            console.log("Uploading new profile picture...");
            // --- Placeholder: Replace with actual image upload logic ---
            // uploadedAvatarUrl = await uploadProfilePicture(selectedFile, user.uid);
            // Mock upload:
            await new Promise(res => setTimeout(res, 1500)); // Simulate upload
            uploadedAvatarUrl = previewUrl; // Use preview URL for mock
            console.log("Profile picture uploaded, URL:", uploadedAvatarUrl);
             toast({ title: "Avatar Uploaded", description: "Processing profile update..." }); // Intermediate toast
            // --- End Placeholder ---
        }

        // 2. Update the user profile data in Firestore
        const profileDataToUpdate = {
            companyName,
            industry,
            description,
            avatarUrl: uploadedAvatarUrl, // Use the potentially new URL
        };
        console.log('Updating profile with:', profileDataToUpdate);

        // --- Placeholder: Replace with actual profile update logic ---
        // await updateUserProfile(user.uid, profileDataToUpdate);
        // Mock update:
        await new Promise(res => setTimeout(res, 1000)); // Simulate update
        // --- End Placeholder ---

        // 3. Optionally update Firebase Auth profile (if storing name/photoURL there too)
        // await updateProfile(user, { displayName: companyName, photoURL: uploadedAvatarUrl });

        setAvatarUrl(uploadedAvatarUrl); // Update local state with the final URL
        setSelectedFile(null); // Reset selected file after successful update
        setOriginalFile(null); // Reset original file

        toast({
            title: "Profile Updated",
            description: "Your profile information has been saved.",
        });

    } catch (error: any) {
        console.error('Error updating profile:', error);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: `Could not update your profile: ${error.message}`,
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  // Loading state for initial auth check or profile fetch
  if (loading || isFetchingProfile) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>Profile Settings</CardTitle>
                  <CardDescription>Manage your public business profile information.</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-3 text-muted-foreground">{loading ? 'Loading user...' : 'Fetching profile...'}</p>
              </CardContent>
          </Card>
      );
  }

  if (!user) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>Access Denied</CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-muted-foreground">Please log in to access settings.</p>
              </CardContent>
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
               {/* Avatar Upload Section */}
               <div className="space-y-2">
                   <Label>Company Logo</Label>
                   <div className="flex items-center gap-4">
                       <Avatar className="h-20 w-20 border">
                            <AvatarImage src={previewUrl ?? undefined} alt={companyName || 'Company Logo'} />
                            <AvatarFallback className="bg-muted text-muted-foreground">
                                {previewUrl ? <User className="h-10 w-10" /> : getInitials(companyName)}
                            </AvatarFallback>
                       </Avatar>
                       <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/png, image/jpeg, image/gif" // Specify acceptable image types
                            style={{ display: 'none' }} // Hide the default input
                            disabled={isSubmitting || isCompressing} // Disable while submitting or compressing
                        />
                       <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAvatarChangeClick}
                            disabled={isSubmitting || isCompressing} // Disable while submitting or compressing
                        >
                            {isCompressing ? (
                                <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Compressing... </>
                            ) : (
                                <> <Upload className="mr-2 h-4 w-4" /> Change </>
                            )}
                        </Button>
                   </div>
                    <p className="text-xs text-muted-foreground">Upload a JPG, PNG, or GIF. Max size {MAX_FILE_SIZE_MB}MB.</p>
               </div>
           </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your Company Inc."
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g., Technology, Retail, Finance"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">About Your Business</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell others a bit about your company..."
              rows={4}
              disabled={isSubmitting}
              className="resize-y"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting || isFetchingProfile || isCompressing}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>

        {/* Compression Confirmation Dialog */}
        <AlertDialog open={showCompressionDialog} onOpenChange={setShowCompressionDialog}>
            {/* <AlertDialogTrigger asChild> */}
                {/* Trigger is handled programmatically */}
            {/* </AlertDialogTrigger> */}
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Image Too Large</AlertDialogTitle>
                    <AlertDialogDescription>
                         The selected image exceeds the {MAX_FILE_SIZE_MB}MB size limit ({(originalFile?.size ?? 0 / 1024 / 1024).toFixed(2)}MB).
                         Would you like to compress it to fit? Compression may slightly reduce quality.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => {
                         // Reset file selections if user cancels compression
                         setSelectedFile(null);
                         setOriginalFile(null);
                         setPreviewUrl(avatarUrl);
                         if (fileInputRef.current) fileInputRef.current.value = '';
                         setShowCompressionDialog(false);
                     }}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleCompressImage} className="bg-primary hover:bg-primary/90">
                       <ImageDown className="mr-2 h-4 w-4" /> Compress Image
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </CardContent>
    </Card>
  );
};

export default ProfileSettingsPage;
