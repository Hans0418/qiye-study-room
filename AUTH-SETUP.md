# Local accounts

Email and phone identifiers support password registration and login. Phone input
accepts E.164 numbers; mainland China numbers may omit +86. Passwords use salted
scrypt hashes. Sessions use random tokens stored as hashes in SQLite and HttpOnly,
SameSite=Strict cookies. Login attempts are limited per IP. Accounts persist in
`.data/accounts.sqlite`, outside the public asset directory and ignored by Git.

This is a local prototype, not verified email/SMS authentication. Identity
ownership is not verified, password recovery is unavailable, and the UI states
these limitations. No SMS or email is sent. Do not collect real users until an
OTP delivery and verification provider is integrated. Browser-local study data
is not associated with accounts and is not synchronized or isolated per account.

Restart `start-local.command` after backend changes. Existing public-host checks
and loopback binding remain in place. Before public deployment, configure HTTPS,
trusted origins, Secure cookies behind a trusted proxy, identity verification,
recovery, and multi-instance rate limiting. Never publish `.data` or `.env`.

Validation: `node --test auth.test.mjs server.test.mjs` (Node 24).
