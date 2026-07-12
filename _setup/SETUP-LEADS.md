# PushToGlory lead capture: setup guide

The system: LinkedIn comment -> your DM reply with pushtoglory.com/free-resource -> visitor enters email -> Cloudflare Worker validates it, adds the contact to your Resend Audience and sends the branded delivery email from info@pushtoglory.com.

Everything below is free. Total setup time: about 25 minutes, most of it waiting for DNS.

---

## Step 1: Resend account (email sending + your contact list)

1. Go to resend.com and create a free account.
2. **Verify your domain** (required to send from info@pushtoglory.com):
   - Dashboard -> Domains -> Add Domain -> enter `pushtoglory.com`.
   - Resend shows you 3 DNS records (SPF and DKIM). Add them wherever your domain DNS is managed (the place you set up the GitHub Pages records).
   - Click Verify. Usually done in minutes, can take up to an hour.
3. **Create an API key**: Dashboard -> API Keys -> Create. Full access or "Sending access" is fine. Copy it somewhere safe, it starts with `re_` and is shown only once.
4. **Get your Audience ID**: Dashboard -> Audiences. A "General" audience already exists. Open it and copy the Audience ID from the page (a UUID like `78261eea-...`).

Free tier limits worth knowing: 100 emails per day, 3,000 per month, 1,000 contacts. If a post goes viral you may hit the daily 100. The paid tier is $20/month if that day comes.

## Step 2: Cloudflare Worker (the backend endpoint)

1. Go to cloudflare.com and create a free account (no domain needed).
2. Workers & Pages -> Create -> Create Worker.
3. Name it `pushtoglory-leads`, click Deploy (it deploys a hello-world first).
4. Click "Edit code", delete everything, paste the full contents of `_setup/worker.js`, click Deploy.
5. Go to the Worker's **Settings -> Variables and Secrets** and add:
   | Name | Type | Value |
   |---|---|---|
   | `RESEND_API_KEY` | Secret | your `re_...` key |
   | `RESEND_AUDIENCE_ID` | Secret | the Audience ID from Step 1.4 |
   | `RESOURCE_URL` | Text | link to your Google Doc or PDF |
   | `RESOURCE_NAME` | Text | e.g. `The AI UGC Ad System` |
6. Copy your Worker URL. It looks like `https://pushtoglory-leads.YOURNAME.workers.dev`.

Resource not ready yet? Set `RESOURCE_URL` and `RESOURCE_NAME` to anything for now and update them the day you launch. Everything else can be fully set up and tested in the meantime.

The API key and Audience ID live only here, server-side. They never appear in the page code.

## Step 3: Connect the page

Done. The page is wired to:
```
https://pushtoglory-leads.peshopetrv06.workers.dev
```
If the Worker is ever renamed or recreated, update the `API_URL` line near the bottom of `free-resource/index.html`.

## Step 4: Publish

1. Save your headshot as `kaloyan.jpg` in the site root, right next to `logo.png`. The about card shows a gold K monogram until this file exists, so the page works either way.
2. Upload the new `free-resource` folder, `kaloyan.jpg` and the updated `index.html` to your GitHub repo the same way you update the rest of the site.
3. The `_setup` folder is not published by GitHub Pages (folders starting with `_` are skipped), so the worker source and this guide stay out of the live site.
4. The page is live at `https://pushtoglory.com/free-resource/`.

## Step 5: Test end to end

1. Open the live page, submit your own email.
2. You should see the success state, and within a minute receive "Your resource is here" from info@pushtoglory.com.
3. Check Resend -> Audiences: your email is in the list.
4. Send a test from a second email (a friend's or a secondary inbox) to be sure.

## Running a new campaign later

Different post, different resource? Change only two things in the Worker settings: `RESOURCE_URL` and `RESOURCE_NAME`. No code changes, no redeploys of the site.

## Sending broadcasts later

Resend -> Broadcasts lets you write and send campaigns to the Audience this system fills. Unsubscribe links are handled by Resend automatically in broadcasts.
