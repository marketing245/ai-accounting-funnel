/**
 * AI Accounting Engineer - High-Converting Funnel & Interactive Lead Qualifier
 */

let funnelState = {
  basePrice: 1499,
  bumpPrice: 399,
  upsellPrice: 2999,
  hasOrderBump: false,
  hasUpsell: false,
  buyerName: '',
  buyerEmail: '',
  buyerPhone: '',
  upiVpa: 'manakppc@okhdfcbank'
};

let quizState = {
  step: 1,
  role: '',
  bottleneck: '',
  closeDuration: '',
  software: '',
  score: 87
};

// ==========================================
// 🎯 INTERACTIVE LEAD QUALIFIER (SCORECARD)
// ==========================================

function openLeadQualifier() {
  quizState.step = 1;
  const modal = document.getElementById('leadQualifierModal');
  if (modal) {
    modal.classList.remove('hidden');
    renderQuizStep();
  }
}

function renderQuizStep() {
  const container = document.getElementById('quizContainer');
  const indicator = document.getElementById('quizStepIndicator');
  const bar = document.getElementById('quizProgressBar');
  if (!container) return;

  if (quizState.step === 1) {
    indicator.innerText = 'Step 1 of 5 · Role Qualification';
    bar.style.width = '20%';
    container.innerHTML = `
      <div class="space-y-4">
        <div>
          <span class="text-xs font-bold text-[#c4953a] uppercase tracking-wider">Question 1</span>
          <h3 class="text-xl font-bold text-white mt-1">What best describes your current professional role?</h3>
          <p class="text-xs text-white/60">This customizes your automation blueprint and time-saving benchmarks.</p>
        </div>
        <div class="space-y-2.5">
          ${[
            '👨‍💼 Qualified Chartered Accountant (CA in Practice / Industry)',
            '📊 Senior Accountant / Finance Manager',
            '📝 Article Assistant / Semi-Qualified CA',
            '🎓 Commerce Graduate (B.Com / M.Com / MBA Finance)',
            '🏢 Business Owner / Finance Controller'
          ].map(r => `
            <button onclick="handleQuizSelect('role', '${r}')" class="w-full p-3.5 rounded-xl bg-white/5 hover:bg-[#c4953a]/20 border border-white/10 hover:border-[#c4953a]/50 text-left text-xs font-semibold text-white transition flex items-center justify-between">
              <span>${r}</span>
              <span class="text-[#c4953a]">→</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  } else if (quizState.step === 2) {
    indicator.innerText = 'Step 2 of 5 · Bottleneck Audit';
    bar.style.width = '40%';
    container.innerHTML = `
      <div class="space-y-4">
        <div>
          <span class="text-xs font-bold text-[#c4953a] uppercase tracking-wider">Question 2</span>
          <h3 class="text-xl font-bold text-white mt-1">What eats up the most brutal hours of your work week?</h3>
          <p class="text-xs text-white/60">Select your biggest manual headache.</p>
        </div>
        <div class="space-y-2.5">
          ${[
            '🧾 GSTR-2A vs 2B Tax Mismatch Matching & Dispute Lists',
            '🏦 Manual Bank Statement Matching & Ledger Tie-Outs',
            '📑 Typing & Classifying Journal Entries from Raw Invoices',
            '⏱️ Month-End GL Scrutiny, Flux Notes & MIS Reports'
          ].map(b => `
            <button onclick="handleQuizSelect('bottleneck', '${b}')" class="w-full p-3.5 rounded-xl bg-white/5 hover:bg-[#c4953a]/20 border border-white/10 hover:border-[#c4953a]/50 text-left text-xs font-semibold text-white transition flex items-center justify-between">
              <span>${b}</span>
              <span class="text-[#c4953a]">→</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  } else if (quizState.step === 3) {
    indicator.innerText = 'Step 3 of 5 · Cycle Time Audit';
    bar.style.width = '60%';
    container.innerHTML = `
      <div class="space-y-4">
        <div>
          <span class="text-xs font-bold text-[#c4953a] uppercase tracking-wider">Question 3</span>
          <h3 class="text-xl font-bold text-white mt-1">How many days does your team's month-end close take currently?</h3>
          <p class="text-xs text-white/60">From day 1 of month-end until trial balance is finalized.</p>
        </div>
        <div class="space-y-2.5">
          ${[
            '⚡ 1 to 5 Days (Already Fast & Optimized)',
            '⏳ 6 to 10 Days (Average — causes regular late nights)',
            '🛑 11 to 15+ Days (Painful backlog & reporting delays)'
          ].map(d => `
            <button onclick="handleQuizSelect('closeDuration', '${d}')" class="w-full p-3.5 rounded-xl bg-white/5 hover:bg-[#c4953a]/20 border border-white/10 hover:border-[#c4953a]/50 text-left text-xs font-semibold text-white transition flex items-center justify-between">
              <span>${d}</span>
              <span class="text-[#c4953a]">→</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  } else if (quizState.step === 4) {
    indicator.innerText = 'Step 4 of 5 · Software Stack';
    bar.style.width = '80%';
    container.innerHTML = `
      <div class="space-y-4">
        <div>
          <span class="text-xs font-bold text-[#c4953a] uppercase tracking-wider">Question 4</span>
          <h3 class="text-xl font-bold text-white mt-1">What accounting tool/software do you live in?</h3>
          <p class="text-xs text-white/60">We verify Claude prompt compatibility with your software.</p>
        </div>
        <div class="space-y-2.5">
          ${[
            '📦 Tally Prime / ERP 9 (100% Compatible via CSV/Excel)',
            '☁️ Zoho Books / QuickBooks Online',
            '🏢 SAP ERP / Oracle / NetSuite',
            '📊 Advanced Microsoft Excel & Google Sheets'
          ].map(s => `
            <button onclick="handleQuizSelect('software', '${s}')" class="w-full p-3.5 rounded-xl bg-white/5 hover:bg-[#c4953a]/20 border border-white/10 hover:border-[#c4953a]/50 text-left text-xs font-semibold text-white transition flex items-center justify-between">
              <span>${s}</span>
              <span class="text-[#c4953a]">→</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  } else if (quizState.step === 5) {
    indicator.innerText = 'Step 5 of 5 · Contact Verification';
    bar.style.width = '95%';
    container.innerHTML = `
      <div class="space-y-5">
        <div>
          <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider">Audit Complete!</span>
          <h3 class="text-xl font-bold text-white mt-1">Where should we deliver your Custom AI Automation Scorecard &amp; Claude Prompts?</h3>
          <p class="text-xs text-white/60">Enter your details below to unlock your custom breakdown and time-savings report.</p>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-[11px] font-bold text-white/70 block mb-1">Your Full Name:</label>
            <input type="text" id="quizName" placeholder="e.g. Manak Sehgal" class="w-full bg-white/5 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#c4953a]">
          </div>
          <div>
            <label class="text-[11px] font-bold text-white/70 block mb-1">Work / Personal Email:</label>
            <input type="email" id="quizEmail" placeholder="e.g. manakppc@gmail.com" class="w-full bg-white/5 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#c4953a]">
          </div>
          <div>
            <label class="text-[11px] font-bold text-white/70 block mb-1">WhatsApp Number (For PDF Blueprint):</label>
            <input type="tel" id="quizPhone" placeholder="e.g. +91 98765 43210" class="w-full bg-white/5 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#c4953a]">
          </div>
        </div>

        <button onclick="submitQuizLead()" class="w-full py-3.5 rounded-xl btn-gold text-sm font-bold flex items-center justify-center gap-2 shadow-lg">
          <span>Calculate My AI Readiness Score &amp; Unlock Report →</span>
        </button>
        <p class="text-[10px] text-white/40 text-center">🔒 100% confidential. No spam. Instant scorecard delivery.</p>
      </div>
    `;
  } else if (quizState.step === 6) {
    // DIAGNOSIS & CONVERSION BRIDGE (THE PITCH)
    indicator.innerText = 'Personalized Automation Scorecard';
    bar.style.width = '100%';

    // Custom calculation based on answers
    let hoursSaved = '14 to 20 hours';
    if (quizState.closeDuration.includes('11-15+')) hoursSaved = '25+ hours';
    else if (quizState.closeDuration.includes('6-10')) hoursSaved = '16 hours';

    container.innerHTML = `
      <div class="space-y-5 text-center">
        
        <!-- Score Card -->
        <div class="p-5 rounded-2xl bg-[#c4953a]/15 border-2 border-[#c4953a] space-y-2">
          <span class="text-[10px] font-bold text-[#c4953a] uppercase tracking-wider">Your Automation Score</span>
          <div class="text-4xl font-black text-white font-mono">89% <span class="text-base text-emerald-400 font-normal">High Readiness</span></div>
          <p class="text-xs text-white/80">
            Great news, <b>${quizState.name || 'Finance Pro'}</b>! Your accounting tasks in <b>${quizState.software.split('(')[0].trim()}</b> have direct plug-and-play AI workflows available.
          </p>
        </div>

        <!-- Custom Findings -->
        <div class="p-4 rounded-xl bg-black/40 border border-white/10 text-left space-y-2.5 text-xs text-white/85">
          <div class="flex items-start gap-2">
            <span class="text-emerald-400 font-bold">✓</span>
            <span><b>Bottleneck Solved:</b> Your biggest pain point (<i>${quizState.bottleneck}</i>) can be automated using Claude prompts taught in Module 3 &amp; 4.</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-emerald-400 font-bold">✓</span>
            <span><b>Projected Time Savings:</b> You can reclaim <b>${hoursSaved} every single month</b> and close on Day 5 instead of ${quizState.closeDuration.split('(')[0].trim()}.</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-emerald-400 font-bold">✓</span>
            <span><b>Career Advantage:</b> As a ${quizState.role.split('(')[0].trim()}, mastering these 5 workflows positions you for senior AI-native roles paying ₹35–45L+.</span>
          </div>
        </div>

        <!-- The Conversion Bridge CTA -->
        <div class="space-y-3 pt-2">
          <button onclick="claimQualifiedOffer()" class="w-full py-4 rounded-xl btn-gold text-sm font-bold shadow-xl flex items-center justify-center gap-2 transform hover:scale-[1.02] transition">
            <span>Claim Your Spot in AI Accounting Engineer (₹1,499) →</span>
          </button>
          <p class="text-[11px] text-emerald-400 font-semibold">
            ⚡ Founding Offer Applied: ₹3,501 Saved · Pre-filled Checkout Ready
          </p>
        </div>

      </div>
    `;
  }
}

