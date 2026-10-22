'use strict';
// Course content served ONLY to logged-in students (see api/course/lessons.js).
// Video IDs live here, never in public HTML.

const CURRICULUM = [
  {
    id: 1,
    code: "M01",
    title: "Claude 101 — Foundation",
    duration: "45 Min",
    category: "Foundation",
    unlockSchedule: "Unlocks Instantly",
    isUnlocked: true,
    bunnyVideoId: "4e8cdcac-b9ab-42db-9b72-bdc1d0a58b52",
    description: "Before we touch any workflow, you need to understand how to actually talk to AI — because it's nothing like a Google search. This module covers how to frame your work for Claude, what to ask, how to check what comes back, and why that skill is the foundation everything else is built on.",
    result: "You go from 'I don't know what to ask' to giving Claude work and getting usable output back — in your first session.",
    poster: "https://media-cdn.cosmofeed.com/chat/native-products/691ad2ab1e76fb001325bd21/88f0c6d28b2bbc76272400976fecb811a3c53a593edc926e.png",
    prompts: [
      {
        title: "Claude Accounting Framework Master Prompt",
        useCase: "Set in Claude Projects or System Prompt before work",
        content: "You are an expert Indian Chartered Accountant with 11+ years of experience across Big 4 (EY), global MNCs, and high-growth finance teams. In this session, I will provide you with financial source documents (trial balances, invoices, bank dumps, GST returns). Your role is to: 1) Extract clean structured data, 2) Apply Indian Accounting Standards (Ind AS / AS) rules, 3) Highlight exceptions rather than repeating matched rows, and 4) Provide reviewable outputs with clear audit trails. Never hallucinate missing ledger accounts or transaction dates."
      },
      {
        title: "Prompt Validation & Output Cross-Check",
        useCase: "Verify AI output before approving and posting to books",
        content: "Perform a self-audit on the output generated above. Verify: 1) Do total debits exactly equal total credits? 2) Are any dates outside the financial period? 3) Flag any high-value transactions (> ₹50,000) that require mandatory TDS or GST e-invoicing compliance. Return a structured verification scorecard."
      }
    ]
  },
  {
    id: 2,
    code: "M02",
    title: "Journal entries",
    duration: "52 Min",
    category: "Ledger",
    unlockSchedule: "Drips after 5 days",
    isUnlocked: true,
    bunnyVideoId: "9c632bf7-9220-430b-a00f-77f6684d81bb",
    description: "You take an invoice, a bank statement, a vendor bill — and Claude reads it and gives you the journal entry, correctly classified, with narration. You review, approve, post.",
    result: "20 minutes per entry → 2 minutes. You review instead of type.",
    poster: "https://media-cdn.cosmofeed.com/chat/native-products/6176b3d141ed2447e4e37e90/7c920decbde58110e2231a64dcd394118c721983372820ba.jpeg",
    prompts: [
      {
        title: "Invoice & Source Document to Journal Entry Parser",
        useCase: "Convert PDF/Image invoice text into 3-column voucher",
        content: "Read the attached vendor invoice / expense claim text. Extract: Vendor Name, Invoice Date, Invoice #, Base Amount, CGST, SGST, IGST, and Total Amount. Determine the correct Expense Ledger Account under standard Chart of Accounts. Generate the complete Journal Entry with standard professional narration: 'Being [Expense Description] against Invoice #[InvoiceNo] dated [Date] approved for payment.' Format as a clean table with Debit and Credit columns."
      },
      {
        title: "Bulk Invoices Narration & Classification Engine",
        useCase: "Process batch expenses in one prompt",
        content: "Analyze the attached 25 vendor expense rows. Classify each row into its appropriate accounting head: [Rent, Cloud Infrastructure, Legal & Professional Fees, Office Supplies, Travel]. Flag any invoice requiring TDS deduction under Section 194C, 194J, or 194I with the applicable threshold and rate."
      }
    ]
  },
  {
    id: 3,
    code: "M03",
    title: "Bank reconciliation & fixed asset depreciation",
    duration: "58 Min",
    category: "Ledger",
    unlockSchedule: "Drips after 5 days",
    isUnlocked: true,
    bunnyVideoId: "f66542f3-9a50-4f8e-a521-a6b7d7681667",
    description: "Paste your bank data and let Claude do the matching. You spend your time on the items that actually don't reconcile — not the ones that do. Depreciation schedules work the same way.",
    result: "Hours of matching → minutes. Depreciation schedules you can hand to anyone, generated in one pass.",
    poster: "https://media-cdn.cosmofeed.com/chat/native-products/6176b3d141ed2447e4e37e90/fa74ee5188d0f973efc2af53188ce02948816d1eff4af7e6.jpeg",
    prompts: [
      {
        title: "Bank Statement Matching & Exception Extractor",
        useCase: "Reconcile Bank Dump vs General Ledger Cash Book in Excel",
        content: "I have provided two tables: Table 1 (Bank Statement) and Table 2 (Books of Accounts). Perform automated reconciliation by matching date (within +/- 3 days buffer), exact amount, and reference numbers. Separate output into: 1) Matched Entries (total count and value), 2) Outstanding Cheques Issued but Not Presented, 3) Uncredited Deposits, 4) Bank Charges & Interest not booked in ledger with suggested adjustment journal entries."
      },
      {
        title: "Companies Act Schedule II Fixed Asset Depreciation",
        useCase: "Generate SLM/WDV depreciation schedules",
        content: "Generate a complete Fixed Asset Register Depreciation Schedule under Companies Act 2013 (Schedule II) using the Written Down Value (WDV) method. For each asset class [Computers (3 yrs), Plant & Machinery (15 yrs), Furniture (10 yrs)], calculate: Opening WDV, Additions during the year (split into >180 days and <180 days), Depreciation for the year, and Closing WDV. Also show the deferred tax impact comparison with Income Tax Act rules (Section 32)."
      }
    ]
  },
  {
    id: 4,
    code: "M04",
    title: "GST reconciliation",
    duration: "60 Min",
    category: "Compliance",
    unlockSchedule: "Drips after 5 days",
    isUnlocked: true,
    bunnyVideoId: "7785eb45-321b-4200-8ad7-fc8c82bcd4bd",
    description: "Claude runs the 2A vs 2B comparison, flags the mismatches, and gives you a clean exception list. You know exactly what needs attention and what doesn't.",
    result: "A full day of GST matching → one hour of focused review.",
    poster: "https://media-cdn.cosmofeed.com/chat/native-products/6176b3d141ed2447e4e37e90/8ab9b6c13697c930fcc9b35cfbd08b788e98d8188435a37d.jpeg",
    prompts: [
      {
        title: "GSTR-2B vs Purchase Register 2-Way Matcher",
        useCase: "Identify missing ITC and vendor filing discrepancies",
        content: "Compare the attached GSTR-2B government portal extract against our internal Purchase Register. Reconcile on GSTIN, Invoice Number, Invoice Date, and Taxable Value (allow +/- ₹1 rounding tolerance). Categorize each invoice into: 1) Matched (Eligible for ITC in Table 4A5 of GSTR-3B), 2) In GSTR-2B but Missing in Books, 3) In Books but Missing in GSTR-2B (Ineligible ITC under Sec 16(2)(aa)), 4) Tax Amount Mismatches. Format as an audit-ready summary."
      },
      {
        title: "Automated Vendor ITC Follow-up Notice",
        useCase: "Email/WhatsApp notice for defaulting suppliers",
        content: "Generate a professional, firm compliance communication for Vendor [Vendor Name], GSTIN [GSTIN]. State that [Count] invoices totaling ₹[Total Tax] are currently not reflecting in our GSTR-2B for the period [Month Year], blocking our input tax credit under Section 16(2)(aa). Request them to confirm filing of GSTR-1 before the 11th of this month to avoid payment withholding."
      }
    ]
  },
  {
    id: 5,
    code: "M05",
    title: "Month-end close (Capstone)",
    duration: "65 Min",
    category: "Capstone",
    unlockSchedule: "Drips after 5 days",
    isUnlocked: true,
    bunnyVideoId: "e26a756b-7495-4fe5-9a98-b041362956f1",
    description: "GL scrutiny, tie-outs, flux notes — this module brings everything together into a close that finishes on time. The capstone where hours saved across every module compound.",
    result: "Close on Day 5 instead of Day 15. The single biggest career unlock in this course.",
    poster: "https://media-cdn.cosmofeed.com/chat/native-products/6176b3d141ed2447e4e37e90/a47afdd6c1ab2002cd45b834d198e1c55ffc640cb22c0a4d.jpeg",
    prompts: [
      {
        title: "GL Scrutiny & Unusual Movement Anomaly Detector",
        useCase: "Scan trial balance for balance sheet audit",
        content: "Review the attached closing Trial Balance. Conduct detailed General Ledger scrutiny: 1) Identify abnormal balances (e.g., negative cash, debit balance in trade creditors, credit balance in trade receivables), 2) Flag any expense ledger showing > 25% fluctuation month-over-month (Flux Analysis) and require explanations, 3) Verify that all clearing accounts (GR/IR, payroll clearing, bank transit) are zeroed out. Produce an Executive Close Checklist."
      },
      {
        title: "Day 5 Executive Close & Flux Note Summary",
        useCase: "Prepare management deck commentary",
        content: "You are the Financial Controller preparing the Day 5 month-end close deck for the CFO and Board. Based on the finalized P&L and Balance Sheet figures attached, draft the Monthly Management Flux Commentary covering: 1) Revenue drivers vs budget, 2) Gross margin walk, 3) Operating expense variances, 4) Working capital days (DSO, DPO, DIO). Keep it punchy, professional, and data-backed."
      }
    ]
  }
];

// Downloadable resources per module. url:null = not uploaded yet (portal shows "coming soon", never a fake file).
const RESOURCES = [
  { moduleId: 3, title: 'Bank Reconciliation Master Sheet (.xlsx)', description: 'Matching sheet used in the bank rec lesson.', url: null },
  { moduleId: 2, title: 'Tally XML Voucher Template', description: 'Bulk import template for purchase vouchers.', url: null },
  { moduleId: 1, title: 'AI SOP Handbook for CA firms (.pdf)', description: 'Step-by-step SOP for articles and junior accountants.', url: null },
];

function publicCurriculum() {
  return CURRICULUM.map((m) => ({
    id: m.id, code: m.code, title: m.title, duration: m.duration, category: m.category,
    description: m.description, result: m.result, prompts: m.prompts || [],
    unlockSchedule: 'Available now',
  }));
}

module.exports = { CURRICULUM, RESOURCES, publicCurriculum };
