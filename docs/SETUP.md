# How to finish setting up NSEYIN (easy steps)

**Read this first**

- Your website already looks finished. You can open it at **https://nseyin.netlify.app**.
- But the **Book a session** form cannot save anything yet. It needs a place to keep the bookings, and a way to send emails.
- This guide shows you how to add those, one small step at a time.
- Do the parts **in order**. Do not skip ahead. Take a break between parts if you like.
- When you see a grey box, that is something to **copy and paste**.
- Stuck? Stop and ask for help. Nothing here can break your website forever.

**⚡ Already started? Read this box first. Do NOT start over.**

Parts 1 and 2 are for people doing this for the first time. If you have already done the things below, **skip them**. Do not sign up again, do not make a new project, and do not run `001_init.sql` again.

| Already done (skip) | What is still left (do this) |
|---|---|
| ✅ Supabase account and the `nseyin` project | ➡️ Part 2, **step B2**: run `002_session_details.sql` (once) |
| ✅ Running `001_init.sql` | ➡️ Part 2, **step B3**: turn on `pg_cron` and run `003_daily_cleanup.sql` (once) |
| ✅ Turning sign-ups off | ➡️ Part 3: Resend email key |
| ✅ Your login user and the owner step | ➡️ Part 4: the two helpers, the six secrets (`config.js` already holds your Supabase address and key) |
| ✅ Copying the URL and key | ➡️ Part 5: try it out |

**Is it a problem to run 001 twice?** Yes. It would stop with an error such as "already exists", because the shelves are already built. It would not erase your data, but there is no reason to run it again. If you see that error, you ran the wrong file. Check you are pasting `002` or `003`.

**The 6 parts**

| Part | What you do | About how long |
|---|---|---|
| 1 | Put the new website files on GitHub | 15 minutes |
| 2 | Make a "bookings box" (Supabase) | 20 minutes |
| 3 | Get an "email sender" (Resend) | 10 minutes |
| 4 | Connect the form to the bookings box (copy and paste only) | 20 minutes |
| 5 | Try it out | 10 minutes |
| 6 | Fill in the missing facts (prices and more) | when you are ready |

---

## Part 1 — Put the new files on GitHub

GitHub is where your website files live. Netlify watches GitHub. When GitHub changes, Netlify updates your website by itself.

1. Find the **zip file** you downloaded (`nseyin-site.zip`).
2. **Unzip it.** (Right-click the file, then choose "Extract" or "Unzip".) You will get a folder called `nseyin-site`.
3. Open your browser and go to **github.com**. Log in.
4. Open the **repository** (the folder on GitHub) that holds your NSEYIN website.
5. Click **Add file**, then click **Upload files**.
6. Open your `nseyin-site` folder on your computer. **Select everything inside it** and drag it into the GitHub page.
   - Drag what is *inside* the folder, not the folder itself.
   - Wait until all the files finish loading.
7. Scroll down. In the box, type: `New NSEYIN website`
8. Click the green **Commit changes** button.

Now clean up the old files. These belong to the old version of the website. You can delete them:

`about.html`, `booking.html`, `contact.html`, `faq.html`, `privacy.html`, `services.html`, `terms.html`, `css/styles.css`, `js/main.js`

To delete one file:
1. Click the file's name on GitHub.
2. Click the **three dots** at the top right.
3. Click **Delete file**.
4. Click **Commit changes**.

(If a file in the list is not there, that is fine. Skip it.)

9. Wait **1 or 2 minutes**. Then open **https://nseyin.netlify.app**.

✅ **You did it if** you see the new green and cream design with the words **Mindfulness & Service**.

⚠️ **Keep Vercel quiet.** Netlify is your public website. Do not share the Vercel link. If you want, you can delete the project on Vercel. Two copies of one website can confuse Google.

---

## Part 2 — Make the bookings box (Supabase)

Supabase is a safe box on the internet. It keeps every booking and every message.

**A. Make an account and a box**

1. Go to **supabase.com**. Click **Start your project**. Sign up.
2. Click **New project**.
3. Name it `nseyin`.
4. Make a **database password**. Make it long. **Write it down on paper.** Keep it safe.
5. Pick the region **closest to Nigeria** that you can find (for example, Europe).
6. Click **Create new project**. Wait a few minutes until it says it is ready.

**B. Build the shelves inside the box**

1. On the left side, click **SQL Editor**. (It looks like `>_`.)
2. Click **New query**.
3. On your computer, open the file `supabase/migrations/001_init.sql` from your `nseyin-site` folder. Use Notepad or any text app.
4. **Select all** the words (Ctrl + A, or Cmd + A on a Mac). **Copy** them.
5. **Paste** them into the Supabase page.
6. Click the green **Run** button.

