# Security Best Practices - JustUs

## 🔐 Environment Variables & Secrets

This project uses environment variables to store sensitive information. **NEVER commit actual secrets to Git.**

### Backend Environment Variables

Create a `.env` file in the `backend/` directory (this file is gitignored):

```bash
# Server Configuration
PORT=8080
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/justus

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### Frontend Environment Variables

Create a `.env` file in the `frontend/` directory if needed:

```bash
# API URL
REACT_APP_API_URL=http://localhost:8080

# WebSocket URL
REACT_APP_WS_URL=ws://localhost:8080
```

## 🚫 What's Hidden in .gitignore

The following sensitive files and directories are automatically ignored:

- **Environment files**: `.env`, `.env.local`, `.env.production`, etc.
- **API Keys & Secrets**: Any files in `secrets/`, `config/secrets.js`, etc.
- **Database files**: MongoDB dumps, SQLite databases
- **SSL Certificates**: `*.pem`, `*.key`, `*.cert`, `*.crt`
- **Uploaded files**: User uploads, GridFS storage
- **Cloud provider configs**: AWS, Google Cloud, Azure credentials
- **Node modules**: All `node_modules/` directories
- **Build outputs**: `build/`, `dist/`, `target/`
- **Logs**: All `*.log` files

## ✅ Security Checklist

### Before Deploying to Production:

1. **Change Default Secrets**
   - [ ] Generate a strong, unique `JWT_SECRET` (minimum 32 characters)
   - [ ] Use a production MongoDB URI with authentication
   - [ ] Never use default passwords

2. **Environment Variables**
   - [ ] All secrets moved to environment variables
   - [ ] `.env` file exists but is gitignored
   - [ ] `.env.example` is committed (without actual values)

3. **Database Security**
   - [ ] MongoDB authentication enabled
   - [ ] Strong database passwords
   - [ ] Network access restricted
   - [ ] Regular backups configured

4. **API Security**
   - [ ] CORS properly configured for production domains only
   - [ ] Rate limiting enabled (consider using `express-rate-limit`)
   - [ ] Input validation on all endpoints
   - [ ] SQL/NoSQL injection prevention

5. **File Uploads**
   - [ ] File size limits enforced
   - [ ] File type validation
   - [ ] Sanitize file names
   - [ ] Virus scanning for production

6. **HTTPS/SSL**
   - [ ] SSL certificates configured
   - [ ] All traffic over HTTPS
   - [ ] HTTP to HTTPS redirect
   - [ ] Secure cookies enabled

7. **Dependencies**
   - [ ] Run `npm audit` regularly
   - [ ] Keep dependencies updated
   - [ ] Remove unused packages

## 🔒 Generating Secure Secrets

### Generate a strong JWT secret:

**Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**PowerShell:**
```powershell
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**OpenSSL:**
```bash
openssl rand -hex 64
```

## 📝 Example .env Template

Copy `.env.example` to `.env` and fill in your actual values:

**Backend (.env.example):**
```bash
PORT=8080
MONGODB_URI=mongodb://localhost:27017/justus
JWT_SECRET=CHANGE_THIS_TO_A_RANDOM_STRING_IN_PRODUCTION
JWT_EXPIRES_IN=24h
ALLOWED_ORIGINS=http://localhost:3000
NODE_ENV=development
```

## 🚨 What to Do If Secrets Are Exposed

If you accidentally commit secrets to Git:

1. **Immediately rotate/change the exposed secrets**
2. **Remove from Git history:**
   ```bash
   # Use BFG Repo Cleaner or git filter-branch
   # This is destructive - coordinate with your team
   ```
3. **Force push (if working alone):**
   ```bash
   git push --force
   ```
4. **Notify affected services** (MongoDB Atlas, AWS, etc.)

## 🛡️ Additional Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [MongoDB Security Checklist](https://www.mongodb.com/docs/manual/administration/security-checklist/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

## 📞 Reporting Security Issues

If you discover a security vulnerability, please email: [your-email@example.com]

**Do not** open public GitHub issues for security vulnerabilities.
