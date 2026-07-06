prompt:

understand the codebase. we currently use pesapal to deposit funds. but since the app is currently in demo and testing only - and pesapal is proving tricky for demo. we want to bypass it all with a dummy setup.

1. We wont remove or harm pesapal integration in anyway. we will simply skip it from UI
2. When users want to add funds - take them to a single dedicated beautiful page (mobile first design). This is a dedicated page but in steps. No popups or modals. dedictaed page. enter amount > Select a payment method (UG Mobile Money - preselected, Credit/Debit Cards, Bank Transfer -coming soon badge and disabled
3. For cards, show a standard card payment flow but nice and easy to use. All deposits will work, any card detail will work as long as correct length. Money will be credited but users can only deposit a maximum cumulative of 40 million UGX (cumulative across all methods, and all deposit transactions per account). I want proper feedback after they enter card details and click on deposit , we will send a sms verification code after they try to do that - like a bank verification - it will be a verification code - they enter the verification code, then the amount is deposited. There should be proper waiting, success, ticks, animations. Animations are extrememly iportant. so it shouldnt be that click button and money is there. Aniation and some waiting makes is look real as there is feedback. Use proper animation libraries for each step. SMS for verification and then a confirmation once deposit is done. This is all dummy. but balance in account will be real

4. Mobile money will be preferred and auto selected. Ask for mobile number (it will be Uganda only so country code will be shown and disabled), after phone number - just show an animation with some progress updates like mobile money traditionally does - and then complete the deposit. Send a confirmation message post deposit to user. Again, animation and feedback is most important. Never aim for lazy click and done development.

5. We have a deposit button in header and on overview page, and an add funds button on portfolio page - all of those should skip to this new page.

6. Show a Portfolio Value (total of all assets in header near avatar)

7. We also build a dummy kyc flow (check I think we already have it in tuition center - we just need to use it). Show a dismissable banner to complete KYC for increased limits and faster payouts. Action button will take users through this dummy kyc flow (verify first that it exists and then reuse it for our purpose and modify it to suit our needs). KYC will be verified after their completion. Again, proper animations for all steps, waiting for status checks and proper feedback

8. Anwywhere else we can integrate animation for things like button clicks, and not random useless animation. Animatiuon that makes it feel like something happens or is happening (like how reactions on facebook and instagram work)



Implementation Plan: Dummy Deposit Flow, KYC, and UI Enhancements
This plan outlines the steps to bypass Pesapal integration and introduce dummy flows for fiat deposits and KYC verifications, along with UI enhancements as requested.

User Review Required
IMPORTANT

The backend dummy deposit endpoint will skip all external payment gateway verifications and directly credit users. This is suitable for the sandbox/demo environment but must be secured or removed before going to a real production setup.

NOTE

The dummy KYC flow will replace the current real /onboarding page and will immediately verify the user upon completion.

Proposed Changes
Backend Updates
[MODIFY] 
fiat.controller.ts
Add a new POST /dummy-deposit endpoint that accepts the deposit amount and method (Mobile Money or Card).
Secure the endpoint with @UseGuards(JwtAuthGuard).
[MODIFY] 
fiat.service.ts
Implement dummyDeposit(userId, amount, method).
Enforce the 40,000,000 UGX cumulative deposit limit by summing previous COMPLETED deposits for the user.
Add a new transaction record and update fiatBalance for successful deposits.
[MODIFY] 
auth.controller.ts
 & 
auth.service.ts
Add a POST /dummy-kyc endpoint to update the user's KYC status to VERIFIED and increase their limits.
Frontend Updates - Deposit Flow
[NEW] 
frontend/pages/deposit/index.tsx
Create a dedicated, mobile-first, multi-step deposit page (no modals).
Step 1: Amount entry.
Step 2: Payment Method selection (Mobile Money preselected, Cards available, Bank Transfer disabled with a "coming soon" badge).
Step 3 (Mobile Money): Input for Uganda phone number (prepopulated with +256), simulated processing animation, and success screen.
Step 3 (Cards): Standard card input layout, mock SMS verification, processing animation, and success screen.
Use framer-motion for smooth step transitions and success ticks.
[DELETE] 
frontend/components/wallet/DepositModal.tsx
Remove the old deposit modal component entirely.
[MODIFY] 
frontend/components/dashboard/DashboardLayout.tsx
Update the "Add Funds" navigation link/button to route to /deposit.
Update the Header section (near the avatar) to display the Total Portfolio Value in UGX. The calculation will be based on the user's balances and current pair prices from ExchangeContext.
[MODIFY] 
frontend/pages/portfolio/index.tsx
Change "Deposit" actions to route to /deposit instead of triggering DepositModal.
Frontend Updates - KYC Flow
[NEW] 
frontend/pages/onboarding/index.tsx
Create the dummy KYC flow by adapting the beautiful claymorphic design from kyc-101.tsx.
Modify the language to be professional (removing child-friendly text).
Upon completing the final step, call the new backend /dummy-kyc endpoint and redirect to the dashboard.
[MODIFY] Global Buttons
Review primary action buttons across the app and add subtle scale animations (whileTap={{ scale: 0.95 }}) for better interaction feedback using framer-motion.
Verification Plan
Automated Tests
No automated tests required for these specific dummy flows.
Manual Verification
Attempt to deposit using Mobile Money and Cards to ensure animations, SMS mock step, and final balance updates work.
Attempt to exceed the 40M UGX limit and ensure the UI shows an appropriate error.
Verify the Total Portfolio Value correctly renders in the Header and updates when a deposit is made.
Go through the Dummy KYC flow and ensure the KYC banner disappears and status updates to VERIFIED.