✅ **You did it if** it says **Success**.

**B2. Add the second set of shelves (new — do this even if you already did B)**

This adds the "how long" and "where" answers to the bookings box.

1. Click **SQL Editor**, then **New query**.
2. Open the file `supabase/migrations/002_session_details.sql` from your `nseyin-site` folder in Notepad.
3. Select all (Ctrl + A), copy (Ctrl + C), and paste (Ctrl + V) into Supabase.
4. Click **Run**.

✅ **You did it if** it says **Success**.

**B3. Turn on the daily clean-up (new)**

This deletes old records by itself, so you do not have to. Contact messages and requests that never became a session are deleted after 30 days. People who had a session are deleted 12 months after it.

1. On the left side, click **Database**, then **Extensions**.
2. Search for `pg_cron`. Turn it **ON**.
3. Click **SQL Editor**, then **New query**.
4. Open `supabase/migrations/003_daily_cleanup.sql` in Notepad. Copy everything. Paste it into Supabase.
5. Click **Run**.

✅ **You did it if** it says **Success**. If it says "pg_cron is not enabled", do steps 1 and 2 again, then run it once more.

**C. Lock the front door so strangers cannot make accounts**

1. On the left side, click **Authentication**.
2. Look for **Sign In / Providers** (or **Providers**). Click **Email**.
3. Find the switch called **Allow new users to sign up**. Turn it **OFF**.
4. Click **Save**.

**D. Make your own login for the staff page**

1. Still under **Authentication**, click **Users**.
2. Click **Add user**, then **Create new user**.
3. Email: `utibedc@gmail.com`
4. Password: make a strong one. **Write it down on paper.**
5. Tick the box that says **Auto Confirm User**.
6. Click **Create user**.

**E. Make yourself the boss ("owner")**

1. Go back to **SQL Editor**. Click **New query**.
2. Copy and paste this:

```sql
insert into staff (user_id, role, display_name)
select id, 'owner', 'Nseyin' from auth.users where email = 'utibedc@gmail.com';
```

3. Click **Run**.

✅ **You did it if** it says **Success**. (If it says "0 rows", the email in step D was typed differently. Check it.)

**F. Copy two things. You need them later.**

1. On the left side, click the **gear** (Project Settings), then **API** (or **API Keys**).
2. Find **Project URL**. It looks like `https://abcdefgh.supabase.co`. Copy it into a note on your phone or computer. Call it **URL**.
3. Find the key called **anon** (it may say **public** or **publishable**). It is a very long line of letters. Copy it into the same note. Call it **KEY**.
4. The first part of your URL, before `.supabase.co`, is your **project code**. In the example, it is `abcdefgh`. Write it down. Call it **CODE**.

🚫 **Never** copy the key called **service_role**. It is a secret. It never goes on your website.

---

## Part 3 — Get an email sender (Resend)

Resend sends the emails. It tells you when someone books.

1. Go to **resend.com**. Sign up with **utibedc@gmail.com**.
2. Click **API Keys**, then **Create API Key**.
3. Name it `nseyin`. Choose **Sending access**. Click **Add**.
4. **Copy the key now.** It starts with `re_`. Resend will not show it again. Put it in your note. Call it **EMAIL KEY**.

**Good to know about customer emails**

- For now, emails will be sent from a test address: `onboarding@resend.dev`.
- With the test address, **you will get an email** every time someone books. 🎉
- But your **customers will not get a "thank you" email.** That is okay for now. Their booking is still saved.
- To let customers get emails too, you need your **own website name** (like `nseyin.com`). It costs about $10 to $15 a year. When you buy one, tell me. I will give you the next steps.

---

## Part 4 — Connect the form to the bookings box

No terminal and no installing. You will **copy and paste** two files into Supabase, then paste three lines into your website.

Open your `nseyin-site` folder (the one you unzipped). Inside it, open the folder `supabase`, then the folder **`paste-into-dashboard`**. It holds two files:

- `submit-booking.ts`
- `submit-contact.ts`

You can open them with **Notepad** (right-click the file, choose **Open with**, then **Notepad**).

### Part 4A — Add the booking helper

1. Go to **supabase.com** and open your `nseyin` project.
2. On the left side, click **Edge Functions**. (The icon looks like a lightning bolt ⚡.)
3. Click **Deploy a new function**. Then choose **Via Editor**.
4. You will see a box with some example words. **Delete all of them.**
   (Click inside the box, press Ctrl + A, then press Delete.)
5. Open `submit-booking.ts` in Notepad. Press **Ctrl + A** to select everything. Press **Ctrl + C** to copy.
6. Click inside the Supabase box. Press **Ctrl + V** to paste.
7. Find the **name** of the function. It may be at the top, or the page may let you rename it. Make the name exactly:

