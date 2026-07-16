"use strict";exports.id=5298,exports.ids=[5298],exports.modules={25451:(a,b,c)=>{c.d(b,{$r:()=>D,AE:()=>u,Cp:()=>r,H9:()=>O,LL:()=>o,Nx:()=>x,OH:()=>I,R0:()=>J,UE:()=>s,Ue:()=>v,_S:()=>z,aw:()=>F,ax:()=>A,bX:()=>w,dq:()=>B,e1:()=>q,fN:()=>M,g7:()=>y,p4:()=>E,sN:()=>p,sO:()=>K,se:()=>G,tG:()=>t,u6:()=>L,wX:()=>N,xK:()=>C});var d=c(87550),e=c.n(d),f=c(33873),g=c.n(f),h=c(29021),i=c.n(h),j=c(55511),k=c.n(j);function l(){return process.env.DATA_DIR||g().join(process.cwd(),"data")}function m(){return g().join(l(),"audio")}function n(){return globalThis.__focusreaderDb||(globalThis.__focusreaderDb=function(){i().mkdirSync(m(),{recursive:!0});let a=new(e())(g().join(l(),"focusreader.db"));a.pragma("journal_mode = WAL"),a.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      title       TEXT NOT NULL,
      chars       INTEGER NOT NULL,
      speed       REAL NOT NULL DEFAULT 1.0,
      background  TEXT NOT NULL DEFAULT 'silence',
      status      TEXT NOT NULL DEFAULT 'processing',
      size_bytes  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tracks_user ON tracks(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS credit_ledger (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      delta       INTEGER NOT NULL,
      reason      TEXT NOT NULL,
      ref         TEXT,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_user ON credit_ledger(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_dedupe
      ON credit_ledger(reason, ref) WHERE ref IS NOT NULL;

    CREATE TABLE IF NOT EXISTS jobs (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      track_id    TEXT NOT NULL,
      text        TEXT NOT NULL,
      speed       REAL NOT NULL DEFAULT 1.0,
      background  TEXT NOT NULL DEFAULT 'silence',
      status      TEXT NOT NULL DEFAULT 'queued',
      error       TEXT,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS notes (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      note        TEXT NOT NULL,
      source      TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS reader_docs (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      title       TEXT NOT NULL,
      doc_type    TEXT NOT NULL DEFAULT 'pdf',
      num_pages   INTEGER NOT NULL DEFAULT 1,
      current_page INTEGER NOT NULL DEFAULT 1,
      current_chunk INTEGER NOT NULL DEFAULT 0,
      total_words INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reader_docs_user ON reader_docs(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS imports (
      id          TEXT PRIMARY KEY,
      text        TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS extension_tokens (
      token_hash  TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      last_used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ext_tokens_user ON extension_tokens(user_id);
  `);try{a.exec("ALTER TABLE jobs ADD COLUMN checkpoints INTEGER NOT NULL DEFAULT 0")}catch{}try{a.exec("ALTER TABLE tracks ADD COLUMN text TEXT NOT NULL DEFAULT ''")}catch{}try{a.exec("ALTER TABLE tracks ADD COLUMN source_url TEXT DEFAULT NULL")}catch{}return a}()),globalThis.__focusreaderDb}function o(a){return g().join(m(),`${a}.mp3`)}function p(a){let b=k().randomUUID();return n().prepare(`INSERT INTO tracks (id, user_id, title, chars, speed, background, status, text, source_url)
       VALUES (?, ?, ?, ?, ?, ?, 'processing', ?, ?)`).run(b,a.userId,a.title,a.chars,a.speed,a.background,a.text??"",a.sourceUrl??null),s(b,a.userId)}function q(a,b){n().prepare("UPDATE tracks SET status = 'ready', size_bytes = ? WHERE id = ?").run(b,a)}function r(a){n().prepare("UPDATE tracks SET status = 'failed' WHERE id = ?").run(a)}function s(a,b){return n().prepare("SELECT * FROM tracks WHERE id = ? AND user_id = ?").get(a,b)}function t(a,b=50){return n().prepare(`SELECT id, user_id, title, chars, speed, background, status, size_bytes, created_at, source_url
       FROM tracks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).all(a,b)}function u(a){return n().prepare("SELECT COALESCE(SUM(delta), 0) AS balance FROM credit_ledger WHERE user_id = ?").get(a).balance}function v(a){return void 0!==n().prepare("SELECT 1 FROM credit_ledger WHERE user_id = ? LIMIT 1").get(a)}function w(a,b,c,d){return n().prepare(`INSERT OR IGNORE INTO credit_ledger (user_id, delta, reason, ref)
       VALUES (?, ?, ?, ?)`).run(a,b,c,d??null).changes>0}function x(a,b,c){let d=n();return d.transaction(()=>{let{balance:e}=d.prepare("SELECT COALESCE(SUM(delta), 0) AS balance FROM credit_ledger WHERE user_id = ?").get(a);return e<b?null:(d.prepare(`INSERT INTO credit_ledger (user_id, delta, reason, ref)
       VALUES (?, ?, 'spend_tts', ?)`).run(a,-b,c),e-b)})()}function y(a,b){let c=n();c.transaction(()=>{let d=u(a);d>0&&c.prepare(`INSERT OR IGNORE INTO credit_ledger (user_id, delta, reason, ref)
         VALUES (?, ?, 'revoke_cancel', ?)`).run(a,-d,b)})()}function z(a){let b=k().randomUUID();return n().prepare(`INSERT INTO jobs (id, user_id, track_id, text, speed, background, checkpoints)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(b,a.userId,a.trackId,a.text,a.speed,a.background,+!!a.checkpoints),A(b,a.userId)}function A(a,b){return n().prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ?").get(a,b)}function B(){let a=n();return a.transaction(()=>{let b=a.prepare("SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1").get();if(b)return a.prepare("UPDATE jobs SET status = 'running', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(b.id),{...b,status:"running"}})()}function C(a,b){n().prepare("UPDATE jobs SET status = ?, error = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(b?"failed":"done",b??null,a)}function D(a,b){return n().prepare("DELETE FROM tracks WHERE id = ? AND user_id = ?").run(a,b).changes>0&&(i().rmSync(o(a),{force:!0}),!0)}function E(a){let b=k().randomUUID();return n().prepare("INSERT INTO notes (id, user_id, note, source) VALUES (?, ?, ?, ?)").run(b,a.userId,a.note,a.source),n().prepare("SELECT * FROM notes WHERE id = ?").get(b)}function F(a){let b=n();b.prepare("DELETE FROM imports WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')").run();let c=k().randomUUID();return b.prepare("INSERT INTO imports (id, text) VALUES (?, ?)").run(c,a.slice(0,2e5)),b.prepare("SELECT * FROM imports WHERE id = ?").get(c)}function G(a){let b=n(),c=b.prepare("SELECT * FROM imports WHERE id = ?").get(a);return c&&b.prepare("DELETE FROM imports WHERE id = ?").run(a),c}function H(a){return k().createHash("sha256").update(a).digest("hex")}function I(a){let b=`frk_${k().randomBytes(32).toString("hex")}`,c=n();return c.transaction(()=>{c.prepare("DELETE FROM extension_tokens WHERE user_id = ?").run(a),c.prepare("INSERT INTO extension_tokens (token_hash, user_id) VALUES (?, ?)").run(H(b),a)})(),b}function J(a){if(!a||!a.startsWith("frk_"))return null;let b=n(),c=b.prepare("SELECT user_id FROM extension_tokens WHERE token_hash = ?").get(H(a));return c?(b.prepare("UPDATE extension_tokens SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE token_hash = ?").run(H(a)),c.user_id):null}function K(a){n().prepare("DELETE FROM extension_tokens WHERE user_id = ?").run(a)}async function L(a){let b=a.id||k().randomUUID(),c=n();return c.prepare(`INSERT OR REPLACE INTO reader_docs (id, user_id, title, doc_type, num_pages, current_page, current_chunk, total_words, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, 0, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`).run(b,a.userId,a.title,a.docType,a.numPages,a.totalWords),c.prepare("SELECT * FROM reader_docs WHERE id = ? AND user_id = ?").get(b,a.userId)}async function M(a,b=50){return n().prepare("SELECT * FROM reader_docs WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?").all(a,b)}async function N(a,b,c,d){n().prepare(`UPDATE reader_docs SET current_page = ?, current_chunk = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ? AND user_id = ?`).run(c,d,a,b)}async function O(a,b){return n().prepare("DELETE FROM reader_docs WHERE id = ? AND user_id = ?").run(a,b).changes>0}},34484:(a,b,c)=>{c.d(b,{Cv:()=>f,NC:()=>g,fw:()=>i,oE:()=>j});var d=c(58102);let e=null;function f(){if(!process.env.STRIPE_SECRET_KEY)throw Error("STRIPE_SECRET_KEY is not set. Add it to frontend/.env.local.");return e||(e=new d.Ay(process.env.STRIPE_SECRET_KEY,{typescript:!0})),e}let g=1e5;function h(a){let b=process.env[a];if(!b)throw Error(`${a} is not set. Add it to frontend/.env.local.`);return b}async function i(a){let b=f(),c=h("NEXT_PUBLIC_APP_URL"),d=a.priceId||process.env.STRIPE_PREMIUM_PRICE_ID;"price_monthly_1999"===d||"core"===d?d=process.env.STRIPE_MONTHLY_PRICE_ID||process.env.STRIPE_PREMIUM_PRICE_ID||"price_monthly_1999":"price_6months_8999"===d||"pro"===d?d=process.env.STRIPE_PRO_PRICE_ID||process.env.STRIPE_PREMIUM_PRICE_ID||"price_6months_8999":("price_2years_19999"===d||"enterprise"===d)&&(d=process.env.STRIPE_ENTERPRISE_PRICE_ID||process.env.STRIPE_PREMIUM_PRICE_ID||"price_2years_19999"),d||(d=h("STRIPE_PREMIUM_PRICE_ID"));let e=await b.checkout.sessions.create({mode:"subscription",line_items:[{price:d,quantity:1}],client_reference_id:a.clerkUserId,metadata:{clerk_user_id:a.clerkUserId},subscription_data:{metadata:{clerk_user_id:a.clerkUserId}},...a.existingStripeCustomerId?{customer:a.existingStripeCustomerId}:{customer_email:a.customerEmail},allow_promotion_codes:!0,success_url:`${c}/dashboard/billing?checkout=success`,cancel_url:`${c}/dashboard/billing?checkout=cancelled`});if(!e.url)throw Error("Stripe did not return a Checkout Session URL.");return e.url}async function j(a){let b=f(),c=h("NEXT_PUBLIC_APP_URL");return(await b.billingPortal.sessions.create({customer:a,return_url:`${c}/dashboard/billing`})).url}},52827:(a,b,c)=>{c.d(b,{De:()=>g,JD:()=>f,wj:()=>h});var d=c(82513),e=c(25451);async function f(a){let b=await (0,d.$)(),c=await b.users.getUser(a),f=c.primaryEmailAddress?.emailAddress?.toLowerCase(),g=c.privateMetadata?.billing;if("zhavior@gmail.com"===f||g?.vipForever)return g?.plan==="premium"&&g?.vipForever||await b.users.updateUserMetadata(a,{privateMetadata:{billing:{...g,plan:"premium",vipForever:!0}}}).catch(()=>{}),{plan:"premium",credits:0x3b9ac9ff,stripeCustomerId:g?.stripeCustomerId||"vip_zhavior_forever",stripeSubscriptionId:g?.stripeSubscriptionId||"sub_vip_forever",creditsGrantedAt:new Date().toISOString()};let h="number"==typeof g?.credits?g.credits:0;return h>0&&!(0,e.Ue)(a)&&(0,e.bX)(a,h,"migration",`clerk:${a}`),(0,e.Ue)(a)||(0,e.bX)(a,5e3,"signup_bonus",`signup:${a}`),{plan:g?.plan==="premium"?"premium":"free",credits:(0,e.AE)(a),stripeCustomerId:g?.stripeCustomerId,stripeSubscriptionId:g?.stripeSubscriptionId,creditsGrantedAt:g?.creditsGrantedAt,lastInvoiceId:g?.lastInvoiceId,canceledAt:g?.canceledAt}}async function g(a,b){let c=await (0,d.$)(),{credits:e,...f}=b;await c.users.updateUserMetadata(a,{privateMetadata:{billing:f}})}async function h(a,b,c){try{let b=await (0,d.$)(),c=await b.users.getUser(a),e=c.primaryEmailAddress?.emailAddress?.toLowerCase(),f=c.privateMetadata?.billing;if("zhavior@gmail.com"===e||f?.vipForever)return 0x3b9ac9ff}catch{}return(0,e.Nx)(a,b,c)}}};