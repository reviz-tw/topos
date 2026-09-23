// Cloudflare Pages Advanced Mode Worker
// Topos Native Pocket Harmonica Interview Engine at the Cloudflare Edge

const DEFAULT_TOPIC_SESSIONS = {
  nuclear4: [
    {
      sessionId: '6o0ryapw2o',
      title: '核電重啟公眾訪談',
      goal: '測試與收集核電重啟之條件、顧慮與多元考量',
      url: '/s/6o0ryapw2o',
      isDefault: true,
      createdAt: 1790167501,
    },
  ],
  'sports-station': [
    {
      sessionId: 'sports-int-1',
      title: '運動驛站公眾訪談',
      goal: '探討公眾對捷運站盥洗寄物設施之需求、衛生管理與預算自償考量',
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
      topic: '核電重啟',
      goal: '測試與收集核電重啟之條件、顧慮與多元考量',
      context: '探討台灣能源轉型與核四重啟之關鍵爭點與各方考量。',
      questions: ['支持嗎', '要錢嗎', '其他原因'],
      language: 'zh-Hant',
      status: 'open',
      maxTurns: 6,
      maxParticipants: 50,
      askAlias: true,
      participants: 1,
      completed: 0,
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

        const convs = MEMORY_CONVERSATIONS.get(sessionId) || [];
        const conv = convs.length > 0 ? convs[convs.length - 1] : null;
        if (!conv) {
          return new Response(JSON.stringify({ error: 'conversation not joined' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
          });
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
            const aiRes = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
              messages: [
                {
                  role: 'system',
                  content: `You are a warm, neutral interviewer for a public consultation on "${session.topic}". Reflect briefly what you heard, then ask exactly one follow-up question. Never argue, evaluate or persuade. Keep under 90 words. Reply with plain text.`,
                },
                {
                  role: 'user',
                  content: isFinal
                    ? `Turn ${conv.turns} of ${session.maxTurns}. FINAL TURN: thank the participant, reflect the most important thing they said, and close without asking anything. Participant said: ${text}`
                    : `Turn ${conv.turns} of ${session.maxTurns}. Participant said: ${text}`,
                },
              ],
              max_tokens: 384,
              temperature: 0.4,
              chat_template_kwargs: { enable_thinking: false },
            });
            replyText = aiRes?.response || '';
          } catch (_) {}
        }

        if (!replyText) {
          if (isFinal) {
            replyText = '非常感謝您撥冗分享寶貴的想法。您的多元觀點已被客觀記錄，將作為公共審議與政策評估的重要參考。訪談在此圓滿結束！';
          } else if (conv.turns - 1 < session.questions.length) {
            replyText = `謝謝您的具體說明。延續剛才的話題，想請教您：${session.questions[conv.turns - 1]}`;
          } else {
            replyText = '理解您的考量。在剛才提到的內容中，您認為最重要的優先順序或關鍵配套會是什麼？';
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
