/**
 * Телеграм-бот Salon de Fleur «Цветочная гостиная» — Cloudflare Worker.
 *
 * Роль 1. Консультант: клиент пишет боту, получает приветствие и меню (/start),
 *         ответы на частые вопросы; любое его сообщение уходит флористу,
 *         а ответ флориста (Reply на сообщение) бот пересылает клиенту.
 * Роль 2. Уведомлятор: сайт отправляет заявку на POST /lead,
 *         бот присылает её флористу в личку.
 *
 * Переменные окружения (Settings → Variables and Secrets):
 *   BOT_TOKEN       — токен от @BotFather (секрет); подойдёт и уже заданный TELEGRAM_BOT_TOKEN
 *   ADMIN_CHAT_ID   — ваш chat id: напишите боту /id, он его покажет
 *   WEBHOOK_SECRET  — любая строка из латиницы и цифр, 16+ символов (секрет)
 *   SITE_URL        — адрес сайта, например https://aperevedencev-glitch.github.io/cvetochnaya_gostinaya/
 *   ALLOWED_ORIGIN  — откуда принимать заявки, например https://aperevedencev-glitch.github.io
 *
 * Маршруты:
 *   POST /webhook          — сюда Телеграм присылает сообщения (вебхук; /telegram тоже работает)
 *   POST /lead             — сюда сайт присылает заявки
 *   GET  /setup?key=СЕКРЕТ — один раз: подключить вебхук и меню команд
 */

const SHOP = {
  name: 'Salon de Fleur',
  sub: 'Цветочная гостиная',
  phone: '+7 (916) 831-92-44',
  email: 'gusarova.all@yandex.ru',
  hours: 'ежедневно с 8:00 до 22:00',
};

const CATALOG = [
  ['Пионовая гостиная', 'пионы Сара Бернар, эвкалипт', 4900],
  ['Красный рояль', 'розы Эксплорер 50 см, рускус', 3900],
  ['Утренний чай', 'эустома, кустовая роза, маттиола', 2700],
  ['Белая скатерть', 'гортензия, белые розы, шляпная коробка', 5200],
  ['Солнечный подоконник', 'ранункулюсы, мимоза, краспедия', 2400],
  ['Сиреневый вечер', 'сирень, тюльпаны, лаванда', 3600],
];

const rub = (n) => Number(n).toLocaleString('ru-RU') + ' ₽';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => String(s ?? '').trim().slice(0, n);

/* ---------- тексты консультанта ---------- */

const MENU = [
  [{ text: '💐 Каталог и цены', callback_data: 'catalog' }],
  [{ text: '🚚 Доставка и оплата', callback_data: 'delivery' }, { text: '🔁 Подписка', callback_data: 'subscription' }],
  [{ text: '🌿 Уход за букетом', callback_data: 'care' }, { text: '🛡 Гарантия', callback_data: 'guarantee' }],
  [{ text: '📝 Оформить заказ', callback_data: 'order' }],
  [{ text: '👩‍🌾 Написать флористу', callback_data: 'florist' }, { text: '📞 Контакты', callback_data: 'contacts' }],
];
const BACK = [[{ text: '« Меню', callback_data: 'menu' }]];

function greeting(firstName) {
  const hi = firstName ? `Здравствуйте, ${esc(firstName)}!` : 'Здравствуйте!';
  return `${hi} Это <b>${SHOP.name}</b> — «${SHOP.sub}», мастерская букетов с доставкой.\n\n` +
    'Собираем букеты из сезонных цветов в день доставки и присылаем фото готового букета до отправки.\n\n' +
    'Выберите, что вас интересует, или просто напишите вопрос — флорист ответит здесь же.';
}

