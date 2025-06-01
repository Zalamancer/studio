
"use client";

import React, { useState, useEffect, useRef } from 'react'; // Added useEffect, useRef
import Link from 'next/link';
import Script from 'next/script'; // Import next/script
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithGoogle, signUpWithEmailPassword } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import type { AuthError } from 'firebase/auth';

const sectors = [
  "Tech", "Retail", "Logistics", "Healthcare", "Finance", "Manufacturing", "Education", "Other"
];

const SignUpPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null);
  const recaptchaWidgetIdRef = useRef<number | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    // This effect can be used for explicit rendering if needed,
    // but automatic rendering with class "g-recaptcha" and script attributes is often sufficient.
    // If explicit rendering is required later:
    // const renderRecaptcha = () => {
    //   if (siteKey && typeof window !== 'undefined' && (window as any).grecaptcha && (window as any).grecaptcha.enterprise) {
    //     const recaptchaContainer = document.getElementById('recaptcha-container');
    //     if (recaptchaContainer && recaptchaContainer.innerHTML === '') { // Prevent multiple renders
    //       recaptchaWidgetIdRef.current = (window as any).grecaptcha.enterprise.render('recaptcha-container', {
    //         sitekey: siteKey,
    //         action: 'SIGNUP',
    //       });
    //     }
    //   }
    // };
    // If the script loads after initial mount, you might need to call renderRecaptcha from the script's onLoad.
    // For automatic rendering, ensure the div exists when the script runs.
  }, [siteKey]);


  const handleEmailSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setRecaptchaError(null);

    const token = typeof window !== 'undefined' && (window as any).grecaptcha?.enterprise?.getResponse(recaptchaWidgetIdRef.current ?? undefined);

    if (!token) {
      toast({
        variant: "destructive",
        title: "reCAPTCHA Required",
        description: "Please complete the reCAPTCHA challenge.",
      });
      setRecaptchaError("Please complete the reCAPTCHA challenge.");
      setIsLoading(false);
      return;
    }

    console.log("reCAPTCHA Token:", token); // Log token for now

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const companyName = formData.get('companyName') as string;
    const industry = formData.get('industry') as string;

    if (!email || !password || !companyName || !industry ) {
      toast({
        variant: "destructive",
        title: "Sign Up Failed",
        description: "Please fill in all required fields.",
      });
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Sign Up Failed",
        description: "Password must be at least 6 characters long.",
      });
      setIsLoading(false);
      return;
    }

    try {
      // TODO: In a real implementation, send the `token` to your backend for verification FIRST.
      // Then, if valid, proceed with user creation.
      // For Firebase client SDK, this usually means calling a Cloud Function that verifies
      // the token and then uses Admin SDK to create user.
      // Or, use Firebase App Check with reCAPTCHA Enterprise.

      const userCredential = await signUpWithEmailPassword(email, password, { companyName, industry });
      if (userCredential) {
        toast({
          title: "Sign Up Successful",
          description: "Welcome! Redirecting to your dashboard...",
        });
        router.push('/');
      }
    } catch (error) {
      const authError = error as AuthError;
      let description = "An unexpected error occurred during sign up.";
      if (authError.code === 'auth/email-already-in-use') {
        description = "This email address is already registered. Please log in or use a different email.";
      } else if (authError.code === 'auth/weak-password') {
        description = "The password is too weak. Please choose a stronger password (at least 6 characters).";
      } else if (authError.code === 'auth/invalid-email') {
        description = "Please enter a valid email address.";
      }
      console.error("Email Signup Error:", authError.code, authError.message);
      toast({
        variant: "destructive",
        title: "Sign Up Failed",
        description: description,
      });
    } finally {
      setIsLoading(false);
      // Reset reCAPTCHA widget after submission attempt
      if (typeof window !== 'undefined' && (window as any).grecaptcha?.enterprise) {
        (window as any).grecaptcha.enterprise.reset(recaptchaWidgetIdRef.current ?? undefined);
      }
    }
  };

  const handleGoogleSignup = async () => {
    // Google Sign-In is less commonly protected by a visible reCAPTCHA on the same form,
    // as Google's sign-in flow has its own abuse protection.
    // Firebase App Check is the more common way to protect this.
    setIsLoading(true);
    try {
      const userCredential = await signInWithGoogle();
      if (userCredential) {
        toast({
          title: "Google Sign Up Successful",
          description: "Welcome! Redirecting to dashboard...",
        });
        router.push('/');
      }
    } catch (error) {
      const authError = error as AuthError;
      let description = "An unexpected error occurred during Google Sign-Up.";
      if (authError.code === 'auth/popup-closed-by-user') {
        description = "Google Sign-Up cancelled.";
        console.log(description);
        setIsLoading(false);
        return;
      } else if (authError.code === 'auth/account-exists-with-different-credential') {
        description = "An account already exists with this email. Please log in using the original method.";
      } else if (authError.code === 'auth/api-key-not-valid') {
        description = "Invalid Firebase API Key configuration.";
      } else if (authError.code === 'auth/auth-domain-config-required' || authError.code === 'auth/operation-not-allowed') {
        description = "Google Sign-Up is not enabled for this project. Please check Firebase console settings.";
      }
      toast({
        variant: "destructive",
        title: "Google Sign Up Error",
        description: description,
      });
      if (authError.code !== 'auth/popup-closed-by-user') {
        console.error("Google Sign Up Error (Signup Page):", authError.code, authError.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!siteKey) {
    console.error("NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set. reCAPTCHA will not be displayed.");
    // Optionally, render a message to the user or a disabled form
  }

  return (
    <>
      <Script
        src="https://www.google.com/recaptcha/enterprise.js"
        async
        defer
        strategy="afterInteractive" // Load after the page is interactive
      />
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-background to-secondary">
        <Card className="w-full max-w-md mx-4 shadow-xl rounded-lg border-border">
          <CardHeader className="space-y-1 text-center p-6">
            <CardTitle className="text-3xl font-bold text-primary">
              Create Your Account
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Join AnonyCollab to collaborate anonymously.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 p-6">
            <form onSubmit={handleEmailSignup} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="companyName" className="text-sm font-medium">Company Name</Label>
                <Input type="text" id="companyName" name="companyName" placeholder="Your Awesome Company" required className="mt-1 rounded-md border-input focus:ring-primary focus:border-primary" disabled={isLoading} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <Input type="email" id="email" name="email" placeholder="you@company.com" required className="mt-1 rounded-md border-input focus:ring-primary focus:border-primary" disabled={isLoading} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input type="password" id="password" name="password" placeholder="Create a password (min. 6 characters)" required className="mt-1 rounded-md border-input focus:ring-primary focus:border-primary" disabled={isLoading} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="industry" className="text-sm font-medium">Select Industry</Label>
                <Select name="industry" required disabled={isLoading}>
                  <SelectTrigger className="mt-1 w-full rounded-md border-input focus:ring-primary focus:border-primary text-muted-foreground [&[data-state=open]>span]:text-foreground">
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border-border bg-popover text-popover-foreground">
                    {sectors.map(sector => (
                      <SelectItem key={sector} value={sector} className="focus:bg-accent focus:text-accent-foreground rounded-sm">{sector}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* reCAPTCHA Widget */}
              {siteKey ? (
                <div className="grid gap-2">
                  <div
                    id="recaptcha-container" // Added ID for potential explicit render
                    className="g-recaptcha"
                    data-sitekey={siteKey} // Use your site key from .env.local
                    data-action="SIGNUP" // Action name for Enterprise
                  ></div>
                  {recaptchaError && <p className="text-sm font-medium text-destructive">{recaptchaError}</p>}
                </div>
              ) : (
                <p className="text-sm text-destructive">reCAPTCHA is not configured. Site key missing.</p>
              )}

              <div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-md py-2.5 font-semibold shadow-md transition duration-200 ease-in-out transform hover:scale-105" disabled={isLoading || !siteKey}>
                  {isLoading ? 'Signing Up...' : 'Sign Up'}
                </Button>
              </div>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <div>
                <Button variant="outline" type="button" className="w-full border-border hover:bg-accent hover:text-accent-foreground rounded-md py-2.5 font-semibold shadow-sm transition duration-200 ease-in-out transform hover:scale-105" onClick={handleGoogleSignup} disabled={isLoading}>
                  Sign up with Google
                </Button>
              </div>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Log in here
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default SignUpPage;