```
submit-booking
```

   Small letters. A dash in the middle. No spaces.

8. Click **Deploy function** (a green button).
9. Wait until it says it worked.

✅ **You did it if** you see `submit-booking` in your list of functions.

### Part 4B — Add the contact helper

Do the same thing again with the second file.

1. Click **Deploy a new function**, then **Via Editor**.
2. Delete the example words.
3. Open `submit-contact.ts` in Notepad. Press Ctrl + A, then Ctrl + C.
4. Paste it in the Supabase box (Ctrl + V).
5. Name it exactly:

```
submit-contact
```

6. Click **Deploy function**.

✅ **You did it if** you now see **two** functions: `submit-booking` and `submit-contact`.

### Part 4C — Open the door for visitors

Visitors are not logged in. So we tell Supabase to let them use these two helpers. Do this for **each** of the two functions.

1. Click the function's name in the list.
2. Look for **Settings** (or **Details**). Find the switch called **Verify JWT** (it may say **Enforce JWT verification**).
3. Turn it **OFF**.
4. Click **Save**.

(If you cannot find the switch, skip this step. It may still work. We will find out in Part 5.)

### Part 4D — Give the helpers their secret settings

1. Still in **Edge Functions**, click **Secrets** (at the top, or in the side menu).
2. Click **Add new secret**.
3. Type a **name** and a **value**. Then save. Do this **six times**, one for each row:

| Name (type exactly, capital letters) | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://nseyin.netlify.app` |
| `RATE_LIMIT_SALT` | Mash your keyboard: type 30 or more random letters and numbers |
| `RESEND_API_KEY` | Your **EMAIL KEY** from Part 3 (it starts with `re_`) |
| `EMAIL_FROM` | `NSEYIN <onboarding@resend.dev>` |
| `NOTIFY_EMAIL_TO` | The email where you want booking alerts (for example `utibedc@gmail.com`) |
| `ADMIN_URL` | `https://nseyin.netlify.app/admin/` |

✅ **You did it if** you see six secrets in the list.

### Part 4E — Tell your website where the bookings box is

1. Go to **github.com**. Open your NSEYIN repository.
2. Open the folder `js`. Click the file `config.js`.
3. Click the **pencil** ✏️ (Edit this file).
4. **Delete everything** in the box.
5. Paste this. Then change **three things**:
   - Change `YOURCODE` (3 places) to your project code. Yours is `nnwpsbtjagnmuzanpdnr`.
   - Change `YOURKEY` to your **anon** (or **publishable**) key from Part 2, step F.

```js
window.NSEYIN_CONFIG = {
  supabaseUrl: "https://YOURCODE.supabase.co",
  bookingEndpoint: "https://YOURCODE.supabase.co/functions/v1/submit-booking",
  contactEndpoint: "https://YOURCODE.supabase.co/functions/v1/submit-contact",
  supabaseAnonKey: "YOURKEY"
};
```

6. Keep all the quote marks `" "`.
7. Click **Commit changes**. Click **Commit changes** again.
8. Wait 1 or 2 minutes. Netlify updates your website by itself.

---

## Part 5 — Try it out

**Test 1: send a booking**

1. Open **https://nseyin.netlify.app**.
2. Click **Book a Session**. Fill in the form. Use **your own** name and number.
3. Press **Send request**.

✅ **You did it if** you see **"Thank you — your request has been received"** and a reference code like `NSY-12345`.

**Test 2: check your email**

1. Open the email for **utibedc@gmail.com**.
2. Look for a new email about the booking. If you do not see it, look in **Spam**.

**Test 3: log in to the staff page**

1. Go to **https://nseyin.netlify.app/admin/**
2. Log in with `utibedc@gmail.com` and the password you wrote down.
3. You should see your test booking.
4. Click it. You will see a green button, **Message on WhatsApp**. It opens WhatsApp with a hello message ready. You press send yourself.

**Test 4: send a message from the Contact box** at the bottom of the website. Check that it shows up on the staff page under **Messages**.

❌ **Something did not work?**

- *"Online booking is not switched on yet"* → Part 4, step F was not saved. Check `config.js`.
- *The form says it could not send* → go back to Part 4C and turn **Verify JWT** off for both helpers. Then check `ALLOWED_ORIGINS` is exactly `https://nseyin.netlify.app` with no space and no slash at the end.
- *No email* → check **Spam**. Then check the `RESEND_API_KEY` secret.
- *Cannot log in* → check the email and password from Part 2, step D.

---

## Part 6 — The facts on the website

All of these are already on the website. Nothing to do here unless something changes:

