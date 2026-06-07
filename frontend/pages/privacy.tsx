import LegalPageLayout from "@/components/legal/LegalPageLayout";
import GrievanceBlock from "@/components/legal/GrievanceBlock";

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="How General Exchange collects, uses, shares, and retains personal data on the platform."
      lastUpdated="27 April 2026"
    >
      <p>
        This Privacy Policy explains how <strong>General Exchange</strong>{" "}
        (<strong>&ldquo;we&rdquo;</strong>, <strong>&ldquo;us&rdquo;</strong>) processes
        personal data of users of the InTuition Exchange platform. It applies in addition to,
        and forms part of, our Terms of Service. This Policy is published in accordance with
        the Information Technology Act, 2000, the Information Technology (Reasonable Security
        Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and
        the Digital Personal Data Protection Act, 2023 (<strong>DPDP Act</strong>).
      </p>

      <h2>1. Personal data we collect</h2>
      <h3>Account data</h3>
      <ul>
        <li>Name, email address, mobile number, password (stored as a salted hash).</li>
      </ul>
      <h3>KYC data</h3>
      <ul>
        <li>Permanent Account Number (PAN) and PAN-card image.</li>
        <li>Aadhaar number (last four digits stored, full number used only for OTP verification through the official UIDAI flow), name, date of birth, gender, and address as returned by Aadhaar e-KYC.</li>
        <li>Live selfie / liveness video for face match.</li>
        <li>Verified bank account number and account holder name.</li>
      </ul>
      <h3>Transaction data</h3>
      <ul>
        <li>Deposits, withdrawals, orders, executed trades, wallet balances, on-chain transfers, and payment-gateway references.</li>
      </ul>
      <h3>Device, log, and usage data</h3>
      <ul>
        <li>IP address, device identifier, operating system, browser, language, referrer URL, pages visited, timestamps, error logs.</li>
        <li>Cookies and similar technologies for authentication, security, and basic analytics. See section 7 below.</li>
      </ul>

      <h2>2. Why we process this data</h2>
      <ul>
        <li><strong>Account creation and login</strong> — to authenticate you and secure your account.</li>
        <li><strong>KYC and AML/CFT compliance</strong> — to verify your identity, screen against sanctions and PEP lists, conduct ongoing due diligence, and file STRs / CTRs with FIU-IND under the Prevention of Money Laundering Act, 2002.</li>
        <li><strong>Payment processing</strong> — to collect INR deposits and disburse INR withdrawals through our regulated payment partners.</li>
        <li><strong>Tax compliance</strong> — to comply with local tax regulations regarding cryptocurrency trading.</li>
        <li><strong>Service operation</strong> — to execute orders, maintain wallet balances, settle trades, and provide transaction history.</li>
        <li><strong>Fraud and security</strong> — to detect and prevent unauthorised access, account takeover, market abuse, and money laundering.</li>
        <li><strong>Service communications</strong> — to send transactional emails and SMS related to your account, security, and KYC status.</li>
        <li><strong>Product improvement</strong> — aggregated, de-identified analytics to improve the Platform.</li>
      </ul>

      <h2>3. Legal basis</h2>
      <p>
        We process your personal data on the basis of (a) the contract you enter into with us
        when you accept our Terms of Service, (b) compliance with legal obligations under the
        PMLA, the Income-tax Act, FIU-IND directions, and the IT Act, and (c) where applicable,
        the consent you provide at the point of collection (for example, for Aadhaar e-KYC).
        You may withdraw consent at any time by writing to our Grievance Officer; withdrawal
        will not affect processing already carried out, and we may need to restrict or close
        your account if consent is withdrawn for a purpose that is essential for service
        provision.
      </p>

      <h2>4. Who we share data with</h2>
      <p>We share personal data only with the following categories of recipients:</p>
      <ul>
        <li><strong>Payment partners</strong> — Razorpay Software Private Limited, for processing INR deposits and the bank account of record for INR withdrawals.</li>
        <li><strong>KYC and identity-verification providers</strong> — Sandbox.co.in (Quicko Infosoft Private Limited) for PAN, Aadhaar, and bank verification.</li>
        <li><strong>Communications providers</strong> — Twilio (SMS) and Zeptomail (email) for transactional notifications.</li>
        <li><strong>Cloud hosting and infrastructure</strong> — providers under contract that store and process data on our behalf.</li>
        <li><strong>Regulators and law enforcement</strong> — Financial regulators, the Revenue Authority, courts, and law-enforcement agencies, where disclosure is required by law or in response to a valid legal request.</li>
        <li><strong>Professional advisers</strong> — auditors, lawyers, and accountants under a duty of confidentiality.</li>
        <li><strong>Successors</strong> — any acquirer in connection with a merger, acquisition, or sale of assets, subject to the same protections set out in this Policy.</li>
      </ul>
      <p>
        We do not sell or rent personal data, and we do not share personal data with
        advertising networks for cross-context behavioural advertising.
      </p>

      <h2>5. Retention</h2>
      <p>
        We retain account, KYC, and transaction records for at least <strong>five years</strong>{" "}
        from the date of the relevant transaction or the closure of your account, whichever is
        later, as required by Section 12 of the Prevention of Money Laundering Act, 2002. Tax
        records are retained for the period prescribed under the Income-tax Act. Server logs
        and security records are retained for shorter periods consistent with our security
        policy. After the retention period expires, data is securely deleted or irreversibly
        anonymised.
      </p>

      <h2>6. Security</h2>
      <ul>
        <li>Data in transit is protected with TLS.</li>
        <li>Sensitive fields (KYC numbers, hot-wallet keys) are encrypted at rest with AES-256-class algorithms.</li>
        <li>Access to production systems is role-based, logged, and limited to authorised personnel with a business need.</li>
        <li>We follow industry standards for vulnerability management, secret rotation, and security testing.</li>
      </ul>
      <p>
        No system is perfectly secure. If you believe your account has been compromised,
        contact us immediately at{" "}
        <a href="mailto:help@intuitionexchange.com">help@intuitionexchange.com</a>.
      </p>

      <h2>7. Cookies</h2>
      <p>We use a small number of cookies and similar technologies:</p>
      <ul>
        <li><strong>Strictly necessary</strong> — session, CSRF, and login cookies required to operate the Platform.</li>
        <li><strong>Preference</strong> — to remember your theme (light/dark) and locale.</li>
        <li><strong>Analytics</strong> — aggregated traffic analytics; we do not use cookies for cross-site advertising.</li>
      </ul>
      <p>
        You can clear cookies through your browser settings. Disabling strictly necessary
        cookies will prevent you from logging in.
      </p>

      <h2>8. Your rights</h2>
      <p>Subject to applicable law (including the DPDP Act, 2023), you have the right to:</p>
      <ul>
        <li>access the personal data we hold about you;</li>
        <li>request correction of inaccurate or incomplete data;</li>
        <li>request erasure of data we are no longer required to retain;</li>
        <li>withdraw consent for processing based on consent;</li>
        <li>nominate another individual to exercise your rights in the event of your death or incapacity;</li>
        <li>file a complaint with our Grievance Officer and, where unresolved, with the relevant Data Protection Authority of Uganda.</li>
      </ul>
      <p>
        Some rights are limited by our legal obligation to retain KYC and transaction records
        under the PMLA. To exercise your rights, write to{" "}
        <a href="mailto:help@intuitionexchange.com">help@intuitionexchange.com</a> from your
        registered email address.
      </p>

      <h2>9. International transfers</h2>
      <p>
        We process and store data primarily in Uganda. Where any sub-processor stores data
        outside Uganda, we transfer data only to jurisdictions notified or otherwise permitted
        under the DPDP Act, 2023 and on the basis of contractual safeguards.
      </p>

      <h2>10. Children</h2>
      <p>
        The Platform is not intended for, and is not knowingly offered to, persons under 18.
        We do not knowingly collect personal data from minors. If you believe we have
        inadvertently collected such data, write to us and we will delete it.
      </p>

      <h2>11. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. The &ldquo;Last updated&rdquo; date at the
        top reflects the most recent change. Material changes will be notified to you in the
        Platform or by email.
      </p>

      <h2>12. Contact and grievance</h2>
      <GrievanceBlock />
    </LegalPageLayout>
  );
}
