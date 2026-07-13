"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createCheckoutSession } from "@/lib/stripe";

export async function createCheckoutAction() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  // We are keeping it simple for now and letting Stripe create the customer
  const sessionUrl = await createCheckoutSession({
    clerkUserId: userId,
    customerEmail: email,
  });

  redirect(sessionUrl);
}