function handleQuizSelect(key, val) {
  quizState[key] = val;
  quizState.step++;
  renderQuizStep();
}

function submitQuizLead() {
  const name = document.getElementById('quizName').value.trim();
  const email = document.getElementById('quizEmail').value.trim();
  const phone = document.getElementById('quizPhone').value.trim();

  if (!email || !phone) {
    alert('Please provide your Email and WhatsApp number so we can deliver your personalized report.');
    return;
  }

  quizState.name = name || 'Finance Leader';
  quizState.email = email;
  quizState.phone = phone;

  // Sync with funnel checkout state so user never has to re-type!
  funnelState.buyerName = quizState.name;
  funnelState.buyerEmail = quizState.email;
  funnelState.buyerPhone = quizState.phone;

  quizState.step = 6;
  renderQuizStep();
}

// When user clicks "Claim Spot" from quiz result -> opens Checkout with pre-filled details!
function claimQualifiedOffer() {
  closeFunnelModal('leadQualifierModal');
  startFunnelCheckout();

  // Pre-fill fields
  if (document.getElementById('buyerName')) document.getElementById('buyerName').value = funnelState.buyerName;
  if (document.getElementById('buyerEmail')) document.getElementById('buyerEmail').value = funnelState.buyerEmail;
  if (document.getElementById('buyerPhone')) document.getElementById('buyerPhone').value = funnelState.buyerPhone;
}

