/**
 * PushToGlory lead capture worker (Cloudflare Workers, free tier)
 *
 * What it does on POST:
 *   1. Validates the email + basic bot checks (honeypot, submit timing)
 *   2. Adds the contact to your Resend Audience
 *   3. Sends the branded delivery email from info@pushtoglory.com
 *
 * Required settings (Worker > Settings > Variables and Secrets):
 *   RESEND_API_KEY      (Secret)  your Resend API key, starts with "re_"
 *   RESEND_AUDIENCE_ID  (Secret)  the Audience ID from Resend > Audiences
 *   RESOURCE_URL        (Text)    link to the Google Doc / PDF
 *   RESOURCE_NAME       (Text)    e.g. "The AI UGC Ad System"
 *
 * Optional:
 *   FROM_EMAIL          (Text)    default: Kaloyan from PushToGlory <info@pushtoglory.com>
 */

const ALLOWED_ORIGINS = [
  "https://pushtoglory.com",
  "https://www.pushtoglory.com",
  "http://localhost:5199",
];

const DISPOSABLE = [
  "mailinator.com", "guerrillamail.com", "tempmail.com", "temp-mail.org",
  "10minutemail.com", "yopmail.com", "sharklasers.com", "trashmail.com",
  "getnada.com", "dispostable.com",
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return new Response("PushToGlory leads API. POST only.", { status: 200 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid request." }, 400, origin);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const honeypot = String(body.company || "");
    const elapsed = Number(body.elapsed || 0);

    // Bot checks: hidden field must be empty, form open for at least 3 seconds
    if (honeypot !== "" || !(elapsed >= 3000)) {
      // Pretend success so bots learn nothing
      return json({ ok: true }, 200, origin);
    }

    // Email validation
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return json({ ok: false, error: "That email does not look right. Double-check it and try again." }, 400, origin);
    }
    const domain = email.split("@")[1];
    if (DISPOSABLE.includes(domain)) {
      return json({ ok: false, error: "Please use a real email address so the resource actually reaches you." }, 400, origin);
    }

    const auth = {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    };

    // 1) Add contact to the Resend Audience (duplicates are fine)
    try {
      const contactRes = await fetch(
        `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`,
        {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ email, unsubscribed: false }),
        }
      );
      if (!contactRes.ok) {
        const t = await contactRes.text();
        // Existing contact is not an error for us; anything else gets logged but
        // we still try to deliver the resource.
        console.log("Audience add non-ok:", contactRes.status, t);
      }
    } catch (e) {
      console.log("Audience add failed:", e && e.message);
    }

    // 2) Send the delivery email
    const from = env.FROM_EMAIL || "Kaloyan from PushToGlory <info@pushtoglory.com>";
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your resource is here",
        html: deliveryHtml(env.RESOURCE_NAME, env.RESOURCE_URL),
      }),
    });

    if (!emailRes.ok) {
      const t = await emailRes.text();
      console.log("Email send failed:", emailRes.status, t);
      return json(
        { ok: false, error: "Could not send the email right now. Try again in a minute, or email info@pushtoglory.com and I will send it personally." },
        502,
        origin
      );
    }

    return json({ ok: true }, 200, origin);
  },
};

function deliveryHtml(resourceName, resourceUrl) {
  const name = resourceName || "your free resource";
  const url = resourceUrl || "https://pushtoglory.com";
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background-color:#0b0805;">
  <div style="display:none;max-height:0;overflow:hidden;">Your ${name} is inside. One click and it is yours.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0805;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <tr>
            <td align="center" style="padding:0 0 26px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:4px;color:#d4af52;">PUSHTOGLORY</span><br>
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:5px;color:#b6a583;">AI MARKETING</span>
            </td>
          </tr>

          <tr>
            <td style="background-color:#16100a;border:1px solid #3a2f1a;border-radius:14px;padding:38px 34px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:#f4e0a6;padding-bottom:16px;">
                    Your resource is here
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#d8cbac;padding-bottom:28px;">
                    Thanks for grabbing <b style="color:#f4ead6;">${name}</b>.<br>
                    One click and it is yours:
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:26px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#d9b257;border-radius:8px;">
                          <a href="${url}" target="_blank"
                             style="display:inline-block;padding:15px 44px;font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:2px;font-weight:bold;color:#3a2a08;text-decoration:none;">
                            OPEN THE RESOURCE
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8f8163;padding-bottom:30px;">
                    Button not working? Copy this link:<br>
                    <a href="${url}" style="color:#d4af52;word-break:break-all;">${url}</a>
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #3a2f1a;padding-top:24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#d8cbac;">
                    One more thing. If you would rather have this done for your brand instead of doing it yourself, just reply to this email and tell me what you sell. I read every reply.
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#f4ead6;">
                    Kaloyan<br>
                    <span style="font-size:12px;color:#b6a583;">Founder, PushToGlory</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:24px 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:#6f6450;">
              PushToGlory &middot; AI ad creative for DTC brands &middot; <a href="https://pushtoglory.com" style="color:#8f8163;">pushtoglory.com</a><br>
              You are receiving this because you requested it at pushtoglory.com.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
