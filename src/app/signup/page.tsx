
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    router.push('/');
  };

  return (
    <div className="flex justify-center items-center h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">
            Sign Up to AnonyCollab
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input type="text" id="companyName" placeholder="Enter company name" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input type="email" id="email" placeholder="Enter email address" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input type="password" id="password" placeholder="Enter password" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="industry">Select Industry</Label>
              <Select id="industry">
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
            <div className="text-center">
              <Button variant="outline">Sign up with Google</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUpPage;

