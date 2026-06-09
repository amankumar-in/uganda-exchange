import LegalPageLayout from "@/components/legal/LegalPageLayout";
import GrievanceBlock from "@/components/legal/GrievanceBlock";

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      description="Terms governing the use of the UG Coin virtual digital asset trading platform operated by UG Coin."
      lastUpdated="27 April 2026"
    >
      <p>
        These Terms of Service (<strong>&ldquo;Terms&rdquo;</strong>) form a binding agreement
        between you (<strong>&ldquo;User&rdquo;</strong>, <strong>&ldquo;you&rdquo;</strong>)
        and <strong>UG Coin</strong>, a company
        incorporated under the laws of Uganda, having its registered office at Kampala, Uganda (<strong>&ldquo;UG Coin&rdquo;</strong>,{" "}
        <strong>&ldquo;we&rdquo;</strong>, <strong>&ldquo;us&rdquo;</strong>), governing your
        access to and use of the UG Coin platform at ugcoin.com and any
        related services (the <strong>&ldquo;Platform&rdquo;</strong>).
      </p>
      <p>
        By creating an account, depositing funds, or placing any order on the Platform, you
        confirm that you have read, understood, and agreed to these Terms, our Privacy Policy,
        Refund Policy, and Cancellation Policy.
      </p>

      <h2>1. Eligibility</h2>
      <ul>
        <li>You are a resident of Uganda, at least 18 years old, and have the legal capacity to enter into a binding contract under Ugandan law.</li>
        <li>You are not on any sanctions list maintained by the United Nations, OFAC, the European Union, the United Kingdom, or the Government of Uganda, and you are not a politically exposed person who has not been onboarded under enhanced due diligence.</li>
        <li>You have completed our KYC process, including PAN and Aadhaar verification, and the information you provided is true, current, and complete.</li>
        <li>You will operate only one account on the Platform. Joint accounts, nominee accounts, and accounts opened on behalf of another person are not permitted.</li>
      </ul>

      <h2>2. Services we provide</h2>
      <p>
        The Platform allows you to (a) deposit Ugandan Shillings (UGX) through Pesapal, (b) place
        orders to buy or sell virtual digital assets (<strong>&ldquo;VDAs&rdquo;</strong>),
        including listed cryptocurrencies and college-issued tokens (TUIT and similar), and (c)
        withdraw UGX back to your verified bank account.
      </p>
      <p>
        We provide an execution venue and a custodial wallet. We do not provide investment,
        legal, or tax advice. Information shown on the Platform — including prices, charts,
        listings, and educational content — is for informational purposes only and should not
        be construed as a recommendation to buy or sell any asset.
      </p>

      <h2>3. KYC, AML, and CFT compliance</h2>
      <p>
        UG Coin is a Reporting Entity under the Prevention of Money Laundering Act, 2002
        (<strong>PMLA</strong>) read with the Ministry of Finance notification dated 7 March
        2023 bringing virtual digital asset service providers within the scope of the PMLA. Our
        registration with the relevant financial authorities in Uganda is in progress.
      </p>
      <ul>
        <li>We perform risk-based customer due diligence at onboarding and on an ongoing basis. We may at any time request additional documents to verify your identity, source of funds, or source of wealth.</li>
        <li>We monitor transactions for unusual or suspicious activity and file Suspicious Transaction Reports (STRs) and Cash Transaction Reports (CTRs) with FIU-IND as required.</li>
        <li>We may freeze, suspend, or close any account, and withhold the release of funds, where required by law, court order, or our internal AML/CFT policies — including for suspected money laundering, terrorism financing, sanctions evasion, structuring, or use of mixers, tumblers, or privacy-enhancing tools.</li>
        <li>Records of identification, accounts, and transactions are retained for at least five years from the date of the transaction or account closure, as required by Section 12 of the PMLA.</li>
      </ul>

      <h2>4. Deposits, withdrawals, and Razorpay</h2>
      <p>
        UGX deposits are processed through Razorpay Software Private Limited, a payment
        aggregator authorised by the Bank of Uganda. Pesapal is used solely to collect
        and settle UGX amounts; the underlying VDA transactions on the Platform are not
        processed through Razorpay and Razorpay bears no responsibility for them.
      </p>
      <ul>
        <li>Deposits must originate from a bank account or Mobile Money number in your own name. Third-party deposits will be reversed and may lead to account suspension.</li>
        <li>Withdrawals are released only to a bank account that has cleared a penny-drop name-match check against your verified KYC name.</li>
        <li>Deposit and withdrawal limits, fees, and processing windows are published on our Fees page and may be updated from time to time.</li>
      </ul>

      <h2>5. Trading rules</h2>
      <ul>
        <li>Orders may execute fully, partially, or not at all, depending on liquidity. Quoted prices are indicative; the executed price is the price at which a counterparty is matched.</li>
        <li>You are responsible for the orders you place, including orders placed through the API. We do not reverse executed trades on account of price movement, user error, or change of mind.</li>
        <li>We may suspend trading of any market for maintenance, on the recommendation of the issuer, or where required for market integrity.</li>
      </ul>

      <h2>6. Risk disclosure</h2>
      <p>
        Virtual digital assets are not legal tender in Uganda. They are not guaranteed by, and
        deposits in VDAs are not insured by, the Bank of Uganda or any other agency. VDA prices are highly
        volatile and can fall to zero. You may lose the entire value of your holdings.
      </p>
      <p>
        College-issued tokens (TUIT and similar) carry additional risks specific to the issuing
        institution, including changes in the issuer&rsquo;s acceptance, redemption terms, or
        operational status. Past performance is not indicative of future results.
      </p>

      <h2>7. Tax</h2>
      <p>
        Income from the transfer of virtual digital assets is taxable in Uganda according to prevailing tax laws, without
        deduction of any expense (other than cost of acquisition) and without set-off or
        carry-forward of losses. <strong>Section 194S</strong> requires us to deduct tax at
        source at 1% on consideration paid for the transfer of a VDA above the prescribed
        thresholds. You are responsible for reporting your VDA transactions in Schedule VDA of
        your Income Tax Return. The above is a summary, not tax advice — consult a qualified
        professional for your specific situation.
      </p>

      <h2>8. Prohibited use</h2>
      <p>You will not use the Platform to:</p>
      <ul>
        <li>launder the proceeds of crime, finance terrorism, evade sanctions, or engage in structuring or layering;</li>
        <li>deposit or withdraw funds on behalf of any third party;</li>
        <li>deposit, withdraw, or trade VDAs that have been mixed, tumbled, or routed through known privacy-enhancing tools;</li>
        <li>manipulate any market on the Platform, including through wash trades, spoofing, layering, or coordinated order placement;</li>
        <li>access the Platform from a jurisdiction in which doing so is prohibited or sanctioned, or while using a VPN or other tool to mask your jurisdiction;</li>
        <li>reverse-engineer, scrape, or otherwise abuse the Platform&rsquo;s technical infrastructure.</li>
      </ul>
      <p>
        Breach of this clause is grounds for permanent account closure, forfeiture of fees,
        reporting to FIU-IND and law-enforcement, and any other remedy available to us in law
        or equity.
      </p>

      <h2>9. Suspension and termination</h2>
      <p>
        We may suspend or terminate your access to the Platform at any time, with or without
        notice, where required by law, court order, regulatory direction, or our AML/CFT
        policy, or where we have reasonable grounds to believe you have breached these Terms.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, UG Coin is not liable for indirect,
        incidental, consequential, special, or punitive damages, lost profits, lost data, or
        loss of goodwill arising from your use of the Platform. Our aggregate liability for any
        claim is limited to the total fees you have paid to us in the three months preceding
        the event giving rise to the claim.
      </p>
      <p>
        We are not liable for losses caused by events outside our reasonable control, including
        outages of payment aggregators or banks, blockchain network congestion, validator
        failure, hard forks, internet failure, or governmental action.
      </p>

      <h2>11. Indemnity</h2>
      <p>
        You will indemnify us, our officers, employees, and affiliates against any claim,
        loss, or expense (including reasonable legal fees) arising from your breach of these
        Terms, your violation of any law, or your infringement of any third-party right.
      </p>

      <h2>12. Governing law and dispute resolution</h2>
      <p>
        These Terms are governed by Ugandan law. Any dispute arising out of or in connection
        with these Terms shall be referred to and finally resolved by arbitration under the
        Arbitration and Conciliation Act, 1996, by a sole arbitrator appointed by UG Coin.
        The seat and venue of arbitration is New Delhi and the proceedings shall be conducted
        in English. Subject to the arbitration clause, courts at New Delhi have exclusive
        jurisdiction.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. The &ldquo;Last updated&rdquo; date at the
        top of this page reflects the most recent change. Continued use of the Platform after
        an update constitutes acceptance of the updated Terms.
      </p>

      <h2>14. Contact and grievance</h2>
      <p>
        General queries: <a href="mailto:help@ugcoin.com">help@ugcoin.com</a>.
      </p>
      <GrievanceBlock />
    </LegalPageLayout>
  );
}
