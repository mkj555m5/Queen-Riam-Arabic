import fetch from "node-fetch";

export class PaymentGateway {
  constructor(config = {}) {
    this.config = {
      base: config.base || config.baseUrl || "https://mustikapayment.com",
      key: config.key || config.apiKey,
      ...config
    };
    this.headers = {
      "X-Api-Key": this.config.key,
    };
  }

  pick(...v) {
    return v.find((x) => x !== undefined && x !== null && String(x) !== "") || null;
  }

  qrUrl(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    return `https://quickchart.io/qr?size=512&text=${encodeURIComponent(s)}`;
  }

  async json(r) {
    const j = await r.json().catch(() => ({}));
    return j;
  }

  mapQr(x = {}) {
    const d = x.data || {};
    const rawQr = this.pick(
      x.qr_image, x.qrImage, x.qr_url, x.qrUrl, x.qris_url, x.image_url, x.image, x.qr_content, x.qrContent,
      d.qr_image, d.qrImage, d.qr_url, d.qrUrl, d.qris_url, d.image_url, d.image, d.qr, d.qr_content, d.qrContent
    );
    return {
      ok: String(this.pick(x.status, d.status, x.message) || "").toLowerCase() === "success",
      ref: this.pick(x.ref_no, x.reference, d.ref_no, d.reference, d.ref),
      link: this.pick(x.payment_link, x.urlPayment, d.payment_link, d.urlPayment, d.link),
      qr: this.qrUrl(rawQr),
      qrContent: this.pick(x.qr_content, x.qrContent, d.qr_content, d.qrContent),
      amount: this.pick(x.amount, d.amount),
      expiredAt: this.pick(x.expired_at, x.expiredAt, x.settle_at, d.expired_at, d.expiredAt, d.settle_at),
      raw: x,
    };
  }

  async createPay({ amount, product_name, customer_name, order_id }) {
    const b = new URLSearchParams();
    b.set("amount", String(amount));
    if (product_name) b.set("product_name", product_name);
    if (customer_name) b.set("customer_name", customer_name);
    if (order_id) b.set("order_id", order_id);
    
    try {
      const r = await fetch(`${this.config.base}/api/createpay`, {
        method: "POST",
        headers: this.headers,
        body: b,
      });
      const j = await this.json(r);
      return this.mapQr(j);
    } catch (e) {
      console.error("[PG Error] createPay:", e);
      return { ok: false };
    }
  }

  async cekPay(ref) {
    try {
      const u = new URL(`${this.config.base}/api/cekpay`);
      u.searchParams.set("ref_no", ref);
      const r = await fetch(u, { headers: this.headers });
      return this.json(r);
    } catch (e) {
      console.error("[PG Error] cekPay:", e);
      return { ok: false };
    }
  }

  okPay(x = {}) {
    return String(x.status || "").toLowerCase() === "success";
  }
}

// Polling System
let isPolling = false;

export async function startPgPolling(sock, db, pgInstance) {
    if (isPolling) return;
    isPolling = true;
    
    setInterval(async () => {
        try {
            const payments = db.setting('pgPayments') || {};
            for (const [ref, pm] of Object.entries(payments)) {
                if (!ref || pm?.st === "paid") continue;
                if (pm?.type === "topup") {
                    const ck = await pgInstance.cekPay(ref);
                    if (!pgInstance.okPay(ck)) continue;
                    
                    // Settle Topup
                    await settlePayment(sock, db, ref, ck);
                }
            }
        } catch (e) {
            console.error("[PG Polling Error]", e);
        }
    }, 15000); // 15 detik
}

async function settlePayment(sock, db, ref, raw) {
    const payments = db.setting('pgPayments') || {};
    const pm = payments[ref];
    if (!pm) return;
    
    payments[ref] = { ...pm, raw, st: "paid" };
    db.setting('pgPayments', payments);
    
    if (pm.topupId) {
        const topups = db.setting('pgTopups') || {};
        const tp = topups[pm.topupId];
        if (!tp) return;
        
        tp.st = "paid";
        tp.payCheck = raw;
        tp.updatedAt = Date.now();
        topups[pm.topupId] = tp;
        db.setting('pgTopups', topups);
        
        // Add balance
        const balanceBefore = db.getUser(tp.userJid)?.saldo || 0;
        const balanceAfter = db.updateSaldo(tp.userJid, tp.amount);
        
        // Notify user
        try {
            let txt = `✅ *تمت تعبئة الرصيد بنجاح*\n\n`;
            txt += `👤 المستخدم: @${tp.userJid.split('@')[0]}\n`;
            txt += `🆔 معرّف التعبئة: \`${tp.id}\`\n`;
            txt += `💵 الرصيد المُضاف: *Rp ${tp.amount.toLocaleString('id-ID')}*\n`;
            txt += `🧾 رسوم الإدارة: *Rp ${tp.fee.toLocaleString('id-ID')}*\n`;
            txt += `💳 المبلغ المدفوع: *Rp ${tp.total.toLocaleString('id-ID')}*\n`;
            txt += `👛 الرصيد الحالي: *Rp ${balanceAfter.toLocaleString('id-ID')}*\n\n`;
            txt += `_زاد رصيدك وأصبح جاهزاً للطلب التلقائي للمنتجات_ 🛍️`;
            
            const targetJid = tp.chatJid || tp.userJid;
            await sock.sendMessage(targetJid, { text: txt, mentions: [tp.userJid] });
        } catch (e) {
            console.error("[PG Settle Error] فشل إرسال رسالة إلى المستخدم:", e);
        }
    }
}