function section(key, env) {
  const site = env.SITE_URL ? `\n\n<a href="${esc(env.SITE_URL)}">Открыть сайт</a>` : '';
  switch (key) {
    case 'catalog':
      return '<b>Букеты этой недели</b>\nЦены за размер «Камерный»; «Гостиный» ≈ ×1,45, «Бальный» ≈ ×2,1.\n\n' +
        CATALOG.map(([n, c, p]) => `• <b>${n}</b> — от ${rub(p)}\n  <i>${c}</i>`).join('\n') +
        '\n\nСоставы меняются по сезону: если какого-то цветка нет, предложим равноценную замену на фото до отправки.' + site;
    case 'delivery':
      return '<b>Доставка</b>\n' +
        `• ${SHOP.hours}, интервал 1 час\n• срочно — за 90 минут\n• стоимость 390 ₽, от 5 000 ₽ — бесплатно\n` +
        '• зимой везём в термобоксе\n• курьер может прислать фото вручения\n\n' +
        '<b>Оплата</b>\nКартой или по СБП. Перед отправкой присылаем фото букета: вы одобряете — курьер выезжает. ' +
        'Если не договорились о правках, вернём деньги до отправки.';
    case 'subscription':
      return '<b>Подписка на цветы</b>\nФлорист сам собирает новый сезонный букет.\n\n' +
        '• раз в неделю — скидка 20%\n• раз в 2 недели — 15%\n• раз в месяц — 10%\n' +
        '• доставка бесплатно, пропустить или перенести можно за сутки\n• можно подарить на 3, 6 или 12 месяцев' + site;
    case 'care':
      return '<b>Как продлить букету жизнь</b>\n' +
        '• подрежьте стебли под углом 45° на 2–3 см\n• вода 18–20 °C, для тюльпанов — прохладная\n' +
        '• меняйте воду раз в 2 дня, листья не должны касаться воды\n• подкормка: 1 пакетик на литр\n' +
        '• не ставьте рядом с фруктами и батареей';
    case 'guarantee':
      return '<b>Гарантия свежести 7 дней</b>\nЕсли при соблюдении правил ухода букет завял раньше — пришлите фото, ' +
        'соберём и привезём новый бесплатно.';
    case 'order':
      return '<b>Оформить заказ</b>\nНапишите одним сообщением:\n\n' +
        '1. Букет и размер\n2. Дату и интервал доставки\n3. Адрес\n4. Имя и телефон получателя\n' +
        '5. Текст открытки (если нужна)\n\nФлорист проверит наличие и пришлёт ссылку на оплату.';
    case 'florist':
      return 'Напишите вопрос прямо сюда — можно приложить фото букета-примера. ' +
        `Флорист ответит в этом чате (${SHOP.hours}).`;
    case 'contacts':
      return `<b>${SHOP.name}</b> — ${SHOP.sub}\n📞 ${SHOP.phone}\n✉️ ${SHOP.email}\n🕗 ${SHOP.hours}` + site;
    default:
      return null;
  }
}

/* ---------- Telegram API ---------- */

const tokenOf = (env) => env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;

async function tg(env, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${tokenOf(env)}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) console.log('telegram error', method, JSON.stringify(data));
  return data;
}

const send = (env, chat_id, text, keyboard) =>
  tg(env, 'sendMessage', {
    chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });

/* ---------- роль 1: консультант ---------- */

function clientLabel(from) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Без имени';
  return esc(name) + (from.username ? ` (@${esc(from.username)})` : '');
}

// Метка #id<число> в тексте позволяет флористу просто ответить (Reply), без базы данных.
const tagFor = (chatId) => `#id${chatId}`;
const tagRe = /#id(-?\d+)/;

async function forwardToFlorist(env, msg) {
  const header = `💬 <b>Клиент пишет в бот</b>\n${clientLabel(msg.from)}\n`;
  const footer = `\n\n<i>Ответьте (Reply) на это сообщение — бот перешлёт ответ клиенту.</i>\n${tagFor(msg.chat.id)}`;

  if (msg.text) {
    return send(env, env.ADMIN_CHAT_ID, header + '\n' + esc(msg.text) + footer);
  }
  const canCaption = msg.photo || msg.video || msg.document || msg.voice || msg.audio || msg.animation;
  if (canCaption) {
    return tg(env, 'copyMessage', {
      chat_id: env.ADMIN_CHAT_ID, from_chat_id: msg.chat.id, message_id: msg.message_id,
      caption: header + (msg.caption ? '\n' + esc(msg.caption) : '') + footer, parse_mode: 'HTML',
    });
  }
  // стикер, контакт, геопозиция и т. п.: копия + отдельная подпись с меткой
  await tg(env, 'copyMessage', { chat_id: env.ADMIN_CHAT_ID, from_chat_id: msg.chat.id, message_id: msg.message_id });
  return send(env, env.ADMIN_CHAT_ID, header + footer);
}

async function handleClientMessage(env, msg) {
  const text = (msg.text || '').trim();
  const cmd = text.startsWith('/') ? text.split(/[\s@]/)[0].toLowerCase() : null;

  if (cmd === '/start' || cmd === '/menu') {
    return send(env, msg.chat.id, greeting(msg.from?.first_name), MENU);
  }
  if (cmd === '/id') {
    return send(env, msg.chat.id, `Ваш chat id: <code>${msg.chat.id}</code>`);
  }
  if (cmd === '/order') {
    return send(env, msg.chat.id, section('order', env), BACK);
  }
  if (cmd) {
    return send(env, msg.chat.id, 'Такой команды нет. Вот меню:', MENU);
  }

  const r = await forwardToFlorist(env, msg);
  if (r?.ok) {
    return send(env, msg.chat.id, 'Спасибо! Передали флористу, ответ придёт в этот чат.', BACK);
  }
  return send(env, msg.chat.id, `Не получилось передать сообщение. Позвоните нам: ${SHOP.phone}`);
}

