import { Router } from "express";

export const legalRouter = Router();

function page(title: string, content: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Yugm</title><style>
    :root{color-scheme:dark;font:16px/1.65 system-ui,sans-serif;background:#100c19;color:#f6f0fb}body{margin:0}.wrap{max-width:760px;margin:0 auto;padding:36px 22px 64px}h1,h2{line-height:1.2}h1{font-size:2.2rem}h2{margin-top:2rem;color:#ffc0de}p,li{color:#ddd2e7}a{color:#ff9acc}label{display:block;margin:16px 0 6px;font-weight:650}input,textarea,button{box-sizing:border-box;width:100%;padding:12px;border-radius:10px;border:1px solid #5b4769;background:#21182b;color:#fff;font:inherit}textarea{min-height:130px}button{margin-top:18px;border:0;background:#ee3f91;font-weight:750;cursor:pointer}small{color:#bcaec8}.notice{padding:12px 14px;border:1px solid #5b4769;border-radius:10px}footer{margin-top:42px;border-top:1px solid #473852;padding-top:18px;color:#bcaec8}
    </style></head><body><main class="wrap"><p><a href="/">Yugm</a></p><h1>${title}</h1>${content}<footer>Yugm · <a href="/legal/privacy">Privacy</a> · <a href="/legal/account-deletion">Account deletion</a> · <a href="/legal/contact">Contact</a></footer></main></body></html>`;
}

legalRouter.get("/privacy", (_req, res) => {
  res.type("html").send(page("Privacy Policy", `
    <p><small>Last updated: November 11, 2026</small></p>
    <p>This policy explains how Yugm handles information when you use the Yugm Android app and related services. Yugm is an adults-only social, voice, video, chat, creator, and community service.</p>
    <h2>Information we collect</h2>
    <ul><li><b>Account and profile:</b> email address or phone number, Firebase account identifier, display name, username, age, profile photo and media, bio, interests, languages, city, and profile preferences.</li>
    <li><b>Messages and user content:</b> chats, posts, room content, voice or video sessions when you choose to join or publish them, reports, blocks, and support requests.</li>
    <li><b>Device and service data:</b> push notification token, app and device diagnostics, security events, feature usage, and network/service logs.</li>
    <li><b>Payments and creator services:</b> purchase records, virtual currency transactions, payout eligibility and verification details you submit. Payment credentials are handled by the selected payment provider.</li>
    <li><b>Safety and verification:</b> moderation reports, trust verification media, and information used to investigate abuse or protect users.</li></ul>
    <h2>How we use information</h2><p>We use information to create and secure accounts; provide profiles, chats, rooms, matching, creator, wallet, and notification features; process purchases and payouts; personalize the service; prevent fraud and abuse; moderate content; and provide support.</p>
    <h2>How information is shared</h2><p>Profile information and content are shown to other users according to the features and visibility settings you choose. We use service providers for hosting and databases, authentication and notifications, voice/video delivery, and payment processing. We may disclose information when required by law or necessary to protect users, the service, or legal rights. We do not sell personal information.</p>
    <h2>Permissions</h2><p>Camera and microphone access are used when you choose profile media, voice rooms, calls, or verification features. Notifications are used for service alerts. You can manage permissions in Android settings; some features may not work without them.</p>
    <h2>Retention and deletion</h2><p>We retain information while needed to provide the service, meet legal and accounting obligations, resolve disputes, and protect users. You may request account and associated data deletion through <a href="/legal/account-deletion">this form</a>. We verify requests before processing and explain any data that must be retained by law.</p>
    <h2>Security and children</h2><p>We use access controls and encrypted network connections to protect information. No online service can guarantee absolute security. Yugm is intended for adults aged 18 and older and does not allow children to create accounts or use dating and social features.</p>
    <h2>Your privacy questions</h2><p>For privacy questions or requests, use the <a href="/legal/contact">Yugm contact form</a>. For account deletion, use the dedicated form above.</p>`));
});

legalRouter.get("/terms", (_req, res) => {
  res.type("html").send(page("Terms of Use", `
    <p>By creating a Yugm account or using Yugm, you agree to these rules and our <a href="/legal/privacy">Privacy Policy</a>.</p>
    <h2>Eligibility</h2><p>Yugm is for adults aged 18 and older. Do not create an account if you are under 18 or provide false age information.</p>
    <h2>Community and user content</h2><p>Do not post or transmit illegal, hateful, threatening, harassing, sexually exploitative, deceptive, or otherwise harmful content. Child sexual abuse and exploitation, grooming, and sexualization of minors are strictly prohibited. You remain responsible for content you create. Yugm may review reports, remove content, restrict features, or suspend accounts to protect people and enforce these rules.</p>
    <p>Before creating a profile, joining or hosting rooms, messaging, or posting, you must accept these Terms and our <a href="/legal/child-safety">Child Safety Standards</a>. Use in-app report and block controls when you encounter a safety problem.</p>
    <h2>Virtual items and payments</h2><p>Virtual currency and digital items are for use in Yugm and have no cash value unless a feature expressly allows an eligible creator payout. Purchases are subject to the payment provider’s terms and applicable law. Refunds are handled under the rules shown by the provider and applicable consumer law.</p>
    <h2>Account closure and service changes</h2><p>You may request account and personal data deletion using the <a href="/legal/account-deletion">deletion form</a>. Yugm may restrict or close accounts for serious or repeated violations and may change or discontinue features with notice where required.</p>
    <h2>Contact</h2><p>For questions, use the <a href="/legal/contact">Yugm contact form</a>.</p>`));
});

legalRouter.get("/child-safety", (_req, res) => {
  res.type("html").send(page("Child Safety Standards", `
    <p>Yugm is an adults-only social and dating service. People under 18 may not create an account or use Yugm.</p>
    <h2>Prohibited content and conduct</h2><p>Yugm prohibits child sexual abuse and exploitation, grooming, sexualization of minors, and any attempt to create, request, possess, or distribute child sexual abuse material. Such activity may result in immediate content removal, account suspension, preservation of relevant records, and reporting to appropriate authorities where required.</p>
    <h2>Reporting and response</h2><p>Users can report profiles, room activity, messages, and other content from the app’s Safety Center or the relevant content menu. Reports are reviewed by the Yugm safety team and may result in removal, restrictions, or account termination. For an urgent child safety concern, submit the <a href="/legal/contact">Yugm contact form</a> and select “Child safety report.”</p>
    <h2>Safety contact</h2><p>Yugm’s child safety contact is reached through the <a href="/legal/contact">Yugm contact form</a>. Please include “Child safety report” in the subject so it is routed for priority review. Do not upload or resend suspected illegal imagery in a report.</p>
    <h2>Standards</h2><p>Yugm cooperates with lawful child-safety investigations and reviews these standards as the service evolves. These standards apply to all users and all content features.</p>`));
});

legalRouter.get("/account-deletion", (_req, res) => {
  res.type("html").send(page("Request Account Deletion", `
    <p>Use this form to request deletion of your Yugm account and associated personal data. Yugm support will verify account ownership, process the request, and tell you if any records must be retained by law. You can also reach this form from Settings in the app.</p>
    <form id="request"><label for="email">Email used for your account</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="254"><label for="username">Yugm username (if known)</label><input id="username" name="username" autocomplete="username" maxlength="32"><label><input id="confirm" type="checkbox" required style="width:auto"> I am requesting deletion of my Yugm account and understand support may contact me to verify ownership.</label><button type="submit">Submit deletion request</button></form><p id="result" class="notice" hidden></p>
    <script>document.getElementById('request').addEventListener('submit',async e=>{e.preventDefault();const result=document.getElementById('result');const data={email:document.getElementById('email').value,username:document.getElementById('username').value,subject:'Delete my Yugm account',message:'I request deletion of my Yugm account and associated personal data. Please contact me to verify ownership if needed.',requestType:'ACCOUNT_DELETION'};try{const r=await fetch('/api/support/public-requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.error?.message||'Request could not be submitted');result.textContent='Request received. Reference: '+j.data.requestId+'. Keep this reference for support follow-up.';result.hidden=false;e.target.reset()}catch(err){result.textContent=err.message;result.hidden=false}})</script>`));
});

legalRouter.get("/contact", (_req, res) => {
  res.type("html").send(page("Contact Yugm", `
    <p>Send a privacy question, support request, or child-safety report. For account deletion, use the dedicated <a href="/legal/account-deletion">deletion request form</a>.</p>
    <form id="request"><label for="email">Your email</label><input id="email" type="email" required maxlength="254"><label for="subject">Subject</label><input id="subject" required minlength="3" maxlength="120"><label for="message">Message</label><textarea id="message" required minlength="10" maxlength="2000"></textarea><button type="submit">Send request</button></form><p id="result" class="notice" hidden></p>
    <script>document.getElementById('request').addEventListener('submit',async e=>{e.preventDefault();const result=document.getElementById('result');const data={email:document.getElementById('email').value,subject:document.getElementById('subject').value,message:document.getElementById('message').value,requestType:'SUPPORT'};try{const r=await fetch('/api/support/public-requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.error?.message||'Request could not be submitted');result.textContent='Request received. Reference: '+j.data.requestId+'.';result.hidden=false;e.target.reset()}catch(err){result.textContent=err.message;result.hidden=false}})</script>`));
});
