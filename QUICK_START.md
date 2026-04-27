# Quick Server Testing Guide

## ✅ Server Status
Your backend server is now fully configured and ready to run!

## 🚀 Starting the Server

### Option 1: Using the Batch File (Easiest - Windows)
```bash
Double-click: server/start-server.bat
```

### Option 2: Using Command Line
```bash
cd "c:\Users\andyn\OneDrive\School Work\Computer Engineering\E-Swag App\server"
node index.js
```

### Option 3: Using npm
```bash
cd "c:\Users\andyn\OneDrive\School Work\Computer Engineering\E-Swag App\server"
npm start
```

## 📝 Demo Users Ready
The server will automatically seed these demo users on first startup:

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin (can manage users & credits) |
| `student` | `student123` | Student (can purchase merch) |

## 🧪 Testing the Backend

### 1. Health Check
```bash
curl http://localhost:3000/api/health
```
Expected: Should return 200 OK

### 2. Login as Student
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"student123"}'
```
Expected Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "username": "student",
    "role": "student",
    "credits": 100,
    "displayName": "Student User"
  }
}
```

### 3. Get Current User Info
```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. View All Users (Admin Only)
```bash
curl http://localhost:3000/admin/users \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE"
```

### 5. Make a Purchase
```bash
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"itemId":"tshirt-blue","price":25,"quantity":1}'
```

### 6. Assign Credits (Admin Only)
```bash
curl -X POST http://localhost:3000/admin/users/student/credits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE" \
  -d '{"creditAmount":50}'
```

## 🔗 Environment Configuration

Your `.env` file is configured with:
- **Port**: 3000
- **Region**: us-east-2
- **Table**: ESwagUsers
- **AWS Credentials**: ✅ Configured
- **JWT Secret**: Configured

## 📱 Frontend Testing

Once the server is running, you can test the frontend:

1. Open `E-Swags-App/index.html` in your browser (or use Live Server)
2. Click **Login**
3. Use credentials:
  - Username: `student`
  - Password: `student123`
4. You should see the merch page with your credits

## 🐛 Troubleshooting

### Server won't start
- Ensure Node.js is installed: `node --version`
- Check .env file has AWS credentials
- Verify DynamoDB table exists in AWS (should be named "ESwagUsers" in us-east-2)

### "Could not load credentials" error
- The .env file has your AWS credentials
- Make sure it's in the `server/` directory
- Try restarting the server

### Can't connect to backend from frontend
- Verify server is running on http://localhost:3000
- Check CORS_ORIGINS in .env includes your frontend URL
- Open browser console (F12) to see network errors

## 📚 API Endpoints

All endpoints are documented in `SETUP_AND_TESTING.md` in the Backlogs folder.

## 🎉 Next Steps

1. Start the server using `start-server.bat`
2. Test the API endpoints using curl or Postman
3. Open the frontend and test the full flow
4. When ready to deploy, follow the deployment guide

---
**Server API Base**: http://localhost:3000
**Frontend Base**: http://localhost:5500 (or wherever you open index.html)
