import LegalPageLayout from "@/components/legal/LegalPageLayout";
import GrievanceBlock from "@/components/legal/GrievanceBlock";

export default function RefundPage() {
  return (
    <LegalPageLayout
      title="Refund Policy"
      description="When UGX refunds are issued on the UG Coin platform and how to request one. Crypto trades are not reversible."
      lastUpdated="27 April 2026"
    >
      <p>
        UG Coin is a virtual digital asset (<strong>VDA</strong>) trading platform
        operated by <strong>UG Coin</strong>. This Refund Policy
        explains the limited circumstances in which we issue an UGX refund, the route the
        refund takes, and the timeline you can expect.
      </p>

      <h2>1. No refund or reversal for completed crypto transactions</h2>
      <p>
        VDA trades and on-chain transfers settle on blockchain networks and through our
        internal ledger and are <strong>final, irreversible, and non-refundable</strong> once
        executed. By placing an order, you accept the executed price, quantity, and any
        applicable fees. We do not reverse, modify, or refund:
      </p>
      <ul>
        <li>orders you placed and that were matched, in full or in part, against a counterparty;</li>
        <li>VDA withdrawals broadcast to a blockchain network;</li>
        <li>internal transfers between your wallets on the Platform;</li>
        <li>fees charged on executed trades or completed withdrawals;</li>
        <li>losses arising from price movement, change of mind, or operator error in placing an order.</li>
      </ul>

      <h2>2. UGX deposit refunds — when we issue them</h2>
      <p>
        We issue an UGX refund only in the following narrow scenarios, where the deposit has{" "}
        <strong>not</strong> been used to purchase any VDA or to fund any other transaction on
        the Platform:
      </p>
      <ul>
        <li><strong>Failed credit.</strong> Your bank or Mobile Money app shows a successful debit but the deposit is not credited to your UGX balance within 24 hours, and our verification confirms the payment was not received or could not be reconciled.</li>
        <li><strong>Duplicate debit.</strong> Razorpay processes the same deposit attempt more than once because of a network or gateway error.</li>
        <li><strong>Account closed before use.</strong> Your account is suspended or closed for KYC, AML, or sanctions reasons before the deposited UGX is used to trade or withdraw, and applicable law and our internal policies permit the return of funds.</li>
        <li><strong>Wrong-name or third-party deposit.</strong> Funds were received from a bank account or Mobile Money number whose holder name does not match your verified KYC name; such deposits are reversed to source.</li>
      </ul>

      <h2>3. Refund route</h2>
      <p>
        Refunds are remitted only to the <strong>original source bank account or Mobile Money number</strong>{" "}
        from which the deposit was received. We do not issue refunds:
      </p>
      <ul>
        <li>to any other bank account, Mobile Money number, wallet, or instrument;</li>
        <li>to a third party;</li>
        <li>in cash, cheque, or in the form of any VDA;</li>
        <li>as platform credit, vouchers, or promotional balance.</li>
      </ul>

      <h2>4. Timeline</h2>
      <p>
        Approved refunds are initiated to Razorpay within <strong>2 business days</strong> of
        approval. Razorpay and the receiving bank typically credit the source instrument within
        a further <strong>5 to 7 business days</strong>. Total time from approval to credit is
        therefore generally up to 7 to 9 business days. Bank holidays and the receiving
        bank&rsquo;s processing time may extend this window.
      </p>

      <h2>5. No chargebacks</h2>
      <p>
        Once you have used a deposit to trade or withdraw a VDA, the deposit has been consumed
        and is no longer eligible for chargeback. Initiating a chargeback or payment dispute
        with your card issuer or bank for a deposit that has been used on the Platform will be{" "}
        <strong>contested with documentary evidence of the underlying VDA trade</strong>.
        Confirmed chargeback abuse will result in:
      </p>
      <ul>
        <li>permanent suspension of your account;</li>
        <li>set-off of the disputed amount against any balance held with us;</li>
        <li>recovery of dispute fees and reasonable legal costs;</li>
        <li>where applicable, the filing of a Suspicious Transaction Report with FIU-IND.</li>
      </ul>

      <h2>6. How to request a refund</h2>
      <p>
        Email <a href="mailto:help@ugcoin.com">help@ugcoin.com</a> from
        your registered email address with:
      </p>
      <ul>
        <li>your registered mobile number and the last four digits of your KYC PAN;</li>
        <li>the UG Coin deposit transaction ID (begins with <code>TXN-</code>);</li>
        <li>the Razorpay payment ID (begins with <code>pay_</code>);</li>
        <li>the date, time, and UGX amount of the deposit;</li>
        <li>a screenshot of the bank or Mobile Money debit confirmation.</li>
      </ul>
      <p>
        We acknowledge refund requests within 48 hours, complete our reconciliation within 7
        business days, and communicate the outcome to your registered email.
      </p>

      <h2>7. Razorpay&rsquo;s role</h2>
      <p>
        Razorpay Software Private Limited is engaged solely as the payment aggregator for UGX
        deposits. The underlying VDA transactions on the Platform are not processed through
        Razorpay and are not within Razorpay&rsquo;s scope. Disputes about VDA trades must be
        raised with us directly and not as a payment dispute with Razorpay.
      </p>

      <h2>8. Grievance and escalation</h2>
      <p>
        If a refund is not resolved to your satisfaction within 30 days of your initial
        complaint, you may escalate it to our Grievance Officer.
      </p>
      <GrievanceBlock />
    </LegalPageLayout>
  );
}
