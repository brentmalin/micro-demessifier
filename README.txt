MICRO DEMESSIFIER — VERSION 1

Purpose
-------
Micro Demessifier is a user-controlled front end for messy Microsoft 365 navigation.
It lets each person organize the OneDrive locations, SharePoint sites, document
libraries, folders, Teams areas, and ordinary web pages they actually use.

Current features
----------------
- User-created sections
- User-created shortcuts
- Rename/reorganize the conceptual structure yourself
- Search saved shortcuts
- Recent items
- Import/export layout as JSON
- Installable-web-app foundation
- Desktop and mobile responsive interface

Privacy
-------
This version has no Microsoft login and sends no data anywhere.
The layout is stored in the browser's local storage.

Testing locally
---------------
From this folder:
  python -m http.server 8000

Then visit:
  http://localhost:8000

For normal installation as a PWA on Windows/iPhone, host these files over HTTPS.

Future direction
----------------
A Graph-connected edition could:
- sign in with a work/school Microsoft account
- discover accessible SharePoint sites and libraries
- search OneDrive + SharePoint together
- show actual recent files
- let users pin live files/folders rather than just URLs
- optionally sync the user's Demessifier layout across devices


ICON UPDATE
-----------
Includes:
- apple-touch-icon.png (180x180)
- icon-192.png
- icon-512.png

The manifest and index.html already reference them.
After GitHub Pages republishes, remove the old iPhone Home Screen shortcut
and add the site again so iOS loads the new icon.
