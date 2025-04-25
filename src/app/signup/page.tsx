
"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const sectors = [
  "Tech", "Retail", "Logistics", "Healthcare", "Finance",
];

const SignUpPage = () => {
  const router = useRouter();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Here, you would typically handle the form submission,
    // e.g., send the data to your authentication service.
    // After successful signup, redirect the user to the home dashboard.
    router.push('/'); // Redirect to dashboard after sign up
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">
            Create an Account
          </CardTitle>
          <CardDescription>
            Enter your details below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button variant="outline" className="w-full">Sign up with Google</Button>
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
