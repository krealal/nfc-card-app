# NFC Card API

TypeScript serverless API that powers NFC wristbands/cards. Each wristband encodes a short path like `/abc123`; the API looks up the user and returns a random active message from that user's collection. Admin endpoints let you upsert users and bulk-insert messages. MongoDB is used in cloud.

### Highlights
- TypeScript Lambdas (Node.js 20) behind API Gateway using AWS SAM
- MongoDB persistence with recommended indexes
- Minimal functional handlers and clear types

## Architecture
```mermaid
flowchart LR
  Client[("Phone / Browser / Postman")] -->|HTTP| APIGW["API Gateway"]
  subgraph AWS
    APIGW --> GET["getEntry Lambda"]
    APIGW --> PUTU["adminPutUser Lambda"]
    APIGW --> POSTM["adminPostMessage Lambda"]
    GET --> MDB[("MongoDB (Atlas)")]
    PUTU --> MDB
    POSTM --> MDB
  end
```

Note: An Express server under `src/local` is provided for optional local debugging only. Production traffic always goes through API Gateway + Lambda.

## Data model
- `users` (1 doc per wristband)
```ts
interface IUser {
  id: string;                // path param (/abc123)
  response: "default" | "static" | "redirect" | "json";
}
```
- `messages` (1 doc per message)
```ts
interface IMessageDoc {
  _id?: string;
  userId: string;            // users.id
  messageId?: string;
  category: string;
  text: string;
  active?: boolean;          // default true
  weight?: number;           // reserved for weighted random
}
```

Recommended indexes (run once in Mongo):
```js
// in Mongo shell
// unique path per wristband
db.users.createIndex({ id: 1 }, { unique: true });

// common filters
db.messages.createIndex({ userId: 1, active: 1, category: 1 });
// optional if you use messageId often
db.messages.createIndex({ messageId: 1 });
```

## Environment variables
- `MONGO_URI` (cloud): MongoDB connection string
- `DB_NAME` (cloud): database name (e.g. `nfc`)
- `ADMIN_API_KEY`: required for admin endpoints
- `PORT` (local, optional): Express port (default `3000`)

A starter file is provided: `.env.example`

## Local debugging (optional)
If you want to test handlers locally against your real MongoDB:

```bash
yarn
yarn run:local  # http://localhost:3000
```

Health check: `GET http://localhost:3000/health`

### Example workflow (cURL)
1) Upsert a user
```bash
curl -X PUT "http://localhost:3000/admin/users/abc123" \
  -H "x-api-key: dev" -H "Content-Type: application/json" \
  -d '{"response":"default"}'
# 200 { "id": "abc123", "response": "default" }
```

2) Insert messages (bulk)
```bash
curl -X POST "http://localhost:3000/admin/messages" \
  -H "x-api-key: dev" -H "Content-Type: application/json" \
  -d '[
    {"userId":"abc123","messageId":"m1","category":"motivation","text":"Trust your instinct.","active":true},
    {"userId":"abc123","messageId":"m2","category":"optimism","text":"Today is a good day.","active":true}
  ]'
# 201 { "insertedCount": 2 }
```

3) Get a random message for the wristband
```bash
curl "http://localhost:3000/abc123"
# 200 { "message": {"userId":"abc123","messageId":"m1","category":"motivation","text":"Trust your instinct.","active":true,"weight":1} }
```

Filtered by category:
```bash
curl "http://localhost:3000/abc123?category=optimism"
```

## API Reference
Base URL (cloud): `https://<api-id>.execute-api.<region>.amazonaws.com/prod`

- GET `/:id`
  - Query: `category?` (string)
  - 200 body:
    ```json
    { "message": { "userId":"abc123", "messageId":"m1", "category":"motivation", "text":"...", "active":true, "weight":1 } }
    ```
  - 404 body: `{ "error": "User not found" }` or `{ "error": "No active messages for this user" }`

- PUT `/admin/users/:id`
  - Headers: `x-api-key: <ADMIN_API_KEY>`
  - Body:
    ```json
    { "response": "default" }
    ```
  - 200 body: `{ "id": "abc123", "response": "default" }`
  - 401 body: `{ "error": "Unauthorized" }`

