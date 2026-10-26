# Apple Shortcut: send screenshots to FranchiseTracker

The fastest capture path (FEATURES.md 5.11): pick photos of the TV or console screenshots from the
share sheet, choose what they are and which week, and they land in the inbox already tagged. The
backend reads them straight away; you review and commit on the phone or the Mac.

The Shortcut talks to two HTTP endpoints on the Convex deployment, authenticated by a bearer token
you create in Settings. Tokens are stored hashed and can be revoked at any time.

| Endpoint | Method | What it does |
|---|---|---|
| `<site>/shortcut/targets` | GET | The menu: `targetLabels`, `targetByLabel`, `weekLabels`, `weekByLabel`, `season`, `suggestedWeek` |
| `<site>/shortcut/upload` | POST | Multipart form: one or more `image` files, plus `target`, `week`, optional `season` (year) |

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
   prompt.)
7. **Get Dictionary Value** → `weekByLabel` in `Menu`, then **Get Dictionary Value** with key =
   `Chosen Item` from step 6. Rename the result to `Week`.
8. **Get Contents of URL** → `<site>/shortcut/upload`
   - Method: POST. Headers: `Authorization` = `Bearer ` + `Token`.
   - Request Body: **Form**. Add fields:
     - `image` (File) = **Shortcut Input**. Several photos send as several `image` fields.
     - `target` (Text) = `Target`
     - `week` (Text) = `Week`
9. **Show Notification** → `Sent to FranchiseTracker` (the response is `{ "ok": true, "images": N }`).

A box score spread across several screens is sent in one go: select all of them in Photos, then
share. They are grouped into one set and read together.

To skip the menus, leave out steps 3 to 7 and the `target`/`week` fields: the screenshots arrive
untagged and wait in the inbox for you to tag them.

## 3. Add it to the home screen (optional)

From the shortcut's details choose **Add to Home Screen**. Started from the home screen, Shortcut
Input is empty, so add a **Select Photos** action (Select Multiple on) at the top and use its
result for the `image` field instead.

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
| Set shows **Failed** in the inbox | The backend could not read the screenshots; open it to see why and retry. Extraction needs `OPENROUTER_API_KEY` on the deployment. |
