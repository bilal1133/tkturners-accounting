import { factories } from "@strapi/strapi";
import crypto from "crypto";

const SIGNATURE_WINDOW_SECONDS = 5 * 60;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const replayGuardStore = new Map<string, number>();
const rateLimitStore = new Map<string, number[]>();
const unparsedBodySymbol = Symbol.for("unparsedBody");

type SlackCommand = "salary" | "gym" | "loan" | "summary" | "help";
type AuditResult = "success" | "denied" | "error";

type SlackSlashPayload = {
  command: string;
  text: string;
  team_id: string;
  user_id: string;
  channel_id: string;
};

type ResolveEmployeeResult = {
  contact: any;
  employeeComponent: any;
  linkId: number | null;
};

const SUPPORTED_COMMANDS = new Set<SlackCommand>([
  "salary",
  "gym",
  "loan",
  "summary",
  "help",
]);

const asTrimmedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeCommandName = (value: string) =>
  asTrimmedString(value).replace(/^\//, "").toLowerCase();

const toNullableNumber = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const getRawBody = (ctx: any) => {
  const body = ctx.request?.body;

  if (body && typeof body === "object" && body[unparsedBodySymbol]) {
    const rawValue = body[unparsedBodySymbol];
    return Buffer.isBuffer(rawValue) ? rawValue.toString("utf8") : String(rawValue);
  }

  if (typeof ctx.request?.rawBody === "string") {
    return ctx.request.rawBody;
  }

  if (typeof body === "string") {
    return body;
  }

  if (body && typeof body === "object") {
    const params = new URLSearchParams();

    Object.entries(body).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      if (Array.isArray(value)) {
        value.forEach((item) => params.append(key, String(item)));
        return;
      }

      params.append(key, String(value));
    });

    return params.toString();
  }

  return "";
};

const isDirectMessageChannel = (channelId: string) => channelId.startsWith("D");

const pruneReplayGuard = (nowMs: number) => {
  const expiryMs = nowMs - SIGNATURE_WINDOW_SECONDS * 1000;

  for (const [key, seenAt] of replayGuardStore.entries()) {
    if (seenAt < expiryMs) {
      replayGuardStore.delete(key);
    }
  }
};

const markAndCheckReplay = (requestTimestamp: string, signature: string) => {
  const nowMs = Date.now();
  pruneReplayGuard(nowMs);

  const replayKey = `${requestTimestamp}:${signature}`;

  if (replayGuardStore.has(replayKey)) {
    return false;
  }

  replayGuardStore.set(replayKey, nowMs);
  return true;
};

const parseSlashPayload = (body: any): SlackSlashPayload | null => {
  if (!body || typeof body !== "object") return null;

  const payload: SlackSlashPayload = {
    command: asTrimmedString(body.command),
    text: asTrimmedString(body.text),
    team_id: asTrimmedString(body.team_id),
    user_id: asTrimmedString(body.user_id),
    channel_id: asTrimmedString(body.channel_id),
  };

  if (!payload.command || !payload.team_id || !payload.user_id || !payload.channel_id) {
    return null;
  }

  return payload;
};

