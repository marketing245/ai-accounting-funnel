/**
 * AI Accounting Engineer - Funnel Engine Interactive Logic
 */

let state = {
  activeTab: 'v1',
  orderBumpSelected: false,
  basePrice: 1499,
  bumpPrice: 399,
  upsellPrice: 2999,
  upsellAccepted: false,
  waStep: 0,
  carouselSlide: 0,
  carouselSlides: [
    {
      step: 'Slide 1 of 4',
      title: 'Why 80% of CAs are drowning in Month-End Closes (and how AI changes it)',
      body: 'Swipe left to see the exact 5-step Claude prompt breakdown that reduced our team\'s close cycle from 12 days to 5 days.'
    },
    {
      step: 'Slide 2 of 4',
      title: 'Step 1: Raw Bank Statement to Automated Classification',
      body: 'Instead of typing 500 journal entries manually, feed 30-day bank CSV into Claude with our classified chart of accounts prompt. Result: 20 mins -> 2 mins.'
    },
    {
      step: 'Slide 3 of 4',
      title: 'Step 2: GSTR-2A vs 2B Auto-Reconciliation',
      body: 'Claude parses both JSON/Excel files, highlights tax mismatches, and outputs a ready-to-dispute vendor vendor exception list in seconds.'
    },
    {
      step: 'Slide 4 of 4',
      title: 'Want the exact prompts? Comment "PROMPTS" below',
      body: 'I will DM you the complete prompt sheet + SOP template for free.'
    }
  ],
  waMessages: [
    {
      type: 'in',
      text: 'Hi Varsha ma\'am! I saw your reel on Instagram. Can you send the AI Accounting prompt guide?',
      time: '10:42 AM'
    },
    {
      type: 'out',
      text: 'Hey! Here is your download link for the 50+ Claude Accounting Prompts Playbook 📥:\nhttps://aiaccountingengineer.com/playbook.pdf\n\nTake 5 minutes to test Module 1 on your live bank rec!',
      time: '10:43 AM'
    },
    {
      type: 'out',
      text: 'Quick video tip from my desk: Always specify "Classify according to Indian AS 18" in prompt line 3 to prevent narration errors 💡',
      time: 'Day 1 · 11:15 AM'
    },
    {
      type: 'out',
      text: 'Case Study 🚀: Rajesh (Senior Accountant at a Bangalore tech firm) used our GSTR-2B prompt yesterday and closed month-end reconciliations in 45 minutes instead of 8 hours.\n\nHis team thought he worked all night!',
      time: 'Day 2 · 02:30 PM'
    },
    {
      type: 'out',
      text: 'Hey! We are closing the Founding Cohort offer for the complete 5-Module AI in Accounting Program in 6 hours.\n\nUse this private link to get ₹3,501 off (₹1,499 only):\n👉 https://aiaccountingengineer.com/cohort',
      time: 'Day 3 · 06:00 PM'
    }
  ]
};

// Tab Switcher
function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.className = 'tab-btn active px-3.5 py-1.5 text-xs rounded-lg transition whitespace-nowrap';
    } else {
      btn.className = 'tab-btn px-3.5 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition whitespace-nowrap';
    }
  });
}

// Checkout Modal
function openCheckoutModal() {
  document.getElementById('checkoutModal').classList.remove('hidden');
  updateModalTotal();
}

function closeCheckoutModal() {
  document.getElementById('checkoutModal').classList.add('hidden');
}

function toggleOrderBump() {
  state.orderBumpSelected = document.getElementById('orderBumpCheck').checked;
  updateModalTotal();
}

function updateModalTotal() {
  const total = state.basePrice + (state.orderBumpSelected ? state.bumpPrice : 0);
  document.getElementById('modalTotalPayable').innerText = `₹${total.toLocaleString('en-IN')}`;
}

function simulateOrderSuccess() {
  closeCheckoutModal();
  // Open One-Click Upsell Modal
  document.getElementById('upsellModal').classList.remove('hidden');
}

