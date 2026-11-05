# Research Planner

A private planner for research projects: **Project → Goal → Experiments and tasks**, colour-coded by project, with
items shown as time blocks on a calendar you can drag around, a materials list (reagents, equipment, samples), and
one-item-at-a-time export to Google Calendar, Outlook or an `.ics` file.

It is a plain static website (HTML + JavaScript, no build step). Login and data storage use Firebase; the site itself is
hosted on GitHub Pages. Data syncs between your computer and phone and stays readable offline.

## Try it locally first (demo mode)

Until `js/firebase-config.js` is filled in, the site runs in **demo mode**: example data, saved only in that browser.
Adding `?demo` to the address (e.g. `http://localhost:8000/?demo`) forces demo mode even with Firebase set up, so
changes can be tried without touching real data.

```
cd research-planner
python -m http.server 8000
```

Open http://localhost:8000. (Opening `index.html` directly from disk does not work; browsers block JavaScript modules from `file://`.)

## One-time setup

### 1. Create the Firebase project (free Spark plan)

1. Go to https://console.firebase.google.com and click **Create a project**. Any name works. Google Analytics is not needed.
2. **Build → Authentication → Get started**. Under *Sign-in method*, enable **Email/Password**. Optionally also enable **Google**.
3. **Build → Firestore Database → Create database**. Pick a US location (for example `nam5`) and **production mode**.
4. In Firestore, open the **Rules** tab, replace everything with the contents of [`firestore.rules`](firestore.rules), and click **Publish**.
   These rules let each account read and write only its own data.
5. **Project settings** (gear icon) → *General* → *Your apps* → click the **Web** icon (`</>`). Register the app (skip Firebase Hosting).
   Copy the values from the `firebaseConfig` it shows into [`js/firebase-config.js`](js/firebase-config.js).

Don't add a billing account. On the Spark plan Firebase can't charge you; if a free limit is ever reached, that service
pauses until the next month.

### 2. Put the site on GitHub Pages

1. Create a GitHub repository (for example `research-planner`). On a free account it has to be **public** for Pages.
   Only the code is public. Your projects and tasks live in Firebase behind your login, so never type research details into the code files.
2. Upload the contents of this folder to the repository: `index.html`, `styles.css`, `firestore.rules`, `.nojekyll` and the `js` folder.
   (You can drag and drop them on the repository page via **Add file → Upload files**.)
3. In the repository: **Settings → Pages → Build and deployment**: *Deploy from a branch*, branch `main`, folder `/ (root)`. Save.
4. After a minute the site is live at `https://<your-username>.github.io/research-planner/`.

### 3. Allow the GitHub address to sign in

In Firebase: **Authentication → Settings → Authorized domains → Add domain**, and add `<your-username>.github.io`.

### 4. Create your account

Open the site, click **Create an account**, and sign in. Do the same sign-in on your phone. On iPhone you can use
Share → *Add to Home Screen*, and on Android ⋮ → *Add to Home screen*, so it opens like an app.

Other people could also create accounts on the site, but the rules give each account only its own empty planner and no
access to yours. If your Firebase console shows **Authentication → Settings → User actions**, you can also turn off
account creation there once your own account exists.

## Using it

- **Plan**: projects on the left (drag ⠿ to reorder). Each project has milestones (fixed dates such as DARPA deadlines),
  project tasks, and goals (e.g. "Get data for the permutants"). Inside a goal are **experiments** (flask icon) and
  **tasks** (non-experimental work), each with a duration. An experiment has its own reagents, equipment and samples;
  a goal can also hold materials shared by all its items. Drag an item by ⠿ to reorder it, move it to another goal, or drop
  it on another project. Drag a goal by its ⠿ to reorder goals. The **!** button marks an item high priority.
- **Calendar**: the tray holds *Missed* items (scheduled on an earlier day but not ticked off), *Quick tasks* (30 min or
  less), then each project's unscheduled items, high priority first. Drag items onto the calendar; the block height matches
  the duration. Drag a block to move it, drag its bottom edge to change the duration, or drag it back to the tray. Switch
  between Day, 3 days and Week, or click a day's date to open it. Rescheduling a missed item adds to its "slipped" count.
  On a phone, drag with the ⠿ handle; tapping a block opens it.
- **Materials**: reagents and equipment to order, and samples to produce or order, across all projects. An experiment
  shows "waiting" until its materials (and its goal's shared materials) are ready. *Copy order list* copies what to order.
- **Milestones**: link an item to a milestone in its editor ("Counts toward milestone"). The milestone then shows how many
  linked items are unscheduled or scheduled after its date.
- **Export to a calendar**: open a scheduled item and choose Google Calendar, Outlook (your Northeastern Microsoft 365
  account), or Download .ics. If you move it afterwards, the editor reminds you that the calendar copy is out of date.
- **Backup**: the Backup button downloads all your planner data as a JSON file.

## Updating the site

Edit the files and push (or upload) them to the repository again; GitHub Pages republishes within a minute or two.
Browsers may keep the old files for a few minutes; a hard refresh (Ctrl+Shift+R) loads the new version.
