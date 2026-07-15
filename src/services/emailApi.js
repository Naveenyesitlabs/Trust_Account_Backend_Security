const axios = require('axios');
const FormData = require('form-data');

async function sendTrustEmail(to, subject, message) {
  const form = new FormData();
  form.append('to', to);
  form.append('subject', subject);
  form.append('message', message);

  try {
    const response = await axios.post(
      'http://awplconnectadmin.tgastaging.com/api/send-trust-email',
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