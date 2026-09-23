// Cloudflare Pages Advanced Mode Worker
// Topos Native Pocket Harmonica Interview Engine at the Cloudflare Edge

const DEFAULT_TOPIC_SESSIONS = {
  nuclear4: [
    {
      sessionId: '6o0ryapw2o',
      title: '核電重啟公眾訪談',
      goal: '測試與收集核電重啟之條件、顧慮與多元考量。',
      url: '/s/6o0ryapw2o',
      isDefault: true,
      createdAt: 1790167501,
    },
  ],
  'control-yuan': [
    {
      sessionId: 'cy-voices-01',
      title: '監察與考試權公眾訪談',
      goal: '理解民眾對監察權、考試權存廢的經驗、擔憂與期待。',
      url: '/s/cy-voices-01',
      isDefault: true,
      createdAt: 1790170000,
    },
  ],
  'sports-station': [
    {
      sessionId: 'sports-int-1',
      title: '運動驛站公眾訪談',
      goal: '探討公眾對捷運站盥洗寄物設施之需求、衛生管理與預算自償考量。',
      url: '/s/sports-int-1',
      isDefault: true,
      createdAt: 1790167501,
    },
  ],
};

const MEMORY_SESSIONS = new Map([
  [
    '6o0ryapw2o',
    {
      sessionId: '6o0ryapw2o',
      topic: '核電重啟公眾訪談',
      goal: '測試與收集核電重啟之條件、顧慮與多元考量。',
      context: '探討台灣能源轉型與核四重啟之關鍵爭點與各方考量。',
      questions: [
        '對於核電重啟，你的基本立場是什麼？最在意的是哪一點？',
        '如果真的要重啟，你認為必須先滿足哪些條件？',
        '核廢料該怎麼處理，你心中有能接受的做法嗎？',
      ],
      language: 'zh-Hant',
      status: 'open',
      maxTurns: 6,
      maxParticipants: 50,
      askAlias: true,
      participants: 2,
      completed: 1,
      model: '@cf/google/gemma-4-26b-a4b-it',
      adminToken: 'admin-nuclear4-topos',
    },
  ],
  [
    'sports-int-1',
    {
      sessionId: 'sports-int-1',
      topic: '捷運與登山口廣設運動驛站',
      goal: '探討公眾對捷運站盥洗寄物設施之需求、衛生管理與預算自償考量',
      context: '台北市長選舉市政政見討論，平衡運動友善與公共治安。',
      questions: [
        '您平日在捷運站或登山口有淋浴更衣的需求嗎？',
        '您認為此類設施應由公帑全額負擔，或採使用者付費？',
        '如何兼顧公共衛生、隱私防偷拍與深夜維安？',
      ],
      language: 'zh-Hant',
      status: 'open',
      maxTurns: 6,
      maxParticipants: 50,
      askAlias: true,
      participants: 0,
      completed: 0,
      model: '@cf/google/gemma-4-26b-a4b-it',
      adminToken: 'admin-sports-topos',
    },
  ],
]);

// In-memory conversation tracks
const MEMORY_CONVERSATIONS = new Map(); // sessionId -> Conversation[]

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Admin-Token',
  };
}

