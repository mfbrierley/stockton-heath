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
  const endsAt =
    subscription.cancel_at ??
    subscription.items?.data?.[0]?.current_period_end ??
    null;

  return {
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    currentPeriodEnd: endsAt ? new Date(endsAt * 1000).toISOString() : null,
  };
};
