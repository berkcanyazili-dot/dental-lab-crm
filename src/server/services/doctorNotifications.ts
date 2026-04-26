type DoctorNotificationContext = {
  caseNumber: string;
  patientName: string;
  doctorName: string | null;
  accountName: string;
  authorName: string;
  noteContent: string;
  toEmail: string | null;
  toPhone: string | null;
};

function buildSubject(caseNumber: string) {
  return `Dental Lab Update for ${caseNumber}`;
}

function buildEmailHtml(context: DoctorNotificationContext) {
  const greetingName = context.doctorName || context.accountName;

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>Hello ${greetingName},</p>
      <p>Your lab posted a new case note that is visible to the doctor.</p>
      <div style="margin: 16px 0; padding: 12px 16px; border-left: 4px solid #0ea5e9; background: #f8fafc;">
        <p style="margin: 0 0 8px;"><strong>Case:</strong> ${context.caseNumber}</p>
        <p style="margin: 0 0 8px;"><strong>Patient:</strong> ${context.patientName}</p>
        <p style="margin: 0 0 8px;"><strong>From:</strong> ${context.authorName}</p>
        <p style="margin: 0;"><strong>Note:</strong><br/>${context.noteContent.replace(/\n/g, "<br/>")}</p>
      </div>
      <p>Please contact the lab if you need anything clarified.</p>
    </div>
  `.trim();
}

function buildSmsBody(context: DoctorNotificationContext) {
  return [
    `Dental Lab Update: ${context.caseNumber}`,
    `Patient: ${context.patientName}`,
    `From: ${context.authorName}`,
    `Note: ${context.noteContent}`,
  ].join("\n");
}

async function sendDoctorEmail(context: DoctorNotificationContext) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from || !context.toEmail) {
    return { attempted: false, channel: "email" as const };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [context.toEmail],
      subject: buildSubject(context.caseNumber),
      html: buildEmailHtml(context),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Doctor email failed: ${body}`);
  }

  return { attempted: true, channel: "email" as const };
}

async function sendDoctorSms(context: DoctorNotificationContext) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from || !context.toPhone) {
    return { attempted: false, channel: "sms" as const };
  }

  const credentials =
    typeof btoa === "function"
      ? btoa(`${accountSid}:${authToken}`)
      : Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: context.toPhone,
        From: from,
        Body: buildSmsBody(context),
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Doctor SMS failed: ${body}`);
  }

  return { attempted: true, channel: "sms" as const };
}

export async function notifyDoctorOfPublicNote(context: DoctorNotificationContext) {
  const results = await Promise.allSettled([
    sendDoctorEmail(context),
    sendDoctorSms(context),
  ]);

  return {
    email: results[0].status === "fulfilled" ? results[0].value : { attempted: true, channel: "email" as const, error: results[0].reason },
    sms: results[1].status === "fulfilled" ? results[1].value : { attempted: true, channel: "sms" as const, error: results[1].reason },
  };
}