function openingMessage(topic, goal, questions, language) {
  const first = questions && questions.length > 0 ? questions[0] : '';
  if (language === 'en') {
    return `Thanks for joining this conversation about "${topic}". ${goal} I'll ask a few questions and follow up on what you say; there are no right answers, and you can stop at any time. To start: ${first}`;
  }
  return `謝謝你參加這輪關於「${topic}」的對話。${goal}我會問幾個問題，並依你說的內容追問；沒有標準答案，隨時可以停。先從這個開始：${first}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      return new Response(null, {
        status: 204,
        headers: {
          ...getCorsHeaders(),
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 2. /api/topics/:id/harmonica/sessions
    const topicSessionsMatch = url.pathname.match(/^\/api\/topics\/([^/]+)\/harmonica\/sessions\/?$/);
    if (topicSessionsMatch) {
      const topicId = topicSessionsMatch[1];
      if (request.method === 'GET') {
        const sessions = DEFAULT_TOPIC_SESSIONS[topicId] || [];
        return new Response(JSON.stringify(sessions), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
        });
      }
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          if (body && body.sessionId) {
            if (!DEFAULT_TOPIC_SESSIONS[topicId]) DEFAULT_TOPIC_SESSIONS[topicId] = [];
            DEFAULT_TOPIC_SESSIONS[topicId].unshift(body);
          }
          return new Response(JSON.stringify({ ok: true, topicId }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
          });
        } catch (_) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
          });
        }
      }
    }

    // 3. /api/harmonica/sessions (Create Session)
    if (url.pathname === '/api/harmonica/sessions' && request.method === 'POST') {
      try {
        const payload = await request.json();
        const sessionId = Math.random().toString(36).substring(2, 12);
        const adminToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        const newSession = {
          sessionId,
          topic: payload.topic || '公眾審議訪談',
          goal: payload.goal || '收集多元觀點',
          context: payload.context || '',
          questions: payload.questions || ['請分享您的看法？'],
          language: payload.language || 'zh-Hant',
          status: 'open',
          maxTurns: payload.maxTurns || 6,
          maxParticipants: payload.maxParticipants || 50,
          askAlias: payload.askAlias !== false,
          participants: 0,
          completed: 0,
          model: '@cf/google/gemma-4-26b-a4b-it',
          adminToken,
        };

        MEMORY_SESSIONS.set(sessionId, newSession);
        MEMORY_CONVERSATIONS.set(sessionId, []);

        const topicId = url.searchParams.get('topicId') || payload.topicId;
        if (topicId) {
          if (!DEFAULT_TOPIC_SESSIONS[topicId]) DEFAULT_TOPIC_SESSIONS[topicId] = [];
          DEFAULT_TOPIC_SESSIONS[topicId].unshift({
            sessionId,
            title: newSession.topic,
            goal: newSession.goal,
            url: `/s/${sessionId}`,
            createdAt: Math.floor(Date.now() / 1000),
          });
        }

        return new Response(
          JSON.stringify({
            ok: true,
            sessionId,
            topic: newSession.topic,
            adminToken,
            urls: {
              participate: `/s/${sessionId}`,
              host: `/h/${sessionId}#admin=${adminToken}`,
            },
            session: newSession,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json', ...getCorsHeaders() } }
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
        });
      }
    }

    // 4. /api/harmonica/sessions/:id (Get Session)
    const sessionDetailMatch = url.pathname.match(/^\/api\/harmonica\/sessions\/([a-z0-9-]+)\/?$/);
    if (sessionDetailMatch && request.method === 'GET') {
      const sessionId = sessionDetailMatch[1];
      const session = MEMORY_SESSIONS.get(sessionId);
      if (!session) {
        return new Response(JSON.stringify({ error: 'session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
        });
      }
      return new Response(JSON.stringify(session), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
      });
    }

    // 5. /api/harmonica/sessions/:id/host (Host Dashboard View)
    const hostMatch = url.pathname.match(/^\/api\/harmonica\/sessions\/([a-z0-9-]+)\/host\/?$/);
    if (hostMatch && request.method === 'GET') {
      const sessionId = hostMatch[1];
      const session = MEMORY_SESSIONS.get(sessionId);
      if (!session) {
        return new Response(JSON.stringify({ error: 'session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
        });
      }

      const convs = MEMORY_CONVERSATIONS.get(sessionId) || [];
      const summaries = convs.map((c) => ({
        participant: c.participant,
        alias: c.alias,
        turns: c.turns,
        done: c.done,
        messages: c.messages.length,
        updatedAt: c.updatedAt,
        lastMessage: c.messages.length > 0 ? c.messages[c.messages.length - 1].text : '',
      }));

      return new Response(
        JSON.stringify({
          ...session,
          conversations: convs,
          summaries,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
        }
      );
    }

    // 6. /api/harmonica/sessions/:id/join (Join Interview)
    const joinMatch = url.pathname.match(/^\/api\/harmonica\/sessions\/([a-z0-9-]+)\/join\/?$/);
    if (joinMatch && request.method === 'POST') {
      const sessionId = joinMatch[1];
      const session = MEMORY_SESSIONS.get(sessionId);
      if (!session) {
        return new Response(JSON.stringify({ error: 'session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
        });
      }

      try {
        const body = await request.json();
        const alias = (body.alias || '').trim();
        const convs = MEMORY_CONVERSATIONS.get(sessionId) || [];

        const openText = openingMessage(session.topic, session.goal, session.questions, session.language);
        const newConv = {
          participant: convs.length + 1,
          alias,
          turns: 0,
          done: false,
          messages: [
            {
              seq: 1,
              role: 'interviewer',
              text: openText,
              at: Date.now(),
            },
          ],
          updatedAt: Date.now(),
        };

        convs.push(newConv);
        MEMORY_CONVERSATIONS.set(sessionId, convs);
        session.participants = convs.length;

        return new Response(
          JSON.stringify({
            ok: true,
            conversation: newConv,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders() } }
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
        });
      }
    }

    // 7. /api/harmonica/sessions/:id/messages (Send Dialogue Turn)
    const msgMatch = url.pathname.match(/^\/api\/harmonica\/sessions\/([a-z0-9-]+)\/messages\/?$/);
    if (msgMatch && request.method === 'POST') {
      const sessionId = msgMatch[1];
      const session = MEMORY_SESSIONS.get(sessionId);
      if (!session) {
        return new Response(JSON.stringify({ error: 'session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
        });
      }

      try {
        const body = await request.json();
        const text = (body.text || '').trim();
        if (!text) {
          return new Response(JSON.stringify({ error: 'text cannot be empty' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
          });
        }

        let convs = MEMORY_CONVERSATIONS.get(sessionId) || [];
        let conv = convs.length > 0 ? convs[convs.length - 1] : null;
        if (!conv) {
          conv = {
            participant: 1,
            alias: '',
            turns: typeof body.turn === 'number' ? body.turn - 1 : 0,
            done: false,
            messages: Array.isArray(body.history) ? body.history : [],
            updatedAt: Date.now(),
          };
          convs.push(conv);
          MEMORY_CONVERSATIONS.set(sessionId, convs);
        }

        // Add participant message
        const pMsg = {
          seq: conv.messages.length + 1,
          role: 'participant',
          text,
          at: Date.now(),
        };
        conv.messages.push(pMsg);
        conv.turns++;

        const isFinal = conv.turns >= session.maxTurns;
        conv.done = isFinal;

        let replyText = '';
        // If Workers AI is bound, call @cf/google/gemma-4-26b-a4b-it
        if (env && env.AI) {
          try {
            const systemPrompt = `你是一位客觀、中立、同理心強的公眾政策審議訪談員，正在進行「${session.topic}」的一對一訪談。
訪談核心目標：${session.goal}
訪談準則：
1. 嚴格保持中立：不評判對錯、不試圖說服對方、不表達任何政策偏好。
2. 同理與摘要：先用一句話真誠反映並摘要受訪者剛才提及的感受、顧慮或核心論點。
3. 具體深化追問：順著受訪者的話，提出「一個」開放式問題，探究其背後的切身經驗、前提條件、價值排序或關鍵顧慮。
4. 全程使用流暢自然的繁體中文，字數限制在 60~90 字之間。直接輸出回覆文字，不可夾帶思考標籤或角色前綴。`;

            const historyMsgs = [{ role: 'system', content: systemPrompt }];
            // Include recent dialogue history for rich context
            const recent = conv.messages.slice(-6);
            for (const m of recent) {
              if (m.text && m.text.trim()) {
                historyMsgs.push({
                  role: m.role === 'interviewer' ? 'assistant' : 'user',
                  content: m.text,
                });
              }
            }

            if (isFinal) {
              historyMsgs.push({
                role: 'user',
                content: '（最後一輪）：請誠摯感謝受訪者花時間把想法說得這麼清楚，總結肯定其寶貴貢獻，圓滿結尾，不要再提出新問題。',
              });
            }

            const aiRes = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
              messages: historyMsgs,
              max_tokens: 300,
              temperature: 0.5,
            });
            replyText = aiRes?.response || '';
          } catch (e) {
            console.error('Workers AI invocation error:', e);
          }
        }

        // Intelligent deliberative fallback if Workers AI is offline
        if (!replyText) {
          if (isFinal) {
            replyText = '謝謝你花時間把想法說清楚。這些內容會被整理成逐字稿，納入審議分析。如果還有想補充的，隨時可以再開一輪。';
          } else {
            const snip = text.replace(/\s+/g, ' ').trim().slice(0, 18) + (text.length > 18 ? '…' : '');
            const probes = [
              '如果要讓你改變想法或完全放心，你覺得需要看到什麼具體的科學數據或制度保證？',
              '這項議題對你身邊的人——家人、工作或社區，最直接的影響會是什麼？',
              '在「供電穩定」、「安全風險」與「環境永續」之間，你心目中的優先順序是什麼？',
              '有沒有哪種說法是你常聽過，但始終無法接受或抱持懷疑的？為什麼？',
            ];

            if (conv.turns % 2 === 1) {
              replyText = `你提到「${snip}」——可以多說一點嗎？是什麼經驗或資訊讓你這樣想？`;
            } else {
              const qi = Math.floor(conv.turns / 2);
              if (session.questions && session.questions[qi]) {
                replyText = `了解，謝謝你的分享。換個角度想：${session.questions[qi]}`;
              } else {
                replyText = probes[Math.floor(conv.turns / 2) % probes.length] || probes[0];
              }
            }
          }
        }

        const replyMsg = {
          seq: conv.messages.length + 1,
          role: 'interviewer',
          text: replyText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim(),
          at: Date.now(),
        };

        conv.messages.push(replyMsg);
        conv.updatedAt = Date.now();

        if (isFinal) {
          session.completed = (session.completed || 0) + 1;
        }

        return new Response(
          JSON.stringify({
            ok: true,
            reply: replyMsg,
            turn: conv.turns,
            done: isFinal,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders() } }
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
        });
      }
    }

    // 8. /api/harmonica/sessions/:id/export/tttc.csv (Talk to the City CSV Export)
    const csvMatch = url.pathname.match(/^\/api\/harmonica\/sessions\/([a-z0-9-]+)\/export\/tttc\.csv\/?$/);
    if (csvMatch && request.method === 'GET') {
      const sessionId = csvMatch[1];
      const session = MEMORY_SESSIONS.get(sessionId) || { topic: 'Topos' };
      const convs = MEMORY_CONVERSATIONS.get(sessionId) || [];

      const lines = ['id,interview,comment'];
      let id = 1;
      for (const c of convs) {
        const interview = `"${session.topic} (${c.alias || 'Participant_' + c.participant})"`;
        for (const m of c.messages) {
          if (m.role === 'participant') {
            lines.push(`${id},${interview},"${m.text.replace(/"/g, '""')}"`);
            id++;
          }
        }
      }

      return new Response(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="topos-harmonica-${sessionId}-tttc.csv"`,
          ...getCorsHeaders(),
        },
      });
    }

    // 9. /api/harmonica/sessions/:id/export/transcripts.json (Transcripts JSON Export)
    const jsonMatch = url.pathname.match(/^\/api\/harmonica\/sessions\/([a-z0-9-]+)\/export\/transcripts\.json\/?$/);
    if (jsonMatch && request.method === 'GET') {
      const sessionId = jsonMatch[1];
      const session = MEMORY_SESSIONS.get(sessionId);
      const convs = MEMORY_CONVERSATIONS.get(sessionId) || [];

      return new Response(
        JSON.stringify(
          {
            session: session || { sessionId },
            exportedAt: Date.now(),
            conversations: convs,
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="topos-harmonica-${sessionId}-transcripts.json"`,
            ...getCorsHeaders(),
          },
        }
      );
    }

    // Fallback: serve static assets
    return env.ASSETS.fetch(request);
  },
};
