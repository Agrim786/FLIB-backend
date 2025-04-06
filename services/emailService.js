const nodemailer = require('nodemailer');

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Email templates
const templates = {
  orderConfirmation: (order, user) => ({
    subject: `Order Confirmation - #${order._id}`,
    html: `
      <h1>Order Confirmation</h1>
      <p>Dear ${user.name},</p>
      <p>Thank you for your order! We're excited to confirm that your order has been received and is being processed.</p>
      
      <h2>Order Details</h2>
      <p>Order ID: ${order._id}</p>
      <p>Total Amount: ₹${order.totalAmount}</p>
      
      <h2>Items</h2>
      <ul>
        ${order.items.map(item => `
          <li>${item.bookId.title} - ₹${item.price}</li>
        `).join('')}
      </ul>
      
      <h2>Shipping Address</h2>
      <p>${order.shippingAddress.fullName}</p>
      <p>${order.shippingAddress.addressLine1}</p>
      ${order.shippingAddress.addressLine2 ? `<p>${order.shippingAddress.addressLine2}</p>` : ''}
      <p>${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}</p>
      <p>${order.shippingAddress.country}</p>
      
      <p>We'll send you another email when your order ships.</p>
      
      <p>Best regards,<br>BookHive Team</p>
    `
  }),

  shippingUpdate: (order, user, update) => ({
    subject: `Shipping Update - Order #${order._id}`,
    html: `
      <h1>Shipping Update</h1>
      <p>Dear ${user.name},</p>
      <p>Your order #${order._id} has been updated:</p>
      
      <h2>Current Status</h2>
      <p>${update.status}</p>
      <p>Location: ${update.location}</p>
      <p>Estimated Delivery: ${new Date(update.estimatedDelivery).toLocaleDateString()}</p>
      
      <h2>Tracking Details</h2>
      <p>Carrier: ${order.tracking.carrier}</p>
      <p>Tracking Number: ${order.tracking.trackingNumber}</p>
      
      <p>You can track your order at any time through your account.</p>
      
      <p>Best regards,<br>BookHive Team</p>
    `
  }),

  deliveryConfirmation: (order, user) => ({
    subject: `Delivery Confirmation - Order #${order._id}`,
    html: `
      <h1>Delivery Confirmation</h1>
      <p>Dear ${user.name},</p>
      <p>Great news! Your order #${order._id} has been delivered successfully.</p>
      
      <h2>Order Details</h2>
      <p>Order ID: ${order._id}</p>
      <p>Total Amount: ₹${order.totalAmount}</p>
      
      <h2>Items</h2>
      <ul>
        ${order.items.map(item => `
          <li>${item.bookId.title} - ₹${item.price}</li>
        `).join('')}
      </ul>
      
      <p>We hope you enjoy your books! If you have any questions or concerns, please don't hesitate to contact us.</p>
      
      <p>Best regards,<br>BookHive Team</p>
    `
  })
};

// Send email function
const sendEmail = async (to, template, data) => {
  try {
    const { subject, html } = templates[template](data.order, data.user);
    
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to,
      subject,
      html
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}`);
  } catch (err) {
    console.error('Error sending email:', err);
    throw err;
  }
};

module.exports = {
  sendEmail,
  templates
}; 