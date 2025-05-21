
// src/app/settings/payment-method/page.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, CreditCard } from 'lucide-react';

const PaymentMethodSettingsPage = () => {
  // Placeholder states and handlers
  const [paymentMethods, setPaymentMethods] = React.useState([
    { id: '1', type: 'Visa', last4: '4242', expiry: '12/25', isDefault: true },
    { id: '2', type: 'Mastercard', last4: '5555', expiry: '06/27', isDefault: false },
  ]);

  const handleAddPaymentMethod = () => {
    // Placeholder: Open a dialog or navigate to add a new method
    console.log("Add new payment method clicked");
  };

  const handleRemovePaymentMethod = (id: string) => {
    console.log(`Remove payment method ${id} clicked`);
    setPaymentMethods(prev => prev.filter(pm => pm.id !== id));
  };

  const handleSetDefault = (id: string) => {
    console.log(`Set payment method ${id} as default`);
    setPaymentMethods(prev => prev.map(pm => ({ ...pm, isDefault: pm.id === id })));
  };

  return (
    <Card className="shadow-md border-border">
      <CardHeader>
        <CardTitle>Payment Method Settings</CardTitle>
        <CardDescription>
          Manage your saved payment methods. Add, remove, or update your payment details here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {paymentMethods.length > 0 ? (
            paymentMethods.map((method) => (
              <Card key={method.id} className="p-4 flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{method.type} ending in {method.last4}</p>
                    <p className="text-xs text-muted-foreground">Expires {method.expiry}</p>
                  </div>
                  {method.isDefault && (
                    <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!method.isDefault && (
                    <Button variant="outline" size="xs" onClick={() => handleSetDefault(method.id)}>
                      Set as Default
                    </Button>
                  )}
                  <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive" onClick={() => handleRemovePaymentMethod(method.id)}>
                    Remove
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              You have no saved payment methods.
            </p>
          )}
        </div>
        <div className="flex justify-start">
          <Button onClick={handleAddPaymentMethod}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Payment Method
          </Button>
        </div>
        <p className="text-xs text-muted-foreground pt-4">
          Your payment information is stored securely. For more details, please review our Privacy Policy.
        </p>
      </CardContent>
    </Card>
  );
};

export default PaymentMethodSettingsPage;
