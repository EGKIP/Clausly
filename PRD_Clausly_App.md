# Clausly.app Product Requirements Document (PRD)

**Product Name:** Clausly.app  
**Domain:** clausly.app  
**Document Type:** Product Requirements Document  
**Primary Audience:** Codex, Augment AI, developers, product contributors, future maintainers  
**Status:** Initial MVP planning document  
**Last Updated:** June 3, 2026  

---

## 1. Product Summary

Clausly.app is an AI-powered contract intelligence and reminder platform that helps users understand, organize, track, and manage contracts, leases, and agreements. Users can upload PDFs or supported documents, store them securely, extract important clauses and dates, understand potential risks, approve suggested reminders, and maintain a long-term portfolio of their important legal and financial documents.

Clausly is not intended to replace a lawyer or provide legal advice. The product should be positioned as a contract organization, document intelligence, and reminder platform. It helps users understand what they signed, remember important obligations, and stay aware of deadlines.

The core promise is:

> Clausly.app turns contracts into organized summaries, risk insights, and approved reminders so users never miss what they signed.

---

## 2. Product Positioning

### 2.1 What Clausly Is

Clausly is:

- A secure home for leases, contracts, agreements, and other important documents.
- An AI-assisted document reader that extracts summaries, important clauses, deadlines, obligations, and potential risks.
- A personal reminder system for contract dates and obligations.
- A contract portfolio dashboard where users can review their active documents chronologically and by risk.
- A future platform for browser-based terms and agreement review through a Chrome extension.
- A future bridge between users and licensed legal professionals, only after the core product is stable.

### 2.2 What Clausly Is Not

Clausly is not:

- An AI lawyer.
- A legal advice platform.
- A replacement for attorney review.
- A legal document drafting tool in the MVP.
- A lawsuit/case intake marketplace in the MVP.
- A generic “chat with PDF” tool.

The product should avoid language such as “AI legal advisor,” “AI attorney,” or “legal decision engine.” Safer language includes “contract intelligence,” “contract organizer,” “document insights,” “deadline tracking,” and “risk awareness.”

---

## 3. Target Users

### 3.1 Primary MVP Users

The first version should focus on everyday consumers, especially renters and people managing personal agreements.

Examples:

- Students with apartment leases.
- Renters managing lease renewal dates and notice deadlines.
- People with car loans, insurance contracts, service contracts, or employment agreements.
- Users who sign documents but do not fully track obligations, fees, renewal clauses, or deadlines.

### 3.2 Secondary Users

Future target groups may include:

- Freelancers and contractors managing client agreements.
- Small business owners managing vendor contracts.
- Landlords managing lease portfolios.
- Professionals who want contract reminders and summaries.
- Users reviewing online terms, privacy policies, and subscription agreements through the browser extension.

### 3.3 Future Users

Long-term users may include:

- Attorneys seeking qualified leads from users who request legal help.
- Legal clinics or student legal support organizations.
- Property managers.
- Small teams managing shared contract portfolios.

These future user types should not drive MVP complexity.

---

## 4. Problem Statement

Most people sign contracts and leases without fully understanding or tracking them. Important information is usually buried inside long PDF documents, including renewal dates, cancellation windows, late fees, notice periods, liability terms, payment obligations, and penalties.

Common user problems:

- Users forget when a lease ends.
- Users miss notice deadlines before renewal.
- Users do not know when automatic renewal applies.
- Users overlook late payment penalties.
- Users cannot quickly find important clauses later.
- Users store contracts randomly in email, downloads, cloud drives, or paper folders.
- Users do not have a single organized portfolio for their signed obligations.
- Users may not know which parts of a document are risky or need attention.

Clausly solves this by turning uploaded documents into structured, searchable, and reminder-driven contract records.

---

## 5. Product Goals

### 5.1 MVP Goals

The MVP should allow users to:

