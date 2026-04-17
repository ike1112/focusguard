# FocusGuard — Force-Install via Group Policy

This guide installs FocusGuard so that Chrome shows "Installed by your
administrator" — your child cannot disable or remove the extension
without admin rights on the computer.

It assumes you are the admin (main account) and your child uses a
standard/limited account on the same machine.

## Overview

1. Package FocusGuard as a .crx file (signed with your private key).
2. Host the .crx somewhere the machine can read (local folder works).
3. Tell Chrome, via policy, to force-install the extension.

---

## Step 1 — Package the extension

1. Open Chrome → `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click **Pack extension**.
4. Set **Extension root directory** to the `focusguard/` folder.
5. Leave **Private key file** blank the first time. Click **Pack**.
6. Chrome creates:
   - `focusguard.crx` (the packaged extension)
   - `focusguard.pem` (your private key — keep this safe; you'll need
     it for future updates)
7. Save both to a folder only your admin account can access,
   for example `C:\FocusGuard\` (Windows) or `~/FocusGuard/` (macOS/Linux).

> Tip: note the extension ID shown on `chrome://extensions` for the
> unpacked version. You'll need it below. It's a 32-char string like
> `abcdefghijklmnopabcdefghijklmnop`.

---

## Step 2A — Windows: Install via Group Policy

### Prerequisites (one-time)

1. Download the Chrome Enterprise policy bundle:
   https://chromeenterprise.google/browser/download/
   (look for "Bundle" under Windows, ZIP file).
2. Extract the ZIP. Copy `policy_templates/windows/admx/chrome.admx`
   into `C:\Windows\PolicyDefinitions\` and the matching
   `en-US/chrome.adml` into `C:\Windows\PolicyDefinitions\en-US\`.
3. Open **Local Group Policy Editor**: Win+R → `gpedit.msc`.

### Force-install FocusGuard

1. Navigate to **Computer Configuration → Administrative Templates →
   Google → Google Chrome → Extensions**.
2. Double-click **Configure the list of force-installed apps and
   extensions** → **Enabled**.
3. Click **Show…** and add an entry of the form:
   ```
   <EXTENSION_ID>;file:///C:/FocusGuard/focusguard.crx
   ```
   Replace `<EXTENSION_ID>` with the 32-char ID from Step 1.
4. Click **OK**, **Apply**.
5. Open a command prompt as admin and run `gpupdate /force`.
6. Restart Chrome. Visit `chrome://extensions` — FocusGuard should
   show "Installed by your administrator" and the **Remove** /
   **Disable** buttons are gone.

### Optional: block the child from disabling developer mode

Under the same Extensions folder:
- **Configure extension installation blocklist**: value `*`
- **Configure extension installation allowlist**: add your
  `<EXTENSION_ID>`

This prevents installing any other extension that might interfere.

---

## Step 2B — macOS: Install via `defaults`

1. Save the following as `~/focusguard-policy.plist`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
     <dict>
       <key>ExtensionInstallForcelist</key>
       <array>
         <string><EXTENSION_ID>;file:///Users/YOU/FocusGuard/focusguard.crx</string>
       </array>
     </dict>
   </plist>
   ```
   Replace `<EXTENSION_ID>` and the file path.
2. Apply it:
   ```bash
   sudo cp ~/focusguard-policy.plist /Library/Managed\ Preferences/com.google.Chrome.plist
   sudo chown root:wheel /Library/Managed\ Preferences/com.google.Chrome.plist
   ```
3. Quit and restart Chrome. Confirm at `chrome://policy` and
   `chrome://extensions`.

---

## Step 2C — Linux: Install via JSON policy

1. Create `/etc/opt/chrome/policies/managed/focusguard.json`:
   ```json
   {
     "ExtensionInstallForcelist": [
       "<EXTENSION_ID>;file:///home/you/FocusGuard/focusguard.crx"
     ]
   }
   ```
2. `sudo chown root:root` and restart Chrome.
3. Confirm at `chrome://policy`.

---

## Updating FocusGuard

1. Edit files in `focusguard/` (or replace with a new version).
2. Bump `version` in `manifest.json`.
3. Pack again — this time, provide the existing `focusguard.pem` as
   the private key so the extension ID stays the same.
4. Overwrite `focusguard.crx` at the path referenced in the policy.
5. Chrome re-installs on next launch.

---

## Troubleshooting

- **"Extension not loading"** on `chrome://extensions`: the CRX file
  path in the policy must be `file:///` absolute and accessible to
  all users. On Windows, paths use forward slashes inside `file:///`.
- **"Installed by administrator" doesn't appear**: run `chrome://policy`
  and click **Reload policies**. If the policy still isn't picked up,
  confirm policy location (Windows registry key
  `HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist`).
- **Want to remove FocusGuard later**: reverse the policy entry,
  `gpupdate /force` (Windows) or restart Chrome (macOS/Linux).

---

## Limitations

- Forced-install prevents your child from *disabling* the extension,
  but it does NOT prevent them from opening Chrome DevTools on a
  page and removing the overlay manually. See
  `focusguard/SECURITY.md` for the full threat model.
- A sufficiently motivated user with admin rights to the machine
  can remove the policy. Make sure your child doesn't have admin.