function acceptUpsell() {
  state.upsellAccepted = true;
  document.getElementById('upsellModal').classList.add('hidden');
  const totalSpent = state.basePrice + (state.orderBumpSelected ? state.bumpPrice : 0) + state.upsellPrice;
  alert(`🎉 Payment Successful!\n\nCart Breakdown:\n- Base Course: ₹1,499\n- Order Bump: ${state.orderBumpSelected ? '₹399 (Added)' : 'None'}\n- 4-Week Cohort Upsell: ₹2,999 (Added)\n\nTotal Customer Value (AOV): ₹${totalSpent.toLocaleString('en-IN')}\n\nNotice how AOV increased from ₹1,499 to ₹${totalSpent.toLocaleString('en-IN')}!`);
}

function declineUpsell() {
  state.upsellAccepted = false;
  document.getElementById('upsellModal').classList.add('hidden');
  const totalSpent = state.basePrice + (state.orderBumpSelected ? state.bumpPrice : 0);
  alert(`✅ Order Confirmed!\n\nTotal Paid: ₹${totalSpent.toLocaleString('en-IN')}\nAccess credentials dispatched to WhatsApp & Email.`);
}

// WhatsApp Chat Simulation
function renderWAChat() {
  const chatArea = document.getElementById('waChatArea');
  if (!chatArea) return;
  chatArea.innerHTML = '';

  for (let i = 0; i <= state.waStep && i < state.waMessages.length; i++) {
    const msg = state.waMessages[i];
    const bubble = document.createElement('div');
    bubble.className = msg.type === 'in' ? 'wa-bubble-in' : 'wa-bubble-out';
    bubble.innerHTML = `
      <div style="white-space: pre-line;">${msg.text}</div>
      <div class="wa-time">${msg.time} ${msg.type === 'out' ? '✓✓' : ''}</div>
    `;
    chatArea.appendChild(bubble);
  }
  chatArea.scrollTop = chatArea.scrollHeight;
}

function simulateNextWAMsg() {
  if (state.waStep < state.waMessages.length - 1) {
    state.waStep++;
    renderWAChat();
  } else {
    alert('Full 4-day WhatsApp drip sequence completed! Notice how trust builds before the paid offer is pitched.');
  }
}

function resetWAChat() {
  state.waStep = 1;
  renderWAChat();
}

// Workshop Pass Generator
function generateWorkshopPass() {
  document.getElementById('passContainer').classList.remove('hidden');
  const seatsEl = document.getElementById('workshopSeats');
  let currentSeats = parseInt(seatsEl.innerText) || 17;
  if (currentSeats > 1) {
    seatsEl.innerText = `${currentSeats - 1} Seats`;
  }
}

// LinkedIn Carousel Navigator
function renderCarouselSlide() {
  const slide = state.carouselSlides[state.carouselSlide];
  const box = document.getElementById('carouselSlideContent');
  if (!box) return;
  box.innerHTML = `
    <span class="text-[10px] font-bold text-gold uppercase tracking-wider">${slide.step}</span>
    <h4 class="text-xl font-bold text-white mt-2">${slide.title}</h4>
    <p class="text-xs text-white/70 mt-2">${slide.body}</p>
  `;
}

function nextSlide() {
  state.carouselSlide = (state.carouselSlide + 1) % state.carouselSlides.length;
  renderCarouselSlide();
}

function prevSlide() {
  state.carouselSlide = (state.carouselSlide - 1 + state.carouselSlides.length) % state.carouselSlides.length;
  renderCarouselSlide();
}

function triggerLinkedInBot() {
  const input = document.getElementById('commentInput');
  if (input.value.trim().toUpperCase().includes('PROMPT')) {
    document.getElementById('botResponse').classList.remove('hidden');
  } else {
    alert('Please type "PROMPTS" in the comment box to trigger the ManyChat workflow simulation.');
  }
}

