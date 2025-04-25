
"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithGoogle } from '@/lib/firebase/auth'; // Import the Google Sign-In function
import { useToast } from "@/hooks/use-toast"; // Import useToast

const sectors = [
  "Tech", "Retail", "Logistics", "Healthcare", "Finance",
];

const SignUpPage = () => {
  const router = useRouter();
  const { toast } = useToast(); // Initialize toast

  const handleEmailSignup = (event: React.FormEvent) => {
    event.preventDefault();
    // Here, you would typically handle the email/password signup,
    // e.g., send the data to your authentication service using Firebase createUserWithEmailAndPassword.
    // Example: createUserWithEmailAndPassword(auth, email, password)
    console.log("Email/Password signup attempt (simulation)");
    // After successful signup, redirect the user to the home dashboard.
     toast({
        title: "Sign Up Successful",
        description: "Redirecting to dashboard...",
      });
    router.push('/'); // Redirect to dashboard after sign up
  };

   const handleGoogleSignup = async () => {
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
      console.error("Google Sign-Up/Sign-In failed.");
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
          <form onSubmit={handleEmailSignup} className="space-y-4">
             <div className="grid gap-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input type="text" id="companyName" placeholder="Your Company Inc." required className="mt-1" />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input type="email" id="email" placeholder="m@example.com" required className="mt-1" />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input type="password" id="password" placeholder="••••••••" required className="mt-1" />
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
               {/* Updated Google Signup Button */}
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
