
"use client";

import React from 'react'; // Removed useRef as it's no longer needed here
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithGoogle, signInWithEmailPassword } from '@/lib/firebase/auth'; // Removed sendPasswordReset import
import { useToast } from "@/hooks/use-toast";
import type { AuthError } from 'firebase/auth';

const LoginPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  // Removed emailInputRef as the forgot password logic is moved to a separate page

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
            // No need to show a toast if the user intentionally closed the popup
             console.log(description); // Log for debugging if needed
             return;
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
       // Avoid logging expected user cancellation errors to the console.
       if (authError.code !== 'auth/popup-closed-by-user') {
            console.error("Google Login Error:", authError.code, authError.message);
       }
    }
  };

  // Removed handleForgotPassword function as it's moved to the /forgot-password page

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-background to-secondary">
      <Card className="w-full max-w-md mx-4 shadow-xl rounded-lg border-border">
        <CardHeader className="space-y-1 text-center p-6">
          <CardTitle className="text-3xl font-bold text-primary">
            Welcome Back!
          </CardTitle>
           <CardDescription className="text-muted-foreground">
            Login to access your AnonyCollab dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 p-6">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <Input type="email" id="email" name="email" placeholder="you@company.com" required className="mt-1 rounded-md border-input focus:ring-primary focus:border-primary" />
            </div>
            <div className="grid gap-2">
             <div className="flex items-center justify-between">
                 <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                 {/* Updated Link to point to the new page */}
                 <Link
                   href="/forgot-password"
                   className="text-sm text-primary hover:underline p-0 h-auto font-medium"
                 >
                    Forgot password?
                 </Link>
              </div>
              <Input type="password" id="password" name="password" placeholder="Enter your password" required className="mt-1 rounded-md border-input focus:ring-primary focus:border-primary" />
            </div>
            <div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-md py-2.5 font-semibold shadow-md transition duration-200 ease-in-out transform hover:scale-105">Login</Button>
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
            <div className="text-center">
               <Button variant="outline" type="button" className="w-full border-border hover:bg-accent hover:text-accent-foreground rounded-md py-2.5 font-semibold shadow-sm transition duration-200 ease-in-out transform hover:scale-105" onClick={handleGoogleLogin}>
                 {/* Add Google Icon (Optional) */}
                 {/* <svg className="mr-2 h-4 w-4" ...>...</svg> */}
                 Login with Google
               </Button>
            </div>
          </form>
           <div className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up here
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;

