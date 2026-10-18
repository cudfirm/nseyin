# How to finish setting up NSEYIN (easy steps)

**Read this first**

- Your website already looks finished. You can open it at **https://nseyin.netlify.app**.
- But the **Book a session** form cannot save anything yet. It needs a place to keep the bookings, and a way to send emails.
- This guide shows you how to add those, one small step at a time.
- Do the parts **in order**. Do not skip ahead. Take a break between parts if you like.
- When you see a grey box, that is something to **copy and paste**.
- Stuck? Stop and ask for help. Nothing here can break your website forever.

**The 6 parts**

| Part | What you do | About how long |
|---|---|---|
| 1 | Put the new website files on GitHub | 15 minutes |
| 2 | Make a "bookings box" (Supabase) | 20 minutes |
| 3 | Get an "email sender" (Resend) | 10 minutes |
| 4 | Connect the form to the bookings box | 25 minutes |
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

This part uses a **terminal**. A terminal is a window where you type a command and press Enter. Go slowly. Copy and paste every command exactly.

**A. Get the helper program**

1. Go to **nodejs.org**. Click the big **LTS** button. Install it. Click "Next" until it finishes.
2. Open your `nseyin-site` folder.
3. **On Windows:** click the address bar at the top of the folder window, type `cmd`, and press Enter. A black window opens.
   **On a Mac:** right-click the folder and choose **New Terminal at Folder**.

**B. Log in to Supabase from the terminal**

Paste this and press Enter:

```
npx supabase login
```

If it asks "Ok to proceed?", type `y` and press Enter. A web page opens. Click to allow it.

**C. Tell the terminal which box to use**

Paste this. **Change `CODE` to your project code** from Part 2, step F. Press Enter:

```
npx supabase link --project-ref CODE
```

If it asks for the database password, type the one you wrote on paper.

**D. Send the two form helpers to Supabase**

Paste this and press Enter. Wait until it finishes:

```
npx supabase functions deploy submit-booking
```

Then paste this and press Enter:

```
npx supabase functions deploy submit-contact
```

✅ **You did it if** each one says **Deployed**.

**E. Give the helpers their secret settings**

1. Go back to the Supabase website.
2. On the left side, click **Edge Functions**.
3. Click **Secrets** (you may see it at the top, or in a menu).
4. Add these **six** secrets, one at a time. Each has a **name** and a **value**. Type the name **exactly** like below, in capital letters:

| Name | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://nseyin.netlify.app` |
| `RATE_LIMIT_SALT` | Mash your keyboard to type 30 or more random letters and numbers |
| `RESEND_API_KEY` | Your **EMAIL KEY** (starts with `re_`) |
| `EMAIL_FROM` | `NSEYIN <onboarding@resend.dev>` |
| `NOTIFY_EMAIL_TO` | `utibedc@gmail.com` |
| `ADMIN_URL` | `https://nseyin.netlify.app/admin/` |

5. Click **Save** after you add them.

**F. Tell your website where the bookings box is**

1. Go to **GitHub**. Open your NSEYIN repository.
2. Open the folder `js`. Click the file `config.js`.
3. Click the **pencil** ✏️ (Edit this file).
4. **Delete everything.** Paste this. **Change `CODE` and `KEY`** to the ones in your note:

```js
window.NSEYIN_CONFIG = {
  supabaseUrl: "https://CODE.supabase.co",
  bookingEndpoint: "https://CODE.supabase.co/functions/v1/submit-booking",
  contactEndpoint: "https://CODE.supabase.co/functions/v1/submit-contact",
  supabaseAnonKey: "KEY"
};
```

   Keep the quote marks `" "`. Only change the words `CODE` and `KEY`.

5. Click **Commit changes**, then **Commit changes** again.
6. Wait 1 or 2 minutes for Netlify to update.

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
- *The form says it could not send* → check `ALLOWED_ORIGINS` is exactly `https://nseyin.netlify.app` with no space and no slash at the end.
- *No email* → check **Spam**. Then check the `RESEND_API_KEY` secret.
- *Cannot log in* → check the email and password from Part 2, step D.

---

## Part 6 — Fill in the missing facts

Some words on the website are in **yellow boxes** that say **"to be confirmed"**. These are things I did not want to guess.

**The easiest way:** send me the facts and I will put them in for you.

I need:
- ⏱ How long each massage takes
- 💰 The price of each massage
- 🕘 Your opening hours
- 📍 Your full address (or the areas where you work)
- 🧥 What clients should wear or bring
- 💳 How clients pay
- 🔁 What happens if a client cancels or is late
- ⏳ How fast you usually reply

---

## Using the staff page every day

Go to **https://nseyin.netlify.app/admin/** and log in.

1. A new booking appears in **New requests**.
2. Click it. Contact the client (email, call, or the **WhatsApp** button).
3. Change the status to **Contacted**.
4. When you both agree on a time, type the date and time, then choose **Confirmed**. Click **Save booking**.
5. After the massage, choose **Completed**.

Every change is saved with the date. The staff page logs you out by itself after 30 minutes. This is to keep client information safe.

---

## Later (when you are ready)

- **Customer emails:** buy a website name, then tell me.
- **Paystack payments:** tell me your prices first. The easiest start is to send clients a Paystack payment link after you confirm their time.
- **Counting visitors:** the best free choice is **Umami**. Tell me when you have signed up. I will add it.
- **Legal words:** the page called **Policies** was written as a first draft. Please ask a lawyer to read it before you promote the website.
- **Costs:** Supabase and Resend are free to start. When the business grows, Supabase may cost about $25 a month. Check their pricing pages.

*(Developers: the old technical notes are in `docs/TECHNICAL.md`.)*
