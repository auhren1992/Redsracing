# MailerSend Setup Guide

## Current Status
✅ API key stored in Firebase Secret Manager  
✅ MailerSend SDK installed for Node.js  
✅ MailerSend SDK added to Python requirements  
✅ All email functions updated to use MailerSend  

## Next Steps

### 1. Verify Your Domain in MailerSend

Before emails will work, you need to verify `redsracing.org` with MailerSend:

1. **Log in to MailerSend**: https://app.mailersend.com/
2. **Go to Domains**: Click "Domains" in the left sidebar
3. **Add Domain**: Click "Add Domain" and enter `redsracing.org`
4. **Add DNS Records**: MailerSend will provide DNS records to add:
   - SPF record (TXT)
   - DKIM record (TXT)
   - CNAME for domain verification

5. **Add to Cloudflare DNS**:
   - Log in to Cloudflare
   - Go to your `redsracing.org` domain
   - Add the DNS records provided by MailerSend
   - **Important**: Set DNS records to "DNS only" (gray cloud), not proxied

6. **Verify**: Return to MailerSend and click "Verify Domain"
   - Verification may take a few minutes

### 2. Add Sender Identities

You need to add these sender addresses in MailerSend:
- `feedback@redsracing.org` - For feedback emails
- `sponsorship@redsracing.org` - For sponsorship inquiries
- `newsletter@redsracing.org` - For newsletter and race notifications

**Steps**:
1. In MailerSend, go to "Domains" → select `redsracing.org`
2. Click "Add sender identity"
3. Add each email address listed above

### 3. Deploy Functions

Once domain is verified, deploy the updated functions:

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:handleSendFeedback,functions:handleSendSponsorship
```

### 4. Test Email Functionality

Test each email function:

**Feedback Form**:
- Visit: https://redsracing.org/feedback.html
- Submit a test feedback message
- Check aaron@redsracing.org for the email

**Sponsorship Form**:
- Visit: https://redsracing.org/sponsorships.html  
- Submit a test inquiry
- Check aaron@redsracing.org for the email

## Email Addresses Used

| Function | From Email | From Name | To Email |
|----------|-----------|-----------|----------|
| Feedback | feedback@redsracing.org | Redsracing Feedback | aaron@redsracing.org |
| Sponsorship | sponsorship@redsracing.org | Redsracing Sponsorship | aaron@redsracing.org |
| Newsletter | newsletter@redsracing.org | RedsRacing | subscribers |

## Free Tier Limits

MailerSend Free Tier:
- **12,000 emails/month** forever free
- 24/7 support
- No credit card required

This is much better than SendGrid's 100 emails/day (3,000/month).

## Troubleshooting

### "Domain not verified" errors
- Check that DNS records are added correctly in Cloudflare
- Make sure records are set to "DNS only" (not proxied)
- Wait up to 24 hours for DNS propagation

### "Sender identity not verified"
- Add all sender addresses in MailerSend domain settings
- Each sender must be verified separately

### Emails not sending
- Check Firebase Functions logs: `firebase functions:log`
- Verify MAILERSEND_API_KEY secret is set
- Check MailerSend dashboard for delivery logs

## API Key Location

The API key is stored securely in:
- **Secret Name**: `MAILERSEND_API_KEY`
- **Value**: `mlsn.e4e8040ef5d897a9d6caef5c6dbaacbb46d2f4ce8c63c6a2266371c81bc138c7`
- **Location**: Firebase Secret Manager (Google Cloud)

## Resources

- MailerSend Dashboard: https://app.mailersend.com/
- MailerSend Docs: https://developers.mailersend.com/
- API Reference: https://developers.mailersend.com/api/v1/email
