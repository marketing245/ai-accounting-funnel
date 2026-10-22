/**
 * AIAccountingEngineer — 1-Step Fast Checkout & Student Portal Access Engine
 * Zero friction: Full Name, Email, WhatsApp Phone -> Direct UPI Payment -> Instant Course Portal Access
 */

const BASE_PRICE = 1499;
const BUMP_PRICE = 399;
const UPI_VPA = 'manakppc@okhdfcbank';
const MERCHANT_NAME = 'AIAccountingEngineer';

let hasOrderBump = false;

// ── Open & Close Checkout Modal ──
function startUnifiedFunnel() {
  const modal = document.getElementById('unifiedFunnelModal');
  if (modal) {
    modal.classList.remove('hidden');
    updateCheckoutDisplay();
    // Scroll modal into view if needed
    modal.scrollTop = 0;
  }
}

function closeUnifiedModal() {
  const modal = document.getElementById('unifiedFunnelModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// ── Toggle Order Bump ──
function toggleOrderBump() {
  const checkbox = document.getElementById('orderBumpCheckbox');
  hasOrderBump = checkbox ? checkbox.checked : false;
  updateCheckoutDisplay();
}

// ── Update Price, Dynamic UPI QR & App Links ──
function updateCheckoutDisplay() {
  const total = hasOrderBump ? (BASE_PRICE + BUMP_PRICE) : BASE_PRICE;
  
  // Update price labels
  const totalEl = document.getElementById('checkoutTotalAmount');
  if (totalEl) totalEl.innerText = `₹${total.toLocaleString('en-IN')}`;

  // Generate real dynamic UPI intent string
  const txnNote = `AAE Course ${hasOrderBump ? '+ Prompts' : ''}`;
  const upiIntent = `upi://pay?pa=${encodeURIComponent(UPI_VPA)}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${total}&cu=INR&tn=${encodeURIComponent(txnNote)}`;

  // Update Dynamic QR Code via high-resolution QR service
  const qrImg = document.getElementById('checkoutQrImg');
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiIntent)}&margin=4`;
  }

  // Update 1-Click UPI Mobile Buttons
  const btnGpay = document.getElementById('btnGpay');
  const btnPhonepe = document.getElementById('btnPhonepe');
  const btnPaytm = document.getElementById('btnPaytm');

  if (btnGpay) btnGpay.href = upiIntent;
  if (btnPhonepe) btnPhonepe.href = upiIntent;
  if (btnPaytm) btnPaytm.href = upiIntent;
}

// ── Complete Payment & Open Portal ──
function completePaymentAndAccess() {
  const nameInput = document.getElementById('custName');
  const emailInput = document.getElementById('custEmail');
  const phoneInput = document.getElementById('custPhone');
  const errorEl = document.getElementById('checkoutError');

  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';

  // Simple validation
  if (!name || !email || !phone) {
    if (errorEl) {
      errorEl.innerText = 'Please enter your Full Name, Email, and WhatsApp number.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  if (phone.length < 10) {
    if (errorEl) {
      errorEl.innerText = 'Please enter a valid 10-digit WhatsApp number.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  if (errorEl) errorEl.classList.add('hidden');

  // Generate unique member token
  const token = `AAE-STU-${Date.now().toString().slice(-6)}`;
  const total = hasOrderBump ? (BASE_PRICE + BUMP_PRICE) : BASE_PRICE;

  // Save student session in localStorage
  localStorage.setItem('aae_auth_token', token);
  localStorage.setItem('aae_user_name', name);
  localStorage.setItem('aae_user_email', email);
  localStorage.setItem('aae_user_phone', phone);
  localStorage.setItem('aae_order_bump', hasOrderBump ? 'true' : 'false');

  // Track Meta conversion event if pixel exists
  if (typeof fbq === 'function') {
    try {
      fbq('track', 'Purchase', {
        value: total,
        currency: 'INR',
        content_name: 'AIAccountingEngineer Masterclass',
        email: email,
        phone: phone
      });
    } catch (e) {}
  }

  // Show Success Screen
  const checkoutForm = document.getElementById('checkoutFormSection');
  const successSection = document.getElementById('checkoutSuccessSection');
  
  if (checkoutForm) checkoutForm.classList.add('hidden');
  if (successSection) {
    successSection.classList.remove('hidden');
    
    // Fill success details
    const finalName = document.getElementById('successName');
    const finalPhone = document.getElementById('successPhone');
    const finalAmount = document.getElementById('successAmount');
    if (finalName) finalName.innerText = name;
    if (finalPhone) finalPhone.innerText = `+91 ${phone}`;
    if (finalAmount) finalAmount.innerText = `₹${total}`;

    // Auto-redirect countdown
    let secondsLeft = 3;
    const countdownEl = document.getElementById('redirectCountdown');
    const interval = setInterval(() => {
      secondsLeft--;
      if (countdownEl) countdownEl.innerText = secondsLeft;
      if (secondsLeft <= 0) {
        clearInterval(interval);
        window.location.href = `/portal?token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`;
      }
    }, 1000);
  }
}

// Direct button to skip waiting and go to portal immediately
function goToPortalNow() {
  const name = localStorage.getItem('aae_user_name') || 'Student Member';
  const phone = localStorage.getItem('aae_user_phone') || '9876543210';
  const token = localStorage.getItem('aae_auth_token') || 'AAE-ACTIVE-MEMBER';
  window.location.href = `/portal?token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`;
}

// Close modal on Escape key or outside click
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeUnifiedModal();
});

// Auto-open modal if requested via URL param (e.g. /?open=checkout)
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('open') === 'checkout' || params.get('enroll') === 'true') {
    startUnifiedFunnel();
  }
});