1. Create an account and sign in securely.
2. Upload a contract, lease, or agreement as a PDF.
3. Store the original PDF securely.
4. Extract text from the PDF.
5. Generate an AI summary of the document.
6. Extract important clauses and explain them in plain language.
7. Identify important dates and obligations.
8. Suggest reminders based on extracted deadlines.
9. Allow users to approve, edit, or ignore reminder suggestions.
10. View all saved documents in a structured dashboard.
11. Open a document profile containing the PDF, summary, clauses, dates, risks, and reminders.
12. Ask questions about a document using AI, with answers grounded in the uploaded document.
13. Distinguish Free and Pro features clearly.
14. Support future expansion without major redesign.

### 5.2 Long-Term Goals

Future versions may include:

- Chrome extension for reviewing online terms, conditions, and contracts before signing.
- Weekly and monthly AI portfolio insights.
- Cross-document search across all saved contracts.
- Contract comparison between versions.
- SMS reminders.
- Calendar integration.
- Lawyer referral marketplace.
- Team or family document workspaces.
- Mobile app.

---

## 6. MVP Scope

### 6.1 Included in MVP

The MVP includes:

- Public website with landing page, pricing page, and authentication entry points.
- User authentication.
- User profile with basic state/jurisdiction preference.
- PDF upload.
- Secure file storage.
- Text extraction from uploaded PDFs.
- AI analysis pipeline.
- Document dashboard.
- Document detail page.
- Clause extraction.
- Deadline extraction.
- Risk labeling.
- Reminder suggestions.
- User approval flow for reminders.
- Email reminders.
- Document Q&A.
- Free and Pro tier separation.
- Basic subscription integration.

### 6.2 Not Included in MVP

The MVP should not include:

- Lawyer marketplace.
- Case intake for legal disputes.
- Legal advice workflows.
- Chrome extension.
- SMS reminders.
- Mobile app.
- Team accounts.
- Contract generation.
- E-signature workflows.
- Full legal research engine.
- Attorney-client communication system.

These should be treated as roadmap items.

---

## 7. Core User Flows

### 7.1 New User Signup Flow

1. User visits clausly.app.
2. User clicks Sign Up.
3. User creates account using email/password or supported provider.
4. User is asked for basic profile information:
   - Name.
   - Email.
   - Default state or jurisdiction for general context.
5. User lands on dashboard.
6. Dashboard prompts user to upload their first document.

Important note: The user’s state should be used as general context only. Users must be able to change the state/jurisdiction per document because someone may live in one state and upload a contract governed by another state.

### 7.2 Document Upload Flow

1. User clicks Upload Document.
2. User selects a PDF file.
3. System validates file type, size, and upload permissions.
4. System uploads original PDF to secure storage.
5. System creates a document record in the database.
6. System extracts text from the document.
7. System sends extracted text and document metadata to AI analysis pipeline.
8. System generates structured output:
   - Document title.
   - Document type.
   - Short summary.
   - Key clauses.
   - Important dates.
   - Obligations.
   - Risk labels.
   - Suggested reminders.
9. User sees an analysis results screen.
10. User reviews AI-generated suggestions.
11. User can approve, edit, or ignore detected reminders.
12. Document becomes available in the user’s portfolio.

### 7.3 Document Portfolio Flow

1. User signs in.
2. User sees dashboard with:
   - Upcoming actions.
   - Recent documents.
   - Documents needing review.
   - High-risk documents.
3. User can filter or sort documents by:
   - Upload date.
   - Effective date.
   - End date.
   - Risk level.
   - Document type.
   - State/jurisdiction.
4. User clicks a document.
5. User opens document profile.

### 7.4 Document Detail Flow

The document detail page should show:

- Original PDF viewer.
- Document title and type.
- Risk level.
- Effective date and end date if available.
- AI-generated summary.
- Key clauses.
- Important dates.
- Approved reminders.
- Suggested reminders pending approval.
- User notes.
- Ask Clausly / Document Q&A section.