const parseSubcommand = (text: string) => {
  const normalized = asTrimmedString(text).toLowerCase();

  if (!normalized) {
    return { command: "help" as SlackCommand };
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const [first = "", ...rest] = tokens;

  if (!SUPPORTED_COMMANDS.has(first as SlackCommand)) {
    return {
      command: "help" as SlackCommand,
      error:
        "Unsupported command. Use one of: `salary`, `gym`, `loan`, `summary`, `help`.",
    };
  }

  if (rest.length > 0) {
    return {
      command: first as SlackCommand,
      error:
        "This bot is self-only. Use `/financials <command>` with no extra arguments.",
    };
  }

  return { command: first as SlackCommand };
};

const getEmployeeComponent = (contact: any) => {
  if (!Array.isArray(contact?.contact_type)) return null;

  return (
    contact.contact_type.find(
      (entry: any) => entry?.__component === "contact-type.employee",
    ) || null
  );
};

const isActiveEmployeeContact = (contact: any) => {
  const employeeComponent = getEmployeeComponent(contact);
  if (!employeeComponent) return false;

  return employeeComponent.active !== false;
};

const getCurrencySymbol = (employeeComponent: any) => {
  const currency = employeeComponent?.currency;
  return (
    asTrimmedString(currency?.Symbol) ||
    asTrimmedString(currency?.symbol) ||
    asTrimmedString(currency?.code) ||
    ""
  );
};

const formatCurrency = (amount: number, currencySymbol: string) => {
  const numberPart = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (currencySymbol) {
    return `${currencySymbol}${numberPart}`;
  }

  return `${numberPart} (currency not set)`;
};

const formatConfiguredAmount = (amount: number | null, currencySymbol: string) => {
  if (amount === null) return "not configured";
  return formatCurrency(amount, currencySymbol);
};

const collectLoanIdsFromEmployeeComponent = (employeeComponent: any) => {
  if (!Array.isArray(employeeComponent?.loans)) return [] as number[];

  return employeeComponent.loans
    .map((entry: any) => {
      if (!entry) return null;
      if (typeof entry === "number") return entry;
      if (typeof entry === "string") {
        const parsed = Number.parseInt(entry, 10);
        return Number.isInteger(parsed) ? parsed : null;
      }

      if (typeof entry === "object" && Number.isInteger(entry.id)) {
        return entry.id;
      }

      return null;
    })
    .filter((value: number | null): value is number => Number.isInteger(value));
};

const getHelpText = () =>
  [
    "*Financial self-service commands*",
    "• `/financials salary`",
    "• `/financials gym`",
    "• `/financials loan`",
    "• `/financials summary`",
    "• `/financials help`",
  ].join("\n");

export default factories.createCoreController(
  "api::employee-slack-link.employee-slack-link",
  ({ strapi }) => {
    const getBotToken = () => asTrimmedString(process.env.SLACK_BOT_TOKEN);

    const getAllowedTeams = () =>
      asTrimmedString(process.env.SLACK_ALLOWED_TEAM_ID)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

    const isFeatureEnabled = () =>
      parseBoolean(process.env.SLACK_FINANCIALS_ENABLED, false);

    const verifySlackSignature = (ctx: any) => {
      const signingSecret = asTrimmedString(process.env.SLACK_SIGNING_SECRET);
      if (!signingSecret) {
        return {
          ok: false,
          status: 503,
          message: "Slack signing secret is not configured.",
        };
      }

      const signatureHeader = asTrimmedString(ctx.get("x-slack-signature"));
      const timestampHeader = asTrimmedString(
        ctx.get("x-slack-request-timestamp"),
      );

      if (!signatureHeader || !timestampHeader) {
        return { ok: false, status: 401, message: "Missing Slack signature headers." };
      }

      const requestTimestamp = Number.parseInt(timestampHeader, 10);
      if (!Number.isInteger(requestTimestamp)) {
        return { ok: false, status: 401, message: "Invalid Slack timestamp." };
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      if (Math.abs(nowSeconds - requestTimestamp) > SIGNATURE_WINDOW_SECONDS) {
        return { ok: false, status: 401, message: "Stale Slack request timestamp." };
      }

      const rawBody = getRawBody(ctx);
      const signatureBase = `v0:${timestampHeader}:${rawBody}`;
      const expectedSignature = `v0=${crypto
        .createHmac("sha256", signingSecret)
        .update(signatureBase)
        .digest("hex")}`;

      const provided = Buffer.from(signatureHeader);
      const expected = Buffer.from(expectedSignature);

      if (provided.length !== expected.length) {
        return { ok: false, status: 401, message: "Invalid Slack signature." };
      }

      if (!crypto.timingSafeEqual(provided, expected)) {
        return { ok: false, status: 401, message: "Invalid Slack signature." };
      }

      if (!markAndCheckReplay(timestampHeader, signatureHeader)) {
        return { ok: false, status: 401, message: "Replay request rejected." };
      }

      return { ok: true };
    };

    const callSlackApi = async (
      endpoint: string,
      token: string,
      options?: {
        method?: "GET" | "POST";
        query?: Record<string, string>;
        body?: Record<string, unknown>;
      },
    ): Promise<any> => {
      const method = options?.method || "POST";
      const url = new URL(`https://slack.com/api/${endpoint}`);

      if (options?.query) {
        Object.entries(options.query).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }

      const response = await fetch(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: method === "POST" ? JSON.stringify(options?.body || {}) : undefined,
      });

      const payload: any = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        const errorCode = asTrimmedString(payload?.error) || "unknown_error";
        throw new Error(`Slack API ${endpoint} failed: ${errorCode}`);
      }

      return payload;
    };

    const fetchSlackUserEmail = async (token: string, userId: string) => {
      const response = await callSlackApi("users.info", token, {
        method: "GET",
        query: { user: userId },
      });

      const email = asTrimmedString(response?.user?.profile?.email).toLowerCase();
      return email || null;
    };

    const sendDirectMessage = async (token: string, userId: string, text: string) => {
      const opened = await callSlackApi("conversations.open", token, {
        method: "POST",
        body: { users: userId },
      });

      const channelId = asTrimmedString(opened?.channel?.id);
      if (!channelId) {
        throw new Error("Unable to open DM channel");
      }

      await callSlackApi("chat.postMessage", token, {
        method: "POST",
        body: {
          channel: channelId,
          text,
          mrkdwn: true,
        },
      });
    };

    const writeAudit = async (
      payload: SlackSlashPayload,
      command: SlackCommand,
      result: AuditResult,
      contactId: number | null,
    ) => {
      try {
        await (strapi.entityService as any).create(
          "api::financial-query-audit.financial-query-audit",
          {
            data: {
              command,
              slack_user_id: payload.user_id,
              team_id: payload.team_id,
              contact_id: contactId,
              result,
              timestamp: new Date(),
            },
          },
        );
      } catch {
        strapi.log.warn("Failed to write financial query audit log.");
      }
    };

    const isRateLimited = (teamId: string, userId: string) => {
      const now = Date.now();
      const minTimestamp = now - RATE_LIMIT_WINDOW_MS;
      const key = `${teamId}:${userId}`;
      const history = (rateLimitStore.get(key) || []).filter(
        (entry) => entry >= minTimestamp,
      );

      if (history.length >= RATE_LIMIT_MAX_REQUESTS) {
        rateLimitStore.set(key, history);
        return true;
      }

      history.push(now);
      rateLimitStore.set(key, history);
      return false;
    };

    const resolveEmployee = async (
      payload: SlackSlashPayload,
      token: string,
    ): Promise<ResolveEmployeeResult | null> => {
      const links = (await (strapi.entityService as any).findMany(
        "api::employee-slack-link.employee-slack-link",
        {
          filters: {
            slack_user_id: { $eq: payload.user_id },
            slack_team_id: { $eq: payload.team_id },
          },
          sort: ["createdAt:asc"],
          populate: [
            "contact",
            "contact.contact_type",
            "contact.contact_type.currency",
            "contact.contact_type.loans",
          ],
          limit: 10,
        },
      )) as any[];

      const activeLinks = links.filter((entry) => entry?.status === "active");
      const revokedLinks = links.filter((entry) => entry?.status === "revoked");

      if (activeLinks.length > 1) {
        return null;
      }

      if (activeLinks.length === 1) {
        const activeLink = activeLinks[0];
        const linkedContact = activeLink?.contact;

        if (!linkedContact || !isActiveEmployeeContact(linkedContact)) {
          return null;
        }

        const employeeComponent = getEmployeeComponent(linkedContact);
        if (!employeeComponent) return null;

        return {
          contact: linkedContact,
          employeeComponent,
          linkId: Number.isInteger(activeLink?.id) ? activeLink.id : null,
        };
      }

      if (revokedLinks.length > 0) {
        return null;
      }

      const email = await fetchSlackUserEmail(token, payload.user_id);
      if (!email) return null;

      const matchingContacts = (await (strapi.entityService as any).findMany(
        "api::contact.contact",
        {
          filters: {
            email: { $eqi: email },
          },
          populate: ["contact_type", "contact_type.currency", "contact_type.loans"],
          limit: 25,
        },
      )) as any[];

      const employeeMatches = matchingContacts.filter((contact) =>
        isActiveEmployeeContact(contact),
      );

      if (employeeMatches.length !== 1) {
        return null;
      }

      const linkedContact = employeeMatches[0];
      const employeeComponent = getEmployeeComponent(linkedContact);
      if (!employeeComponent) return null;

      const createdLink = await (strapi.entityService as any).create(
        "api::employee-slack-link.employee-slack-link",
        {
          data: {
            slack_user_id: payload.user_id,
            slack_team_id: payload.team_id,
            contact: linkedContact.id,
            linked_email: email,
            status: "active",
            last_used_at: new Date(),
          },
        },
      );

      return {
        contact: linkedContact,
        employeeComponent,
        linkId: Number.isInteger(createdLink?.id) ? createdLink.id : null,
      };
    };

    const getLoanRemaining = async (
      contactId: number,
      fallbackLoanIds: number[],
    ) => {
      const mergedLoans = new Map<number, any>();

      let primaryLoans: any[] = [];
      try {
        primaryLoans = (await (strapi.entityService as any).findMany(
          "api::loan.loan",
          {
            filters: {
              status: { $eq: "Active" },
              disbursement_transaction: {
                contact: {
                  id: { $eq: contactId },
                },
              },
            },
            fields: ["id", "remaining_balance", "status"],
            limit: 1000,
          },
        )) as any[];
      } catch {
        primaryLoans = [];
      }

      primaryLoans.forEach((loan) => {
        if (Number.isInteger(loan?.id)) {
          mergedLoans.set(loan.id, loan);
        }
      });

      const fallbackIds = fallbackLoanIds.filter((loanId) => !mergedLoans.has(loanId));
      if (fallbackIds.length > 0) {
        const fallbackLoans = (await (strapi.entityService as any).findMany(
          "api::loan.loan",
          {
            filters: {
              id: { $in: fallbackIds },
              status: { $eq: "Active" },
            },
            fields: ["id", "remaining_balance", "status"],
            limit: fallbackIds.length,
          },
        )) as any[];

        fallbackLoans.forEach((loan) => {
          if (Number.isInteger(loan?.id)) {
            mergedLoans.set(loan.id, loan);
          }
        });
      }

      let total = 0;
      for (const loan of mergedLoans.values()) {
        total += toNullableNumber(loan?.remaining_balance) || 0;
      }

      return total;
    };

    const buildFinancialResponse = (
      command: SlackCommand,
      employeeComponent: any,
      loanRemaining: number,
    ) => {
      const currencySymbol = getCurrencySymbol(employeeComponent);
      const salary = toNullableNumber(employeeComponent?.salary);
      const gymAllowance = toNullableNumber(employeeComponent?.gym_allowance);

      if (command === "salary") {
        return `Your current base salary is *${formatConfiguredAmount(salary, currencySymbol)}*.`;
      }

      if (command === "gym") {
        return `Your current gym allowance is *${formatConfiguredAmount(gymAllowance, currencySymbol)}*.`;
      }

      if (command === "loan") {
        return `Your remaining active loan balance is *${formatCurrency(loanRemaining, currencySymbol)}*.`;
      }

      if (command === "summary") {
        return [
          "*Your financial summary*",
          `• Base salary: *${formatConfiguredAmount(salary, currencySymbol)}*`,
          `• Gym allowance: *${formatConfiguredAmount(gymAllowance, currencySymbol)}*`,
          `• Loan remaining: *${formatCurrency(loanRemaining, currencySymbol)}*`,
        ].join("\n");
      }

      return getHelpText();
    };

    const sendDeniedMessage = async (token: string, payload: SlackSlashPayload, text: string) => {
      await sendDirectMessage(token, payload.user_id, text);
    };

    const runCommand = async (payload: SlackSlashPayload) => {
      const token = getBotToken();
      if (!token) {
        strapi.log.error("SLACK_BOT_TOKEN is missing; command cannot be processed.");
        return;
      }

      const parsed = parseSubcommand(payload.text);

      if (isRateLimited(payload.team_id, payload.user_id)) {
        await sendDeniedMessage(
          token,
          payload,
          "Rate limit exceeded (20 requests per 5 minutes). Please try again shortly.",
        );
        await writeAudit(payload, parsed.command, "denied", null);
        return;
      }

      if (parsed.error) {
        await sendDeniedMessage(token, payload, `${parsed.error}\n\n${getHelpText()}`);
        await writeAudit(payload, parsed.command, "denied", null);
        return;
      }

      if (parsed.command === "help") {
        await sendDirectMessage(token, payload.user_id, getHelpText());
        await writeAudit(payload, parsed.command, "success", null);
        return;
      }

      const resolved = await resolveEmployee(payload, token);
      if (!resolved) {
        await sendDeniedMessage(
          token,
          payload,
          "Unable to link your Slack account to a unique active employee profile. Please contact finance/admin.",
        );
        await writeAudit(payload, parsed.command, "denied", null);
        return;
      }

      const loanRemaining = await getLoanRemaining(
        resolved.contact.id,
        collectLoanIdsFromEmployeeComponent(resolved.employeeComponent),
      );

      const responseText = buildFinancialResponse(
        parsed.command,
        resolved.employeeComponent,
        loanRemaining,
      );

      await sendDirectMessage(token, payload.user_id, responseText);

      if (resolved.linkId) {
        await (strapi.entityService as any).update(
          "api::employee-slack-link.employee-slack-link",
          resolved.linkId,
          {
            data: {
              last_used_at: new Date(),
            },
          },
        );
      }

      await writeAudit(payload, parsed.command, "success", resolved.contact.id || null);
    };

    return {
      async handleFinancialCommand(ctx) {
        const verification = verifySlackSignature(ctx);

        if (!verification.ok) {
          ctx.status = verification.status;
          ctx.body = { error: verification.message };
          return;
        }

        const payload = parseSlashPayload(ctx.request.body);

        if (!payload) {
          ctx.status = 400;
          ctx.body = { error: "Invalid slash command payload." };
          return;
        }

        const configuredCommand = normalizeCommandName(
          asTrimmedString(process.env.SLACK_COMMAND_NAME) || "financials",
        );

        if (normalizeCommandName(payload.command) !== configuredCommand) {
          ctx.status = 200;
          ctx.body = {
            response_type: "ephemeral",
            text: "Unsupported command configuration.",
          };
          return;
        }

        const allowedTeams = getAllowedTeams();
        if (allowedTeams.length === 0 || !allowedTeams.includes(payload.team_id)) {
          ctx.status = 200;
          ctx.body = {
            response_type: "ephemeral",
            text: "This Slack workspace is not authorized for this command.",
          };
          return;
        }

        if (!isFeatureEnabled()) {
          ctx.status = 200;
          ctx.body = {
            response_type: "ephemeral",
            text: "Financial self-service is currently disabled.",
          };
          return;
        }

        const botToken = getBotToken();
        if (!botToken) {
          ctx.status = 200;
          ctx.body = {
            response_type: "ephemeral",
            text: "Financial self-service is not configured yet.",
          };
          return;
        }

        ctx.status = 200;
        ctx.body = {
          response_type: "ephemeral",
          text: isDirectMessageChannel(payload.channel_id)
            ? "Request received. Sending your financial details here shortly."
            : "Request received. I will send your financial details in a direct message.",
        };

        setImmediate(() => {
          const parsedForAudit = parseSubcommand(payload.text);
          void runCommand(payload).catch(async () => {
            try {
              await sendDirectMessage(
                botToken,
                payload.user_id,
                "Something went wrong while processing your financial request. Please contact finance/admin.",
              );
              await writeAudit(payload, parsedForAudit.command, "error", null);
            } catch {
              strapi.log.error("Financial Slack command failed and error DM could not be sent.");
            }
          });
        });
      },
    };
  },
);
