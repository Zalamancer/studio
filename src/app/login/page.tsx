
"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const LoginPage = () => {
  const router = useRouter();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Simulate login process
    // In a real app, you would verify credentials here.
    // For now, just redirect to the home dashboard.
    router.push('/');
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">
            Login to AnonyCollab
          </CardTitle>
           <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input type="email" id="email" placeholder="m@example.com" required className="mt-1" />
            </div>
            <div className="grid gap-2">
             <div className="flex items-center">
                 <Label htmlFor="password">Password</Label>
                {/* Optional: Add Forgot Password link */}
                {/* <Link href="/forgot-password" passHref className="ml-auto inline-block text-sm underline">
                    Forgot your password?
                </Link> */}
              </div>
              <Input type="password" id="password" placeholder="Enter password" required className="mt-1" />
            </div>
            <div>
              <Button type="submit" className="w-full">Login</Button>
            </div>
            <div className="text-center">
              <Button variant="outline" className="w-full">Login with Google</Button>
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