### 7.5 Reminder Approval Flow

1. AI detects a date or obligation.
2. System creates a suggested reminder object, not an active reminder.
3. Suggested reminder includes:
   - Suggested title.
   - Date.
   - Time if available.
   - Short description.
   - Source clause or page reference.
   - Confidence level.
   - Suggested reminder timing.
4. User can:
   - Approve as-is.
   - Edit title, date, description, or reminder timing.
   - Ignore the suggestion.
5. Only approved reminders become active.
6. Active reminders trigger notifications based on the user’s selected reminder settings.

AI should never automatically create active reminders without user approval.

### 7.6 Document Q&A Flow

1. User opens a saved document.
2. User asks a question such as:
   - “When does this lease end?”
   - “What happens if I terminate early?”
   - “Are there late payment fees?”
   - “Do I need to give notice before moving out?”
3. AI answers using the document content.
4. Answer should include source references when possible.
5. If AI is uncertain, it should say so clearly.
6. AI should avoid legal advice and recommend attorney review for high-risk or legal interpretation questions.

---

## 8. Functional Requirements

### 8.1 Authentication Requirements

The system must support:

- User registration.
- User login.
- Secure logout.
- Password reset.
- Protected routes.
- User-owned data access.
- Optional OAuth support if selected.

Each user must only access their own documents unless future shared workspaces are added.

### 8.2 User Profile Requirements

Each user profile should include:

- Full name.
- Email.
- Default state/jurisdiction.
- Subscription tier.
- Notification preferences.
- Account creation date.

State/jurisdiction should be editable.

### 8.3 Document Upload Requirements

The system must support:

- PDF upload in MVP.
- File type validation.
- File size validation.
- Upload status feedback.
- Secure storage of original file.
- Association between file and user.
- Failed upload handling.
- File deletion by user.

Future versions may support DOCX, TXT, screenshots, pasted text, and browser extension captures.

### 8.4 Document Storage Requirements

For every uploaded document, the system should store:

- Original file.
- Extracted text.
- Document metadata.
- AI structured output.
- User-edited corrections.
- Clauses.
- Deadlines.
- Reminders.
- Notes.

The original file should be stored outside the relational database, preferably in object storage. The database should store file path, metadata, and access permissions.

### 8.5 Text Extraction Requirements

The system must extract usable text from uploaded PDFs.

Extraction should support:

- Native text PDFs.
- Scanned PDFs when possible.
- Multi-page documents.
- Page-level references.
- Basic layout awareness.

If text extraction fails, the user should receive a clear error message and be encouraged to upload a clearer file.

### 8.6 AI Analysis Requirements

AI analysis should produce structured output, preferably JSON-like data that can be validated and stored.

Expected fields:

- Document title.
- Document type.
- Short summary.
- Long summary.
- Key parties if available.
- Effective date.
- End date.
- State/jurisdiction if detected.
- Risk level.
- Risk categories.
- Clauses.
- Deadlines.
- Obligations.
- Suggested reminders.
- AI confidence flags.

The AI output must be validated before saving. The backend should not trust AI output blindly.

### 8.7 Clause Extraction Requirements

Each extracted clause should include:

- Clause title.
- Clause category.
- Plain-English explanation.
- Risk level.
- Source quote or source reference.
- Page number if available.
- Confidence score if available.
- User-editable notes.

Example clause categories:

- Rent/payment.
- Late fees.
- Security deposit.
- Renewal.
- Termination.
- Maintenance.
- Liability.
- Arbitration.
- Insurance.
- Privacy.
- Cancellation.
- Auto-renewal.
- Governing law.

### 8.8 Risk Analysis Requirements

Risk should be presented in a cautious and explainable way.

Use risk labels rather than overly precise scores.

Recommended levels:

- Low.
- Medium.
- High.
- Needs Review.