// B2B Team License Calculator
function updateB2BCalculation() {
  const seats = parseInt(document.getElementById('seatSlider').value);
  document.getElementById('seatCount').innerText = `${seats} Seats`;

  const hoursPerAccountant = 16;
  const totalHours = seats * hoursPerAccountant;
  document.getElementById('hoursSaved').innerText = `${totalHours} hrs`;

  const billableRate = 350;
  const savings = totalHours * billableRate;
  document.getElementById('costSavings').innerText = `₹${savings.toLocaleString('en-IN')} / mo`;

  let price = 0;
  let bundleName = '';
  if (seats <= 5) {
    price = 8999;
    bundleName = 'Starter Firm Pack (5 Seats)';
  } else if (seats <= 15) {
    price = 18999;
    bundleName = `Growth Firm Pack (${seats} Seats)`;
  } else {
    price = 29999 + (seats - 20) * 1200;
    bundleName = `Enterprise Firm License (${seats} Seats)`;
  }

  document.getElementById('bundleName').innerText = bundleName;
  document.getElementById('bundlePrice').innerText = `₹${price.toLocaleString('en-IN')}`;
}

// Full Funnel Unit Economics Engine
function runFullCalculation() {
  const spend = parseFloat(document.getElementById('calcSpend').value);
  const cpc = parseFloat(document.getElementById('calcCpc').value);
  const cvr = parseFloat(document.getElementById('calcCvr').value) / 100;
  const bumpRate = parseFloat(document.getElementById('calcBump').value) / 100;
  const upsellRate = parseFloat(document.getElementById('calcUpsell').value) / 100;

  // Update slider text displays
  document.getElementById('calcSpendText').innerText = `₹${spend.toLocaleString('en-IN')}`;
  document.getElementById('calcCpcText').innerText = `₹${cpc}`;
  document.getElementById('calcCvrText').innerText = `${(cvr * 100).toFixed(1)}%`;
  document.getElementById('calcBumpText').innerText = `${Math.round(bumpRate * 100)}%`;
  document.getElementById('calcUpsellText').innerText = `${Math.round(upsellRate * 100)}%`;

  // Mathematical Calculations
  const visitors = Math.floor(spend / cpc);
  const buyers = Math.floor(visitors * cvr);
  
  if (buyers === 0) return;

  const baseRevenue = buyers * 1499;
  const bumpBuyers = Math.floor(buyers * bumpRate);
  const bumpRevenue = bumpBuyers * 399;
  const upsellBuyers = Math.floor(buyers * upsellRate);
  const upsellRevenue = upsellBuyers * 2999;

  const grossRev = baseRevenue + bumpRevenue + upsellRevenue;
  const aov = Math.round(grossRev / buyers);
  const cac = Math.round(spend / buyers);
  const netProfit = grossRev - spend;
  const roas = (grossRev / spend).toFixed(2);

  // Render outputs
  document.getElementById('resVisitors').innerText = visitors.toLocaleString('en-IN');
  document.getElementById('resBuyers').innerText = buyers.toLocaleString('en-IN');
  document.getElementById('resAov').innerText = `₹${aov.toLocaleString('en-IN')}`;
  document.getElementById('resCac').innerText = `₹${cac.toLocaleString('en-IN')}`;
  document.getElementById('resGrossRev').innerText = `₹${grossRev.toLocaleString('en-IN')}`;
  document.getElementById('resSpend').innerText = `- ₹${spend.toLocaleString('en-IN')}`;
  document.getElementById('resNetProfit').innerText = `₹${netProfit.toLocaleString('en-IN')}`;
  document.getElementById('resRoas').innerText = `${roas}x`;

  const profitEl = document.getElementById('resNetProfit');
  if (netProfit >= 0) {
    profitEl.className = 'text-2xl font-extrabold text-emerald-300';
  } else {
    profitEl.className = 'text-2xl font-extrabold text-red-400';
  }
}

// Initial Setup
window.addEventListener('DOMContentLoaded', () => {
  renderWAChat();
  renderCarouselSlide();
  updateB2BCalculation();
  runFullCalculation();
});