async function handleFloristMessage(env, msg) {
  const text = (msg.text || '').trim();
  if (text === '/start' || text === '/menu') {
    return send(env, msg.chat.id,
      'Вы флорист этого бота.\n\n• Заявки с сайта и сообщения клиентов приходят сюда.\n' +
      '• Чтобы ответить клиенту, нажмите <b>Ответить (Reply)</b> на его сообщение — можно текстом, фото или голосом.\n' +
      '• /client — посмотреть меню глазами клиента.');
  }
  if (text === '/client') return send(env, msg.chat.id, greeting(msg.from?.first_name), MENU);
  if (text === '/id') return send(env, msg.chat.id, `Ваш chat id: <code>${msg.chat.id}</code>`);

  const replied = msg.reply_to_message;
  const source = replied && (replied.text || replied.caption || '');
  const m = source && source.match(tagRe);
  if (!m) {
    return send(env, msg.chat.id, 'Чтобы ответить клиенту, нажмите «Ответить» (Reply) на его сообщение.');
  }
  const clientId = m[1];
  const r = await tg(env, 'copyMessage', { chat_id: clientId, from_chat_id: msg.chat.id, message_id: msg.message_id });
  return send(env, msg.chat.id, r?.ok ? '✅ Отправлено клиенту' : '⚠️ Не доставлено: клиент мог заблокировать бота.');
}

async function handleCallback(env, cq) {
  const chatId = cq.message?.chat?.id;
  await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id });
  if (!chatId) return;
  if (cq.data === 'menu') return send(env, chatId, greeting(cq.from?.first_name), MENU);
  const text = section(cq.data, env);
  if (text) return send(env, chatId, text, BACK);
}

async function handleUpdate(env, update) {
  if (update.callback_query) return handleCallback(env, update.callback_query);
  const msg = update.message;
  if (!msg || msg.chat?.type !== 'private') return;
  if (String(msg.chat.id) === String(env.ADMIN_CHAT_ID)) return handleFloristMessage(env, msg);
  return handleClientMessage(env, msg);
}

/* ---------- роль 2: уведомлятор заявок с сайта ---------- */

function formatLead(d) {
  const lines = ['🌸 <b>Новая заявка с сайта</b>', ''];
  lines.push(`👤 ${esc(clip(d.name, 80)) || '—'}`);
  lines.push(`📞 ${esc(clip(d.phone, 40)) || '—'}`);

  const items = Array.isArray(d.items) ? d.items.slice(0, 30) : [];
  if (items.length) {
    lines.push('', '<b>Заказ</b>');
    for (const it of items) {
      const q = Math.max(1, Math.min(99, parseInt(it.q, 10) || 1));
      const p = Math.max(0, Number(it.p) || 0);
      lines.push(`• ${esc(clip(it.name, 120))} × ${q} — ${rub(p * q)}`);
    }
    const total = Number(d.total) || items.reduce((a, it) => a + (Number(it.p) || 0) * (parseInt(it.q, 10) || 1), 0);
    lines.push(`<b>Итого: ${rub(total)}</b>`);
  }

  const dl = d.delivery || {};
  if (dl.address || dl.date || dl.slot) {
    lines.push('', '<b>Доставка</b>');
    if (dl.address) lines.push(`📍 ${esc(clip(dl.address, 200))}`);
    if (dl.date || dl.slot) lines.push(`🗓 ${esc(clip(dl.date, 20))} ${esc(clip(dl.slot, 20))}`.trim());
    if (dl.recipient) lines.push(`🎁 Кому: ${esc(clip(dl.recipient, 40))}`);
  }
  if (d.card) lines.push('', `💌 Открытка: «${esc(clip(d.card, 500))}»`);
  if (d.comment) lines.push('', `📝 ${esc(clip(d.comment, 1000))}`);
  lines.push('', `<i>${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК</i>`);
  return lines.join('\n');
}

