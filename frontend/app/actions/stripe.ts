"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createCheckoutSession } from "@/lib/stripe";

export async function createCheckoutAction(formData?: FormData) {
  const priceId = formData?.get("priceId") as string | undefined;
  const { userId } = await auth();
  
  if (!userId) {
    const target = priceId ? `/dashboard/billing?checkout=${priceId}` : "/dashboard/billing";
    redirect(`/sign-up?redirect_url=${encodeURIComponent(target)}`);
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  const sessionUrl = await createCheckoutSession({
    clerkUserId: userId,
    customerEmail: email,
    priceId,
  });

  redirect(sessionUrl);
}
