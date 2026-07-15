const sgMail = require('@sendgrid/mail');
require('dotenv').config();

// Initialize SendGrid API key from .env
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send email with retries using SendGrid
 * @param {Object} msg - SendGrid message object
 * @param {number} retries - number of retries
 */
const sendEmail = async (msg, retries) => {
    try {
        await sgMail.send(msg);
    } catch (err) {
        console.error('Error sending email:', err.response ? err.response.body : err);
        if (retries > 0) {
            await new Promise(res => setTimeout(res, 1000));
            await sendEmail(msg, retries - 1);
        } else {
            throw new Error('Failed to send email after multiple attempts');
        }
    }
};

/**
 * Send OTP email
 * @param {string} email - recipient email address
 * @param {string} otp - OTP code to send
 * @param {number} retries - retries count (default 3)
 */
const sendOtpEmail = async (email, otp, retries = 3) => {
    const msg = {
        to: email,
        from: process.env.SENDGRID_SENDER_EMAIL, // Verified sender email in SendGrid
        subject: 'Your OTP Verification Code',
        text: `Your Verification Code: ${otp}`,
        html: `<p>Your Verification Code: <strong>${otp}</strong></p>`,
    };

    await sendEmail(msg, retries);
};

/**
 * Send password reset email
 * @param {string} email - recipient email address
 * @param {string} resetLink - password reset URL
 * @param {number} retries - retries count (default 3)
 */
const sendPasswordResetEmail = async (email, resetLink, retries = 3) => {
    const msg = {
        to: email,
        from: process.env.SENDGRID_SENDER_EMAIL,
        subject: 'Password Reset Request',
        text: `Please click the following link to reset your password: ${resetLink}`,
        html: `<p>Please click the following link to reset your password: <a href="${resetLink}">${resetLink}</a></p>`,
    };

    await sendEmail(msg, retries);
};

module.exports = {
    sendOtpEmail,
    sendPasswordResetEmail,
    sendEmail,
};
