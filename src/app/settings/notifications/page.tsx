// src/app/settings/notifications/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getUserPreferences, updateUserPreferences } from '@/services/userPreferenceService';
import type { UserPreference, UpdateUserPreferencesData } from '@/types/userPreferences';

const NotificationSettingsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Extended state for notification preferences
  const [prefs, setPrefs] = useState<UpdateUserPreferencesData>({
    notifyOnNewConnectionRequest: true,
    notifyOnConnectionAccepted: true,
    notifyOnNewMessage: true,
    notifyOnReply: true, // Default to true
    notifyOnMention: true, // Default to true
    notifyOnPlatformUpdates: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      setIsLoading(true);
      getUserPreferences(user.uid)
        .then((fetchedPrefs) => {
          if (fetchedPrefs) {
            setPrefs({
              notifyOnNewConnectionRequest: fetchedPrefs.notifyOnNewConnectionRequest ?? true,
              notifyOnConnectionAccepted: fetchedPrefs.notifyOnConnectionAccepted ?? true,
              notifyOnNewMessage: fetchedPrefs.notifyOnNewMessage ?? true,
              notifyOnReply: fetchedPrefs.notifyOnReply ?? true,
              notifyOnMention: fetchedPrefs.notifyOnMention ?? true,
              notifyOnPlatformUpdates: fetchedPrefs.notifyOnPlatformUpdates ?? true,
            });
          } else {
            // Set default preferences if none are fetched (e.g., for a new user)
            setPrefs({
              notifyOnNewConnectionRequest: true,
              notifyOnConnectionAccepted: true,
              notifyOnNewMessage: true,
              notifyOnReply: true,
              notifyOnMention: true,
              notifyOnPlatformUpdates: true,
            });
          }
        })
        .catch(error => {
          console.error("Error fetching notification preferences:", error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Could not load your notification settings.",
          });
          // Keep default prefs on error
        })
        .finally(() => setIsLoading(false));
    } else if (!authLoading && !user) {
      setIsLoading(false); // Not logged in, stop loading
    }
  }, [user, authLoading, toast]);

  const handlePrefChange = (key: keyof UpdateUserPreferencesData, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveChanges = async () => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in." });
      return;
    }
    setIsSubmitting(true);
    try {
      await updateUserPreferences(user.uid, prefs);
      toast({ title: "Preferences Saved", description: "Your notification settings have been updated." });
    } catch (error: any) {
      console.error("Error saving notification preferences:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message || "Could not save your notification settings.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
      return (
           <Card>
              <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>Manage how you receive notifications from AnonyCollab.</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Loading settings...</p>
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
          <p className="text-muted-foreground">Please log in to manage notification settings.</p>
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
        <div>
          <h3 className="text-lg font-medium mb-4 text-foreground">Email Notifications</h3>
          <div className="space-y-5 rounded-lg border p-4">
             <div className="flex items-center justify-between">
               <div>
                 <Label htmlFor="notifyOnNewConnectionRequest" className="font-medium">New Connection Request</Label>
                 <p className="text-sm text-muted-foreground">Receive an email when someone wants to connect.</p>
               </div>
               <Switch
                 id="notifyOnNewConnectionRequest"
                 checked={prefs.notifyOnNewConnectionRequest}
                 onCheckedChange={(checked) => handlePrefChange('notifyOnNewConnectionRequest', checked)}
                 disabled={isSubmitting}
                 aria-label="Toggle new connection request notifications"
               />
             </div>
             <hr className="border-border"/>
             <div className="flex items-center justify-between">
               <div>
                 <Label htmlFor="notifyOnConnectionAccepted" className="font-medium">Connection Accepted</Label>
                 <p className="text-sm text-muted-foreground">Get notified when your connection request is accepted.</p>
               </div>
               <Switch
                 id="notifyOnConnectionAccepted"
                 checked={prefs.notifyOnConnectionAccepted}
                 onCheckedChange={(checked) => handlePrefChange('notifyOnConnectionAccepted', checked)}
                 disabled={isSubmitting}
                 aria-label="Toggle connection accepted notifications"
               />
             </div>
             <hr className="border-border"/>
             <div className="flex items-center justify-between">
               <div>
                 <Label htmlFor="notifyOnNewMessage" className="font-medium">New Message</Label>
                 <p className="text-sm text-muted-foreground">Receive an email for new messages in your conversations.</p>
               </div>
               <Switch
                 id="notifyOnNewMessage"
                 checked={prefs.notifyOnNewMessage}
                 onCheckedChange={(checked) => handlePrefChange('notifyOnNewMessage', checked)}
                 disabled={isSubmitting}
                 aria-label="Toggle new message notifications"
               />
             </div>
             <hr className="border-border"/>
             <div className="flex items-center justify-between">
                 <div>
                     <Label htmlFor="notifyOnReply" className="font-medium">Replies to Your Comments</Label>
                     <p className="text-sm text-muted-foreground">Get notified when someone replies to your comments or posts.</p>
                 </div>
                 <Switch
                     id="notifyOnReply"
                     checked={prefs.notifyOnReply}
                     onCheckedChange={(checked) => handlePrefChange('notifyOnReply', checked)}
                     disabled={isSubmitting}
                     aria-label="Toggle reply notifications"
                 />
             </div>
             <hr className="border-border"/>
             <div className="flex items-center justify-between">
                 <div>
                     <Label htmlFor="notifyOnMention" className="font-medium">Mentions</Label>
                     <p className="text-sm text-muted-foreground">Get notified when someone @mentions you.</p>
                 </div>
                 <Switch
                     id="notifyOnMention"
                     checked={prefs.notifyOnMention}
                     onCheckedChange={(checked) => handlePrefChange('notifyOnMention', checked)}
                     disabled={isSubmitting}
                     aria-label="Toggle mention notifications"
                 />
             </div>
              <hr className="border-border"/>
             <div className="flex items-center justify-between">
               <div>
                 <Label htmlFor="notifyOnPlatformUpdates" className="font-medium">Platform Updates & News</Label>
                 <p className="text-sm text-muted-foreground">Receive occasional updates about new features and news.</p>
               </div>
               <Switch
                 id="notifyOnPlatformUpdates"
                 checked={prefs.notifyOnPlatformUpdates}
                 onCheckedChange={(checked) => handlePrefChange('notifyOnPlatformUpdates', checked)}
                 disabled={isSubmitting}
                 aria-label="Toggle platform update notifications"
               />
             </div>
          </div>
        </div>
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
