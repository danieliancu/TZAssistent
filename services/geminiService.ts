import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Course, AIResponseSchema, ChatMessage } from "../types";
import { searchLocalCourses } from "./dataService";
import { getCourseDetails } from "./courseContent";
import { analytics } from "./analyticsService";

let ai: GoogleGenAI | null = null;

const initAI = () => {
  if (!ai) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("VITE_GEMINI_API_KEY is not set in .env.local file");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

// Helper function to retry requests on 429 errors
async function generateWithRetry(client: any, params: any, retries = 3, baseDelay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await client.models.generateContent(params);
    } catch (error: any) {
      // Check for 429 (Resource Exhausted) or 503 (Service Unavailable)
      const isQuotaError = error.status === 429 || error.code === 429 ||
        (error.message && error.message.includes('429'));
      const isServerOverload = error.status === 503 || error.code === 503;

      // Also check for AUTH errors (400/403) which should NOT be retried
      const isAuthError = error.status === 403 || error.status === 400 ||
        (error.message && (error.message.includes('API key') || error.message.includes('PERMISSION_DENIED')));

      if (isAuthError) {
        throw error; // Throw immediately, do not retry
      }

      if ((isQuotaError || isServerOverload) && i < retries - 1) {
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000; // Exponential backoff + jitter
        console.warn(`Gemini API busy (Code ${error.status || error.code}). Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// 1. Tool for Searching Schedule
const searchCoursesTool: FunctionDeclaration = {
  name: "searchCourses",
  description: "Search for training courses based on name, acronym, location, or date range. Returns live schedule, price, spaces, and delivery metadata.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The course name, acronym, or reference (e.g., 'SMSTS', 'First Aid', 'Traffic Marshal'). Do NOT include city/venue here."
      },
      location: {
        type: Type.STRING,
        description: "The city or venue (e.g., 'London', 'Online', 'Chelmsford'). Can be a comma-separated list of multiple locations (e.g., 'London, Stratford, Wembley')."
      },
      dateStart: {
        type: Type.STRING,
        description: "The start date for the search range in YYYY-MM-DD format."
      },
      dateEnd: {
        type: Type.STRING,
        description: "The end date for the search range in YYYY-MM-DD format. If user says 'next week', calculate the 7 day range."
      }
    }
  }
};

// 2. Tool for Retrieving Content Details
const getCourseDetailsTool: FunctionDeclaration = {
  name: "getCourseDetails",
  description: "Get detailed information about a course's content, syllabus, exam format, prerequisites, or what is included. Use this when the user asks 'What is covered?', 'Is there an exam?', 'What time does it start?', etc.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      courseType: {
        type: Type.STRING,
        description: "The acronym or main name of the course (e.g., 'SMSTS', 'SSSTS')."
      }
    },
    required: ["courseType"]
  }
};

const COURSE_FAMILY_PATTERNS: Array<{ family: string; pattern: RegExp }> = [
  { family: 'SMSTS', pattern: /\bsmsts\b|site management/i },
  { family: 'SSSTS', pattern: /\bsssts\b|site supervisor/i },
  { family: 'HSA', pattern: /\bhsa\b|health and safety awareness|green card|card verde/i },
  { family: 'TWC', pattern: /\btwc\b|temporary works coordinator/i },
  { family: 'TWS', pattern: /\btws\b|temporary works supervisor/i },
  { family: 'NEBOSH_GENERAL', pattern: /nebosh.*(general|national general)/i },
  { family: 'NEBOSH_CONSTRUCTION', pattern: /nebosh.*construction/i },
  { family: 'NEBOSH', pattern: /\bnebosh\b/i },
  { family: 'FIRST_AID', pattern: /first aid|\bfaw\b/i },
  { family: 'IOSH', pattern: /\biosh\b/i },
  { family: 'EUSR', pattern: /\beusr\b|water hygiene/i },
];

const LOCATION_HINT_PATTERN = /\b(london|stratford|wembley|ilford|barking|harrow|enfield|dartford|romford|uxbridge|heathrow|waltham abbey|essex|kent|birmingham|manchester|chelmsford|online)\b/i;
const DATE_HINT_PATTERN = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|next|week|month|tomorrow|today|march|april|may|june|july|august|september|october|november|december)\b/i;

const detectCourseFamily = (text: string): string | null => {
  for (const matcher of COURSE_FAMILY_PATTERNS) {
    if (matcher.pattern.test(text)) return matcher.family;
  }
  return null;
};

const detectLastCourseFamilyInHistory = (history: ChatMessage[]): string | null => {
  for (let i = history.length - 1; i >= 0; i--) {
    const fam = detectCourseFamily(history[i].text || '');
    if (fam) return fam;
  }
  return null;
};

const localizeNoResultsWithCriteria = (
  userLanguage: string,
  criteria: { query?: string; location?: string; dateStart?: string; dateEnd?: string }
): string => {
  const q = criteria.query || 'not specified';
  const l = criteria.location || 'any location';
  const d = (criteria.dateStart || criteria.dateEnd) ? `${criteria.dateStart || '...'} to ${criteria.dateEnd || '...'}` : 'any date';

  if (userLanguage.startsWith('ro')) {
    return `Nu am gasit cursuri pentru criteriile folosite: curs=\"${q}\", locatie=\"${l}\", perioada=\"${d}\". Vrei sa relaxez locatia sau perioada?`;
  }
  if (userLanguage.startsWith('pl')) {
    return `Nie znalazlem kursow dla kryteriow: kurs=\"${q}\", lokalizacja=\"${l}\", okres=\"${d}\". Chcesz, zebym rozszerzyl lokalizacje lub daty?`;
  }
  if (userLanguage.startsWith('bg')) {
    return `Ne namerih kursove za kriteriite: kurs=\"${q}\", lokaciya=\"${l}\", period=\"${d}\". Iskate li da razshirim lokaciya ili dati?`;
  }
  if (userLanguage.startsWith('hu')) {
    return `Nem talaltam kurzust ezekkel a kriteriumokkal: kurzus=\"${q}\", helyszin=\"${l}\", idoszak=\"${d}\". Szeretne lazitani a helyszinen vagy datumon?`;
  }
  if (userLanguage.startsWith('cs')) {
    return `Nenasel jsem kurzy pro tato kriteria: kurz=\"${q}\", lokalita=\"${l}\", obdobi=\"${d}\". Chcete rozsirit lokalitu nebo terminy?`;
  }
  return `I couldn't find courses with these criteria: course="${q}", location="${l}", date range="${d}". Do you want me to relax location or dates?`;
};

export const sendMessageToGemini = async (
  prompt: string | { audioData: string; mimeType: string },
  history: ChatMessage[],
  allCourses: Course[],
  userLanguage: string = 'en-US' // Default to English
): Promise<AIResponseSchema> => {
  const client = initAI();
  if (!client) throw new Error("AI Client not initialized");



  // Use English/International date format for the system context
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const systemInstruction = `
    You are a helpful AI assistant for "Target Zero Training". Your role is to help users find training courses and answer questions about them.
    Today is: ${today} (ISO: ${todayISO}).

    CRITICAL INSTRUCTION - TOOLS:
    You have two distinct tools. Use them appropriately:
    1.  **searchCourses**: Use this when the user asks about DATES, LOCATIONS, AVAILABILITY, or PRICES. (e.g., "When is the next SMSTS?", "Courses in London").
    2.  **getCourseDetails**: Use this when the user asks about CONTENT, EXAMS, SYLLABUS, or PREREQUISITES. (e.g., "What is the pass mark for SMSTS?", "What do I learn?", "Is lunch included?").
    3.  Hybrid source of truth rule:
        - Live commercial/schedule data (dates, spaces, price, delivery, online/offline, booking link) always comes from **searchCourses** results.
        - Learning content (exam format, syllabus, prerequisites) comes from **getCourseDetails**.
        - If there is any conflict, prioritize searchCourses for schedule/price/availability.

    CONTEXT RETENTION (CRITICAL):
    - **Always analyze the FULL conversation history** to extract implicit context.
    - Track these key details from previous messages:
      1. **Course Type/Name** (e.g., "SMSTS", "NEBOSH General", "First Aid")
      2. **Location/Venue** (e.g., "London", "Chelmsford", "Online")
      3. **Date Range** (e.g., "June 2026", "next week", "March")
    
    - When the user asks a follow-up question WITHOUT repeating all details, you MUST:
      a) Look back at the conversation history
      b) Extract the missing context (course, location, or date)
      c) Apply it to the current query
    
    - **Examples:**
      * History: "Show me NEBOSH courses in June 2026" → AI shows NEBOSH General
      * User: "What about construction?" 
      * AI should search: "NEBOSH Construction" + "June 2026" (retaining the date!)
      
      * History: "SMSTS courses in London"
      * User: "What about next week?"
      * AI should search: "SMSTS" + "London" + calculate next week dates
      
      * History: "Courses in Chelmsford in March"
      * User: "Show me NEBOSH"
      * AI should search: "NEBOSH" + "Chelmsford" + "March"
    
    - **BEFORE calling searchCourses**, follow this process:
      STEP 1: Check current message for course type, location, and date
      STEP 2: If ANY parameter is missing, scan conversation history backwards
      STEP 3: Extract the most recent mention of each missing parameter
      STEP 4: Combine current + historical parameters
      STEP 5: Call searchCourses with complete parameters
      
      Example walkthrough:
      - History: "Show me NEBOSH courses in June 2026" 
      - Current: "What about construction?"
      - STEP 1: Current has course modifier ("construction") but NO date
      - STEP 2: Date is missing, scan history
      - STEP 3: Found "June 2026" in previous message
      - STEP 4: Combine: "NEBOSH Construction" + "June 2026"
      - STEP 5: searchCourses(query: "NEBOSH Construction", dateStart: "2026-06-01", dateEnd: "2026-06-30")

    CONTEXT RESET OVERRIDE (CRITICAL):
    - If the current user message clearly switches to a different course topic, DO NOT inherit old location automatically.
    - On clear course switch: keep prior date context if useful, but reset stale location unless user repeats location.
    - In no-results responses, explicitly mention the exact criteria used (query, location, date range).



    LANGUAGE RULES (CRITICAL):
    1.  **Detect Language:** Analyze the language of the user's latest message.
    2.  **Reply Language:** You MUST reply in the EXACT SAME language as the user.
    3.  **Fallback:** If the user's language is ambiguous or cannot be determined, use **English**.
    
    GEOGRAPHY & PROXIMITY (CRITICAL):
    - The database does NOT have geospatial intelligence. You must bridge this gap.
    - **Expand Location Queries:** If the user asks for a major city or region, you MUST search for that city AND its known districts/boroughs.
    - **Pass multiple terms** to the 'location' parameter, separated by commas.
    
    **KNOWLEDGE BASE (Use these mappings):**
    - **"London"** -> query location: "London, Stratford, Wembley, Ilford, Barking, Harrow, Enfield, Dartford, Romford, Uxbridge, Heathrow, Waltham Abbey"
    - **"Essex"** -> query location: "Essex, Chelmsford, Brentwood, Basildon, Colchester, Harlow, Romford, Ilford, Barking, Waltham Abbey"
    - **"Kent"** -> query location: "Kent, Dartford, Maidstone, Ashford, Canterbury"
    - **"Birmingham"** -> query location: "Birmingham, Solihull, Walsall, Wolverhampton"
    - **"Manchester"** -> query location: "Manchester, Salford, Bolton, Stockport"
    
    *Example:*
    - User: "Courses in London"
    - Tool Call: searchCourses(location: "London, Stratford, Wembley, Ilford, Barking")

    CRITICAL TRANSLATION EXCEPTION:
    - **NEVER TRANSLATE COURSE NAMES.**
    - Always use the official English name for the course, even if the rest of the sentence is in another language.
    - Example (Bad): "Am găsit cursuri de Coordonator Lucrări Temporare"
    - Example (Good): "Am găsit cursuri de **Temporary Works Coordinator**"
    - Example (Bad): "Examenul de Prim Ajutor"
    - Example (Good): "Examenul de **First Aid at Work**"

    - **ALWAYS USE ENGLISH VENUE NAMES.**
    - If the user says "Londra", you MUST search for and display "London".
    - If the user says "București", you MUST search for "Bucharest" (if applicable) or explain availability in English terms.
    - Example: User says "cursuri în Londra" -> Search location: "London, Stratford, Wembley" -> Reply "Am găsit cursuri în **London**".

    DATE & TIME REASONING:
    Users use natural language. Calculate dates relative to Today (${todayISO}) BEFORE calling the tool.
    - "Next Monday": Calculate the specific YYYY-MM-DD.
    - "In two weeks": Calculate range starting approx 14 days from now.

    ACRONYM MAPPING (Use these for the 'query' or 'courseType' parameters):
    - "SMSTS", "Site Management" -> query: "SMSTS"
    - "SSSTS", "Site Supervisor" -> query: "SSSTS"
    - "HSA", "Green card", "Card verde" -> query: "HSA"
    - "FAW", "First Aid", "Prim ajutor" -> query: "First Aid"
    - "MHFA", "Mental Health" -> query: "MHFA"
    - "SEATS", "Environment" -> query: "SEATS"
    - "TWC", "Temporary Works Coordinator" -> query: "TWC"
    - "TWS", "Temporary Works Supervisor" -> query: "TWS"
    - "Fire Marshal", "Incendiu" -> query: "Fire"
    - "Traffic Marshal", "Banksman" -> query: "Traffic"
    - "Directors" -> query: "DRHS"
    - "EUSR", "Water" -> query: "EUSR"
    - "IOSH" -> query: "IOSH"
    - "NEBOSH" -> query: "NEBOSH"

    RESPONSE RULES:
    1.  **Tone:** Professional, friendly, and concise (WhatsApp style).
    2.  **Disambiguation:** If the tool returns mixed results (e.g. both General and Construction for 'Nebosh'), populate 'disambiguation_options'.
    3.  **No Results:** If the tool returns no courses, suggest closest alternatives or ask for clarification.
    
    VISUAL PRESENTATION RULE (CRITICAL):
    - The 'searchCourses' tool returns an object with a 'courses' array.
    - Each course object in the array has an 'id' field (number).
    - **Extract the 'id' from each course** and populate 'suggested_course_ids' with these IDs.
    - Example: If tool returns {courses: [{id: 123, name: "SMSTS"}, {id: 456, name: "SSSTS"}]}, 
      then suggested_course_ids should be [123, 456].
    - **IMPORTANT:** If the tool returns {courses: [], message: "No courses found..."}, 
      DO NOT say "I found courses". Instead, inform the user that no courses were found and suggest alternatives.
    - The User Interface will automatically display detailed cards for courses in 'suggested_course_ids'.
    - **DO NOT list the courses in your text reply.**
    - If the user asks a direct factual question about one result (example: "how many spaces are left?" or "what is the current price?"), you may mention the exact value in text using the tool result.
    - Otherwise, avoid duplicating long date/price/venue lists in text because cards will show them.
    - Your text reply must be ONLY a short introductory sentence.
    - Example of GOOD reply: "I found the following SMSTS courses for next week:"
    - Example of BAD reply: "I found courses on Monday 12th, Tuesday 13th... [list of data]" → NEVER DO THIS.

    FALLBACK RESPONSE RULE (CRITICAL):
    - If the tool returns a message containing "FALLBACK_TO_ONLINE", you MUST reply with this EXACT phrase (translated to user's language):
    - English: "I couldn't find courses in that area, but here are some Online alternatives. Let me know if you'd like to check other dates or locations."
    - Romanian: "Nu am găsit în zona respectivă, acestea sunt alternativele online. Spune-mi dacă vrei să caut și alte locații sau date."
    - DO NOT mention the specific locations you searched for (e.g., don't say "Harrow, Enfield, Wembley"). Keep it generic.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      reply: {
        type: Type.STRING,
        description: "The text response. Keep it short if courses are found.",
      },
      suggested_course_ids: {
        type: Type.ARRAY,
        items: { type: Type.INTEGER },
        description: "List of IDs (numbers) of relevant courses found via the tool.",
      },
      disambiguation_options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of specific course names if query was broad.",
      },
    },
    required: ["reply", "suggested_course_ids", "disambiguation_options"],
  };

  try {
    // 1. Construct Initial Conversation History
    const contents: any[] = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // 2. Add current user prompt
    let currentParts: any[] = [];
    if (typeof prompt === 'string') {
      currentParts.push({ text: prompt });
    } else {
      currentParts.push({
        inlineData: {
          mimeType: prompt.mimeType,
          data: prompt.audioData
        }
      });
      currentParts.push({ text: "Analyze audio. Reply in spoken language." });
    }
    contents.push({ role: "user", parts: currentParts });

    const currentPromptText = typeof prompt === 'string' ? prompt : '';
    const currentPromptLower = currentPromptText.toLowerCase();
    const currentCourseFamily = detectCourseFamily(currentPromptText);
    const lastCourseFamily = detectLastCourseFamilyInHistory(history);
    const topicChanged = !!(currentCourseFamily && lastCourseFamily && currentCourseFamily !== lastCourseFamily);
    const hasExplicitLocationInCurrent = LOCATION_HINT_PATTERN.test(currentPromptText);
    const hasExplicitDateInCurrent = DATE_HINT_PATTERN.test(currentPromptText);

    // 3. First API Call: Send Prompt + Tools (WITH RETRY)
    let response = await generateWithRetry(client, {
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ functionDeclarations: [searchCoursesTool, getCourseDetailsTool] }],
        temperature: 0.2,
      },
    });

    // 4. Handle Function Calls (Multi-turn loop)
    const candidates = response.candidates;
    const firstCandidate = candidates?.[0];
    const functionCalls = firstCandidate?.content?.parts?.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);

    if (functionCalls && functionCalls.length > 0) {
      // Add the model's "thought" (the function call) to the history
      contents.push({
        role: "model",
        parts: firstCandidate?.content?.parts || []
      });

      // Execute the function(s)
      const functionResponses = [];

      for (const call of functionCalls) {
        // HANDLER 1: SEARCH
        if (call.name === 'searchCourses' && call.args) {
          const args = call.args as any;
          let resolvedQuery = args.query as string | undefined;
          let resolvedLocation = args.location as string | undefined;
          let resolvedDateStart = args.dateStart as string | undefined;
          let resolvedDateEnd = args.dateEnd as string | undefined;

          const queryFromCurrent = !!(resolvedQuery && currentPromptLower.includes(String(resolvedQuery).toLowerCase()));
          const criteriaSource = {
            query: queryFromCurrent || currentCourseFamily ? 'current_message' : (resolvedQuery ? 'history' : 'none'),
            location: hasExplicitLocationInCurrent ? 'current_message' : (resolvedLocation ? 'history' : 'none'),
            dateStart: hasExplicitDateInCurrent ? 'current_message' : (resolvedDateStart ? 'history' : 'none'),
            dateEnd: hasExplicitDateInCurrent ? 'current_message' : (resolvedDateEnd ? 'history' : 'none'),
          } as const;

          if (topicChanged && !hasExplicitLocationInCurrent && resolvedLocation) {
            resolvedLocation = undefined;
          }

          console.log("Executing Tool: searchCourses");
          console.log("   Query:", resolvedQuery);
          console.log("   Location:", resolvedLocation);
          console.log("   Date Start:", resolvedDateStart);
          console.log("   Date End:", resolvedDateEnd);
          console.log("   Topic Changed:", topicChanged);

          let dateInfo = "Anytime";
          if (resolvedDateStart || resolvedDateEnd) dateInfo = `${resolvedDateStart || ''} to ${resolvedDateEnd || ''}`;
          analytics.logSearch(resolvedQuery, dateInfo);

          const searchResult = searchLocalCourses(allCourses, {
            query: resolvedQuery,
            location: resolvedLocation,
            dateStart: resolvedDateStart,
            dateEnd: resolvedDateEnd,
            criteriaSource,
          });

          console.log("   Results found:", searchResult.courses?.length || 0);
          console.log("   Search message:", searchResult.message);
          console.log("   Applied criteria:", searchResult.applied_criteria);
          if (searchResult.courses && searchResult.courses.length > 0) {
            console.log("   First 3 course IDs:", searchResult.courses.slice(0, 3).map((c: any) => c.id));
          }

          functionResponses.push({
            functionResponse: {
              name: 'searchCourses',
              id: call.id,
              response: { result: searchResult }
            }
          });
        }
        // HANDLER 2: DETAILS
        if (call.name === 'getCourseDetails' && call.args) {
          const args = call.args as any;
          console.log("Executing Tool: getCourseDetails", args);

          // --- ANALYTICS TRACKING ---
          analytics.logSearch(args.courseType, "Content Query");
          // --------------------------

          const detailResult = getCourseDetails(args.courseType);
          functionResponses.push({
            functionResponse: {
              name: 'getCourseDetails',
              id: call.id,
              response: { result: detailResult }
            }
          });
        }
      }

      // Add the function result to history
      contents.push({
        role: "user",
        parts: functionResponses
      });

      // 5. Final API Call: Get the actual text response with JSON schema (WITH RETRY)
      response = await generateWithRetry(client, {
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.2,
        },
      });
    } else {
      // Fallback for simple chat or if no tools were called
      const text = response.text || "";
      if (!text.trim().startsWith('{')) {
        response = await generateWithRetry(client, {
          model: "gemini-2.5-flash",
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.2,
          },
        });
      }
    }

    const textResponse = response.text;
    if (!textResponse) throw new Error("Empty response from AI");

    const parsed: AIResponseSchema = JSON.parse(textResponse);
    const lastFunctionResponse = contents
      .slice().reverse()
      .find(c => c.role === 'user' && c.parts?.some((p: any) => p.functionResponse?.name === 'searchCourses'));
    const searchPart = lastFunctionResponse?.parts?.find((p: any) => p.functionResponse?.name === 'searchCourses');
    const lastSearchResult = searchPart?.functionResponse?.response?.result;
    const lastSearchMessage = lastSearchResult?.message || '';
    const appliedCriteria = lastSearchResult?.applied_criteria || {};

    const stronglyClaimsFindingCourses = parsed.reply.toLowerCase().includes('i found the following') ||
      parsed.reply.toLowerCase().includes('here are the') ||
      parsed.reply.toLowerCase().includes('these courses') ||
      parsed.reply.toLowerCase().includes('iata cateva optiuni') ||
      parsed.reply.toLowerCase().includes('am gasit') ||
      parsed.reply.toLowerCase().includes('acestea sunt');

    if (!parsed.suggested_course_ids || parsed.suggested_course_ids.length === 0) {
      if (lastSearchResult?.courses && Array.isArray(lastSearchResult.courses) && lastSearchResult.courses.length > 0) {
        console.warn('AI found courses via tool but failed to include IDs. Auto-recovering IDs.');
        parsed.suggested_course_ids = lastSearchResult.courses.map((c: any) => c.id);
      }
    }

    if (lastSearchMessage.includes('FALLBACK_DROPPED_STALE_LOCATION') && parsed.suggested_course_ids?.length > 0) {
      parsed.reply = userLanguage.startsWith('ro')
        ? 'Nu am gasit rezultate cu locatia anterioara, asa ca am cautat fara acea locatie. Acestea sunt cele mai relevante rezultate.'
        : 'I could not find results with the previous location, so I searched without that location. These are the best matches.';
    }

    if (lastSearchMessage.includes('FALLBACK_QUERY_RELAXED') && parsed.suggested_course_ids?.length > 0) {
      parsed.reply = userLanguage.startsWith('ro')
        ? 'Nu am gasit rezultate pe denumirea exacta, asa ca am cautat pe varianta echivalenta. Acestea sunt optiunile disponibile.'
        : 'I could not find results for the exact name, so I searched with an equivalent query. Here are the available options.';
    }

    if (lastSearchMessage.includes('FALLBACK_TO_NEAREST_DATES') && parsed.suggested_course_ids?.length > 0) {
      parsed.reply = userLanguage.startsWith('ro')
        ? 'Nu am gasit cursuri exact in perioada ceruta, dar acestea sunt urmatoarele date disponibile. Spune-mi daca vrei alta perioada.'
        : 'I could not find courses in the exact date range, but these are the next closest available dates. Let me know if you want another date range.';
    }

    if (lastSearchMessage.includes('FALLBACK_TO_ONLINE') && parsed.suggested_course_ids?.length > 0) {
      parsed.reply = userLanguage.startsWith('ro')
        ? 'Nu am gasit in zona ceruta. Acestea sunt alternativele online disponibile.'
        : 'I could not find courses in that area, but here are online alternatives.';
    }

    if (lastSearchMessage.includes('NO_RESULTS')) {
      parsed.reply = localizeNoResultsWithCriteria(userLanguage, appliedCriteria);
      parsed.suggested_course_ids = [];
    }

    if (stronglyClaimsFindingCourses && (!parsed.suggested_course_ids || parsed.suggested_course_ids.length === 0)) {
      console.warn('AI strongly claimed to find courses but returned empty IDs. Correcting response.');
      parsed.reply = localizeNoResultsWithCriteria(userLanguage, appliedCriteria);
    }

    return parsed;

  } catch (error: any) {
    console.error("Gemini API Error:", error);

    // Handle empty model output error
    if (error.message && error.message.includes('model output must contain')) {
      console.warn("Empty model output - retrying with simpler prompt");
      return {
        reply: "I didn't quite understand that. Could you please rephrase your question? For example: 'Show me SMSTS courses in London'",
        suggested_course_ids: [],
        disambiguation_options: []
      };
    }

    // Pass the specific error type back to the UI
    if (error.status === 429 || (error.message && error.message.includes('429'))) {
      throw new Error("QUOTA_EXCEEDED");
    }
    // Re-throw critical auth errors so App.tsx can handle them
    if (error.status === 403 || error.status === 400 || (error.message && (error.message.includes('API key') || error.message.includes('PERMISSION_DENIED')))) {
      throw error;
    }

    return {
      reply: "I'm experiencing high traffic right now. Please try again in a few seconds.",
      suggested_course_ids: [],
      disambiguation_options: []
    };
  }
};