Risk categories may include:

- Financial risk.
- Renewal risk.
- Deadline risk.
- Liability risk.
- Legal complexity.
- Unclear language.
- Missing information.

Each risk label should include an explanation. Avoid unsupported conclusions.

### 8.9 Deadline Detection Requirements

The system should detect:

- Lease end dates.
- Renewal deadlines.
- Notice periods.
- Payment due dates.
- Cancellation windows.
- Inspection dates.
- Insurance renewal dates.
- Contract deliverable dates.
- Warranty expiration dates.
- Trial expiration dates.
- Automatic renewal dates.

Detected deadlines should become suggestions, not active reminders.

### 8.10 Reminder Requirements

Users must be able to:

- View suggested reminders.
- Approve reminders.
- Edit reminders.
- Delete reminders.
- Select reminder timing.
- Receive email reminders.
- View upcoming reminders on dashboard.

Reminder timing options should include:

- Same day.
- 1 day before.
- 3 days before.
- 1 week before.
- 2 weeks before.
- 1 month before.
- Custom date/time.

### 8.11 Notification Requirements

MVP notification channel:

- Email.

Future channels:

- SMS.
- Push notifications.
- Calendar integration.

Email reminders should include:

- Reminder title.
- Document name.
- Due date.
- Short description.
- Link to document profile.
- Disclaimer that the reminder is informational.

### 8.12 Document Q&A Requirements

The document Q&A system should:

- Answer questions using the selected document.
- Prefer grounded answers based on extracted text.
- Reference source clauses or page numbers when possible.
- Say when it cannot find an answer.
- Avoid giving legal advice.
- Encourage attorney review for high-risk or unclear issues.

### 8.13 Subscription Requirements

The system should support Free and Pro tiers.

Free tier should provide enough value to encourage adoption.

Pro tier should unlock advanced and recurring value.

The subscription system should support:

- Monthly billing.
- Yearly billing.
- Upgrade.
- Downgrade.
- Cancel.
- Billing portal.
- Feature gating.

---

## 9. Subscription Model

### 9.1 Free Tier

Recommended Free features:

- Account creation.
- Store limited number of documents, such as 5.
- Upload PDFs.
- Basic dashboard.
- Basic document metadata.
- Basic reminders.
- Limited AI analysis or limited number of analyses.
- Email reminders.

The Free tier should make the product useful without making token costs uncontrolled.

### 9.2 Pro Tier

Recommended Pro features:

- More or unlimited document storage, depending on cost controls.
- Advanced AI analysis.
- Full risk insights.
- Document Q&A.
- Weekly AI review.
- Monthly contract health report.
- Cross-document search in future.
- More reminders.
- More analysis credits or token allowance.
- Priority processing.

### 9.3 Pro Insight Feature

The weekly or monthly AI insight feature should be treated as a strong Pro retention feature.

Weekly review may include:

- Upcoming deadlines.
- High-risk items needing attention.
- Newly added documents.
- Suggested actions.
- Documents missing important dates.

Monthly contract health report may include:

- Number of active documents.
- Upcoming deadlines.
- High-risk clauses.
- Expiring contracts.
- Auto-renewal warnings.
- Recommended review actions.

This feature gives users a reason to keep paying even after their initial document analysis.

---

## 10. Technical Stack

### 10.1 Frontend

Recommended frontend:

- Next.js.
- Tailwind CSS.
- Component-based architecture.

Reasoning:

- Next.js is strong for SaaS applications with landing pages, dashboards, pricing pages, and authenticated user portals.
- Tailwind CSS supports fast UI development and clean design consistency.
- Augment AI can use this stack effectively to build and iterate on UI components.

### 10.2 Backend

Recommended backend:

- Django.
- Django REST Framework.

Reasoning:

- Clausly is a structured, database-heavy SaaS product.
- Django is strong for user-owned records, permissions, admin controls, subscriptions, document metadata, reminders, and backend workflows.
- Django REST Framework provides clean API endpoints for the frontend.
- Django’s admin can help with internal operations and early-stage debugging.

Django is not chosen only because the founder knows it. It is a strong architectural fit for this product.

### 10.3 Database

Recommended database:

- PostgreSQL.

Reasoning:

- The product requires structured relational data.
- Key entities include users, documents, clauses, deadlines, reminders, subscriptions, notifications, and AI jobs.
- PostgreSQL works well with Django and is production-ready.

### 10.4 File Storage

Recommended file storage:

- AWS S3.

Reasoning:

- PDFs should not be stored directly in the relational database.
- S3 is suitable for storing original PDFs, extracted text, and generated reports.
- The database should store file metadata and object references.

### 10.5 Text Extraction

Recommended extraction approach:

- Start with direct PDF text extraction for simple PDFs.
- Use AWS Textract for scanned PDFs, OCR, forms, and layout-aware extraction.

Reasoning:

- Many users will upload scanned or low-quality documents.
- The system should be able to handle imperfect PDFs.

### 10.6 AI Layer

Recommended AI layer:

- OpenAI and/or Anthropic Claude for MVP reasoning quality.
- AWS Bedrock can be considered later for deeper AWS-native integration.

AI responsibilities:

- Summarize documents.
- Extract clauses.
- Detect deadlines.
- Identify risks.
- Generate reminder suggestions.
- Answer document questions.
- Generate weekly/monthly insights for Pro users.

### 10.7 Authentication

Recommended authentication options:

- Clerk for faster MVP development.
- AWS Cognito for AWS-native architecture.

Recommendation:

- Use the auth provider that allows the team to move fastest while still maintaining secure user-owned document access.
- If the project wants a strongly AWS-centered architecture, Cognito is reasonable.
- If the project prioritizes speed and developer experience, Clerk is reasonable.

### 10.8 Payments

Recommended payment provider:

- Stripe.

Reasoning:

- Stripe is standard for SaaS subscriptions.
- It supports monthly and yearly subscriptions, billing portals, webhooks, and customer management.

### 10.9 Reminders and Email

Recommended reminder system:

- Backend reminder records in PostgreSQL.
- Scheduled reminder processing through AWS EventBridge Scheduler, Celery beat, or a similar job scheduler.
- Email delivery through AWS SES or another transactional email provider.

MVP should start with email reminders before adding SMS.

---

## 11. Data Model Overview

The following is a high-level schema direction. A separate database schema document can define exact fields and indexes.

### 11.1 User

Represents an account owner.

Key fields:

- id.
- email.
- full_name.
- default_state.
- subscription_tier.
- created_at.
- updated_at.

### 11.2 Document

Represents an uploaded contract, lease, or agreement.

Key fields:

- id.
- user_id.
- title.
- document_type.
- state_or_jurisdiction.
- original_file_url or storage_key.
- extracted_text_location.
- summary.
- risk_level.
- effective_date.
- end_date.
- upload_status.
- analysis_status.
- created_at.
- updated_at.

### 11.3 Clause

Represents an extracted clause.

Key fields:

- id.
- document_id.
- title.
- category.
- source_text.
- page_number.
- explanation.
- risk_level.
- confidence.
- created_at.

### 11.4 Deadline

Represents an extracted date or obligation.

Key fields:

- id.
- document_id.
- title.
- description.
- deadline_date.
- deadline_time.
- source_clause_id.
- status.
- confidence.
- created_at.

Status examples:

- suggested.
- approved.
- ignored.
- completed.

### 11.5 Reminder

Represents an active reminder approved by the user.

Key fields:

- id.
- user_id.
- document_id.
- deadline_id.
- reminder_datetime.
- channel.
- status.
- sent_at.
- created_at.

### 11.6 AIJob

Represents AI processing tasks.

Key fields:

- id.
- user_id.
- document_id.
- job_type.
- status.
- input_token_count.
- output_token_count.
- error_message.
- created_at.
- completed_at.

### 11.7 Subscription

Represents user billing state.

Key fields:

- id.
- user_id.
- stripe_customer_id.
- stripe_subscription_id.
- plan.
- status.
- current_period_start.
- current_period_end.
- created_at.

---

## 12. AI Output Contract

AI responses should be structured and predictable. The backend should request JSON output and validate it before storing.

Example structure:

```json
{
  "document_title": "Apartment Lease Agreement",
  "document_type": "lease",
  "state_or_jurisdiction": "Minnesota",
  "summary_short": "This document appears to be an apartment lease agreement between a tenant and landlord.",
  "risk_level": "Medium",
  "risk_reasons": [
    "Automatic renewal language may require attention.",
    "Late payment fees are included."
  ],
  "important_dates": [
    {
      "title": "Lease End Date",
      "date": "2026-08-31",
      "description": "The lease term appears to end on this date.",
      "source_page": 1,
      "confidence": 0.91
    }
  ],
  "clauses": [
    {
      "title": "Late Payment Fee",
      "category": "payment",
      "risk_level": "Medium",
      "source_page": 2,
      "source_text": "Tenant must pay a late fee if rent is not received by the due date.",
      "plain_english": "If rent is late, the tenant may owe an extra fee.",
      "confidence": 0.87
    }
  ],
  "suggested_reminders": [
    {
      "title": "Lease Renewal Notice Deadline",
      "date": "2026-07-01",
      "description": "Review whether notice is required before the lease ends.",
      "default_reminder_offsets": ["30_days_before", "7_days_before"],
      "confidence": 0.82
    }
  ]
}
```

AI output should never be treated as final truth without user review for reminders and high-impact obligations.

---

## 13. Legal and Safety Boundaries

The product must include clear legal boundaries.

### 13.1 Required Disclaimer Direction

Clausly should communicate:

- Clausly provides document organization and general contract information.
- Clausly does not provide legal advice.
- Clausly is not a law firm.
- Clausly does not create an attorney-client relationship.
- Users should consult a licensed attorney for legal advice.

### 13.2 AI Behavior Restrictions

AI should not say:

- “You are legally allowed to...”
- “This is definitely illegal.”
- “You should sue.”
- “You will win.”
- “This clause is unenforceable.”

AI can say:

- “This clause may be important.”
- “This may require attorney review.”
- “The document appears to state...”
- “Based on the uploaded document...”
- “This looks like a potential risk area.”

### 13.3 State-Specific Context

State information should be used carefully.

MVP should store the user’s state and document jurisdiction, but should avoid making strong legal conclusions based on state law unless reliable sources and legal review are added later.

---

## 14. Security and Privacy Requirements

Clausly handles sensitive documents. Security should be treated as a core product requirement.

### 14.1 Security Requirements

The system should support:

- Secure authentication.
- User-specific document access controls.
- Encrypted storage for files.
- HTTPS everywhere.
- Secure environment variable management.
- Restricted access to storage buckets.
- Signed URLs for private file access.
- Audit-friendly logging without exposing sensitive document content.
- File deletion support.

### 14.2 Privacy Requirements

The product should:

- Avoid exposing document text unnecessarily.
- Avoid logging full contract contents in plain logs.
- Provide user-controlled deletion.
- Clearly explain how documents are used for AI analysis.
- Avoid using user documents for model training unless explicitly allowed by provider terms and user consent.

### 14.3 Data Retention

Recommended MVP policy:

- User documents are stored until the user deletes them or closes the account.
- Free users may have storage limits.
- Pro users may have higher or unlimited storage limits.
- Deleted documents should be removed from active storage and database references.

---

## 15. UI and UX Direction

Most UI implementation will be handled separately, especially by Augment AI. This PRD should not over-prescribe visual details.

