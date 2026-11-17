import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

  let payload: string;
  try {
    payload = await request.text();
    if (!payload || payload.length > 20_000) {
      return json(400, { error: "invalid_payload" });
    }

    const hookSecret = requiredEnv("SEND_SMS_HOOK_SECRET");
    const webhook = new Webhook(hookSecret.replace(/^v1,whsec_/, ""));
    const event = webhook.verify(payload, Object.fromEntries(request.headers)) as {
      user?: { phone?: string };
      sms?: { otp?: string; message?: string };
    };

    const phone = event.user?.phone ?? "";
    const otp = event.sms?.otp ?? "";
    if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\d{4,10}$/.test(otp)) {
      return json(400, { error: "invalid_auth_payload" });
    }

    const username = requiredEnv("AFRICASTALKING_USERNAME");
    const apiKey = requiredEnv("AFRICASTALKING_API_KEY");
    const environment = (Deno.env.get("AFRICASTALKING_ENV") ?? "sandbox").toLowerCase();
    if (environment !== "sandbox" && environment !== "production") {
      return json(500, { error: "invalid_provider_environment" });
    }

    const endpoint = environment === "sandbox"
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    const form = new URLSearchParams({
      username,
      to: phone,
      message: `Your CREOVA verification code is ${otp}. It expires soon. Do not share this code.`,
    });
    const senderId = Deno.env.get("AFRICASTALKING_SENDER_ID")?.trim();
    if (senderId) form.set("from", senderId);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "apiKey": apiKey,
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("Africa's Talking request failed", response.status, responseText.slice(0, 500));
      return json(502, { error: "sms_provider_rejected_request" });
    }

    let result: {
      SMSMessageData?: {
        Recipients?: Array<{ status?: string; statusCode?: number; messageId?: string }>;
      };
    };
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error("Africa's Talking returned non-JSON response");
      return json(502, { error: "sms_provider_invalid_response" });
    }

    const recipient = result.SMSMessageData?.Recipients?.[0];
    if (!recipient || recipient.statusCode !== 101 || recipient.status !== "Success") {
      console.error("Africa's Talking did not accept the OTP", recipient?.statusCode, recipient?.status);
      return json(502, { error: "sms_delivery_not_accepted" });
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("CREOVA Send SMS hook failed", message);
    return json(500, { error: "sms_hook_failed" });
  }
});
