declare const require: any;

export async function openRazorpayCheckout(checkout: any) {
  let RazorpayCheckout: any;
  try {
    RazorpayCheckout = require("react-native-razorpay")?.default ?? require("react-native-razorpay");
  } catch {
    throw new Error("Install and configure react-native-razorpay in a dev/production build to open native checkout.");
  }
  return RazorpayCheckout.open({
    key: checkout.key,
    amount: checkout.amount,
    currency: checkout.currency,
    order_id: checkout.orderId,
    name: checkout.name,
    description: checkout.description,
    prefill: checkout.prefill ?? {},
    theme: { color: "#FF8A22" }
  });
}

export async function startGooglePlayPurchase(productId: string) {
  try {
    const iap = require("react-native-iap");
    if (!iap?.requestPurchase) throw new Error("Missing requestPurchase");
    return iap.requestPurchase({ skus: [productId] });
  } catch {
    throw new Error("Install and configure react-native-iap or Play Billing in a dev/production build, then send the purchase token to the verify endpoint.");
  }
}
