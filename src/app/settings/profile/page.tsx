
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
import { Loader2, User, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast'; // Import useToast
// Placeholder: Import functions for fetching profile, updating profile, and uploading image
// import { getUserProfile, updateUserProfile, uploadProfilePicture } from '@/services/userService';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // State for loading/submitting
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // Basic validation (optional: add more checks for size, type)
      if (file.size > 1 * 1024 * 1024) { // 1MB limit example
        toast({ variant: "destructive", title: "File Too Large", description: "Please select an image smaller than 1MB." });
        return;
      }
      if (!file.type.startsWith('image/')) {
          toast({ variant: "destructive", title: "Invalid File Type", description: "Please select an image file (JPG, PNG, GIF)." });
          return;
      }

      setSelectedFile(file);
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
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
        // 1. If a new file was selected, upload it
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
                        />
                       <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAvatarChangeClick}
                            disabled={isSubmitting}
                        >
                            <Upload className="mr-2 h-4 w-4" /> Change
                        </Button>
                   </div>
                    <p className="text-xs text-muted-foreground">Upload a JPG, PNG, or GIF. Max size 1MB.</p>
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
            <Button type="submit" disabled={isSubmitting || isFetchingProfile}>
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
      </CardContent>
    </Card>
  );
};

export default ProfileSettingsPage;

