
"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithGoogle, signUpWithEmailPassword } from '@/lib/firebase/auth'; // Import the signup function
import { useToast } from "@/hooks/use-toast"; // Import useToast
import type { AuthError } from 'firebase/auth';


const sectors = [
  "Tech", "Retail", "Logistics", "Healthcare", "Finance",
];

const SignUpPage = () => {
  const router = useRouter();
  const { toast } = useToast(); // Initialize toast

  const handleEmailSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const companyName = formData.get('companyName') as string; // Get other fields if needed
    const industry = formData.get('industry') as string;

     if (!email || !password || !companyName || !industry ) {
       toast({
        variant: "destructive",
        title: "Sign Up Failed",
        description: "Please fill in all required fields.",
      });
      return;
    }

    // Basic password validation (example)
    if (password.length < 6) {
        toast({
            variant: "destructive",
            title: "Sign Up Failed",
            description: "Password must be at least 6 characters long.",
        });
        return;
    }


    try {
      const userCredential = await signUpWithEmailPassword(email, password);
       if (userCredential) {
        // You might want to store companyName and industry in Firestore here
        // associated with the userCredential.user.uid
         toast({
            title: "Sign Up Successful",
            description: "Redirecting to dashboard...",
          });
        router.push('/'); // Redirect to dashboard after sign up
      }
       // No 'else' needed, errors are caught below
    } catch (error) {
       const authError = error as AuthError;
       let description = "An unexpected error occurred during sign up.";
       if (authError.code === 'auth/email-already-in-use') {
           description = "This email address is already registered. Please log in or use a different email.";
       } else if (authError.code === 'auth/weak-password') {
            description = "The password is too weak. Please choose a stronger password.";
       } else if (authError.code === 'auth/invalid-email') {
           description = "Please enter a valid email address.";
       }
       console.error("Email Signup Error:", authError.code, authError.message);
       toast({
        variant: "destructive",
        title: "Sign Up Failed",
        description: description,
      });
    }
  };

   const handleGoogleSignup = async () => {
    try {
      const userCredential = await signInWithGoogle(); // Re-use the same function
      if (userCredential) {
        // User signed in (and potentially created an account) successfully
         toast({
          title: "Google Sign Up Successful",
          description: "Redirecting to dashboard...",
        });
        router.push('/'); // Redirect to the home dashboard
      } else {
        // Handle sign-in failure
         toast({
          variant: "destructive",
          title: "Google Sign Up Failed",
          description: "Could not sign up with Google. Please try again.",
        });
        console.error("Google Sign-Up/Sign-In failed (returned null).");
      }
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Google Sign Up Error",
        description: "An unexpected error occurred during Google Sign-Up.",
      });
      console.error("Unexpected error during Google Sign-Up:", error);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">
            Create an Account
          </CardTitle>
          <CardDescription>
            Enter your details below or use Google to create your account
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
           {/* Update form to use names for FormData */}
          <form onSubmit={handleEmailSignup} className="space-y-4">
             <div className="grid gap-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input type="text" id="companyName" name="companyName" placeholder="Your Company Inc." required className="mt-1" />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input type="email" id="email" name="email" placeholder="m@example.com" required className="mt-1" />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input type="password" id="password" name="password" placeholder="•••••••• (min. 6 characters)" required className="mt-1" />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="industry">Select Industry</Label>
              <Select name="industry" required>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map(sector => (
                    <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button type="submit" className="w-full">Sign Up</Button>
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
            <div>
               {/* Google Signup Button */}
              <Button variant="outline" type="button" className="w-full" onClick={handleGoogleSignup}>
                Sign up with Google
              </Button>
            </div>
          </form>
           <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUpPage;
