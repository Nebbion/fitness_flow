import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export type EmailTemplate =
  | 'welcome'
  | 'appointment_confirmation'
  | 'appointment_reminder'
  | 'appointment_followup'
  | 'portal_invite'

export interface EmailData {
  to: string
  locale?: 'it' | 'en'
  tenantName?: string
  clientName?: string
  staffName?: string
  appointmentDate?: string
  appointmentTime?: string
  serviceName?: string
  portalUrl?: string
  customMessage?: string
}

// Template soggetti per lingua
const SUBJECTS: Record<EmailTemplate, Record<string, string>> = {
  welcome: {
    it: 'Benvenuto in {tenantName}!',
    en: 'Welcome to {tenantName}!',
  },
  appointment_confirmation: {
    it: '✅ Appuntamento confermato — {date}',
    en: '✅ Appointment confirmed — {date}',
  },
  appointment_reminder: {
    it: '🔔 Promemoria appuntamento domani',
    en: '🔔 Appointment reminder for tomorrow',
  },
  appointment_followup: {
    it: 'Come stai andando dopo il tuo appuntamento?',
    en: 'How are you doing after your appointment?',
  },
  portal_invite: {
    it: 'Accedi al tuo portale personale',
    en: 'Access your personal portal',
  },
}

function interpolate(template: string, data: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => data[key] ?? '')
}

