import { SupportedLanguage } from '../utils/cookie';
import { Crux } from '../types';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const LANGUAGE_LIST: LanguageInfo[] = [
  { code: 'zh-TW', name: 'Traditional Chinese', nativeName: '繁體中文', flag: '🇹🇼' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
];

export interface TranslationStrings {
  appTitle: string;
  deskBadge: string;
  subtitle: string;
  guestButton: string;
  guestUserName: string;
  logout: string;
  googleLoginNotConfigured: string;
  googleLoginAlert: string;
  pickTopicHeading: string;
  cruxCount: (count: number) => string;
  keyCruxesHeading: string;
  proLabel: string;
  conLabel: string;
  facilitatorTitle: string;
  facilitatorSubtitle: string;
  guestQuotaLabel: (rem: number) => string;
  memberQuotaLabel: (rem: number) => string;
  reviewingBanner: (date: string) => string;
  backToCurrentDialogue: string;
  emptyChatPrompt: string;
  sampleQuestions: string[];
  userLabel: string;
  facilitatorLabel: string;
  citationSource: string;
  loadingMessage: string;
  inputPlaceholderNormal: string;
  inputPlaceholderReviewing: string;
  inputPlaceholderExhausted: string;
  sendButton: string;
  archiveButton: string;
  guestNotice: string;
  historyHeading: string;
  historyEmpty: string;
  defaultSessionTitle: string;
  languageSelectAria: string;
}

export const TRANSLATIONS: Record<SupportedLanguage, TranslationStrings> = {
  'zh-TW': {
    appTitle: 'Topos (τόπος) - 公共議題審議與觀點探索平台',
    deskBadge: '審議 DESK',
    subtitle: 'OPEN DELIBERATION · 公共審議平台',
    guestButton: '訪客身份，直接開始 →',
    guestUserName: '訪客體驗者',
    logout: '登出',
    googleLoginNotConfigured: 'Google 登入（尚未設定 Client ID）',
    googleLoginAlert:
      '【Google 登入設定指引】\n\n目前後端尚未配置 GOOGLE_CLIENT_ID。\n\n請在 GCP Console (專案 elix-498805) 建立 OAuth 2.0 用戶端 ID（類型：網頁應用程式），並將 https://topos-d10.pages.dev 加入「已授權的 JavaScript 來源」，再設定於 Cloud Run 環境變數即可啟用！\n\n現在可直接點擊左側「訪客身份，直接開始 →」立即體驗完整審議功能。',
    pickTopicHeading: 'PICK A TOPIC · 選擇議題',
    cruxCount: (count) => `§ ${count} 個核心爭點`,
    keyCruxesHeading: '核心爭議關鍵點 · KEY CRUXES',
    proLabel: '✓ 正方 PRO',
    conLabel: '✕ 反方 CON',
    facilitatorTitle: '審議引導對話',
    facilitatorSubtitle: 'Topos Facilitator · AI 逐字稿推理引擎',
    guestQuotaLabel: (rem) => `訪客額度 · 本小時剩餘 ${rem} / 5 次`,
    memberQuotaLabel: (rem) => `會員額度 · 本小時剩餘 ${rem} / 30 次`,
    reviewingBanner: (date) => `正在回顧 ${date} 的討論`,
    backToCurrentDialogue: '返回目前對話 →',
    emptyChatPrompt: '你可以直接丟問題，不用先想好要怎麼問，例如：',
    sampleQuestions: [
      '「台灣的地震帶地質，會為核電廠帶來大災害的可能性嗎？」',
      '「如果重啟核四，核廢料目前各國都是怎麼處理的？」',
    ],
    userLabel: '你',
    facilitatorLabel: '審議引導助手 (Topos Facilitator)',
    citationSource: '📌 引用根據：',
    loadingMessage: '審議引導助手正在檢索 2021 公投逐字稿論點並進行中立推理…',
    inputPlaceholderNormal: '輸入你的問題或觀點，按送出…',
    inputPlaceholderReviewing: '正在回顧歷史紀錄，返回目前對話後可繼續提問',
    inputPlaceholderExhausted: '訪客 5 次額度已用畢，請點擊右上角「Google 登入」解鎖 30 次額度！',
    sendButton: '送出 →',
    archiveButton: '封存本次討論，開新提問 ↻',
    guestNotice: '送出問題會自動以訪客身份加入 · guest@topos.local',
    historyHeading: '歷史對話紀錄 · HISTORY',
    historyEmpty: '目前議題還沒有封存的討論。送出幾個問題後，可以按「封存本次討論」把這輪對話留存下來。',
    defaultSessionTitle: '審議對話',
    languageSelectAria: '切換介面語言',
  },

  en: {
    appTitle: 'Topos (τόπος) - Public Deliberation & Perspective Exploration Platform',
    deskBadge: 'DELIBERATION DESK',
    subtitle: 'OPEN DELIBERATION · PUBLIC POLICY PLATFORM',
    guestButton: 'Start as Guest →',
    guestUserName: 'Guest Explorer',
    logout: 'Log out',
    googleLoginNotConfigured: 'Sign in with Google (Client ID unconfigured)',
    googleLoginAlert:
      '[Google Sign-in Setup Guide]\n\nGOOGLE_CLIENT_ID is not currently configured in the backend.\n\nPlease create an OAuth 2.0 Client ID in GCP Console, add https://topos-d10.pages.dev to Authorized JavaScript Origins, and set it in Cloud Run environment variables.\n\nYou can click "Start as Guest →" to experience all features right now!',
    pickTopicHeading: 'PICK A TOPIC',
    cruxCount: (count) => `§ ${count} Key Cruxes`,
    keyCruxesHeading: 'CRITICAL POINTS OF DISAGREEMENT · KEY CRUXES',
    proLabel: '✓ PRO Arguments',
    conLabel: '✕ CON Arguments',
    facilitatorTitle: 'Deliberative Dialogue',
    facilitatorSubtitle: 'Topos Facilitator · AI Transcript Reasoning Engine',
    guestQuotaLabel: (rem) => `Guest Quota · ${rem} / 5 left this hour`,
    memberQuotaLabel: (rem) => `Member Quota · ${rem} / 30 left this hour`,
    reviewingBanner: (date) => `Reviewing discussion from ${date}`,
    backToCurrentDialogue: 'Return to live discussion →',
    emptyChatPrompt: 'Feel free to ask questions or share thoughts directly, for example:',
    sampleQuestions: [
      '"Does Taiwan\'s active seismic geology pose a high catastrophe risk for nuclear plants?"',
      '"If Nuclear Plant 4 is restarted, how do other countries handle nuclear waste storage?"',
    ],
    userLabel: 'You',
    facilitatorLabel: 'Topos Deliberative Facilitator',
    citationSource: '📌 Grounded Reference: ',
    loadingMessage: 'Topos Facilitator is retrieving debate transcripts and synthesizing balanced arguments…',
    inputPlaceholderNormal: 'Type your question or viewpoint, press Send…',
    inputPlaceholderReviewing: 'Reviewing archived history. Return to live discussion to ask questions.',
    inputPlaceholderExhausted: 'Guest limit of 5 queries reached. Sign in with Google to unlock 30 queries!',
    sendButton: 'Send →',
    archiveButton: 'Archive current session & start new ↻',
    guestNotice: 'Sending queries will automatically connect as guest · guest@topos.local',
    historyHeading: 'DISCUSSION ARCHIVES · HISTORY',
    historyEmpty: 'No archived discussions yet for this topic. Click "Archive current session" after asking questions to save.',
    defaultSessionTitle: 'Deliberation Chat',
    languageSelectAria: 'Select language',
  },

  ja: {
    appTitle: 'Topos (τόπος) - 公共政策審議と視点探求プラットフォーム',
    deskBadge: '審議 DESK',
    subtitle: 'OPEN DELIBERATION · 公共政策審議プラットフォーム',
    guestButton: 'ゲストとして開始 →',
    guestUserName: 'ゲスト参加者',
    logout: 'ログアウト',
    googleLoginNotConfigured: 'Googleログイン（Client ID未設定）',
    googleLoginAlert:
      '【Googleログイン設定案内】\n\n現在バックエンドで GOOGLE_CLIENT_ID が未設定です。\n\nGCP Console で OAuth 2.0 クライアント ID を作成し、環境変数に設定すると有効化されます。\n\n左側の「ゲストとして開始 →」からすぐに全ての機能をお試しいただけます。',
    pickTopicHeading: 'PICK A TOPIC · 議題を選択',
    cruxCount: (count) => `§ ${count} つの重要争点`,
    keyCruxesHeading: '核心的な対立点 · KEY CRUXES',
    proLabel: '✓ 賛成 PRO',
    conLabel: '✕ 反対 CON',
    facilitatorTitle: '審議ガイダンス対話',
    facilitatorSubtitle: 'Topos Facilitator · AI 逐字録推論エンジン',
    guestQuotaLabel: (rem) => `ゲスト枠 · 今時残り ${rem} / 5 回`,
    memberQuotaLabel: (rem) => `会員枠 · 今時残り ${rem} / 30 回`,
    reviewingBanner: (date) => `${date} の対話を閲覧中`,
    backToCurrentDialogue: '現在の対話に戻る →',
    emptyChatPrompt: '形式を気にせず、自由に疑問を投げかけてみてください。例えば：',
    sampleQuestions: [
      '「台湾の地震帯地質は、原発に壊滅的なリスクをもたらす可能性がありますか？」',
      '「第4原発を再稼働した場合、他国では核廃棄物をどのように最終処分していますか？」',
    ],
    userLabel: 'あなた',
    facilitatorLabel: '審議アシスタント (Topos Facilitator)',
    citationSource: '📌 引用根拠：',
    loadingMessage: '審議アシスタントが公聴会や討論会の逐字録を検索し、中立的な論点を推論中…',
    inputPlaceholderNormal: '質問や観点を入力して送信…',
    inputPlaceholderReviewing: '履歴を閲覧中です。現在の対話に戻ると質問できます',
    inputPlaceholderExhausted: 'ゲストの5回枠を使い切りました。右上のGoogleログインで30回まで解除できます！',
    sendButton: '送信 →',
    archiveButton: '今回の対話を保存して新規開始 ↻',
    guestNotice: '送信すると自動的にゲストとして参加します · guest@topos.local',
    historyHeading: '対話履歴 · HISTORY',
    historyEmpty: 'この議題のアーカイブはまだありません。質問後に「今回の対話を保存」で記録を残せます。',
    defaultSessionTitle: '審議対話',
    languageSelectAria: 'インターフェース言語を切り替え',
  },

  ko: {
    appTitle: 'Topos (τόπος) - 공공 의제 심의 및 다각적 관점 탐색 플랫폼',
    deskBadge: '심의 DESK',
    subtitle: 'OPEN DELIBERATION · 공공 심의 플랫폼',
    guestButton: '게스트로 바로 시작 →',
    guestUserName: '게스트 체험자',
    logout: '로그아웃',
    googleLoginNotConfigured: 'Google 로그인 (Client ID 미설정)',
    googleLoginAlert:
      '[Google 로그인 설정 안내]\n\n현재 백엔드에 GOOGLE_CLIENT_ID가 설정되어 있지 않습니다.\n\nGCP Console에서 OAuth 2.0 클라이언트 ID를 생성하여 Cloud Run 환경 변수에 설정하면 활성화됩니다.\n\n지금 바로 왼쪽의 "게스트로 바로 시작 →"을 클릭하여 모든 기능을 체험하실 수 있습니다.',
    pickTopicHeading: 'PICK A TOPIC · 의제 선택',
    cruxCount: (count) => `§ ${count}개 핵심 쟁점`,
    keyCruxesHeading: '핵심 쟁점 대립각 · KEY CRUXES',
    proLabel: '✓ 찬성 PRO',
    conLabel: '✕ 반대 CON',
    facilitatorTitle: '심의 안내 대화',
    facilitatorSubtitle: 'Topos Facilitator · AI 공청회 추론 엔진',
    guestQuotaLabel: (rem) => `게스트 한도 · 이번 시간 ${rem} / 5회 남음`,
    memberQuotaLabel: (rem) => `회원 한도 · 이번 시간 ${rem} / 30회 남음`,
    reviewingBanner: (date) => `${date}의 토론 기록 검토 중`,
    backToCurrentDialogue: '현재 대화로 돌아가기 →',
    emptyChatPrompt: '생각나는 질문이나 의견을 편하게 던져보세요. 예시:',
    sampleQuestions: [
      '"대만의 지진 단층 구조가 원자력 발전소에 치명적인 재해 위험을 초래할 수 있나요?"',
      '"제4원전을 재가동할 경우, 다른 국가들은 고준위 방사성 폐기물을 어떻게 처분하고 있나요?"',
    ],
    userLabel: '나',
    facilitatorLabel: '심의 안내 퍼실리테이터 (Topos Facilitator)',
    citationSource: '📌 인용 근거: ',
    loadingMessage: '심의 도우미가 2021 공청회 발언록을 검색하고 중립적 균형 추론을 진행 중입니다…',
    inputPlaceholderNormal: '질문이나 의견을 입력하고 전송을 누르세요…',
    inputPlaceholderReviewing: '과거 기록을 보는 중입니다. 현재 대화로 돌아가면 계속 질문할 수 있습니다.',
    inputPlaceholderExhausted: '게스트 5회 이용권이 소진되었습니다. 우측 상단 Google 로그인으로 30회를 잠금 해제하세요!',
    sendButton: '전송 →',
    archiveButton: '현재 토론 보관하고 새로 시작 ↻',
    guestNotice: '질문 제출 시 게스트 계정(guest@topos.local)으로 자동 참여됩니다',
    historyHeading: '토론 기록 보관소 · HISTORY',
    historyEmpty: '아직 보관된 토론이 없습니다. 몇 가지 질문을 나눈 뒤 "현재 토론 보관"을 눌러 저장해 보세요.',
    defaultSessionTitle: '심의 대화',
    languageSelectAria: '인터페이스 언어 선택',
  },

  fr: {
    appTitle: 'Topos (τόπος) - Plateforme de délibération publique et d’exploration des perspectives',
    deskBadge: 'BUREAU DÉLIBÉRATIF',
    subtitle: 'OPEN DELIBERATION · DÉLIBÉRATION PUBLIQUE',
    guestButton: 'Commencer en invité →',
    guestUserName: 'Participant Invité',
    logout: 'Déconnexion',
    googleLoginNotConfigured: 'Connexion Google (Client ID non configuré)',
    googleLoginAlert:
      '[Guide de configuration Google Sign-in]\n\nGOOGLE_CLIENT_ID n\'est pas encore configuré sur le backend.\n\nVous pouvez cliquer sur "Commencer en invité →" pour explorer immédiatement toutes les fonctionnalités de délibération !',
    pickTopicHeading: 'CHOISIR UN THÈME',
    cruxCount: (count) => `§ ${count} points cruciaux`,
    keyCruxesHeading: 'POINTS CRUCIAUX DE DIVERGENCE · KEY CRUXES',
    proLabel: '✓ Arguments POUR',
    conLabel: '✕ Arguments CONTRE',
    facilitatorTitle: 'Dialogue Délibératif',
    facilitatorSubtitle: 'Topos Facilitator · Moteur de raisonnement basé sur les transcriptions',
    guestQuotaLabel: (rem) => `Quota invité · ${rem} / 5 restants cette heure`,
    memberQuotaLabel: (rem) => `Quota membre · ${rem} / 30 restants cette heure`,
    reviewingBanner: (date) => `Consultation de l'échange du ${date}`,
    backToCurrentDialogue: 'Retour au dialogue en cours →',
    emptyChatPrompt: 'Posez directement vos questions sans formalité préalable, par exemple :',
    sampleQuestions: [
      '« Les failles sismiques de Taïwan posent-elles un risque de catastrophe majeure pour les centrales nucléaires ? »',
      '« Si la centrale nucléaire 4 redémarre, comment les autres pays gèrent-ils les déchets radioactifs ? »',
    ],
    userLabel: 'Vous',
    facilitatorLabel: 'Facilitateur de délibération Topos',
    citationSource: '📌 Source citée : ',
    loadingMessage: 'Le facilitateur recherche dans les procès-verbaux de débat et élabore une synthèse neutre…',
    inputPlaceholderNormal: 'Saisissez votre question ou argument, puis cliquez sur Envoyer…',
    inputPlaceholderReviewing: 'Consultation de l\'historique. Revenez au dialogue en direct pour poser une question.',
    inputPlaceholderExhausted: 'Limite invité de 5 questions atteinte. Connectez-vous avec Google pour débloquer 30 questions !',
    sendButton: 'Envoyer →',
    archiveButton: 'Archiver cette session et recommencer ↻',
    guestNotice: 'L\'envoi de questions utilise le profil invité · guest@topos.local',
    historyHeading: 'HISTORIQUE DES DISCUSSIONS',
    historyEmpty: 'Aucune discussion archivée pour le moment. Cliquez sur « Archiver cette session » pour la sauvegarder.',
    defaultSessionTitle: 'Discussion délibérative',
    languageSelectAria: 'Changer la langue de l\'interface',
  },

  de: {
    appTitle: 'Topos (τόπος) - Plattform für öffentliche Deliberation und Perspektivenvielfalt',
    deskBadge: 'BERATUNGSDESK',
    subtitle: 'OPEN DELIBERATION · ÖFFENTLICHE BERATUNG',
    guestButton: 'Als Gast starten →',
    guestUserName: 'Gast-Teilnehmer',
    logout: 'Abmelden',
    googleLoginNotConfigured: 'Google-Login (Client-ID nicht konfiguriert)',
    googleLoginAlert:
      '[Google Login Anleitung]\n\nGOOGLE_CLIENT_ID ist im Backend noch nicht konfiguriert.\n\nKlicken Sie einfach auf "Als Gast starten →", um alle Funktionen direkt auszuprobieren!',
    pickTopicHeading: 'THEMA WÄHLEN',
    cruxCount: (count) => `§ ${count} Kernstreitpunkte`,
    keyCruxesHeading: 'ZENTRALE STREITPUNKTE · KEY CRUXES',
    proLabel: '✓ PRO Argumente',
    conLabel: '✕ CONTRA Argumente',
    facilitatorTitle: 'Deliberativer Dialog',
    facilitatorSubtitle: 'Topos Facilitator · KI-Protokoll-Argumentationssystem',
    guestQuotaLabel: (rem) => `Gast-Kontingent · noch ${rem} / 5 in dieser Stunde`,
    memberQuotaLabel: (rem) => `Mitglieder-Kontingent · noch ${rem} / 30 in dieser Stunde`,
    reviewingBanner: (date) => `Diskussion vom ${date} wird angezeigt`,
    backToCurrentDialogue: 'Zurück zur aktuellen Diskussion →',
    emptyChatPrompt: 'Stellen Sie Ihre Frage direkt und ungezwungen, zum Beispiel:',
    sampleQuestions: [
      '„Besteht durch die Erdbebenzonen in Taiwan ein hohes Katastrophenrisiko für das Kernkraftwerk?“',
      '„Wie gehen andere Länder mit der Endlagerung von Atommüll um, falls Block 4 reaktiviert wird?“',
    ],
    userLabel: 'Sie',
    facilitatorLabel: 'Topos Deliberations-Assistent',
    citationSource: '📌 Belegstelle: ',
    loadingMessage: 'Der Assistent durchsucht die Anhörungsprotokolle und wägt Argumente neutral ab…',
    inputPlaceholderNormal: 'Geben Sie Ihre Frage oder Meinung ein und klicken Sie auf Senden…',
    inputPlaceholderReviewing: 'Verlauf wird eingesehen. Zurück zur Live-Diskussion, um Fragen zu stellen.',
    inputPlaceholderExhausted: 'Gast-Limit (5 Fragen) erreicht. Melden Sie sich mit Google an, um 30 Fragen freizuschalten!',
    sendButton: 'Senden →',
    archiveButton: 'Sitzung archivieren & neu starten ↻',
    guestNotice: 'Fragen werden automatisch als Gast gestellt · guest@topos.local',
    historyHeading: 'DISKUSSIONSVERLAUF · ARCHIV',
    historyEmpty: 'Noch keine archivierten Diskussionen. Klicken Sie auf „Sitzung archivieren“, um sie zu speichern.',
    defaultSessionTitle: 'Beratungsgespräch',
    languageSelectAria: 'Oberflächensprache auswählen',
  },

  es: {
    appTitle: 'Topos (τόπος) - Plataforma de deliberación pública y exploración de perspectivas',
    deskBadge: 'MESA DELIBERATIVA',
    subtitle: 'OPEN DELIBERATION · PLATAFORMA DE DELIBERACIÓN PÚBLICA',
    guestButton: 'Comenzar como invitado →',
    guestUserName: 'Explorador Invitado',
    logout: 'Cerrar sesión',
    googleLoginNotConfigured: 'Iniciar sesión con Google (Client ID no configurado)',
    googleLoginAlert:
      '[Guía de configuración de Google Sign-in]\n\nGOOGLE_CLIENT_ID aún no está configurado en el backend.\n\n¡Haz clic en "Comenzar como invitado →" para experimentar todas las funciones deliberativas de inmediato!',
    pickTopicHeading: 'SELECCIONA UN TEMA',
    cruxCount: (count) => `§ ${count} puntos clave`,
    keyCruxesHeading: 'PUNTOS CRUCIALES DE DESACUERDO · KEY CRUXES',
    proLabel: '✓ A FAVOR (PRO)',
    conLabel: '✕ EN CONTRA (CON)',
    facilitatorTitle: 'Diálogo Deliberativo',
    facilitatorSubtitle: 'Topos Facilitator · Motor de razonamiento de transcripciones con IA',
    guestQuotaLabel: (rem) => `Cuota de invitado · ${rem} / 5 restantes esta hora`,
    memberQuotaLabel: (rem) => `Cuota de miembro · ${rem} / 30 restantes esta hora`,
    reviewingBanner: (date) => `Revisando discusión del ${date}`,
    backToCurrentDialogue: 'Volver a la discusión en vivo →',
    emptyChatPrompt: 'Puedes hacer preguntas directamente y sin rodeos, por ejemplo:',
    sampleQuestions: [
      '«¿Las fallas sísmicas en Taiwán suponen un alto riesgo de catástrofe para las centrales nucleares?»',
      '«Si se reactiva la central nuclear 4, ¿cómo gestionan otros países los residuos radiactivos?»',
    ],
    userLabel: 'Tú',
    facilitatorLabel: 'Facilitador Deliberativo Topos',
    citationSource: '📌 Fuente citada: ',
    loadingMessage: 'El facilitador consulta las actas de debate y razona argumentos equilibrados…',
    inputPlaceholderNormal: 'Escribe tu pregunta o perspectiva y presiona Enviar…',
    inputPlaceholderReviewing: 'Revisando archivo histórico. Vuelve a la discusión en vivo para formular preguntas.',
    inputPlaceholderExhausted: 'Límite de invitado (5) agotado. ¡Inicia sesión con Google para desbloquear 30 solicitudes!',
    sendButton: 'Enviar →',
    archiveButton: 'Archivar esta sesión y comenzar nueva ↻',
    guestNotice: 'Las preguntas se envían automáticamente como invitado · guest@topos.local',
    historyHeading: 'HISTORIAL DE DEBATES · ARCHIVO',
    historyEmpty: 'Aún no hay discusiones archivadas. Haz preguntas y pulsa «Archivar esta sesión» para guardarlas.',
    defaultSessionTitle: 'Diálogo deliberativo',
    languageSelectAria: 'Cambiar idioma de la interfaz',
  },

  it: {
    appTitle: 'Topos (τόπος) - Piattaforma di deliberazione pubblica ed esplorazione delle prospettive',
    deskBadge: 'TAVOLO DELIBERATIVO',
    subtitle: 'OPEN DELIBERATION · PIATTAFORMA DI DELIBERAZIONE PUBBLICA',
    guestButton: 'Inizia come ospite →',
    guestUserName: 'Visitatore Ospite',
    logout: 'Disconnetti',
    googleLoginNotConfigured: 'Accedi con Google (Client ID non configurato)',
    googleLoginAlert:
      '[Guida alla configurazione Google Sign-in]\n\nGOOGLE_CLIENT_ID non è attualmente configurato nel backend.\n\nFai clic su "Inizia come ospite →" per provare subito tutte le funzionalità!',
    pickTopicHeading: 'SCEGLI UN TEMA',
    cruxCount: (count) => `§ ${count} punti controversi`,
    keyCruxesHeading: 'PUNTI CONTROVERSI FONDAMENTALI · KEY CRUXES',
    proLabel: '✓ Argomenti a FAVORE',
    conLabel: '✕ Argomenti CONTRO',
    facilitatorTitle: 'Dialogo Deliberativo',
    facilitatorSubtitle: 'Topos Facilitator · Motore di ragionamento basato sulle trascrizioni',
    guestQuotaLabel: (rem) => `Quota ospite · ${rem} / 5 rimanenti questa ora`,
    memberQuotaLabel: (rem) => `Quota membro · ${rem} / 30 rimanenti questa ora`,
    reviewingBanner: (date) => `Revisione della discussione del ${date}`,
    backToCurrentDialogue: 'Torna alla discussione in corso →',
    emptyChatPrompt: 'Fai pure le tue domande senza formalità, ad esempio:',
    sampleQuestions: [
      '«Le faglie sismiche di Taiwan rappresentano un grave rischio di catastrofe per le centrali nucleari?»',
      '«In caso di riattivazione del 4° impianto nucleare, come gestiscono gli altri paesi lo stoccaggio delle scorie?»',
    ],
    userLabel: 'Tu',
    facilitatorLabel: 'Facilitatore Deliberativo Topos',
    citationSource: '📌 Fonte citata: ',
    loadingMessage: 'Il facilitatore sta consultando i verbali dei dibattiti per un\'argomentazione neutrale…',
    inputPlaceholderNormal: 'Scrivi la tua domanda o opinione e premi Invia…',
    inputPlaceholderReviewing: 'Stai consultando la cronologia. Torna alla discussione dal vivo per fare domande.',
    inputPlaceholderExhausted: 'Limite di 5 richieste ospite esaurito. Accedi con Google per sbloccare 30 richieste!',
    sendButton: 'Invia →',
    archiveButton: 'Archivia sessione corrente e ricomincia ↻',
    guestNotice: 'Le domande verranno inviate con account ospite · guest@topos.local',
    historyHeading: 'ARCHIVIO DISCUSSIONI · CRONOLOGIA',
    historyEmpty: 'Nessuna discussione ancora archiviata. Fai qualche domanda e premi «Archivia sessione» per salvarla.',
    defaultSessionTitle: 'Dialogo deliberativo',
    languageSelectAria: 'Seleziona lingua dell\'interfaccia',
  },
};

export interface TopicTranslation {
  category: string;
  title: string;
  description: string;
  tags: string[];
  keyCruxes: Crux[];
}

export const TOPIC_TRANSLATIONS: Record<string, Record<SupportedLanguage, TopicTranslation>> = {
  nuclear4: {
    'zh-TW': {
      category: '能源政策',
      title: '台灣是否應該重啟核四（啟封商轉發電）？',
      description: '回顧 2021 公投第 17 案及當前能源轉型爭議，探討地質耐震、工程整合、核廢料處置與供電穩定之交鋒。',
      tags: ['能源', '核能', '公投', '地質安全', '淨零碳排'],
      keyCruxes: [
        {
          title: '地質與耐震安全',
          description: 'S 斷層與外海斷層是否連通，電廠耐震設計與 PGA 加速度能否承受強震？',
          proPoints: ['中央地調所報告載明非活動斷層', '即便保守推估地動值 0.57G 仍低於廠房耐震 0.66G，且可工程加固', '日本女川與柏崎刈羽核電廠均有耐震經驗'],
          conPoints: ['陳文山等學者提出外海活動斷層相連之新事證', '耐震標準若因新斷層大幅調高，核四難以完全保證無虞', '北部人口稠密，承受不起重大核災風險'],
        },
        {
          title: '工程整合與建廠測試',
          description: '試運轉測試未完成 vs. 安檢報告完成，到底能否安全重啟？',
          proPoints: ['2014 年完成 231 份安檢報告', '一號機設備大多完好，缺少零件與數位儀控可洽美商奇異公司重新採購', '國際上有類似封存後重啟並商轉之前例（如美國 Watts Bar）'],
          conPoints: ['許永輝處長指出試運轉測試 308 份未通過原能會審查', '歐美電器設備與日本 ABWR 廠房空間無法相容，管線狹小難以加固', '原廠團隊已解散，關鍵零件停產，重啟耗時且經費深不見底'],
        },
        {
          title: '能源配比、空污與淨零',
          description: '重啟核四是否有助於減碳抑低空污，還是應全力發展綠能與天然氣？',
          proPoints: ['核能為零碳基載電力，可大幅減少中南部燃煤發電與肺腺癌空污風險', '天然氣儲存天數短，過度依賴天然氣有國安與斷氣封鎖風險', '再生能源具有間歇性，大型儲能成本過高'],
          conPoints: ['核四重啟至少需要 7~10 年以上，遠水救不了近火', '現代國際趨勢轉向風電、光電與分散式電網', '核廢料（低放與高放射性）在台灣無縣市願意接納最終處置場，形成世代不正義'],
        },
      ],
    },
    en: {
      category: 'Energy Policy',
      title: 'Should Taiwan restart the Fourth Nuclear Power Plant (Lungmen)?',
      description: 'Revisiting the 2021 Referendum Case 17 and ongoing energy transition debates, examining geological seismic safety, engineering integration, nuclear waste disposal, and grid stability.',
      tags: ['Energy', 'Nuclear Power', 'Referendum', 'Seismic Safety', 'Net Zero'],
      keyCruxes: [
        {
          title: 'Geological & Seismic Safety',
          description: 'Are the S fault and offshore fault systems connected, and can the plant seismic PGA withstand major earthquakes?',
          proPoints: ['Central Geological Survey reports designate it as non-active fault', 'Conservative ground acceleration estimate of 0.57G is within the 0.66G design capacity and reinforceable', 'Proven seismic durability in Japanese plants like Onagawa and Kashiwazaki-Kariwa'],
          conPoints: ['Prof. Chen Wen-shan and geologists cite evidence of interconnected offshore active faults', 'Substantially raised seismic criteria could exceed feasible retrofit margins', 'Dense Northern Taiwan population cannot withstand high-consequence nuclear catastrophe risks'],
        },
        {
          title: 'Engineering Integration & Commissioning Tests',
          description: 'Incomplete commissioning tests vs. completed safety inspection reports: can it be safely restarted?',
          proPoints: ['231 safety inspection reports were certified in 2014', 'Unit 1 equipment remains largely intact; missing digital instrumentation can be procured from GE', 'International precedents exist for restarting mothballed plants (e.g. US Watts Bar)'],
          conPoints: ['Plant Director Hsu Yung-hui highlighted 308 commissioning test items failing AEC regulatory approvals', 'Incompatibility between Western electronics and Japanese ABWR layout creates extreme pipe congestion', 'Original engineering vendor team has disbanded and custom parts are discontinued, leading to runaway costs'],
        },
        {
          title: 'Energy Mix, Air Pollution & Net-Zero Transition',
          description: 'Does restarting Nuclear 4 aid decarbonization and air quality, or should Taiwan prioritize renewables and LNG?',
          proPoints: ['Nuclear provides zero-carbon baseload electricity, reducing Central/Southern coal burning and lung cancer health risks', 'LNG storage buffer is very limited, creating severe national security vulnerability to maritime blockades', 'Renewables suffer from intermittency and grid-scale storage remains prohibitively expensive'],
          conPoints: ['Restarting Nuclear 4 takes at least 7–10 years, failing near-term power demand', 'Global consensus is shifting rapidly to offshore wind, solar, and distributed smart grids', 'No local county will accept a high-level radioactive waste repository, creating intergenerational injustice'],
        },
      ],
    },
    ja: {
      category: 'エネルギー政策',
      title: '台湾は第4原子力発電所（竜門原発）を再稼働すべきか？',
      description: '2021年の第17回国民投票と現行のエネルギー転換の議論を振り返り、断層耐震性、エンジニアリング統合、核廃棄物処分、電力供給の安定性に関する論点を多角的に検証します。',
      tags: ['エネルギー', '原子力', '国民投票', '地質・耐震', 'ネットゼロ'],
      keyCruxes: [
        {
          title: '地質構造と耐震安全性',
          description: 'S断層と沖合活断層の連動性、および発電所の耐震設計加速度（PGA）は大地震に耐えうるか？',
          proPoints: ['中央地質調査所の報告では非活断層と判断されている', '保守的試算0.57Gでも耐震設計値0.66Gを下回り、耐震補強工事が可能', '日本の女川や柏崎刈羽原発における実地耐震データが参考になる'],
          conPoints: ['陳文山教授ら地質学者が沖合活断層の連動を示す新証拠を提示', '耐震基準が大幅に引き上げられた場合、現行構造での安全保証は極めて困難', '北部大都市圏の人口密集度を考慮すると、過酷事故リスクは許容できない'],
        },
        {
          title: 'プラント統合と試運転試験',
          description: '試運転試験の未完 vs 安全検査報告書の完了：本当に安全に再稼働できるか？',
          proPoints: ['2014年に231件の安全点検報告書が完了済み', '1号機の主要機器は良好であり、不足部品やデジタル制御機器は米GE社から再調達可能', '長期間凍結後の再稼働および商用運転の国際前例が存在する（米ワッツバー原発等）'],
          conPoints: ['許永輝元所長は308件の試運転試験が原子力委員会の承認を通過していないと指摘', '欧米製電気機器と日立/東芝製ABWR建屋の整合性が取れず、配管が過密で補強が極めて困難', 'メーカーのエンジニアチームは解散し部品は生産終了、費用と期間が青天井になる恐れ'],
        },
        {
          title: 'エネルギー構成・大気汚染・ネットゼロ',
          description: '第4原発の再開は脱炭素とPM2.5抑制に寄与するか、それとも再エネとLNG推進に注力すべきか？',
          proPoints: ['原子力はゼロエミッションのベースロード電源であり、火力発電依存による大気汚染と健康被害を軽減', 'LNGは備蓄日数が短く、海上封鎖などの安全保障上のリスクが高い', '再生可能エネルギーは間欠性があり、大規模蓄電システムの導入費用が高額'],
          conPoints: ['再稼働には最低でも7〜10年以上を要し、直近の電力需要には間に合わない', '国際的な潮流は洋上風力・太陽光と分散型スマートグリッドに移行している', '高レベル放射性廃棄物の最終処分場受け入れ自治体が台湾国内に存在せず、世代間不公正を招く'],
        },
      ],
    },
    ko: {
      category: '에너지 정책',
      title: '대만은 제4원자력발전소(룽먼 원전)를 재가동해야 하는가?',
      description: '2021년 국민투표 제17호 안건과 에너지 전환 논쟁을 되돌아보며 단층 지질 내진성, 엔지니어링 통합, 방사성 폐기물 처분 및 전력 공급 안정성을 살펴봅니다.',
      tags: ['에너지', '원자력', '국민투표', '지질안전', '넷제로'],
      keyCruxes: [
        {
          title: '지질 구조 및 내진 안전성',
          description: 'S 단층과 해저 활단층의 연동 가능성, 발전소 내진설계(PGA)가 대형 지진을 견딜 수 있는가?',
          proPoints: ['중앙지질조사소 보고서는 비활성 단층으로 규정', '보수적 추정치 0.57G도 원전 설계 기준인 0.66G 이내이며 보강 공사 가능', '일본 오나가와 및 가시와자키 가리와 원전 등의 내진 방호 사례'],
          conPoints: ['천원산 교수 등 지질학자들이 해역 활단층 연계에 관한 새로운 근거 제시', '신규 단층으로 인한 내진 기준 상향 시 룽먼 원전의 완전한 안전 보장 불가', '대만 북부 인구 밀집 지역의 특성상 중대 원전 사고 위험 감수 불가'],
        },
        {
          title: '엔지니어링 통합 및 시운전 시험',
          description: '미완료 시운전 시험 vs 완료된 안전검사 보고서: 안전한 재가동이 가능한가?',
          proPoints: ['2014년 231건의 안전점검 보고서 승인 완료', '1호기 설비는 상당 부분 양호하며 부족한 부품은 미국 GE사를 통해 재조달 가능', '건설 중단 후 재개 및 상업 운전에 성공한 해외 사례 존재(미국 와츠바 원전 등)'],
          conPoints: ['쉬융후이 처장은 308건의 시운전 시험이 원자력에너지위원회 심사를 통과하지 못했다고 증언', '유럽·미국산 전기 설비와 일본 ABWR 원자로 건물 규격 불일치로 배관 협소 및 보강 곤란', '원제작사 기술팀 해체 및 핵심 단종 부품 문제로 막대한 예산과 시간 소요'],
        },
        {
          title: '전력 믹스, 대기오염 및 탄소중립',
          description: '제4원전 재가동이 온실가스 감축에 도움이 되는가, 아니면 재생에너지와 LNG에 집중해야 하는가?',
          proPoints: ['원자력은 무탄소 기저 부하 전력으로, 석탄 화력 축소를 통해 미세먼지와 폐암 위험 저감', '천연가스(LNG)는 저장 일수가 짧아 해상 봉쇄 등 안보 취약점 상존', '재생에너지는 간헐성이 크며 대규모 에너지 저장 장치(ESS) 비용 과다'],
          conPoints: ['제4원전 재가동에 최소 7~10년 이상 소요되어 당장의 전력난 해결 불가', '글로벌 에너지 패러다임은 풍력, 태양광 및 분산형 그리드로 급속 전환 중', '고준위 방사성 폐기물 최종 처분장을 수용할 지자체가 전무하여 미래 세대에 부담 전가'],
        },
      ],
    },
    fr: {
      category: 'Politique énergétique',
      title: 'Taïwan devrait-il redémarrer la 4e centrale nucléaire (Lungmen) ?',
      description: 'Analyse du référendum taïwanais de 2021 et du débat de transition énergétique : géologie sismique, intégration industrielle, déchets radioactifs et sécurité d’approvisionnement.',
      tags: ['Énergie', 'Nucléaire', 'Référendum', 'Sécurité sismique', 'Zéro carbone'],
      keyCruxes: [
        {
          title: 'Géologie et sûreté sismique',
          description: 'Les failles S et sous-marines sont-elles interconnectées, et la conception sismique résiste-t-elle à des secousses extrêmes ?',
          proPoints: ['Les rapports officiels du CGS classent la faille comme non active', 'Même l\'estimation conservatrice de 0,57G reste inférieure à la tolérance de conception de 0,66G', 'Résistance prouvée lors de séismes majeurs au Japon (ex. Onagawa)'],
          conPoints: ['De nouveaux travaux géologiques démontrent l\'interconnexion possible des failles marines', 'Une réévaluation sismique stricte rendrait la conformité incertaine sans travaux démesurés', 'La forte densité de population dans le nord de l\'île rend tout risque inacceptable'],
        },
        {
          title: 'Intégration technique et essais de mise en service',
          description: 'Essais de mise en service inachevés vs rapports d’inspection validés : un redémarrage fiable est-il possible ?',
          proPoints: ['231 rapports d\'inspection de sécurité ont été validés en 2014', 'Le réacteur 1 est en grande partie intact ; les pièces manquantes peuvent être commandées auprès de GE', 'Il existe des précédents de reprise après longue mise sous cocon (ex. Watts Bar aux États-Unis)'],
          conPoints: ['308 protocoles d\'essais n\'ont pas reçu l\'aval de l\'autorité de sûreté (AEC)', 'Incompatibilités spatiales entre équipements électriques occidentaux et structure ABWR japonaise', 'Dispersion des équipes d\'ingénierie d\'origine et pièces obsolètes engendrant des coûts exponentiels'],
        },
        {
          title: 'Mix énergétique, pollution de l’air et neutralité carbone',
          description: 'Le nucléaire aide-t-il à réduire le charbon ou faut-il miser exclusivement sur les renouvelables et le GNL ?',
          proPoints: ['Électricité bas-carbone continue permettant de réduire la pollution au charbon dans le centre et le sud', 'Le stockage de GNL est très limité dans le temps, posant un risque en cas de blocus maritime', 'L\'intermittence des renouvelables nécessite des capacités de stockage aujourd\'hui trop onéreuses'],
          conPoints: ['Un redémarrage exigerait 7 à 10 ans minimum, ne répondant pas aux urgences immédiates', 'La tendance internationale s\'oriente vers l\'éolien offshore, le solaire et les réseaux décentralisés', 'Aucune collectivité n\'accepte de site de stockage définitif des déchets radioactifs'],
        },
      ],
    },
    de: {
      category: 'Energiepolitik',
      title: 'Sollte Taiwan das 4. Kernkraftwerk (Lungmen) reaktivieren?',
      description: 'Rückblick auf das Referendum von 2021 und die Energiewende: Erdbebensicherheit, technische Systemintegration, Atommüllendlagerung und Versorgungssicherheit.',
      tags: ['Energie', 'Kernenergie', 'Referendum', 'Seismische Sicherheit', 'Netto-Null'],
      keyCruxes: [
        {
          title: 'Geologie und seismische Belastbarkeit',
          description: 'Sind die S-Verwerfung und marine Bruchzonen gekoppelt, und hält die Anlage starken Erdbebenbeschleunigungen stand?',
          proPoints: ['Berichte des Geologischen Dienstes stufen die Verwerfung als inaktiv ein', 'Konservative Schätzung von 0,57G liegt unter der baulichen Auslegung von 0,66G und kann verstärkt werden', 'Erfahrungen mit Erdbebenresistenz japanischer Reaktoren wie Onagawa'],
          conPoints: ['Neue geologische Gutachten weisen auf zusammenhängende marine Verwerfungssysteme hin', 'Verschärfte Erdbebennormen könnten die wirtschaftliche und bauliche Machbarkeit übersteigen', 'Hohe Bevölkerungsdichte im Norden Taiwans schließt jedes unkalkulierbare Restrisiko aus'],
        },
        {
          title: 'Systemintegration und Inbetriebnahmetests',
          description: 'Unvollständige Inbetriebnahmetests vs. abgeschlossene Sicherheitsgutachten: Ist eine sichere Fertigstellung möglich?',
          proPoints: ['231 Sicherheitsberichte wurden 2014 erfolgreich abgeschlossen', 'Reaktorblock 1 ist weitgehend intakt; fehlende Digital- und Leitsysteme können von GE beschafft werden', 'Internationale Präzedenzfälle für Wiederinbetriebnahme nach Stillstand vorhanden (z. B. Watts Bar, USA)'],
          conPoints: ['308 Testprotokolle haben die offizielle Zulassung der Atomaufsicht nicht bestanden', 'Inkompatibilität westlicher Elektronik mit der japanischen ABWR-Bauweise erschwert Nachrüstungen erheblich', 'Ursprüngliche Entwicklerteams sind aufgelöst, Ersatzteilbeschaffung führt zu unabsehbaren Kosten'],
        },
        {
          title: 'Energiemix, Luftqualität und Klimaneutralität',
          description: 'Hilft Kernkraft bei der Reduktion von Kohleemissionen oder sollte der Fokus auf Erneuerbaren und Flüssiggas liegen?',
          proPoints: ['Emissionsfreie Grundlaststromversorgung mindert Kohleverstromung und Gesundheitsrisiken durch Feinstaub', 'Geringe Vorratsreichweite bei LNG birgt erhebliche Versorgungs- und Sicherheitsrisiken bei Blockaden', 'Erneuerbare Energien sind wetterabhängig; großtechnische Stromspeicher sind noch sehr teuer'],
          conPoints: ['Reaktivierung dauert mindestens 7 bis 10 Jahre und löst akute Engpässe nicht', 'Internationaler Trend setzt vorrangig auf Offshore-Wind, Photovoltaik und dezentrale Netze', 'Ungelöste Endlagerfrage für hochradioaktiven Müll mangels regionaler Akzeptanz'],
        },
      ],
    },
    es: {
      category: 'Política energética',
      title: '¿Debería Taiwán reiniciar la cuarta central nuclear (Lungmen)?',
      description: 'Análisis del referéndum de 2021 y el debate sobre la transición energética: sismicidad geológica, integración de ingeniería, gestión de residuos y seguridad del suministro eléctrico.',
      tags: ['Energía', 'Energía Nuclear', 'Referéndum', 'Seguridad Sísmica', 'Cero Neto'],
      keyCruxes: [
        {
          title: 'Geología y seguridad sísmica',
          description: '¿Están conectadas la falla S y las fallas submarinas? ¿Puede el diseño resistir sismos severos?',
          proPoints: ['El Servicio Geológico Central determinó que no es una falla activa', 'La estimación conservadora de 0,57G no supera la capacidad de diseño de 0,66G y es reforzable', 'Experiencia demostrada en centrales nucleares japonesas como Onagawa'],
          conPoints: ['Geólogos independientes señalan indicios de fallas activas marinas interconectadas', 'Si los estándares sísmicos se elevan drásticamente, la seguridad total no puede garantizarse', 'La alta densidad demográfica del norte no puede asumir el riesgo de un desastre nuclear'],
        },
        {
          title: 'Integración de ingeniería y pruebas operativas',
          description: 'Pruebas de puesta en marcha incompletas frente a informes de inspección cerrados: ¿es seguro reiniciar?',
          proPoints: ['Se completaron 231 informes de inspección de seguridad en 2014', 'La unidad 1 se encuentra en buen estado; componentes digitales pueden adquirirse a GE', 'Existen precedentes internacionales de reactivación tras prolongados parones (ej. Watts Bar en EE. UU.)'],
          conPoints: ['308 pruebas de puesta en marcha no superaron la aprobación del organismo regulador nuclear', 'Incompatibilidad de espacios entre sistemas eléctricos occidentales y el diseño japonés ABWR', 'Equipo técnico original disperso y piezas descatalogadas, con costes impredecibles'],
        },
        {
          title: 'Matriz energética, contaminación y descarbonización',
          description: '¿Contribuye la nuclear a reducir el carbón o debe priorizarse el gas natural licuado y las renovables?',
          proPoints: ['Electricidad de base sin emisiones directas que disminuye la quema de carbón y problemas respiratorios', 'Las reservas de GNL son limitadas en días, generando vulnerabilidad ante bloqueos navales', 'Las energías renovables son intermitentes y el almacenamiento a gran escala aún es costoso'],
          conPoints: ['El reinicio tardaría al menos entre 7 y 10 años, sin solucionar urgencias inmediatas', 'La tendencia global avanza decididamente hacia la eólica marina, solar y redes inteligentes', 'Ninguna comunidad local acepta el almacenamiento definitivo de residuos radiactivos'],
        },
      ],
    },
    it: {
      category: 'Politica energetica',
      title: 'Taiwan dovrebbe riattivare la quarta centrale nucleare (Lungmen)?',
      description: 'Riflessione sul referendum del 2021 e sul dibattito energetico: sicurezza sismica, integrazione impiantistica, smaltimento scorie e stabilità della fornitura elettrica.',
      tags: ['Energia', 'Nucleare', 'Referendum', 'Sicurezza sismica', 'Net Zero'],
      keyCruxes: [
        {
          title: 'Geologia e resistenza sismica',
          description: 'La faglia S e quelle sottomarine sono collegate? La progettazione PGA può reggere terremoti di elevata magnitudo?',
          proPoints: ['I rilievi ufficiali indicano che la faglia non è attiva', 'La stima prudenziale di 0,57G rientra nel limite progettuale di 0,66G ed è consolidabile', 'Esperienze positive di tenuta sismica in impianti giapponesi come Onagawa'],
          conPoints: ['Studi geologici indipendenti segnalano la continuità con faglie attive al largo', 'Criteri antisismici più severi renderebbero l\'adeguamento tecnico estremamente incerto', 'L\'alta densità abitativa del nord rende inaccettabile il rischio di catastrofe nucleare'],
        },
        {
          title: 'Integrazione ingegneristica e collaudi',
          description: 'Collaudi operativi incompleti vs relazioni di sicurezza completate: è possibile un riavvio affidabile?',
          proPoints: ['231 perizie di sicurezza sono state certificate nel 2014', 'I componenti dell\'unità 1 sono in gran parte preservati; strumentazione digitale reperibile da GE', 'Esistono precedenti internazionali di riattivazione dopo lunghi fermi (es. Watts Bar, USA)'],
          conPoints: ['308 collaudi non hanno ottenuto il via libera dell\'autorità per l\'energia atomica', 'Difficoltà di convivenza tra cablaggi occidentali e architettura giapponese ABWR con spazi ristretti', 'Team costruttori smantellati e componenti fuori produzione, con costi esponenziali'],
        },
        {
          title: 'Mix energetico, emissioni e transizione verde',
          description: 'Il nucleare favorisce la decarbonizzazione o è preferibile puntare esclusivamente su rinnovabili e GNL?',
          proPoints: ['Generazione di base a zero emissioni, che riduce l\'uso di carbone e l\'inquinamento da particolato', 'L\'autonomia delle scorte di GNL è di pochi giorni, con forti rischi in caso di blocco navale', 'Le rinnovabili sono discontinue e l\'accumulo su larga scala comporta costi ancora proibitivi'],
          conPoints: ['Il riavvio richiederebbe almeno 7-10 anni, risultando inutile per le esigenze a breve termine', 'La traiettoria globale punta decisamente su eolico offshore, solare e reti intelligenti', 'Nessun comune accetta il deposito definitivo delle scorie ad alta attività, gravando sulle generazioni future'],
        },
      ],
    },
  },
};
