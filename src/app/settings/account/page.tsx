
// src/app/settings/account/page.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext'; // Assuming auth context
import { Loader2, Trash2, ShieldAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Placeholder: Need functions for changing password, deleting account, etc.

const AccountSettingsPage = () => {
  const { user, loading } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);

  // Placeholder functions
  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsChangingPassword(true);
      console.log("Initiating password change...");
      // Call Firebase auth function for password change (requires re-authentication usually)
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsChangingPassword(false);
      // Show toast
  };

  const handleDeleteAccount = async () => {
      setIsDeletingAccount(true);
      console.log("Initiating account deletion...");
      // Call Firebase auth function for account deletion (requires re-authentication)
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsDeletingAccount(false);
      // Redirect user after deletion, maybe show final toast
  };


   if (loading) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>Account Settings</CardTitle>
                  <CardDescription>Manage your login credentials and account status.</CardDescription>
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
        <CardTitle>Account Settings</CardTitle>
        <CardDescription>Manage your login credentials and account status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Change Password Section - Basic example */}
         {/* Note: Secure password change often requires current password or re-authentication */}
        <div className="space-y-4">
           <h3 className="text-lg font-medium text-foreground">Change Password</h3>
           <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
              {/* Add fields for current password, new password, confirm new password */}
              <div className="space-y-2">
                   <Label htmlFor="currentPassword">Current Password</Label>
                   <Input id="currentPassword" type="password" disabled={isChangingPassword} required />
              </div>
               <div className="space-y-2">
                   <Label htmlFor="newPassword">New Password</Label>
                   <Input id="newPassword" type="password" disabled={isChangingPassword} required />
              </div>
               <div className="space-y-2">
                   <Label htmlFor="confirmPassword">Confirm New Password</Label>
                   <Input id="confirmPassword" type="password" disabled={isChangingPassword} required />
              </div>
              <Button type="submit" variant="outline" disabled={isChangingPassword}>
                {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update Password
              </Button>
           </form>
        </div>

        <hr className="border-border" />

        {/* Delete Account Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-destructive">Delete Account</h3>
          <p className="text-sm text-muted-foreground">
            Permanently delete your AnonyCollab account and all associated data. This action cannot be undone.
          </p>
           <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeletingAccount}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete My Account
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                           <ShieldAlert className="h-5 w-5 text-destructive" /> Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your account, posts, messages,
                            connections, and all other associated data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingAccount}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                           onClick={handleDeleteAccount}
                           disabled={isDeletingAccount}
                           className="bg-destructive hover:bg-destructive/90"
                         >
                             {isDeletingAccount ? (
                                <>
                                 <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                                </>
                             ) : (
                                'Yes, delete my account'
                             )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountSettingsPage;