- POST `/admin/messages`
  - Headers: `x-api-key: <ADMIN_API_KEY>`
  - Body (object or array):
    ```json
    [
      { "userId": "abc123", "messageId": "m1", "category": "motivation", "text": "...", "active": true, "weight": 1 }
    ]
    ```
  - 201 body: `{ "insertedCount": 1 }`
  - 400 body (validation): `{ "error": "Fields required: userId, category, text" }`
  - 401 body: `{ "error": "Unauthorized" }`

## Build
```bash
yarn build
# outputs JS to dist/
```

## Deploy (AWS SAM)
Make sure you have the AWS CLI and SAM CLI configured.

### Prerequisites
1. Install AWS CLI and configure credentials
2. Install SAM CLI
3. Ensure you have Node.js and Yarn installed

### Deployment Steps
```bash
# 1. Install dependencies and build TypeScript
yarn install
yarn build

# 2. Build SAM application (packages Lambda functions with dependencies)
sam build

# 3. Deploy
# Option A: First-time guided deploy
sam deploy --guided

# Option B: Quick deploy with parameters
sam deploy --parameter-overrides \
  AdminApiKey=your-secret-key \
  MongoUri="mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority"
```

### Parameters
- **MongoUri**: MongoDB connection string (e.g. `mongodb+srv://...`)
- **DbName**: Database name (default: `nfc`)
- **AdminApiKey**: Choose a strong random value for admin endpoint protection

### Build Process
The build script automatically:
- Compiles TypeScript to JavaScript in `dist/` directory
- Generates a `package.json` with production dependencies (`mongodb`)
- SAM packages Lambda functions with `node_modules` for proper runtime execution

### Important Notes
- SAM automatically installs Node.js dependencies during the build process
- The `dist/` directory contains compiled code and a minimal `package.json` for Lambda runtime
- Dependencies are properly bundled to avoid `Cannot find module` errors in CloudWatch

Output includes the base API URL. Example production requests:
- `GET https://<api-id>.execute-api.<region>.amazonaws.com/prod/{id}`
- `PUT https://<api-id>.execute-api.<region>.amazonaws.com/prod/admin/users/{id}` (with header `x-api-key: <AdminApiKey>`)
- `POST https://<api-id>.execute-api.<region>.amazonaws.com/prod/admin/messages` (with header `x-api-key: <AdminApiKey>`)

## Troubleshooting

### Common Deployment Issues

**"Cannot find module 'mongodb'" in CloudWatch logs**
- Solution: Make sure you run `yarn build` before `sam build` to generate the proper `package.json` in `dist/`
- The build process creates a minimal `package.json` with MongoDB dependency for Lambda runtime

**"Stack is in ROLLBACK_COMPLETE state and cannot be updated"**
- Solution: Delete the failed stack and redeploy
```bash
aws cloudformation delete-stack --stack-name nfc-card-app --region <your-region>
# Wait for deletion to complete, then redeploy
sam deploy --parameter-overrides AdminApiKey=<key> MongoUri="<uri>"
```

**"Parameters: [MongoUri] must have values"**
- Solution: Provide all required parameters during deployment
```bash
sam deploy --parameter-overrides AdminApiKey=<key> MongoUri="<uri>" DbName="nfc"
```

**API Gateway deployment fails with "The REST API doesn't contain any methods"**
- This was a known issue with the SAM template structure that has been fixed
- Make sure you're using the latest version of the template

## Notes
- Random message selection uses `$sample` in Mongo. If a user has very large message sets and you need tighter performance, consider precomputed sampling or a count+skip approach.
- Response kinds `static`, `redirect`, `json` are placeholders for future expansion; today only `default` is implemented.
- Local logs include request lines and Lambda timing. Source maps are enabled for better stack traces.

## Next steps
- Frontend vue4
- ui components library
- backoffice for admin (maybe in frontend? or another service?)
- user management (cognito?)
- more endpoints
  - get all users

