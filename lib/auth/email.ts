import nodemailer from "nodemailer";
import {
  buildVerificationEmailHtml,
  buildVerificationEmailText,
  getVerificationEmailSubject,
} from "@/lib/auth/email-template";
import { getSmtpConfig } from "@/lib/env";
import type { VerificationPurpose } from "@/lib/auth/types";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const smtp = getSmtpConfig();
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });
  }
  return transporter;
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  purpose: VerificationPurpose
) {
  const smtp = getSmtpConfig();

  await getTransporter().sendMail({
    from: `"LUNO" <${smtp.user}>`,
    to,
    subject: getVerificationEmailSubject(purpose),
    text: buildVerificationEmailText(code, purpose),
    html: buildVerificationEmailHtml(code, purpose),
  });
}
