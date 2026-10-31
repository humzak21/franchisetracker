# Apple Shortcut: send screenshots to FranchiseTracker

The fastest capture path (FEATURES.md 5.11): pick photos of the TV or console screenshots from the
share sheet, choose what they are and which week, and they land in the inbox already tagged. The
backend reads them straight away; you review and commit on the phone or the Mac.

The Shortcut talks to two HTTP endpoints on the Convex deployment, authenticated by a bearer token
you create in Settings. Tokens are stored hashed and can be revoked at any time.

| Endpoint | Method | What it does |
|---|---|---|
| `<site>/shortcut/targets` | GET | The menu: `targetLabels`, `targetByLabel`, `asksWeekByLabel`, `weekLabels`, `weekByLabel`, `season`, `suggestedWeek` |
| `<site>/shortcut/upload` | POST | Multipart form: one or more `image` files, plus `target`, optional `week`, `season` (year), and `batch` with `batchSize` |

`<site>` is the deployment's site URL (`https://<deployment>.convex.site`). Settings shows the full
upload URL under **Apple Shortcut → Endpoint**; the targets URL is the same with `/targets` in place
of `/upload`.

## 1. Create a token

1. Open FranchiseTracker → **Settings → Apple Shortcut**.
2. Name the token (for example "iPhone") and tap **New token**.
3. Copy the token now. It is shown once; if you lose it, revoke it and make another.

## 2. Build the Shortcut

In the Shortcuts app, create a new shortcut named **Send to FranchiseTracker**. Open its details
(the ⓘ button) and turn on **Show in Share Sheet**, accepting **Images** only. Then add these
actions in order. Text in `code` is typed exactly; `[Token]` is the token from step 1.

1. **Text** → `[Token]`. Rename the variable to `Token`.
2. **Get Contents of URL** → `<site>/shortcut/targets`
   - Method: GET. Headers: `Authorization` = `Bearer ` followed by the `Token` variable.
   - Rename the result to `Menu`.
3. **Get Dictionary Value** → `targetLabels` in `Menu`.
4. **Choose from List** → the dictionary value, prompt `What is this?`.
5. **Get Dictionary Value** → `targetByLabel` in `Menu`, then another **Get Dictionary Value**
   with key = `Chosen Item` from step 4. Rename the result to `Target`.
6. **Get Dictionary Value** → `weekLabels` in `Menu`, then **Choose from List**, prompt `Which week?`.
   (`suggestedWeek` in `Menu` is the week after your latest result if you want to show it in the
   prompt.) Season screens (standings, leaders, season stats, the draft) have no week: before step
   6, add **Get Dictionary Value** → `asksWeekByLabel` in `Menu`, then **Get Dictionary Value** with
   key = `Chosen Item` from step 4, and wrap steps 6 and 7 in **If** that value is `1` (tap the
   variable and set its type to **Number**: a Boolean condition does not save). Or skip the week
   altogether: the endpoint infers it (the next game for a box score, the week just played for
   weekly awards and the injury report).
7. **Get Dictionary Value** → `weekByLabel` in `Menu`, then **Get Dictionary Value** with key =
   `Chosen Item` from step 6. Rename the result to `Week`.
8. **Count** → Items in **Shortcut Input**. Rename the result to `Batch Size`.
9. **Get Random Number** between `100000000` and `999999999`. Rename the result to `Batch`.
10. **Repeat with Each** → **Shortcut Input**, and inside it:
    1. **Resize Image** → **Repeat Item**, by **Longest Edge**, `2048`.
    2. **Convert Image** → the **Resized Image** to **JPEG**, Compression Quality `85%`, Preserve
       Metadata off.
    3. **Get Contents of URL** → `<site>/shortcut/upload`
       - Method: POST. Headers: `Authorization` = `Bearer ` + `Token`.
       - Request Body: **Form**. Add fields:
         - `image` (File) = **Converted Image**
         - `target` (Text) = `Target`
         - `week` (Text) = `Week`
         - `batch` (Text) = `Batch`
         - `batchSize` (Text) = `Batch Size`
11. After **End Repeat**, **Show Notification** → `Sent to FranchiseTracker` (each response is
    `{ "ok": true, "sets": 1, "duplicate": false, "images": 1 }`; `duplicate` is true when the image was
    uploaded before, and it then waits in the inbox rather than being read).

Steps 10.1 and 10.2 matter: the endpoint refuses images over 2 MB. A phone screenshot is a
PNG of several megabytes, and Convex counts every byte again each time the model or the app reads
it (data egress, 1 GB a month on the free plan). Resized and converted it is a few hundred KB, and
the model reads it just as well, since it scales anything bigger down to about this size anyway.

A box score spread across several screens is sent in one go: select all of them in Photos, then
share. A form field in Shortcuts holds only the first of several photos, so step 10 sends one
photo per request, and the shared `batch` tells the endpoint they belong together: they land in
one set, which is read once all `batchSize` screenshots have arrived. The same goes for a list that
needs several screenshots (standings, leaders, a roster, the draft): they are read one by one and
merged into one list, so send the whole batch at once. Screens read one at a time (team game stats)
ignore the batch and become a set each. A batch that is already being read refuses more
screenshots; share again to start a new one.

The menu is generated from the target registry, so a new screen type appears in it without
touching the Shortcut.

To skip the menus, leave out steps 3 to 7 and the `target`, `week` and batch fields: the screenshots arrive
untagged and wait in the inbox for you to tag them.

## 3. Add it to the home screen (optional)

From the shortcut's details choose **Add to Home Screen**. Started from the home screen, Shortcut
Input is empty, so add a **Select Photos** action (Select Multiple on) at the top and use its
result in place of Shortcut Input in steps 8 and 10.

## Share it with your other devices

Shortcuts syncs through iCloud. To keep a copy outside iCloud, use **Share → Copy iCloud Link**
or **Export File** from the shortcut's menu; the token is part of the shortcut, so treat the file
like a password and revoke the token in Settings if it leaks.

## Troubleshooting

| Response | Meaning |
|---|---|
| `401 Invalid or revoked token` | The token is wrong, or it was revoked in Settings. Create a new one. |
| `400 Unknown target` / `Unknown week` | The Shortcut sent a label instead of a key; check steps 5 and 7. |
| `400 Attach between 1 and 20 images` | No photos reached the request, or more than 20. |
| `400 Send batch … with batchSize …` | `batch` is empty or not letters, digits, `-` or `_`, or `batchSize` is not 1 to 20; check steps 8 and 9. |
| `400 The batch holds N screenshots` | More photos arrived under one `batch` than its `batchSize`. |
| `413 Only images up to 2 MB can be imported` | A photo skipped the resize and conversion; check steps 10.1 and 10.2 and that the form's `image` is **Converted Image**. |
| `400 This batch was already read` | A request reused a batch that is complete; each share needs a new random `Batch`. |
| Set shows **Failed** in the inbox | The backend could not read the screenshots; open it to see why and retry. Extraction needs `OPENROUTER_API_KEY` on the deployment. |
