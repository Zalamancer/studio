
// src/app/settings/notifications/page.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

// Placeholder: Need functions to fetch/update notification preferences

const NotificationSettingsPage = () => {
  // Placeholder state - replace with actual preference fetching/updating logic
  const [prefs, setPrefs] = React.useState({
    newConnectionRequest: true,
    connectionAccepted: true,
    newMessage: true,
    postReply: false, // Example: Maybe disable by default
    platformUpdates: true,
  });
  const [isLoading, setIsLoading] = React.useState(false); // For loading state
  const [isSubmitting, setIsSubmitting] = React.useState(false); // For saving state

  React.useEffect(() => {
    // Placeholder: Fetch notification preferences on load
    setIsLoading(true);
    console.log("Fetching notification preferences...");
    // Simulate fetch
    setTimeout(() => {
        // Replace with actual fetched data
        // setPrefs(fetchedPrefs);
        setIsLoading(false);
    }, 1000);
  }, []);

  const handlePrefChange = (key: keyof typeof prefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveChanges = async () => {
    setIsSubmitting(true);
    console.log("Saving notification preferences:", prefs);
    // Placeholder: Call API to save preferences
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    // Show success toast
  };

  if (isLoading) {
      return (
           <Card>
              <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>Manage how you receive notifications from AnonyCollab.</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
          </Card>
      );
  }

  return (
    <Card className="shadow-md border-border">
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>Manage how you receive notifications from AnonyCollab.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Notifications Section */}
        <div>
          <h3 className="text-lg font-medium mb-4 text-foreground">Email Notifications</h3>
          <div className="space-y-5 rounded-lg border p-4">
             {/* New Connection Request */}
             <div className="flex items-center justify-between">
               <div>
                 <Label htmlFor="newConnectionRequest" className="font-medium">New Connection Request</Label>
                 <p className="text-sm text-muted-foreground">Receive an email when someone wants to connect.</p>
               </div>
               <Switch
                 id="newConnectionRequest"
                 checked={prefs.newConnectionRequest}
                 onCheckedChange={(checked) => handlePrefChange('newConnectionRequest', checked)}
                 disabled={isSubmitting}
                 aria-label="Toggle new connection request notifications"
               />
             </div>

             <hr className="border-border"/>

             {/* Connection Accepted */}
             <div className="flex items-center justify-between">
               <div>
                 <Label htmlFor="connectionAccepted" className="font-medium">Connection Accepted</Label>
                 <p className="text-sm text-muted-foreground">Get notified when your connection request is accepted.</p>
               </div>
               <Switch
                 id="connectionAccepted"
                 checked={prefs.connectionAccepted}
                 onCheckedChange={(checked) => handlePrefChange('connectionAccepted', checked)}
                 disabled={isSubmitting}
                 aria-label="Toggle connection accepted notifications"
               />
             </div>

             <hr className="border-border"/>

              {/* New Message */}
             <div className="flex items-center justify-between">
               <div>
                 <Label htmlFor="newMessage" className="font-medium">New Message</Label>
                 <p className="text-sm text-muted-foreground">Receive an email for new messages in your conversations.</p>
               </div>
               <Switch
                 id="newMessage"
                 checked={prefs.newMessage}
                 onCheckedChange={(checked) => handlePrefChange('newMessage', checked)}
                 disabled={isSubmitting}
                 aria-label="Toggle new message notifications"
               />
             </div>

             <hr className="border-border"/>

             {/* Post Reply/Interaction (Example) */}
             <div className="flex items-center justify-between">
                 <div>
                     <Label htmlFor="postReply" className="font-medium">Post Interactions</Label>
                     <p className="text-sm text-muted-foreground">Get notified about activity on your posts (e.g., offers of help).</p>
                 </div>
                 <Switch
                     id="postReply"
                     checked={prefs.postReply}
                     onCheckedChange={(checked) => handlePrefChange('postReply', checked)}
                     disabled={isSubmitting}
                     aria-label="Toggle post interaction notifications"
                 />
             </div>

              <hr className="border-border"/>

             {/* Platform Updates */}
             <div className="flex items-center justify-between">
               <div>
                 <Label htmlFor="platformUpdates" className="font-medium">Platform Updates & News</Label>
                 <p className="text-sm text-muted-foreground">Receive occasional updates about new features and news.</p>
               </div>
               <Switch
                 id="platformUpdates"
                 checked={prefs.platformUpdates}
                 onCheckedChange={(checked) => handlePrefChange('platformUpdates', checked)}
                 disabled={isSubmitting}
                 aria-label="Toggle platform update notifications"
               />
             </div>
          </div>
        </div>

         {/* In-App Notifications Section (Placeholder) */}
         {/* <div>
            <h3 className="text-lg font-medium mb-2">In-App Notifications</h3>
            <p className="text-sm text-muted-foreground">Configure notifications shown within the app (coming soon).</p>
         </div> */}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveChanges} disabled={isSubmitting || isLoading}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                'Save Preferences'
              )}
            </Button>
          </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettingsPage;