However, product UX should follow these principles:

- Clean, modern, trustworthy SaaS design.
- Document-first experience.
- Dashboard focused on upcoming actions, not just file storage.
- Clear distinction between suggested and approved reminders.
- Clear risk labels with explanations.
- Simple upload flow.
- Strong empty states for new users.
- Light mode as default.
- Dark mode support should be planned from the design system level, but it should not delay MVP.

Recommended approach to dark mode:

- Support both light and dark mode.
- Use light mode as default because legal/document products benefit from clarity and readability.
- Use Tailwind theme tokens to avoid duplicating UI work.
- Do not make dark mode a separate design project in Sprint 1.

---

## 16. MVP Pages and Screens

### 16.1 Public Pages

- Landing page.
- Pricing page.
- About page.
- Login page.
- Signup page.
- Terms of service.
- Privacy policy.

### 16.2 Authenticated Pages

- Dashboard.
- Upload document page.
- Document processing screen.
- Document list / portfolio page.
- Document detail page.
- Reminder management page.
- Account settings.
- Billing page.

### 16.3 Admin/Internal Pages

- Django admin for documents, users, subscriptions, AI jobs, and failed processing tasks.
- Internal logs or status views can be added later.

---

## 17. Dashboard Requirements

The dashboard should prioritize what the user needs to act on.

Recommended dashboard sections:

1. Upcoming Deadlines.
2. Documents Needing Review.
3. High-Risk Items.
4. Recent Uploads.
5. Quick Upload Button.
6. Pro Insight Preview if applicable.

The dashboard should answer:

- What needs my attention soon?
- Which documents are risky?
- Which reminders are active?
- What have I uploaded recently?

---

## 18. Success Metrics

MVP success can be measured using:

- Number of users who upload at least one document.
- Upload-to-analysis completion rate.
- Number of reminders approved per document.
- Number of users returning after first analysis.
- Number of Pro upgrades.
- Weekly active users.
- Document Q&A usage.
- Reminder email open rate.
- User retention after 30 days.

The most important early signal is whether users approve reminders and return to the dashboard. That indicates Clausly is more than a one-time PDF summarizer.

---

## 19. Roadmap

### Phase 1: Foundation

- Setup repository.
- Setup frontend and backend.
- Setup authentication.
- Setup PostgreSQL.
- Setup S3 file upload.
- Setup basic dashboard.
- Setup PDF upload and storage.

### Phase 2: AI Document Processing

- Extract text from PDFs.
- Build AI analysis endpoint.
- Generate document summaries.
- Extract clauses.
- Extract important dates.
- Store structured analysis output.

### Phase 3: Reminder System

- Generate reminder suggestions.
- Build approval/edit/ignore flow.
- Create active reminders.
- Send email reminders.
- Show reminders on dashboard.

### Phase 4: Pro and Payments

- Add Stripe subscriptions.
- Add Free vs Pro feature gating.
- Add document limits.
- Add Pro document Q&A.
- Add Pro weekly/monthly insights.

### Phase 5: Product Polish

- Improve dashboard UX.
- Improve document detail view.
- Add better error handling.
- Add processing status UI.
- Add analytics and internal admin visibility.

### Phase 6: Future Expansion

- Chrome extension waitlist.
- Chrome extension MVP.
- Cross-document search.
- Contract comparison.
- SMS reminders.
- Calendar integration.
- Lawyer referral marketplace.

---

## 20. Chrome Extension Future Scope

The Chrome extension should not be built in MVP, but the web app should prepare for it as a future acquisition channel.

Future extension concept:

- User visits a terms and conditions page, privacy policy, checkout agreement, subscription agreement, or online contract.
- User clicks “Analyze with Clausly.”
- Extension extracts visible text or sends URL/page content to Clausly.
- Clausly returns a short summary, risk flags, renewal/cancellation warnings, and save option.
- User can save the result to their Clausly portfolio.

