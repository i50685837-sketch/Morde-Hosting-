const PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY;

const PAYSTACK_PUBLIC_KEY =
  process.env.PAYSTACK_PUBLIC_KEY;

const PAYSTACK_CURRENCY =
  process.env.PAYSTACK_CURRENCY || "KES";


if (!PAYSTACK_SECRET_KEY) {

  console.warn(
    "⚠️ PAYSTACK_SECRET_KEY is missing."
  );

}


if (!PAYSTACK_PUBLIC_KEY) {

  console.warn(
    "⚠️ PAYSTACK_PUBLIC_KEY is missing."
  );

}


module.exports = {

  secretKey:
    PAYSTACK_SECRET_KEY,

  publicKey:
    PAYSTACK_PUBLIC_KEY,

  currency:
    PAYSTACK_CURRENCY

};
