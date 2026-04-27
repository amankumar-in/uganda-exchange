import LegalPageLayout from "@/components/legal/LegalPageLayout";
import GrievanceBlock from "@/components/legal/GrievanceBlock";

export default function CancellationPage() {
  return (
    <LegalPageLayout
      title="Cancellation Policy"
      description="What can be cancelled on the InTuition Exchange platform — open orders, pending withdrawals, and accounts — and what cannot."
      lastUpdated="27 April 2026"
    >
      <p>
        This Cancellation Policy explains what you can cancel on the InTuition Exchange
        platform operated by <strong>Intuition India OPC Private Limited</strong>, and what
        cannot be cancelled because of how blockchain settlement and payment-rail processing
        work. Read it together with our Refund Policy and Terms of Service.
      </p>

      <h2>1. Orders on the order book</h2>
      <h3>Open orders — cancellable</h3>
      <ul>
        <li>Limit, stop-limit, and similar resting orders that have not yet been matched can be cancelled at any time from the Trade screen.</li>
        <li>For partially filled orders, only the unfilled remainder is cancelled. The portion already executed is final.</li>
      </ul>
      <h3>Executed orders — non-cancellable</h3>
      <ul>
        <li>Once any portion of your order is matched against a counterparty, the executed portion is final and cannot be cancelled, modified, or reversed by you, by the counterparty, or by us — including in the event of price movement, change of mind, or operator error.</li>
        <li>Market orders are designed to execute immediately at the best available price and are typically not cancellable in practice.</li>
      </ul>

      <h2>2. INR deposits</h2>
      <ul>
        <li>An INR deposit initiated through Razorpay cannot be cancelled by us once you have authorised the payment with your bank or UPI app. If the payment fails or times out, no charge is applied to your bank or UPI account, and no further action is needed from you.</li>
        <li>If you authorised a deposit in error and were charged, see our Refund Policy for the limited circumstances in which the deposit may be reversed.</li>
      </ul>

      <h2>3. INR withdrawals</h2>
      <ul>
        <li><strong>Pending</strong> — INR withdrawal requests can be cancelled by you, from the Portfolio screen, while the request is in <code>PENDING</code> status (typically the first few minutes after submission).</li>
        <li><strong>Processing</strong> — once the request moves to <code>PROCESSING</code> and has been handed off to the bank rail (NEFT / IMPS / RTGS), it cannot be cancelled.</li>
        <li><strong>Completed</strong> — completed withdrawals cannot be cancelled. If you sent funds to a wrong-but-verified bank account, you must approach the receiving bank directly under the RBI&rsquo;s wrong-credit recovery process.</li>
      </ul>

      <h2>4. VDA withdrawals (on-chain transfers)</h2>
      <p>
        On-chain VDA transfers are <strong>irreversible</strong> once broadcast to the
        blockchain network. We cannot cancel, recall, or refund such transfers, including in
        the case of:
      </p>
      <ul>
        <li>incorrect destination address;</li>
        <li>wrong network selected (for example, sending an asset on a network the destination does not support);</li>
        <li>destination address that the receiving wallet, exchange, or smart contract refuses to credit.</li>
      </ul>
      <p>
        Confirm the address, network, and amount before approving any VDA withdrawal. We may
        offer a brief internal hold window for security reasons; you can cancel a withdrawal
        during this hold from the Portfolio screen.
      </p>

      <h2>5. KYC and onboarding</h2>
      <ul>
        <li>You may abandon an in-progress KYC submission at any time before final approval by closing the browser tab; no account is created until KYC is approved.</li>
        <li>Once KYC is approved and an account is created, the account closure process under section 6 applies.</li>
      </ul>

      <h2>6. Account closure</h2>
      <ul>
        <li>You may request closure of your InTuition account at any time by writing to <a href="mailto:help@intuitionexchange.com">help@intuitionexchange.com</a> from your registered email.</li>
        <li>Before we close the account, you must close all open orders, withdraw your VDA balances, and withdraw your INR balance to your verified bank account. Any residual INR below the minimum withdrawal threshold may be retained as administrative cost.</li>
        <li>Closure is typically completed within 7 business days of all balances being settled.</li>
        <li>KYC, account, and transaction records are retained for at least <strong>five years</strong> after closure as required by Section 12 of the Prevention of Money Laundering Act, 2002. Closure does not result in deletion of these records.</li>
      </ul>

      <h2>7. Subscriptions and fees</h2>
      <p>
        We do not currently sell subscription products. Trading and platform fees are charged
        per transaction and are non-refundable once the underlying transaction has executed.
      </p>

      <h2>8. Cancellations initiated by us</h2>
      <p>
        We may cancel open orders or refuse to process deposits, withdrawals, or transfers
        where required by law, court order, regulatory direction, or our AML / CFT policy, or
        where we have reasonable grounds to believe the activity is fraudulent, manipulative,
        or in breach of our Terms of Service. Where lawful, we will inform you of the action
        taken.
      </p>

      <h2>9. How to cancel</h2>
      <ul>
        <li><strong>Open orders</strong> — Trade screen, Open Orders panel.</li>
        <li><strong>INR withdrawals (Pending)</strong> — Portfolio screen, Withdrawals tab.</li>
        <li><strong>Account closure</strong> — email <a href="mailto:help@intuitionexchange.com">help@intuitionexchange.com</a>.</li>
        <li><strong>Anything else</strong> — email <a href="mailto:help@intuitionexchange.com">help@intuitionexchange.com</a>; we acknowledge within 48 hours.</li>
      </ul>

      <h2>10. Grievance</h2>
      <GrievanceBlock />
    </LegalPageLayout>
  );
}