- ⏱ **Lengths:** 30 minutes, 1 hour, or a custom length (15 minutes or more)
- 💰 **Prices:** Swedish and Shiatsu ₦5,000 / ₦8,000. Deep Tissue ₦8,000 / ₦12,000. Sports ₦10,000 / ₦14,000
- 🕘 **Hours:** Monday to Friday 6am–9am and 6pm–8pm. Saturday 6am–11am and 6pm–10pm. Sunday 6am–10pm
- 📍 **Where:** the workspace in Boundary, Ajegunle, Home service, and Private suites
- 💳 **Payment:** bank transfer or cash, after the appointment is confirmed
- 🤝 **Deposit:** 30% for Home service, Private suites and custom lengths. None for the workspace
- 🔁 **Cancelling:** free with 12 hours' notice. Under 12 hours or a no-show: 30% fee. Late by 15 minutes: session is shortened
- 🗑 **Records:** requests and messages deleted after 30 days. Clients with a session: 12 months
- ⏳ **Reply time:** within 24 hours

**To change a price, hour or rule later:** tell me the new number or words. (Developers: the numbers are at the top of the page-builder script. See `docs/TECHNICAL.md`.)

---

## Using the staff page every day

Go to **https://nseyin.netlify.app/admin/** and log in.

1. A new booking appears in **New requests**.
2. Click it. Contact the client (email, call, or the **WhatsApp** button).
3. Change the status to **Contacted**.
4. When you both agree on a time, type the date and time, then choose **Confirmed**. Click **Save booking**.
5. After the massage, choose **Completed**.

**Two clients want the same time?** The website does not hold a time for anyone until you confirm it. Only **Confirmed** bookings block a time.

- When you open a booking, a box called **Same day** lists everyone else on that date. Look at it before you agree a time.
- If you press **Save booking** with **Confirmed** and the time is too close to another confirmed booking, the page asks: *"This time clashes… Confirm anyway?"* Press **Cancel** and pick another time. The page leaves 15 minutes between sessions at your workspace and 30 minutes for home visits and private suites, for rest and travel.
- Simple rule: **the first person you confirm gets the time.** Message the other person on WhatsApp and offer a different time.
- A custom length is counted as 1 hour for this check.

**Put it in your calendar.** Once a booking is **Confirmed** with a time, two buttons appear: **Add to Google Calendar** (opens Google Calendar with everything filled in; you just press Save) and **Download .ics** (works with Apple, Outlook and others). These do not connect to your Google account, so nothing is shared.

Every change is saved with the date. **Do not type health details in the notes box.** Only write things like: called, no answer. The staff page logs you out by itself after 30 minutes. This is to keep client information safe.

---

## Optional: count visitors with Google Analytics

You can skip this. The website works the same without it.

1. Go to **analytics.google.com** and sign in with your Google account.
2. Press **Start measuring** (or **Admin**, then **Create**, then **Property**). Name it **NSEYIN**. Choose time zone **Nigeria** and currency **Naira**. Press **Next** until it is created.
3. When it asks what to set up, choose **Web**. Type **https://nseyin.netlify.app** and the name **NSEYIN**. Leave the other boxes as they are. Press **Create stream**.
4. You will see a **Measurement ID** that starts with **G-** (for example G-ABC123XYZ). Copy it.
5. On your computer, open the file **js/config.js** in Notepad. Find the line `gaMeasurementId: "",`. Put your ID between the quotes: `gaMeasurementId: "G-ABC123XYZ",`. Save the file.
6. Upload the changed file to GitHub like you did in Part 1. Wait for Netlify to update.
7. Open your website. A small box asks about counting visits. Press **Accept**. Then open Analytics and look at **Reports, Realtime**. You should see yourself within a minute.

How it behaves: nothing is counted unless a visitor presses **Accept**. **Decline** means nothing is counted. A visitor can change their mind with **Cookie choices** at the bottom of the page. Booking details are never sent to Google. The page counts only that a booking request or message was sent.

---

## Later (when you are ready)

- **Customer emails:** buy a website name, then tell me.
- **Paystack payments:** tell me your prices first. The easiest start is to send clients a Paystack payment link after you confirm their time.
- **Counting visitors:** this is optional. You do not need it to run the business. If you want it, follow **Optional: count visitors with Google Analytics** below.
- **Google Calendar that fills itself in:** later we can connect your Google account so confirmed bookings appear in your calendar by themselves. This needs a free Google Cloud project and extra setup. Tell me if you want it.
- **Legal words:** the page called **Policies** was written as a first draft. Please ask a lawyer to read it before you promote the website.
- **Costs:** Supabase and Resend are free to start. When the business grows, Supabase may cost about $25 a month. Check their pricing pages.

*(Developers: the old technical notes are in `docs/TECHNICAL.md`.)*
