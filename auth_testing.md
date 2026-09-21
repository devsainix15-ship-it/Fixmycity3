# Auth Testing Playbook (FixMyCity)

Auth: custom email/password with JWT Bearer tokens (FastAPI + MongoDB). Token returned as `{token, user}` from login/register; frontend stores it in localStorage (`fmc_token`) and sends `Authorization: Bearer <token>`.

## Step 1: MongoDB verification
```
mongosh
use test_database
db.users.find({role: "admin"})
db.users.findOne({role: "admin"}, {password_hash: 1})   # must start with $2b$
db.users.getIndexes()   # unique index on email
```

## Step 2: API testing
```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"prathamgiri2005@gmail.com","password":"admin123"}'
TOKEN=<token from above>
curl $API/api/auth/me -H "Authorization: Bearer $TOKEN"
```
Login returns user object with role; /me returns the same user.

## Accounts
See /app/memory/test_credentials.md. Admin: prathamgiri2005@gmail.com / admin123. Demo citizen: demo@fixmycity.app / demo123. Workers: worker1..4@fixmycity.gov / worker123.
