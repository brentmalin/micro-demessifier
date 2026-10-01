MICRO DEMESSIFIER — VERSION 5 (SUPABASE SYNC)

Purpose
-------
Micro Demessifier is a user-controlled front end for messy Microsoft 365 navigation.
It lets each person organize the OneDrive locations, SharePoint sites, document libraries,
folders, Teams areas, and ordinary web pages they actually use.

Current features
----------------
- User-created sections, folders, and shortcuts
- Custom/automatic icons
- Search saved shortcuts
- Recent items (device-local)
- Import/export layout as JSON
- Installable PWA
- Responsive desktop/mobile interface
- Private cross-device layout sync through Supabase Auth + Row Level Security

Sync behavior
-------------
The layout is always saved in browser localStorage first. If signed in, it is also saved to
Supabase. Signed-in devices check for a newer cloud copy when the app opens, when it regains
focus, and about every 15 seconds. The first signed-in device creates the cloud copy from its
current local layout.

Security
--------
The browser uses only the Supabase project URL and publishable key. Row Level Security restricts
each authenticated user to rows whose user_id matches auth.uid(). Do not use a Supabase secret
or service-role key in this app.
