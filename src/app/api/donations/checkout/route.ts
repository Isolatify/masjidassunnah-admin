import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.FORM_CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const ALLOWED_FUNDS: Record<string, string> = {
  general: "General Fund",
  quran: "Quran College",
  madrasah: "Madrasah",
  youth: "NextGen Youth",
  maintenance: "Masjid Maintenance",
  books: "Mashaikh & Books",
};

// Creates a Stripe Checkout session for a one-off donation and returns the
// redirect URL. Requires STRIPE_SECRET_KEY; otherwise reports a friendly error
// so the site can fall back to bank transfer.
export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { success: false, configured: false, error: "Card payments are not set up yet" },
      { status: 503, headers: CORS_HEADERS }
    );
  }

  try {
    const body = (await request.json()) as {
      amount?: number;
      currency?: string;
      fund?: string;
      name?: string;
      email?: string;
      successUrl?: string;
      cancelUrl?: string;
      origin?: string;
    };

    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount < 1 || amount > 10_000_000) {
      return NextResponse.json({ success: false, error: "Enter a valid amount" }, { status: 400, headers: CORS_HEADERS });
    }

    const currency = (body.currency || "aud").toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) {
      return NextResponse.json({ success: false, error: "Invalid currency" }, { status: 400, headers: CORS_HEADERS });
    }

    const fundKey = String(body.fund || "general");
    const fundName = ALLOWED_FUNDS[fundKey] ?? ALLOWED_FUNDS.general;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const origin = body.origin ? String(body.origin) : appUrl;
    const validOrigin = /^https?:\/\//.test(origin) ? origin : appUrl;

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount,
            product_data: {
              name: `${fundName} donation`,
              description: `Masjid As Sunnah — ${fundName}`,
            },
          },
        },
      ],
      customer_email: body.email ? String(body.email).slice(0, 320) : undefined,
      metadata: { fund: fundKey, source: "masjid-donate" },
      success_url: `${validOrigin}/donate?paid=1`,
      cancel_url: `${validOrigin}/donate?paid=0`,
    });

    return NextResponse.json({ success: true, url: session.url, sessionId: session.id }, { headers: CORS_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not start the payment";
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: CORS_HEADERS });
  }
}