This extension should be positioned as:

> Understand what you are about to agree to before you click accept.

---

## 21. Lawyer Marketplace Future Scope

The lawyer marketplace should be treated as a long-term expansion only after the core product has real users.

Potential future flow:

1. User uploads a document or describes an issue.
2. Clausly summarizes the issue in a structured way.
3. User chooses whether they want professional help.
4. User can request attorney referrals.
5. Partner attorneys can receive qualified leads.

Important boundaries:

- Clausly should not create an attorney-client relationship.
- Clausly should not provide legal advice.
- Users must explicitly consent before information is shared with attorneys.
- Sensitive legal case intake requires stronger privacy, security, and compliance review.

---

## 22. Development Guidelines for AI Coding Tools

This PRD is intended to guide Codex, Augment AI, and future developers.

### 22.1 General Rules

- Build the MVP first.
- Do not implement future roadmap features unless explicitly requested.
- Keep features modular.
- Keep AI outputs structured and validated.
- Do not hardcode user-specific assumptions.
- Use environment variables for secrets.
- Keep frontend and backend responsibilities separate.
- Prioritize security and privacy.

### 22.2 Backend Rules

- Use Django models for core entities.
- Use DRF serializers for API input/output validation.
- Validate all AI-generated JSON before saving.
- Never trust client-side user IDs for authorization.
- Ensure users can only access their own documents.
- Store files in object storage, not the database.
- Track processing status for uploads and AI jobs.

### 22.3 Frontend Rules

- Build reusable components.
- Keep UI clean and trustworthy.
- Avoid overloading the first screen after upload.
- Clearly distinguish pending suggestions from approved user data.
- Make editing easy.
- Show loading and processing states clearly.
- Prepare theme support without overcomplicating Sprint 1.

### 22.4 AI Rules

- AI should summarize and organize, not give legal advice.
- AI should cite document sections or page references when possible.
- AI should flag uncertainty.
- AI should produce structured data.
- AI should not create active reminders without user approval.
- AI should use cautious language for risk.

---

## 23. Open Questions

These questions can be answered during implementation:

1. Exact document limit for Free users.
2. Exact Pro pricing.
3. Whether MVP uses Clerk or Cognito.
4. Whether MVP uses Textract immediately or starts with basic PDF parsing.
5. Exact AI provider for MVP.
6. Maximum file size.
7. Whether to support DOCX after PDF.
8. Whether weekly insights launch with first Pro version or later.
9. Whether reminder scheduling uses EventBridge, Celery, or another queue/scheduler.
10. Whether document Q&A is Free-limited or Pro-only.

---

## 24. Recommended MVP Decision Defaults

Unless changed later, use these defaults:

- Product name: Clausly.app.
- Primary input: PDF upload.
- Frontend: Next.js + Tailwind CSS.
- Backend: Django + Django REST Framework.
- Database: PostgreSQL.
- Storage: AWS S3.
- AI: OpenAI or Claude for MVP.
- Payments: Stripe.
- Notifications: Email first.
- Auth: Clerk for speed or Cognito for AWS-native direction.
- UI theme: Light mode default, dark mode supported.
- Core dashboard focus: Upcoming actions and documents needing review.
- Legal positioning: Contract intelligence and reminder platform, not legal advice.

---

## 25. Final Product Definition

Clausly.app is a contract intelligence and reminder platform that helps users upload, store, understand, and track important agreements. The MVP should focus on secure PDF storage, AI-powered summaries, clause extraction, risk awareness, deadline detection, user-approved reminders, and a clean document portfolio.

The product should be built carefully because it deals with sensitive documents and legal-adjacent content. The safest and strongest direction is to help users organize and understand their documents while avoiding legal advice claims.

The MVP wins if users can upload a lease or contract, immediately understand the most important parts, approve reminders for key dates, and return later because Clausly helps them remember obligations they would otherwise forget.

