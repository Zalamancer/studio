
// src/app/settings/verification/page.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, AlertTriangle, Clock } from 'lucide-react';

// Placeholder: You'll need state management and logic to handle verification status and process

const VerificationSettingsPage = () => {
  // Placeholder state - replace with actual verification status logic
  const verificationStatus: 'verified' | 'pending' | 'unverified' = 'unverified'; // Example status
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleStartVerification = async () => {
      setIsSubmitting(true);
      console.log("Starting verification process...");
      // Placeholder: Call your backend/service to initiate verification
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      // Update status based on response (e.g., set to 'pending')
      setIsSubmitting(false);
      // Show toast message
  };

  const renderStatusBadge = () => {
    switch (verificationStatus) {
      case 'verified':
        return (
          <div className="flex items-center gap-2 text-green-600 bg-green-100 dark:bg-green-900/50 px-3 py-1 rounded-full text-sm font-medium">
            <ShieldCheck className="h-5 w-5" /> Verified
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-2 text-yellow-600 bg-yellow-100 dark:bg-yellow-900/50 px-3 py-1 rounded-full text-sm font-medium">
            <Clock className="h-5 w-5" /> Pending Review
          </div>
        );
      case 'unverified':
      default:
        return (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-100 dark:bg-orange-900/50 px-3 py-1 rounded-full text-sm font-medium">
            <AlertTriangle className="h-5 w-5" /> Unverified
          </div>
        );
    }
  };

  return (
    <Card className="shadow-md border-border">
      <CardHeader>
        <CardTitle>Business Verification</CardTitle>
        <CardDescription>Verify your business to increase trust and unlock potential features.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
         <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium text-foreground">Current Status:</span>
            {renderStatusBadge()}
         </div>

         {verificationStatus === 'unverified' && (
             <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                    Verifying your business helps build trust within the AnonyCollab community.
                    Verified businesses may gain access to exclusive features or enhanced visibility.
                </p>
                <p>
                    Click the button below to start the verification process. You may be required to
                    submit documentation or link external accounts.
                </p>
                <Button
                    onClick={handleStartVerification}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto"
                >
                    {isSubmitting ? (
                        <>
                            <Clock className="mr-2 h-4 w-4 animate-spin" /> Starting...
                        </>
                    ) : (
                        'Start Verification'
                    )}
                </Button>
             </div>
         )}

         {verificationStatus === 'pending' && (
            <p className="text-sm text-muted-foreground">
                Your verification request is currently under review. We will notify you once the process is complete.
                This typically takes 1-3 business days.
            </p>
         )}

         {verificationStatus === 'verified' && (
             <p className="text-sm text-green-600 font-medium">
                Congratulations! Your business is verified.
             </p>
         )}
      </CardContent>
    </Card>
  );
};

export default VerificationSettingsPage;
