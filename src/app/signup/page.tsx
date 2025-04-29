
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
  "Tech", "Retail", "Logistics", "Healthcare", "Finance", "Manufacturing", "Education", "Other" // Added more options
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

    // --- Password Requirement Validation ---
    if (password.length < 6) {
        toast({
            variant: "destructive",
            title: "Sign Up Failed",
            description: "Password must be at least 6 characters long.",
        });
        return; // Stop execution if password is too short
    }
    // --- End Password Validation ---


    try {
      const userCredential = await signUpWithEmailPassword(email, password);
       if (userCredential) {
        // You might want to store companyName and industry in Firestore here
        // associated with the userCredential.user.uid
         toast({
            title: "Sign Up Successful",
            description: "Welcome! Redirecting to your dashboard...",
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
            // This backend check is still useful as a fallback
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
    }
  };

   const handleGoogleSignup = async () => {
    try {
      const userCredential = await signInWithGoogle(); // Re-use the same function
      if (userCredential) {
        // User signed in (and potentially created an account) successfully
         toast({
          title: "Google Sign Up Successful",
          description: "Welcome! Redirecting to dashboard...",
        });
        router.push('/'); // Redirect to the home dashboard
      }
       // Errors are handled in the catch block by signInWithGoogle re-throwing
    } catch (error) {
        // Error handling is now primarily within signInWithGoogle, but catch here as a fallback
        const authError = error as AuthError;
        let description = "An unexpected error occurred during Google Sign-Up.";
        if (authError.code === 'auth/popup-closed-by-user') {
            description = "Google Sign-Up cancelled.";
             console.log(description); // Log for debugging if needed
             return; // Don't show toast for user cancellation
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
    }
  };

  return (
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
           {/* Update form to use names for FormData */}
          <form onSubmit={handleEmailSignup} className="space-y-4">
             <div className="grid gap-2">
              <Label htmlFor="companyName" className="text-sm font-medium">Company Name</Label>
              <Input type="text" id="companyName" name="companyName" placeholder="Your Awesome Company" required className="mt-1 rounded-md border-input focus:ring-primary focus:border-primary" />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <Input type="email" id="email" name="email" placeholder="you@company.com" required className="mt-1 rounded-md border-input focus:ring-primary focus:border-primary" />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              {/* Updated placeholder to show requirement */}
              <Input type="password" id="password" name="password" placeholder="Create a password (min. 6 characters)" required className="mt-1 rounded-md border-input focus:ring-primary focus:border-primary" />
              {/* Optional: Add password strength indicator later */}
            </div>
             <div className="grid gap-2">
              <Label htmlFor="industry" className="text-sm font-medium">Select Industry</Label>
              <Select name="industry" required>
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
            <div>
               <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-md py-2.5 font-semibold shadow-md transition duration-200 ease-in-out transform hover:scale-105">Sign Up</Button>
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
               {/* Google Signup Button */}
              <Button variant="outline" type="button" className="w-full border-border hover:bg-accent hover:text-accent-foreground rounded-md py-2.5 font-semibold shadow-sm transition duration-200 ease-in-out transform hover:scale-105" onClick={handleGoogleSignup}>
                 {/* Add Google Icon (Optional) */}
                 {/* <svg className="mr-2 h-4 w-4" ...>...</svg> */}
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
  );
};

export default SignUpPage;


    