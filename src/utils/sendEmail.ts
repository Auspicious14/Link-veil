interface EmailOptions {
  to: string;
  subject: string;
  text: string;
}

export const sendEmail = async (options: EmailOptions) => {
  console.log('--- Sending Email ---');
  console.log(`To: ${options.to}`);
  console.log(`Subject: ${options.subject}`);
  console.log(`Text: ${options.text}`);
  console.log('---------------------');
  return Promise.resolve();
};