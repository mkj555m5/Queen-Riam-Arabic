'use strict';

/**
 * lib/richMessage.js — مساعد لإرسال Rich Response Messages
 *
 * الإضافات اللي بتبعت ألعاب HTML/React بتستخدم richResponseMessage.
 * ده مساعد موحّد لإرسال نفس النوع من الرسائل.
 */

const { Buffer } = require('buffer');
const { randomUUID } = require('crypto');

/**
 * إرسال رسالة HTML تفاعلية (rich response)
 * @param {object} sock   — Baileys socket
 * @param {string} chatId — الـ JID المستهدف
 * @param {string} html   — كود HTML اللي هيتعرض
 * @param {string} title  — عنوان قصير يظهر فوق الـ HTML
 */
async function sendRichHtml(sock, chatId, html, title = 'Queen Riam — Interactive') {
  const responseId = randomUUID();

  // richResponseMessage payload — WhatsApp Chat Platform
  const payload = {
    response_id: responseId,
    sections: [
      {
        view_model: {
          primitive: {
            __typename: 'GenAIaeacdsnwHtmlPrimitive',
            payload: html,
            trusted_sources: ['yato.dev', 'queen-riam.dev'],
          },
          __typename: 'GenAISingleLayoutViewModel',
        },
      },
    ],
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');

  await sock.relayMessage(
    chatId,
    {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        botMetadata: {
          messageDisclaimerText: '',
          botResponseId: responseId,
        },
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: [
              {
                messageType: 2,
                messageText: title,
              },
            ],
            unifiedResponse: {
              data: encoded,
            },
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardedAiBotMessageInfo: {
                botJid: '867051314767696@bot',
              },
              forwardOrigin: 4,
            },
          },
        },
      },
    },
    { messageId: responseId }
  );
}

module.exports = { sendRichHtml };
