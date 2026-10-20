/**
 * AI Accounting Engineer - High-Converting Sales Funnel Logic
 */

let funnelState = {
  basePrice: 1499,
  bumpPrice: 399,
  upsellPrice: 2999,
  hasOrderBump: false,
  hasUpsell: false,
  buyerName: 'Manak Sehgal',
  buyerEmail: 'manakppc@gmail.com',
  buyerPhone: '+91 98765 43210'
};

// Open Checkout Modal
function startFunnelCheckout() {
  const modal = document.getElementById('funnelCheckoutModal');
  if (modal) {
    modal.classList.remove('hidden');
    updateCheckoutTotal();
  }
}

// Close any modal
function closeFunnelModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

// Order Bump Toggle
function toggleOrderBump() {
  const check = document.getElementById('orderBumpCheck');
  funnelState.hasOrderBump = check ? check.checked : false;
  updateCheckoutTotal();
}

function updateCheckoutTotal() {
  const total = funnelState.basePrice + (funnelState.hasOrderBump ? funnelState.bumpPrice : 0);
  const el = document.getElementById('checkoutTotalAmount');
  if (el) el.innerText = `₹${total.toLocaleString('en-IN')}`;
}

// Payment Processing -> Triggers Post-Purchase Upsell
function processFunnelPayment() {
  // Capture buyer info
  funnelState.buyerName = document.getElementById('buyerName').value || 'Customer';
  funnelState.buyerEmail = document.getElementById('buyerEmail').value || 'manakppc@gmail.com';
  funnelState.buyerPhone = document.getElementById('buyerPhone').value || '+91 98765 43210';

  closeFunnelModal('funnelCheckoutModal');

  // Open Upsell Modal (OTO)
  const upsellModal = document.getElementById('funnelUpsellModal');
  if (upsellModal) {
    upsellModal.classList.remove('hidden');
  }
}

// Accept Upsell
function acceptFunnelUpsell() {
  funnelState.hasUpsell = true;
  closeFunnelModal('funnelUpsellModal');
  showSuccessReceipt();
}

// Decline Upsell
function declineFunnelUpsell() {
  funnelState.hasUpsell = false;
  closeFunnelModal('funnelUpsellModal');
  showSuccessReceipt();
}

// Show Final Receipt & WhatsApp VIP
function showSuccessReceipt() {
  const successModal = document.getElementById('funnelSuccessModal');
  if (!successModal) return;

  const total = funnelState.basePrice + 
    (funnelState.hasOrderBump ? funnelState.bumpPrice : 0) + 
    (funnelState.hasUpsell ? funnelState.upsellPrice : 0);

  let items = ['5-Module AI Accounting Course'];
  if (funnelState.hasOrderBump) items.push('Prompt SOP Pack (₹399)');
  if (funnelState.hasUpsell) items.push('4-Week Live Cohort Upgrade (₹2,999)');

  document.getElementById('confirmedEmail').innerText = funnelState.buyerEmail;
  document.getElementById('receiptItems').innerText = items.join(' + ');
  document.getElementById('receiptTotal').innerText = `₹${total.toLocaleString('en-IN')}`;

  successModal.classList.remove('hidden');
}

// Countdown Timer simulation
function initTimer() {
  let seconds = 14 * 3600 + 32 * 60 + 18;
  const timerEl = document.getElementById('countdownTimer');
  if (!timerEl) return;

  setInterval(() => {
    if (seconds > 0) seconds--;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    timerEl.innerText = `${h < 10 ? '0' + h : h} : ${m < 10 ? '0' + m : m} : ${s < 10 ? '0' + s : s}`;
  }, 1000);
}

window.addEventListener('DOMContentLoaded', () => {
  initTimer();
});
