const axios = require('axios');
const FormData = require('form-data');

async function sendTrustEmail(to, subject, message) {
  const serviceUrl = process.env.TRUST_EMAIL_API_URL;
  if (!serviceUrl) {
    throw new Error('TRUST_EMAIL_API_URL is not configured');
  }

  const parsedUrl = new URL(serviceUrl);
  if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
    throw new Error('TRUST_EMAIL_API_URL must use HTTPS in production');
  }

  const form = new FormData();
  form.append('to', to);
  form.append('subject', subject);
  form.append('message', message);

  try {
    const response = await axios.post(
      serviceUrl,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
}

module.exports = { sendTrustEmail };