// Costruisce l'HTML email in base al template e lingua
function buildEmailHtml(template: EmailTemplate, data: EmailData): string {
  const locale = data.locale ?? 'it'
  const { clientName, tenantName, staffName, appointmentDate, appointmentTime, serviceName, portalUrl } = data

  const baseStyle = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    max-width: 560px; margin: 0 auto; padding: 0;
  `
  const btnStyle = `
    display: inline-block; background: #2563EB; color: white;
    padding: 12px 24px; border-radius: 8px; text-decoration: none;
    font-weight: 600; font-size: 14px; margin-top: 16px;
  `

  const bodies: Record<EmailTemplate, Record<string, string>> = {
    welcome: {
      it: `<p>Ciao <strong>${clientName}</strong>,</p>
<p>Benvenuto in <strong>${tenantName}</strong>! Il tuo profilo è stato creato con successo.</p>
<p>Potrai visualizzare i tuoi appuntamenti, documenti e progressi direttamente dal tuo portale personale.</p>
${portalUrl ? `<a href="${portalUrl}" style="${btnStyle}">Accedi al portale</a>` : ''}`,
      en: `<p>Hi <strong>${clientName}</strong>,</p>
<p>Welcome to <strong>${tenantName}</strong>! Your profile has been successfully created.</p>
<p>You can view your appointments, documents and progress directly from your personal portal.</p>
${portalUrl ? `<a href="${portalUrl}" style="${btnStyle}">Access portal</a>` : ''}`,
    },
    appointment_confirmation: {
      it: `<p>Ciao <strong>${clientName}</strong>,</p>
<p>Il tuo appuntamento con <strong>${staffName}</strong> è confermato:</p>
<table style="background:#F8FAFC;border-radius:8px;padding:16px;width:100%;margin:16px 0;">
  <tr><td style="color:#64748B;font-size:13px;">Data</td><td style="font-weight:600;">${appointmentDate}</td></tr>
  <tr><td style="color:#64748B;font-size:13px;">Ora</td><td style="font-weight:600;">${appointmentTime}</td></tr>
  ${serviceName ? `<tr><td style="color:#64748B;font-size:13px;">Servizio</td><td style="font-weight:600;">${serviceName}</td></tr>` : ''}
</table>
<p>Per modificare o annullare l'appuntamento, rispondi a questa email.</p>`,
      en: `<p>Hi <strong>${clientName}</strong>,</p>
<p>Your appointment with <strong>${staffName}</strong> is confirmed:</p>
<table style="background:#F8FAFC;border-radius:8px;padding:16px;width:100%;margin:16px 0;">
  <tr><td style="color:#64748B;font-size:13px;">Date</td><td style="font-weight:600;">${appointmentDate}</td></tr>
  <tr><td style="color:#64748B;font-size:13px;">Time</td><td style="font-weight:600;">${appointmentTime}</td></tr>
  ${serviceName ? `<tr><td style="color:#64748B;font-size:13px;">Service</td><td style="font-weight:600;">${serviceName}</td></tr>` : ''}
</table>
<p>To modify or cancel your appointment, reply to this email.</p>`,
    },
    appointment_reminder: {
      it: `<p>Ciao <strong>${clientName}</strong>,</p>
<p>Ti ricordiamo che <strong>domani alle ${appointmentTime}</strong> hai un appuntamento con <strong>${staffName}</strong>.</p>
${serviceName ? `<p>Servizio: <strong>${serviceName}</strong></p>` : ''}
<p>Ci vediamo domani! 💪</p>`,
      en: `<p>Hi <strong>${clientName}</strong>,</p>
<p>Just a reminder that <strong>tomorrow at ${appointmentTime}</strong> you have an appointment with <strong>${staffName}</strong>.</p>
${serviceName ? `<p>Service: <strong>${serviceName}</strong></p>` : ''}
<p>See you tomorrow! 💪</p>`,
    },
    appointment_followup: {
      it: `<p>Ciao <strong>${clientName}</strong>,</p>
<p>Speriamo che tu stia andando alla grande dopo il tuo ultimo appuntamento con <strong>${staffName}</strong>!</p>
<p>Hai domande o vuoi fissare il prossimo appuntamento? Rispondi a questa email o contattaci direttamente.</p>`,
      en: `<p>Hi <strong>${clientName}</strong>,</p>
<p>We hope you're doing great after your last appointment with <strong>${staffName}</strong>!</p>
<p>Do you have any questions or would you like to schedule your next appointment? Reply to this email or contact us directly.</p>`,
    },
    portal_invite: {
      it: `<p>Ciao <strong>${clientName}</strong>,</p>
<p><strong>${tenantName}</strong> ti ha invitato ad accedere al tuo portale personale.</p>
<p>Dal portale potrai:</p>
<ul>
  <li>Visualizzare i tuoi appuntamenti</li>
  <li>Scaricare i tuoi piani e documenti</li>
  <li>Monitorare i tuoi progressi</li>
</ul>
${portalUrl ? `<a href="${portalUrl}" style="${btnStyle}">Accedi al portale</a>` : ''}
<p style="color:#64748B;font-size:12px;margin-top:16px;">Il link è valido per 24 ore.</p>`,
      en: `<p>Hi <strong>${clientName}</strong>,</p>
<p><strong>${tenantName}</strong> has invited you to access your personal portal.</p>
<p>From the portal you can:</p>
<ul>
  <li>View your appointments</li>
  <li>Download your plans and documents</li>
  <li>Monitor your progress</li>
</ul>
${portalUrl ? `<a href="${portalUrl}" style="${btnStyle}">Access portal</a>` : ''}
<p style="color:#64748B;font-size:12px;margin-top:16px;">The link is valid for 24 hours.</p>`,
    },
  }

  const bodyContent = bodies[template]?.[locale] ?? bodies[template]?.it ?? ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="background:#F1F5F9;padding:24px 0;">
  <div style="${baseStyle}">
    <div style="background:#2563EB;padding:20px 24px;border-radius:12px 12px 0 0;">
      <p style="color:white;font-weight:700;font-size:18px;margin:0;">${tenantName ?? 'FitnessFlow'}</p>
    </div>
    <div style="background:white;padding:24px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      ${bodyContent}
      <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;">
      <p style="color:#94A3B8;font-size:12px;margin:0;">
        ${tenantName ?? 'FitnessFlow'} · Powered by FitnessFlow
      </p>
    </div>
  </div>
</body>
</html>`
}

// Funzione principale per inviare email
export async function sendEmail(template: EmailTemplate, data: EmailData): Promise<{ id?: string; error?: string }> {
  try {
    const locale = data.locale ?? 'it'
    const subjectTemplate = SUBJECTS[template][locale] ?? SUBJECTS[template].it
    const subject = interpolate(subjectTemplate, {
      tenantName: data.tenantName ?? '',
      date: data.appointmentDate ?? '',
    })

    const html = buildEmailHtml(template, data)

    const { data: result, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: data.to,
      subject,
      html,
    })

    if (error) throw error
    return { id: result?.id }
  } catch (err: any) {
    console.error('Email send error:', err)
    return { error: err.message }
  }
}
