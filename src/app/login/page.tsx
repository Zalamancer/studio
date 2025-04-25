
"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithGoogle } from '@/lib/firebase/auth'; // Import the Google Sign-In function
import { useToast } from "@/hooks/use-toast"; // Import useToast

const LoginPage = () => {
  const router = useRouter();
  const { toast } = useToast(); // Initialize toast

  const handleEmailLogin = (event: React.FormEvent) => {
    event.preventDefault();
    // Simulate email/password login process
    // In a real app, you would verify credentials here using Firebase or another auth provider.
    // Example: signInWithEmailAndPassword(auth, email, password)
    console.log("Email/Password login attempt (simulation)");
    // For now, show a placeholder message and redirect.
     toast({
      title: "Login Successful",
      description: "Redirecting to dashboard...",
    });
    router.push('/');
  };

  const handleGoogleLogin = async () => {
    const userCredential = await signInWithGoogle();
    if (userCredential) {
      // User signed in successfully
       toast({
        title: "Google Login Successful",
        description: "Redirecting to dashboard...",
      });
      router.push('/'); // Redirect to the home dashboard
    } else {
      // Handle sign-in failure (optional: show a toast message)
      toast({
        variant: "destructive",
        title: "Google Login Failed",
        description: "Could not log in with Google. Please try again.",
      });
       console.error("Google Sign-In failed.");
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
              <Input type="email" id="email" placeholder="m@example.com" required className="mt-1" />
            </div>
            <div className="grid gap-2">
             <div className="flex items-center">
                 <Label htmlFor="password">Password</Label>
              </div>
              <Input type="password" id="password" placeholder="Enter password" required className="mt-1" />
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
               {/* Updated Google Login Button */}
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
