'use strict';

const { Resend } = require('resend');

let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function fromAddress() {
  return `Norevify <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  if (!process.env.RESEND_API_KEY) return;
  await getResend().emails.send({
    from: fromAddress(),
    to,
    subject: 'Recuperação de senha — Norevify',
    html: `
      <p>Você solicitou a recuperação de senha da sua conta no <strong>Norevify</strong>.</p>
      <p>Clique no link abaixo para redefinir sua senha. O link é válido por <strong>15 minutos</strong>.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Se você não fez essa solicitação, ignore este email.</p>
    `,
  });
}

async function sendVerificationEmail({ to, verifyUrl }) {
  if (!process.env.RESEND_API_KEY) return;
  await getResend().emails.send({
    from: fromAddress(),
    to,
    subject: 'Verifique seu email — Norevify',
    html: `
      <p>Obrigado por criar sua conta no <strong>Norevify</strong>!</p>
      <p>Clique no link abaixo para verificar seu endereço de email. O link é válido por <strong>24 horas</strong>.</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>Se você não criou esta conta, ignore este email.</p>
    `,
  });
}

function formatReminderLine(r) {
  const parts = [r.type];
  if (r.title) parts.push(`— ${r.title}`);
  if (r.dueDate) parts.push(`(${new Date(r.dueDate).toLocaleDateString('pt-BR')})`);
  if (r.dueKm != null) parts.push(`${r.dueKm} km`);
  return parts.join(' ');
}

function reminderSection(heading, reminders) {
  if (reminders.length === 0) return '';
  return `
      <p><strong>${heading}:</strong></p>
      <ul>${reminders.map((r) => `<li>${formatReminderLine(r)}</li>`).join('')}</ul>
  `;
}

async function sendReminderDigest({ to, overdue, dueSoon }) {
  if (!process.env.RESEND_API_KEY) return;
  const remindersUrl = `${process.env.FRONTEND_URL || process.env.BASE_URL}/reminders`;
  await getResend().emails.send({
    from: fromAddress(),
    to,
    subject: 'Lembretes pendentes — Norevify',
    html: `
      <p>Você tem lembretes de manutenção que precisam de atenção.</p>
      ${reminderSection('Atrasados', overdue)}
      ${reminderSection('Vencendo em breve', dueSoon)}
      <p><a href="${remindersUrl}">Ver todos os lembretes</a></p>
    `,
  });
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail, sendReminderDigest };
