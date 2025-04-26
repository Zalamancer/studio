
"use client";

import React, { useRef } from 'react'; // Import useRef
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithGoogle, signInWithEmailPassword, sendPasswordReset } from '@/lib/firebase/auth'; // Import sendPasswordReset
import { useToast } from "@/hooks/use-toast";
import type { AuthError } from 'firebase/auth';

const LoginPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const emailInputRef = useRef<HTMLInputElement>(null); // Ref for email input

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
       toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Please enter both email and password.",
      });
      return;
    }

    try {
      const userCredential = await signInWithEmailPassword(email, password);
      toast({
        title: "Login Successful",
        description: "Redirecting to dashboard...",
      });
      router.push('/'); // Redirect on success

    } catch (error) {
       const authError = error as AuthError;
       let description = "An unexpected error occurred during login.";

       if (authError.code === 'auth/invalid-credential') {
           description = "Incorrect email or password. Please try again or sign up.";
       } else if (authError.code === 'auth/invalid-email') {
            description = "Please enter a valid email address.";
       } else if (authError.code === 'auth/too-many-requests') {
           description = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
       }
       // Avoid logging expected invalid credential errors to the console, but log others.
       if (authError.code !== 'auth/invalid-credential') {
           console.error("Email Login Error:", authError.code, authError.message);
       }

       toast({
        variant: "destructive",
        title: "Login Failed",
        description: description,
      });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const userCredential = await signInWithGoogle();
      if (userCredential) {
         toast({
          title: "Google Login Successful",
          description: "Redirecting to dashboard...",
        });
        router.push('/');
      }
      // Errors are caught below
    } catch (error) {
        const authError = error as AuthError;
        let description = "An unexpected error occurred during Google Sign-In.";
        if (authError.code === 'auth/popup-closed-by-user') {
            description = "Google Sign-In cancelled.";
            return; // Exit without showing error toast
        } else if (authError.code === 'auth/account-exists-with-different-credential') {
            description = "An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.";
        } else if (authError.code === 'auth/api-key-not-valid') {
             description = "Invalid Firebase API Key. Please check your environment variables.";
        }

       toast({
        variant: "destructive",
        title: "Google Login Error",
        description: description,
      });
      if (authError.code !== 'auth/popup-closed-by-user') {
        console.error("Google Login Error:", authError.code, authError.message);
      }
    }
  };

  const handleForgotPassword = async () => {
    const email = emailInputRef.current?.value; // Get email from ref

    if (!email) {
      toast({
        variant: "destructive",
        title: "Forgot Password Failed",
        description: "Please enter your email address first.",
      });
      return;
    }

    try {
      await sendPasswordReset(email);
      toast({
        title: "Password Reset Email Sent",
        description: "If an account exists for this email, you will receive instructions to reset your password.",
      });
    } catch (error) {
      const authError = error as AuthError;
      let description = "An error occurred while sending the password reset email.";
      if (authError.code === 'auth/invalid-email') {
          description = "Please enter a valid email address.";
      } else if (authError.code === 'auth/user-not-found') {
          // It's often better not to reveal if an email exists for security reasons.
          // So we might show the same success message regardless.
          // description = "No account found with this email address.";
          toast({
            title: "Password Reset Email Sent",
            description: "If an account exists for this email, you will receive instructions to reset your password.",
          });
          return; // Avoid showing a destructive toast in this case
      }
       console.error("Forgot Password Error:", authError.code, authError.message);
       toast({
        variant: "destructive",
        title: "Forgot Password Error",
        description: description,
      });
    }
  };


  return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">
            Login to AnonyCollab
          </CardTitle>
           <CardDescription>
            Enter your email below to login or use Google
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input ref={emailInputRef} type="email" id="email" name="email" placeholder="m@example.com" required className="mt-1" />
            </div>
            <div className="grid gap-2">
             <div className="flex items-center justify-between">
                 <Label htmlFor="password">Password</Label>
                 {/* Forgot Password Link */}
                 <Button
                   type="button"
                   variant="link"
                   className="text-sm p-0 h-auto"
                   onClick={handleForgotPassword} // Call handler on click
                 >
                    Forgot password?
                 </Button>
              </div>
              <Input type="password" id="password" name="password" placeholder="Enter password" required className="mt-1" />
            </div>
            <div>
              <Button type="submit" className="w-full">Login</Button>
            </div>
             <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                    </span>
                </div>
            </div>
            <div className="text-center">
               <Button variant="outline" type="button" className="w-full" onClick={handleGoogleLogin}>
                 Login with Google
               </Button>
            </div>
          </form>
           <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
