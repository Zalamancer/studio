
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sendPasswordReset } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import type { AuthError } from 'firebase/auth';
import { Mail, ArrowLeft } from 'lucide-react'; // Import icons

const ForgotPasswordPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setEmailSent(false); // Reset status on new attempt

    if (!email) {
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: "Please enter your email address.",
      });
      setIsLoading(false);
      return;
    }

    try {
      await sendPasswordReset(email);
      toast({
        title: "Password Reset Email Sent",
        description: "If an account exists for this email, you will receive instructions to reset your password shortly. Please check your inbox (and spam folder).",
        duration: 7000, // Keep toast longer
      });
      setEmailSent(true); // Show confirmation message
    } catch (error) {
      const authError = error as AuthError;
      let description = "An error occurred while sending the password reset email.";
      if (authError.code === 'auth/invalid-email') {
          description = "Please enter a valid email address.";
      } else if (authError.code === 'auth/user-not-found') {
          // Security best practice: Show the same success message even if user not found
          toast({
            title: "Password Reset Email Sent",
            description: "If an account exists for this email, you will receive instructions to reset your password shortly. Please check your inbox (and spam folder).",
            duration: 7000,
          });
          setEmailSent(true);
          setIsLoading(false);
          return; // Avoid showing a destructive toast
      }
       console.error("Forgot Password Error:", authError.code, authError.message);
       toast({
        variant: "destructive",
        title: "Forgot Password Error",
        description: description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-background to-sky-100 p-4">
      <Card className="w-full max-w-md mx-auto shadow-2xl rounded-xl border-border bg-card overflow-hidden">
        <CardHeader className="space-y-2 text-center p-8 bg-gradient-to-r from-primary to-teal-400 text-primary-foreground">
          <CardTitle className="text-3xl font-bold">
            Forgot Your Password?
          </CardTitle>
           <CardDescription className="text-primary-foreground/90 pt-1">
            No worries! Enter your email below and we'll send you a link to reset it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 p-8">
          {!emailSent ? (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-sm font-medium flex items-center text-foreground">
                  <Mail className="mr-2 h-4 w-4 text-primary" /> Email Address
                </Label>
                <Input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="mt-1 rounded-md border-input focus:ring-primary focus:border-primary transition-colors duration-200"
                />
              </div>
              <div>
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-md py-2.5 font-semibold shadow-md transition duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? (
                     <>
                       <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></span>
                       Sending...
                     </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <Mail className="mx-auto h-12 w-12 text-green-500"/>
              <p className="text-lg font-semibold text-foreground">Check Your Email!</p>
              <p className="text-muted-foreground text-sm">
                We've sent a password reset link to <strong>{email}</strong>. Follow the instructions in the email to reset your password.
              </p>
               <p className="text-xs text-muted-foreground">(Didn't receive it? Check your spam folder or try again.)</p>
            </div>
          )}
           <div className="mt-6 text-center text-sm">
            <Link href="/login" className="font-medium text-primary hover:underline flex items-center justify-center gap-1">
               <ArrowLeft className="h-4 w-4" /> Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
