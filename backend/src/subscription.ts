import type Stripe from "stripe";

export interface SubscriptionPeriod {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

// What the portal needs to tell a business their subscription is ending and
// when. `active` deliberately stays true through a pending cancellation - they
// have paid to the end of the period - so without these two the portal cannot
// tell a cancelled subscription from a healthy one.
//
// `cancel_at` is preferred when Stripe has set it, because that is precisely
// when the subscription stops. Otherwise the renewal date is read from the
// first subscription item: Stripe moved current_period_end off the
// subscription in a recent API version and it no longer exists at the top
// level, so reading it from there would silently produce nothing.
export const subscriptionPeriod = (
  subscription: Stripe.Subscription,
): SubscriptionPeriod => {
  // Stripe expresses a pending cancellation in two different ways, and which
  // one it uses depends on how the cancellation was made. `cancel_at` is "a
  // date in the future at which the subscription will automatically get
  // canceled"; `cancel_at_period_end` is the older boolean.
  //
  // The Customer Portal on the current API version sets only `cancel_at` and
  // leaves the boolean false, so reading the boolean alone silently misses
  // every cancellation made there - and also misses our own cancel route,
  // which stores whatever Stripe hands back. Either signal means the
  // subscription is ending.
  const cancelAt = subscription.cancel_at ?? null;
  const endsAt =
    cancelAt ?? subscription.items?.data?.[0]?.current_period_end ?? null;

  return {
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true || cancelAt !== null,
    currentPeriodEnd: endsAt ? new Date(endsAt * 1000).toISOString() : null,
  };
};
