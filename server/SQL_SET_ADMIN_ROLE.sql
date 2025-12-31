-- Promote an existing user to admin
-- Replace the email/username below with your account.

-- Option 1: by username (often email)
UPDATE users
SET role = 'admin'
WHERE username = 'rafiils120@gmail.com';

-- Option 2: by email (if you store it)
-- UPDATE users
-- SET role = 'admin'
-- WHERE email = 'YOUR_EMAIL_HERE';

-- Verify (keep it compatible: some DBs don't have email_verified/profile_completed/email columns)
SELECT id, username, role, created_at
FROM users
WHERE username = 'rafiils120@gmail.com';


