# Slack App Setup

1. Create a Slack app from scratch and add these scopes:
- `chat:write`
- `commands`
- `channels:history`

2. Configure slash command:
- Command: `/money`
- Request URL: `https://<api-domain>/api/slack/commands`

3. Configure event subscriptions:
- Enable events.
- Request URL: `https://<api-domain>/api/slack/events`
- Subscribe to bot events: `message.channels`
- Restrict app to the finance channel.

4. Configure interaction endpoint:
- Interactivity Request URL: `https://<api-domain>/api/slack/interactions`

5. Install app to workspace and copy:
- Bot token -> `SLACK_BOT_TOKEN`
- Signing secret -> `SLACK_SIGNING_SECRET`
- Finance channel id -> `SLACK_FINANCE_CHANNEL_ID`

6. Keep signature verification enabled in production:
- `SLACK_SIGNING_ENFORCED=true`