function cors(env, request) {
  const origin = request.headers.get('origin') || '';
  // «https://site.github.io/путь/» → «https://site.github.io»: прощаем слеш и путь в настройке
  const allowed = (env.ALLOWED_ORIGIN || '*').split(',').map((s) => s.trim()).filter(Boolean)
    .map((s) => (s === '*' ? s : s.replace(/^(https?:\/\/[^/]+).*$/i, '$1').toLowerCase()));
  if (!allowed.length) allowed.push('*');
  const ok = allowed.includes('*') || allowed.includes(origin.toLowerCase());
  return {
    'access-control-allow-origin': ok ? (allowed.includes('*') ? '*' : origin) : 'null',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
}

const json = (obj, status, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

async function handleLead(request, env) {
  const h = cors(env, request);
  if (h['access-control-allow-origin'] === 'null') {
    console.log('lead rejected: origin', request.headers.get('origin'), 'allowed', env.ALLOWED_ORIGIN);
    // отвечаем с разрешающим заголовком, чтобы сайт смог показать причину
    return json({ ok: false, error: 'origin' }, 403, { ...h, 'access-control-allow-origin': request.headers.get('origin') || '*' });
  }

  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: 'bad json' }, 400, h); }
  if (d.website) return json({ ok: true }, 200, h); // ловушка для ботов: скрытое поле заполнено
  if (!clip(d.phone, 40) || clip(d.phone, 40).replace(/\D/g, '').length < 6) {
    return json({ ok: false, error: 'Укажите телефон' }, 422, h);
  }
  if (!env.ADMIN_CHAT_ID) return json({ ok: false, error: 'admin_chat_id' }, 500, h);
  const r = await send(env, env.ADMIN_CHAT_ID, formatLead(d));
  return r?.ok ? json({ ok: true }, 200, h) : json({ ok: false, error: 'telegram: ' + (r?.description || 'нет ответа') }, 502, h);
}

/* ---------- маршрутизация ---------- */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if ((url.pathname === '/webhook' || url.pathname === '/telegram') && request.method === 'POST') {
      if (request.headers.get('x-telegram-bot-api-secret-token') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      const update = await request.json().catch(() => null);
      if (update) ctx.waitUntil(handleUpdate(env, update).catch((e) => console.log('update error', e?.stack || e)));
      return new Response('ok');
    }

    if (url.pathname === '/lead') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, request) });
      if (request.method === 'POST') return handleLead(request, env);
    }

    if (url.pathname === '/setup') {
      if (!env.WEBHOOK_SECRET || url.searchParams.get('key') !== env.WEBHOOK_SECRET) {
        return new Response('Нужен параметр ?key=WEBHOOK_SECRET', { status: 403 });
      }
      const hook = await tg(env, 'setWebhook', {
        url: `${url.origin}/webhook`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      });
      const cmds = await tg(env, 'setMyCommands', {
        commands: [
          { command: 'start', description: 'Приветствие и меню' },
          { command: 'order', description: 'Оформить заказ' },
          { command: 'menu', description: 'Показать меню' },
        ],
      });
      const me = await tg(env, 'getMe', {});
      return json({ webhook: hook, commands: cmds, bot: me.result?.username, admin_chat_id: env.ADMIN_CHAT_ID || 'не задан — напишите боту /id' }, 200);
    }

    if (url.pathname === '/test-lead') {
      // проверка роли 2 без сайта: /test-lead?key=WEBHOOK_SECRET присылает флористу тестовую заявку
      if (!env.WEBHOOK_SECRET || url.searchParams.get('key') !== env.WEBHOOK_SECRET) {
        return new Response('Нужен параметр ?key=WEBHOOK_SECRET', { status: 403 });
      }
      if (!env.ADMIN_CHAT_ID) return json({ ok: false, error: 'ADMIN_CHAT_ID не задан' }, 500);
      const r = await send(env, env.ADMIN_CHAT_ID, formatLead({
        name: 'Тестовая заявка', phone: '+7 000 000-00-00',
        items: [{ name: 'Проверка связи сайта и бота', q: 1, p: 0 }],
      }));
      return json({ ok: !!r?.ok, telegram: r?.ok ? 'отправлено' : (r?.description || 'нет ответа'), admin_chat_id: env.ADMIN_CHAT_ID }, r?.ok ? 200 : 502);
    }

    if (url.pathname === '/status') {
      // проверка без секретов: задан ли токен, куда смотрит вебхук, задан ли получатель заявок
      const info = tokenOf(env) ? await tg(env, 'getWebhookInfo', {}) : null;
      const me = tokenOf(env) ? await tg(env, 'getMe', {}) : null;
      return json({
        token: tokenOf(env) ? 'задан' : 'НЕ ЗАДАН',
        bot: me?.result?.username || null,
        webhook_url: info?.result?.url || 'не подключён',
        webhook_points_here: info?.result?.url === `${url.origin}/webhook`,
        pending_updates: info?.result?.pending_update_count ?? null,
        last_error: info?.result?.last_error_message || null,
        admin_chat_id: env.ADMIN_CHAT_ID ? 'задан' : 'НЕ ЗАДАН',
        webhook_secret: env.WEBHOOK_SECRET ? 'задан' : 'НЕ ЗАДАН',
        allowed_origin: env.ALLOWED_ORIGIN || '* (любой сайт)',
        version: 'salon-de-fleur-4',
      }, 200);
    }

    return new Response(`${SHOP.name} — ${SHOP.sub}: бот работает`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};

// для тестов
export { formatLead, section, handleUpdate };
