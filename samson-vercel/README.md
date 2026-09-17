# Samson Pest Control website

A fast static website with a small serverless function for the estimate form. Built for Vercel.

```
public/            the website (HTML, CSS, JS, images, fonts)
api/contact.js     emails estimate requests (no dependencies)
vercel.json        routing, redirects from the old site, security headers, caching
```

## Deploy on Vercel (no coding needed)

1. Create a new repository on GitHub (it can be private).
2. On the new repository page, click **uploading an existing file**.
3. Drag in **everything inside this folder**: the `public` folder, the `api` folder, `vercel.json` and `README.md`.
   Dragging folders from Finder or File Explorer into the browser keeps them intact. Click **Commit changes**.
4. In Vercel, click **Add New > Project**, import the repository, leave every setting as it is
   (Framework Preset: Other, no build command), and click **Deploy**.

## Turn on the estimate form

In Vercel open **Project > Settings > Environment Variables**, add these, then **redeploy**:

| Name | Example |
| --- | --- |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | the mailbox that sends the email |
| `SMTP_PASS` | an app password for that mailbox |
| `MAIL_TO` | `vern@samsonpestcontrolpa.com` (default) |

Until these are set the form politely asks visitors to call instead.

## Notes

- `*.vercel.app` addresses send a `noindex` header so the preview never competes with the real domain in Google.
  When you connect `samsonpestcontrolpa.com`, pages are indexable automatically.
- Old WordPress addresses such as `/about-us` and `/resources` redirect to the new pages.
- Vercel's free Hobby plan is for non commercial use. A business site should use a Pro plan.
- Photos are from Pexels (free to use). Replace them with real photos of Samson, the team and the trucks whenever possible.
