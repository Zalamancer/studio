
// src/app/settings/profile/page.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext'; // Assuming you have an auth context
import { Loader2 } from 'lucide-react';

// Placeholder: You'll need a form library (like react-hook-form) and state management
// Also, functions to fetch and update user profile data from Firestore

const ProfileSettingsPage = () => {
  const { user, loading } = useAuth(); // Get user data

  // Placeholder state and handlers
  const [companyName, setCompanyName] = React.useState('');
  const [industry, setIndustry] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    // Placeholder: Fetch user profile data when component mounts
    if (user) {
        // Example: Fetch from Firestore based on user.uid
        // Replace with your actual data fetching logic
        const fetchedData = { companyName: "Example Corp", industry: "Tech", description: "Leading innovator..." };
        setCompanyName(fetchedData.companyName);
        setIndustry(fetchedData.industry);
        setDescription(fetchedData.description);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Placeholder: Update profile data in Firestore
    console.log('Submitting profile:', { companyName, industry, description });
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
    // Add success/error handling with toasts
    setIsSubmitting(false);
  };

  if (loading) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>Profile Settings</CardTitle>
                  <CardDescription>Manage your public business profile information.</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {/* Avatar Upload Placeholder */}
               <div className="space-y-2">
                   <Label htmlFor="avatar">Company Logo</Label>
                   <div className="flex items-center gap-4">
                       <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                           {/* Placeholder Avatar */}
                           <User className="h-10 w-10" />
                       </div>
                       <Button type="button" variant="outline" size="sm" disabled={isSubmitting}>Change</Button>
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
            <Button type="submit" disabled={isSubmitting}>
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
