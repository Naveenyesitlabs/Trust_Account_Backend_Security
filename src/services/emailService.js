const { sendTrustEmail } = require('./emailApi');

const sendEmail = async (mailOptions, retries) => {
    const message = mailOptions?.html || mailOptions?.text || '';
    await sendTrustEmail(mailOptions?.to, mailOptions?.subject, message);
};


const sendOtpEmail = async (email, otp, retries = 3) => {
    // const mailOptions = {
    //     from: process.env.GMAIL_USER,
    //     to: email,
    //     subject: 'Your OTP Verification Code',
    //     text: `Your Verification Code: ${otp}`,
    //     html: `<p> Your Verification Code: <strong>${otp}</strong></p>`,
    // };
    // await sendEmail(mailOptions, retries);

    const subject = 'Your OTP Verification Code';
    const body = `<p> Your Verification Code: <strong>${otp}</strong></p>`;

    await sendTrustEmail(email, subject, body);
};


module.exports = { sendOtpEmail, sendEmail };