// ==========================================
// ⚡ CHECKOUT & PAYMENT FUNNEL
// ==========================================

function startFunnelCheckout() {
  const modal = document.getElementById('funnelCheckoutModal');
  if (modal) {
    modal.classList.remove('hidden');
    updateCheckoutTotal();
    // Pre-fill if lead qualified
    if (funnelState.buyerName && document.getElementById('buyerName')) {
      document.getElementById('buyerName').value = funnelState.buyerName;
    }
    if (funnelState.buyerEmail && document.getElementById('buyerEmail')) {
      document.getElementById('buyerEmail').value = funnelState.buyerEmail;
    }
    if (funnelState.buyerPhone && document.getElementById('buyerPhone')) {
      document.getElementById('buyerPhone').value = funnelState.buyerPhone;
    }
  }
}

function closeFunnelModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

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

// Open Real Payment Gateway (Step 2)
function openRealPaymentGateway() {
  funnelState.buyerName = document.getElementById('buyerName').value || 'Customer';
  funnelState.buyerEmail = document.getElementById('buyerEmail').value || 'manakppc@gmail.com';
  funnelState.buyerPhone = document.getElementById('buyerPhone').value || '+91 98765 43210';

  closeFunnelModal('funnelCheckoutModal');

  const total = funnelState.basePrice + (funnelState.hasOrderBump ? funnelState.bumpPrice : 0);
  const itemSummary = funnelState.hasOrderBump 
    ? '5-Module Course + Prompt Pack' 
    : '5-Module AI Course';

  document.getElementById('realPayAmount').innerText = `₹${total.toLocaleString('en-IN')}`;
  document.getElementById('paymentItemSummary').innerText = itemSummary;

  // Generate NPCI UPI Link
  const note = encodeURIComponent(`AI Accounting Course - ${funnelState.buyerName}`);
  const upiUrl = `upi://pay?pa=${funnelState.upiVpa}&pn=AIAccountingEngineer&am=${total}&cu=INR&tn=${note}`;
  
  // Real QR Code Image
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`;
  const qrImg = document.getElementById('upiQrImage');
  if (qrImg) qrImg.src = qrApiUrl;

  // App Links
  const gpay = document.getElementById('gpayLink');
  const phonepe = document.getElementById('phonepeLink');
  const paytm = document.getElementById('paytmLink');
  if (gpay) gpay.href = upiUrl;
  if (phonepe) phonepe.href = upiUrl;
  if (paytm) paytm.href = upiUrl;

  const paymentModal = document.getElementById('realPaymentModal');
  if (paymentModal) paymentModal.classList.remove('hidden');
}

function confirmRealPayment() {
  closeFunnelModal('realPaymentModal');
  const upsellModal = document.getElementById('funnelUpsellModal');
  if (upsellModal) {
    upsellModal.classList.remove('hidden');
  }
}

function acceptFunnelUpsell() {
  funnelState.hasUpsell = true;
  closeFunnelModal('funnelUpsellModal');
  showSuccessReceipt();
}

function declineFunnelUpsell() {
  funnelState.hasUpsell = false;
  closeFunnelModal('funnelUpsellModal');
  showSuccessReceipt();
}

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

// Countdown Timer
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
