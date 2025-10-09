import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendEmail = async (options: EmailOptions) => {
  // 1. Create a transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // For services like Mailtrap, you might need to allow less secure apps
    // tls: {
    //   rejectUnauthorized: false
    // }
  });

  // 2. Define the email options
  const mailOptions = {
    from: `LinkVeil <${process.env.EMAIL_FROM || 'noreply@linkveil.com'}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  // 3. Actually send the email
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    // In a real app, you'd want more robust error handling,
    // maybe re-queueing the email or alerting an admin.
    throw new Error('Email could not be sent.');
  }
};